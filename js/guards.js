// 경비 AI + CCTV
// 경비 상태: patrol(순찰) → suspicious(뭐지?) → investigate(확인하러 감) → search(두리번) → alert(추격) → attack
//           sleep(졸기) / down(기절)
// 감지: 시야각 + 거리 + 가림 + 플레이어 노출도(조명, 앉기, 움직임) / 소리(heist.noise)
import * as THREE from 'three';
import { Character, BODY_IDLE, BODY_WALK, BODY_RUN, BODY_SWING, BODY_LOOK, BODY_SLEEP, BODY_ALERT, BODY_DOWN } from './character.js';
import { sightBlocked, collideCircle } from './nav.js';
import { shared } from './ps1.js';
import { ps1Mat, mesh } from './ps1.js';
import { sfx } from './audio.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const FOV = THREE.MathUtils.degToRad(55);      // 정면 시야(반각)
const FOV_SIDE = THREE.MathUtils.degToRad(85); // 곁눈질
const LINES = {
  sus: ['어?', '뭐지?', '방금 뭐가...', '누구 있어요?'],
  calm: ['기분 탓인가...', '고양이였나', '야근하다 헛것 보네', '...아무것도 아니네'],
  alert: ['거기 서!', '도둑이야!', '야 너 뭐야!', '꼼짝 마!'],
  lost: ['어디 갔지...', '숨어 봐야 소용없어!', '분명 이쪽인데'],
  body: ['김 씨?! 일어나 봐!', '누가 쓰러졌다!'],
  wake: ['으음... 뭐야?', '나 안 잤어!', '응? 무슨 소리야'],
  hit: ['악!', '윽!', '이게!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Guard {
  constructor(heist, o) {
    this.h = heist;
    this.name = o.name;
    this.char = new Character({ jacketTex: 'uniform', pantsTex: 'slacks', headTex: 'skin', faceTex: 'face', shoeTex: 'slacks', cap: true, weapon: 'baton', flashlight: !!o.flashSlot || o.flashSlot === 0 });
    heist.scene.add(this.char.root);
    this.pos = new THREE.Vector3(o.pos[0], 0, o.pos[1]);
    this.yaw = o.yaw ?? 0;
    this.route = (o.route || []).map(([x, z, wait = 1.2, look]) => ({ p: new THREE.Vector3(x, 0, z), wait, look }));
    this.ri = 0;
    this.flashSlot = o.flashSlot;
    this.state = o.sleeping ? 'sleep' : 'patrol';
    this.sus = 0;
    this.last = new THREE.Vector3();
    this.path = [];
    this.timer = 0;
    this.hp = 3;
    this.seeing = false;
    this.seeT = 0;
    this.lostT = 0;
    this.attackCd = 0;
    this.foundBody = null;
    this.speed = 0;
    this.downT = 0;
    this.lookYaw = null;
    this.reported = false;
    this.char.anim.play(o.sleeping ? BODY_SLEEP : BODY_IDLE, { blend: 0 });
    // 손전등 빛줄기(눈에 보이는 원뿔)
    if (this.char.flash) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 5, 10, 1, true).translate(0, -2.5, 0).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.028, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      cone.position.z = 0.15;
      this.char.flash.add(cone);
      this.beam = cone;
    }
    this.bubbleT = 0;
  }

  get awake() { return this.state !== 'sleep' && this.state !== 'down'; }
  get eye() { return _v.set(this.pos.x, 1.62, this.pos.z); }
  get forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  say(text, force = false) {
    if (!force && this.bubbleT > 0) return;
    this.bubbleT = 1.6;
    this.h.hud.bubble(text, 0, 0, 'g_' + this.name);
  }

  // 플레이어(또는 지점)가 보이는지와 보이는 정도(0~)
  canSee(target, maxDist = 13) {
    const eye = new THREE.Vector3(this.pos.x, 1.62, this.pos.z);
    const d = eye.distanceTo(target);
    if (d > maxDist) return 0;
    _v2.copy(target).sub(eye); _v2.y = 0; _v2.normalize();
    const ang = Math.acos(THREE.MathUtils.clamp(_v2.dot(this.forward), -1, 1));
    if (ang > FOV_SIDE) return 0;
    if (sightBlocked(this.h.world, eye, target)) return 0;
    const side = ang > FOV ? 0.35 : 1;
    const near = d < 2.2 ? 3 : 1;
    return side * near * Math.pow(1 - d / maxDist, 1.1);
  }

  hear(pos, radius, loud = 1) {
    if (this.state === 'down') return;
    const d = this.pos.distanceTo(pos);
    let r = radius * (this.state === 'sleep' ? 0.55 : 1);
    if (sightBlocked(this.h.world, new THREE.Vector3(pos.x, 1.2, pos.z), new THREE.Vector3(this.pos.x, 1.5, this.pos.z))) r *= 0.6;
    if (d > r) return;
    const k = (1 - d / r) * 0.7 + 0.25;
    if (this.state === 'sleep') {
      this.sus += k * loud * 0.9;
      if (this.sus > 0.6) { this.wake(pos); }
      return;
    }
    this.sus = Math.min(1.2, this.sus + k * loud * 0.55);
    if (this.state !== 'alert' && this.state !== 'attack') {
      this.last.copy(pos);
      if (this.state === 'patrol' || this.state === 'search' || this.state === 'return') this.toSuspicious();
      else if (this.state === 'investigate') this.path = this.h.nav.path(this.pos, this.last);
    }
  }

  wake(pos) {
    this.state = 'suspicious';
    this.timer = 1.4;
    this.last.copy(pos);
    this.char.anim.play(BODY_ALERT, { blend: 0.1 });
    this.say(pick(LINES.wake), true);
    sfx('pat', 0.4);
  }

  toSuspicious() {
    if (this.state === 'suspicious') return;
    this.state = 'suspicious';
    this.timer = 0.9;
    this.path = [];
    this.say(pick(LINES.sus));
    sfx('ui', 0.25);
  }
  toAlert() {
    if (this.state === 'alert' || this.state === 'attack' || this.state === 'down') return;
    const first = this.state !== 'search';
    this.state = 'alert';
    this.sus = 1.2;
    this.lostT = 0;
    this.path = [];
    this.repath = 0;
    if (first) { this.char.anim.play(BODY_ALERT, { blend: 0.08 }); this.say(pick(LINES.alert), true); sfx('pat', 0.6); }
    this.h.onSpotted(this);
  }

  knockout() {
    if (this.state === 'down') return;
    this.state = 'down';
    this.downT = 0;
    this.sus = 0;
    this.h.hud.bubble('ZZZ...', 0, 0, 'g_' + this.name);
    this.char.anim.play(BODY_DOWN, { blend: 0.15 });
    if (this.flashSlot !== undefined) shared.uPointColor.value[this.flashSlot].setRGB(0, 0, 0);
    if (this.beam) this.beam.visible = false;
  }
  // 플레이어 공격을 맞음 – 몰래(눈치 못 챈 상태)면 한 방에 기절
  hit(sneak) {
    if (this.state === 'down') return;
    if (sneak) { this.knockout(); return true; }
    this.hp--;
    this.say(pick(LINES.hit), true);
    if (this.hp <= 0) { this.knockout(); return true; }
    this.last.copy(this.h.player.pos);
    this.toAlert();
    this.attackCd = Math.max(this.attackCd, 0.5);
    return false;
  }
  unaware() {
    return (this.state === 'patrol' || this.state === 'sleep' || this.state === 'return' || (this.state === 'investigate' && !this.seeing) || (this.state === 'search' && !this.seeing)) && this.sus < 0.9;
  }

  // 이동: 경로를 따라 걷기/뛰기
  moveTo(target, speed, dt) {
    if (!this.path.length || this.pathTarget?.distanceTo(target) > 0.6) {
      this.path = this.h.nav.path(this.pos, target);
      this.pathTarget = target.clone();
    }
    const next = this.path[0];
    if (!next) return true;
    _v.copy(next).sub(this.pos); _v.y = 0;
    const d = _v.length();
    if (d < 0.25) { this.path.shift(); return this.path.length === 0; }
    _v.normalize();
    this.turnTo(Math.atan2(_v.x, _v.z), dt, 6);
    const step = Math.min(d, speed * dt);
    this.pos.addScaledVector(_v, step);
    collideCircle(this.h.world, this.pos, 0.3);
    this.speed = speed;
    return false;
  }
  turnTo(y, dt, rate = 5) {
    let d = y - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * rate);
  }

  update(dt) {
    const h = this.h, P = h.player;
    this.bubbleT -= dt;
    this.attackCd -= dt;
    this.speed = 0;
    if (this.state === 'down') {
      this.downT = Math.min(1, this.downT + dt * 2.2);
      this.render(dt);
      return;
    }

    // ---- 시야 ----
    this.seeing = false;
    let rate = 0;
    if (this.awake && !h.ended) {
      const ph = P.eye - 0.35;
      const tp = new THREE.Vector3(P.pos.x, ph, P.pos.z);
      let v = this.canSee(tp, this.state === 'alert' ? 16 : 12);
      if (!v) v = this.canSee(new THREE.Vector3(P.pos.x, 0.45, P.pos.z), 12) * 0.6;
      if (v > 0) {
        this.seeing = true;
        const exposure = h.exposure;          // 0.15 ~ 1.2
        rate = v * exposure * 1.9;
        this.last.copy(P.pos);
      }
      // 쓰러진 동료 발견
      if (!this.foundBody && this.state !== 'alert' && this.state !== 'attack') {
        for (const g of h.guards) {
          if (g === this || g.state !== 'down') continue;
          if (this.canSee(new THREE.Vector3(g.pos.x, 0.3, g.pos.z), 12) > 0) {
            this.foundBody = g;
            this.last.copy(g.pos);
            this.state = 'investigate';
            this.path = [];
            this.say(pick(LINES.body), true);
            sfx('pat', 0.5);
            break;
          }
        }
      }
    }
    if (rate > 0) this.sus = Math.min(1.2, this.sus + rate * dt);
    else if (this.state !== 'alert') this.sus = Math.max(0, this.sus - dt * (this.state === 'patrol' ? 0.18 : 0.1));
    if (this.awake && this.sus >= 1 && this.state !== 'alert' && this.state !== 'attack') this.toAlert();
    else if (this.state === 'patrol' && this.sus >= 0.35) { this.toSuspicious(); }

    // ---- 상태 ----
    switch (this.state) {
      case 'sleep':
        if (this.sus > 0.55) this.wake(P.pos);
        break;
      case 'patrol': {
        const wp = this.route[this.ri];
        if (!wp) break;
        if (this.timer > 0) {
          this.timer -= dt;
          if (wp.look !== undefined) this.turnTo(wp.look, dt, 2.5);
          if (this.timer <= 0) this.ri = (this.ri + 1) % this.route.length;
        } else if (this.moveTo(wp.p, 1.35, dt)) { this.timer = wp.wait; this.path = []; }
        break;
      }
      case 'return': {
        const wp = this.route[this.ri];
        if (!wp || this.moveTo(wp.p, 1.35, dt)) { this.state = 'patrol'; this.timer = 0.3; this.path = []; }
        break;
      }
      case 'suspicious':
        _v.copy(this.last).sub(this.pos);
        this.turnTo(Math.atan2(_v.x, _v.z), dt, 4);
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'investigate'; this.path = []; }
        break;
      case 'investigate':
        if (this.moveTo(this.last, this.foundBody ? 2.6 : 1.6, dt)) {
          if (this.foundBody) {
            // 쓰러진 동료 확인 → 경보
            this.say('침입자다! 경보 울려!', true);
            h.raiseAlarm('body');
            this.foundBody = null;
            this.state = 'search';
            this.timer = 5;
          } else { this.state = 'search'; this.timer = 3.5; }
          this.path = [];
        }
        break;
      case 'search':
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.sus < 0.3) { this.say(pick(LINES.calm)); this.state = 'return'; this.path = []; }
          else { this.timer = 2; }
        }
        break;
      case 'alert': {
        if (this.seeing) { this.lostT = 0; this.seeT += dt; } else { this.lostT += dt; this.seeT = 0; }
        if (this.seeT > 2.2 && !h.alarm) { this.say('여기 침입자! 지원 바람!', true); h.raiseAlarm('guard'); }
        const target = this.seeing ? P.pos : this.last;
        const d = this.pos.distanceTo(P.pos);
        if (this.seeing && d < 1.35 && this.attackCd <= 0) {
          this.state = 'attack'; this.timer = 0; this.hitDone = false;
          this.char.anim.play(BODY_SWING, { blend: 0.06 });
          sfx('swish', 0.6);
          break;
        }
        if (this.seeing && d < 1.1) { _v.copy(P.pos).sub(this.pos); this.turnTo(Math.atan2(_v.x, _v.z), dt, 10); }
        else this.moveTo(target, h.alarm ? 4.4 : 4.0, dt);
        if (this.lostT > 6) {
          this.say(pick(LINES.lost));
          this.state = 'search'; this.timer = 6; this.sus = 0.8;
        }
        break;
      }
      case 'attack': {
        this.timer += dt;
        _v.copy(P.pos).sub(this.pos);
        this.turnTo(Math.atan2(_v.x, _v.z), dt, 8);
        if (!this.hitDone && this.timer > 0.32) {
          this.hitDone = true;
          const d = this.pos.distanceTo(P.pos);
          _v.normalize();
          if (d < 1.75 && _v.dot(this.forward) > 0.5) h.damagePlayer(18, this);
          else sfx('swish', 0.4);
        }
        if (this.timer > 0.75) { this.state = 'alert'; this.attackCd = 0.55; }
        break;
      }
    }
    this.render(dt);
  }

  render(dt) {
    const c = this.char;
    // 애니메이션 선택
    let want;
    if (this.state === 'down') want = BODY_DOWN;
    else if (this.state === 'sleep') want = BODY_SLEEP;
    else if (this.state === 'attack') want = BODY_SWING;
    else if (this.speed > 3) want = BODY_RUN;
    else if (this.speed > 0.2) want = BODY_WALK;
    else if (this.state === 'search' || (this.state === 'patrol' && this.timer > 0 && this.route[this.ri]?.look === undefined)) want = BODY_LOOK;
    else want = BODY_IDLE;
    const a = c.anim;
    const busyAlert = a.clip === BODY_ALERT && a.playing;
    if (a.clip !== want && !busyAlert) a.play(want, { blend: 0.2 });
    a.speed = want === BODY_WALK ? THREE.MathUtils.clamp(this.speed / 1.4, 0.7, 1.5) : 1;
    c.update(dt);
    // 손전등 든 왼팔(누워 있거나 잘 땐 제외)
    if (c.flash && this.state !== 'down' && this.state !== 'sleep') {
      c.arm.l.sh.rotation.set(-1.15, 0, -0.15, 'XZY');
      c.arm.l.el.rotation.set(-0.45, 0, 0);
    }
    c.root.position.copy(this.pos);
    c.root.rotation.set(0, this.yaw, 0);
    if (this.state === 'down') {
      // 뒤로 넘어져 눕기
      const e = this.downT * this.downT * (3 - 2 * this.downT);
      c.root.rotation.x = -Math.PI / 2 * e;
      c.root.position.y = 0.12 * e;
      c.root.position.addScaledVector(this.forward, -0.15 * e);
    }
    // 손전등 빛
    if (c.flash && this.flashSlot !== undefined) {
      const on = this.state !== 'down' && this.state !== 'sleep';
      if (this.beam) this.beam.visible = on;
      c.root.updateMatrixWorld(true);
      // 손전등 방향을 시선 방향으로 맞춤
      const dir = this.forward.clone(); dir.y = -0.18; dir.normalize();
      const parentQ = c.flash.parent.getWorldQuaternion(_q).invert();
      c.flash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir).premultiply(parentQ);
      c.flash.getWorldPosition(_v2);
      this.flashPos = _v2.clone();
      this.flashDir = dir;
      const L = shared.uPointPos.value[this.flashSlot];
      L.copy(_v2).addScaledVector(dir, 1.6);
      if (on) shared.uPointColor.value[this.flashSlot].setRGB(0.85, 0.8, 0.62);
      else shared.uPointColor.value[this.flashSlot].setRGB(0, 0, 0);
      shared.uPointRange.value[this.flashSlot] = 5.5;
    }
  }

  // 손전등이 플레이어를 비추는 정도(노출도에 더함)
  flashOn(p) {
    if (!this.flashPos || this.state === 'down' || this.state === 'sleep') return 0;
    _v.copy(p).sub(this.flashPos);
    const d = _v.length();
    if (d > 9) return 0;
    _v.normalize();
    const c = _v.dot(this.flashDir);
    if (c < 0.9) return 0;
    if (sightBlocked(this.h.world, this.flashPos, p)) return 0;
    return (1 - d / 9) * ((c - 0.9) / 0.1) * 1.1;
  }
}

// ------------------------------------------------------------------
// CCTV – 좌우로 돌며 감시, 다 차면 경보
// ------------------------------------------------------------------
export class Cctv {
  constructor(heist, o) {
    this.h = heist;
    this.name = o.name;
    this.pos = new THREE.Vector3(...o.pos);
    this.base = o.yaw;
    this.sweep = o.sweep ?? 0.6;
    this.period = o.period ?? 8;
    this.pitch = o.pitch ?? -0.45;
    this.fov = o.fov ?? 0.42;
    this.range = o.range ?? 13;
    this.meter = 0;
    this.off = false;
    this.t = Math.random() * 10;
    const g = new THREE.Group();
    g.position.copy(this.pos);
    const mount = mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), ps1Mat({ color: 0x5a5d63 }));
    mount.position.y = 0.12; g.add(mount);
    this.head = new THREE.Group(); g.add(this.head);
    const body = mesh(new THREE.BoxGeometry(0.16, 0.14, 0.34), ps1Mat({ color: 0xd8d6d0, spec: 0.3 }));
    body.position.z = 0.08; this.head.add(body);
    const lens = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8).rotateX(Math.PI / 2), ps1Mat({ color: 0x111114, spec: 1 }));
    lens.position.z = 0.26; this.head.add(lens);
    this.ledMat = ps1Mat({ color: 0xff2020, emissive: 1 });
    const led = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), this.ledMat);
    led.position.set(0.05, 0.08, 0.2); this.head.add(led);
    this.led = led;
    heist.scene.add(g);
    this.group = g;
  }
  get dir() {
    const y = this.base + Math.sin(this.t * Math.PI * 2 / this.period) * this.sweep;
    return new THREE.Vector3(Math.sin(y) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(y) * Math.cos(this.pitch));
  }
  update(dt) {
    const h = this.h;
    if (!this.off) this.t += dt;
    const y = this.base + Math.sin(this.t * Math.PI * 2 / this.period) * this.sweep;
    this.head.rotation.set(-this.pitch, y, 0, 'YXZ');
    this.led.visible = !this.off && (Math.sin(this.t * 6) > 0 || this.meter > 0.05);
    this.seeing = false;
    if (this.off || h.ended || h.alarm) { this.meter = Math.max(0, this.meter - dt); return; }
    const P = h.player;
    const tp = new THREE.Vector3(P.pos.x, P.eye - 0.35, P.pos.z);
    _v.copy(tp).sub(this.pos);
    const d = _v.length();
    let rate = 0;
    if (d < this.range) {
      _v.normalize();
      if (Math.acos(THREE.MathUtils.clamp(_v.dot(this.dir), -1, 1)) < this.fov && !sightBlocked(h.world, this.pos, tp)) {
        this.seeing = true;
        rate = (1 - d / this.range * 0.6) * h.exposure * 1.5;
      }
    }
    if (rate > 0) this.meter = Math.min(1, this.meter + rate * dt);
    else this.meter = Math.max(0, this.meter - dt * 0.25);
    if (this.meter >= 1) { h.say('CCTV에 찍혔다고?! 경보 울린다!!'); h.raiseAlarm('cctv'); }
  }
  turnOff() { this.off = true; this.meter = 0; this.led.visible = false; }
}
