// 1인칭 뷰모델 – 오른손(발리송) + 왼손(감정표현), 팔뚝은 팔꿈치 고정점까지 자동으로 이어짐
import * as THREE from 'three';
import { Hand } from './hand.js';
import { Balisong } from './balisong.js';
import { Animator } from './anim.js';
import { ps1Mat, mesh } from './ps1.js';
import { tex } from './textures.js';
import { R_BASE, L_BASE, KNIFE, IDLE_OPEN, IDLE_CLOSED } from './knifeClips.js';
import { sfx } from './audio.js';

const AX_X = new THREE.Vector3(1, 0, 0), AX_Y = new THREE.Vector3(0, 1, 0), AX_Z = new THREE.Vector3(0, 0, 1);
const AX_PIN = new THREE.Vector3(-1, 1, 0).normalize();   // 대각선 그립에서 칼 핀 축(손 좌표)
const _qa = new THREE.Quaternion(), _va = new THREE.Vector3();
const FINGER_CH = ['iB', 'iD', 'mB', 'mD', 'rB', 'rD', 'pB', 'pD', 'sp', 'tF', 'tA', 'tC'];

function makeForearm(mat) {
  // 손목(0) -> 팔꿈치(+Y) 로 뻗는 소매. 길이는 매 프레임 scale.y 로 맞춤
  const g = new THREE.CylinderGeometry(0.031, 0.04, 1, 8, 2, false);
  g.translate(0, 0.5, 0);
  g.scale(1, 1, 0.82);
  const m = mesh(g, mat);
  const grp = new THREE.Group();
  grp.add(m);
  // 소매 끝 접힘
  const cuff = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8).translate(0, 0.02, 0).scale(1, 1, 0.84), mat);
  grp.add(cuff);
  return grp;
}

export class Viewmodel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.scene.add(this.camera);
    this.root = new THREE.Group();          // 카메라 공간
    this.camera.add(this.root);
    this.sway = new THREE.Group();
    this.root.add(this.sway);

    const sleeveMat = ps1Mat({ map: tex('sleeve'), vm: true });
    // 오른팔
    this.wristR = new THREE.Group();
    this.sway.add(this.wristR);
    this.adjR = new THREE.Group();          // 손목 꺾기/튕기기(손 기준 회전)
    this.wristR.add(this.adjR);
    this.handR = new Hand({ side: 1, vm: true });
    this.adjR.add(this.handR.root);
    this.kPivot = new THREE.Group();
    this.kOff = new THREE.Group();
    this.handR.root.add(this.kPivot);
    this.kPivot.add(this.kOff);
    this.knife = new Balisong({ vm: true });
    this.kOff.add(this.knife.root);
    this.forearmR = makeForearm(sleeveMat);
    this.sway.add(this.forearmR);
    this.elbowR = new THREE.Vector3(0.44, -0.42, -0.2);

    // 왼팔
    this.wristL = new THREE.Group();
    this.sway.add(this.wristL);
    this.adjL = new THREE.Group();
    this.wristL.add(this.adjL);
    this.handL = new Hand({ side: -1, vm: true });
    this.adjL.add(this.handL.root);
    this.forearmL = makeForearm(sleeveMat);
    this.sway.add(this.forearmL);
    this.elbowL = new THREE.Vector3(-0.44, -0.42, -0.2);

    this.animR = new Animator(R_BASE);
    this.animR.wrap = ['krx', 'kry', 'krz'];
    this.animL = new Animator(L_BASE);
    this.animR.onEvent = (type, arg) => this._event(type, arg, 0.35);
    this.animL.onEvent = (type, arg) => this._event(type, arg, -0.35);

    this.open = true;          // 칼이 펼쳐진 상태인지
    this.busyR = false;
    this.busyL = false;
    this.queue = null;
    this.trickName = '';
    this.onTrick = null;       // HUD 알림
    this.onEmoteEvent = null;
    this.frozen = false;       // 검수용 – 애니메이션 정지

    this.lag = new THREE.Vector2();
    this.bobT = 0;
    this.bob = 0;
    this.crouch = 0;
    this.animR.play(IDLE_OPEN, { blend: 0 });
    this.animL.play(KNIFE.leftIdle, { blend: 0 });
    this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }

  _event(type, arg, pan) {
    if (type === 'sfx') sfx(arg.name || arg, arg.v ?? 1, pan);
    else if (type === 'open') this.open = !!arg;
    else if (this.onEmoteEvent) this.onEmoteEvent(type, arg);
  }

  get busy() { return this.busyR; }

  // ---------------- 칼 ----------------
  knifeAction(name) {
    if (this.busyR) { this.queue = name; return; }
    const t = KNIFE[name];
    if (!t) return;
    // 접혀 있는데 펼친 상태가 필요한 트릭이면 먼저 펼치고 이어서
    if (t.meta.from === 'open' && !this.open) { this.queue = name; name = 'open'; }
    if (t.meta.from === 'closed' && this.open) { this.queue = name; name = 'close'; }
    const clip = KNIFE[name];
    this.busyR = true;
    this.trickName = clip.meta.label || '';
    if (this.onTrick && clip.meta.label) this.onTrick(clip.meta.label);
    this.animR.play(clip, {
      blend: clip.meta.blend ?? 0.1,
      onEnd: () => {
        this.open = clip.meta.to === 'open';
        this.busyR = false;
        const q = this.queue; this.queue = null;
        if (q && q !== name) this.knifeAction(q);
        else this.animR.play(this.open ? IDLE_OPEN : IDLE_CLOSED, { blend: 0.12 });
      },
    });
  }
  toggleKnife() { this.knifeAction(this.open ? 'close' : 'open'); }

  // ---------------- 감정표현(1인칭 왼손) ----------------
  playLeft(clip, onEnd) {
    this.busyL = true;
    this.animL.play(clip, {
      blend: 0.12,
      onEnd: () => {
        this.busyL = false;
        this.animL.play(KNIFE.leftIdle, { blend: 0.2 });
        if (onEnd) onEnd();
      },
    });
  }
  // 오른손도 쓰는 감정표현 – 칼은 그대로 쥔 채
  playRight(clip) {
    if (this.busyR) return;
    this.busyR = true;
    this.animR.play(clip, {
      blend: 0.12,
      onEnd: () => { this.busyR = false; this.animR.play(this.open ? IDLE_OPEN : IDLE_CLOSED, { blend: 0.2 }); },
    });
  }
  stopLeft() {
    if (!this.busyL) return;
    this.busyL = false;
    this.animL.play(KNIFE.leftIdle, { blend: 0.2 });
  }

  // ---------------- 매 프레임 ----------------
  update(dt, ctx) {
    const pr = this.frozen ? this.animR.update(0) : this.animR.update(dt);
    const pl = this.frozen ? this.animL.update(0) : this.animL.update(dt);
    this._apply(pr, pl);

    // 흔들림: 걷기 보빙 + 시선 지연 + 숨쉬기
    const sp = ctx.speed || 0;
    this.bobT += dt * (ctx.running ? 11 : 8) * Math.min(1, sp / 2);
    const amt = Math.min(1, sp / 4) * (ctx.grounded ? 1 : 0.2);
    this.bob += (amt - this.bob) * Math.min(1, dt * 8);
    const bx = Math.sin(this.bobT) * 0.012 * this.bob;
    const by = -Math.abs(Math.cos(this.bobT)) * 0.012 * this.bob;
    const tgx = THREE.MathUtils.clamp(-(ctx.lookDX || 0) * 0.0009, -0.06, 0.06);
    const tgy = THREE.MathUtils.clamp((ctx.lookDY || 0) * 0.0009, -0.06, 0.06);
    this.lag.x += (tgx - this.lag.x) * Math.min(1, dt * 10);
    this.lag.y += (tgy - this.lag.y) * Math.min(1, dt * 10);
    const br = Math.sin(performance.now() * 0.0012) * 0.003;
    this.sway.position.set(bx + this.lag.x * 0.5, by + br + this.lag.y * 0.4 - this.crouch * 0.01, 0);
    this.sway.rotation.set(this.lag.y * 0.8, this.lag.x * 1.2, -this.lag.x * 0.6 + bx * 0.5);

    this._forearm(this.wristR, this.handR, this.forearmR, this.elbowR);
    this._forearm(this.wristL, this.handL, this.forearmL, this.elbowL);
  }

  _adj(g, p, flAxis) {
    // tw: 팔뚝 비틀기(손 Y축)  fx: 손목 굽힘(손 X축)  fl: 튕기기(칼 핀 축 / 왼손은 손바닥 축)
    const q = g.quaternion;
    q.setFromAxisAngle(AX_Y, p.tw || 0);
    _qa.setFromAxisAngle(AX_X, p.fx || 0); q.multiply(_qa);
    _qa.setFromAxisAngle(flAxis, p.fl || 0); q.multiply(_qa);
  }

  _apply(pr, pl) {
    this.wristR.position.set(pr.x, pr.y, pr.z);
    this.wristR.rotation.set(pr.rx, pr.ry, pr.rz);
    this._adj(this.adjR, pr, AX_PIN);
    this.handR.setPose(pr);
    this.kPivot.position.set(pr.kpx, pr.kpy, pr.kpz);
    // 카메라 공간 오프셋(공중에 던질 때) -> 손 좌표로 변환해서 더함
    if (pr.cx || pr.cy || pr.cz) {
      _qa.copy(this.wristR.quaternion).multiply(this.adjR.quaternion).invert();
      _va.set(pr.cx, pr.cy, pr.cz).applyQuaternion(_qa);
      this.kPivot.position.add(_va);
    }
    this.kPivot.rotation.set(pr.krx, pr.kry, pr.krz);
    this.kOff.position.set(pr.kox, pr.koy, pr.koz);
    this.knife.set(pr.a, pr.b);
    this.knife.root.visible = pr.kv > 0.5;

    this.wristL.position.set(pl.x, pl.y, pl.z);
    this.wristL.rotation.set(pl.rx, pl.ry, pl.rz);
    this._adj(this.adjL, pl, AX_Z);
    this.handL.setPose(pl);
    this.wristL.visible = this.forearmL.visible = pl.y > -0.6;
  }

  _forearm(wrist, hand, fa, elbow) {
    // 손목에서 팔꿈치 쪽으로 – 손 기준 아래(-Y) 방향으로 살짝 빼서 팔꿈치와 섞음
    wrist.updateMatrix();
    const w = wrist.position;
    const handDown = this._v2.set(0, -1, 0).applyQuaternion(wrist.children[0].quaternion).applyQuaternion(wrist.quaternion);
    const target = this._v.copy(elbow).addScaledVector(handDown, 0.07);
    const dir = target.sub(w);
    const len = dir.length();
    dir.normalize();
    const Y = dir;
    const hz = new THREE.Vector3(0, 0, 1).applyQuaternion(wrist.quaternion);
    const Z = hz.sub(Y.clone().multiplyScalar(hz.dot(Y))).normalize();
    const X = new THREE.Vector3().crossVectors(Y, Z);
    const m = new THREE.Matrix4().makeBasis(X, Y, Z);
    fa.quaternion.setFromRotationMatrix(m);
    fa.position.copy(w).addScaledVector(Y, -0.012);
    fa.children[0].scale.y = Math.max(0.3, len + 0.25);
  }

  setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }

  // 검수용: 특정 클립의 특정 시간 포즈로 고정
  preview(side, clip, t) {
    const an = side === 'L' ? this.animL : this.animR;
    an.play(clip, { blend: 0, hold: true });
    an.time = 0;
    an.update(t);
    this.frozen = true;
  }
}

export { FINGER_CH };
