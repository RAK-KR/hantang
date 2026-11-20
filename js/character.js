// 3인칭 캐릭터(복면 강도) – 관절 리그 + 손가락까지 움직이는 손
// 캐릭터는 +Z 를 바라봄. 채널 값은 '자연스러운 방향이 +' 가 되도록 코드에서 부호를 맞춤
import * as THREE from 'three';
import { ps1Mat, mesh } from './ps1.js';
import { tex } from './textures.js';
import { Hand, HANDS } from './hand.js';
import { Balisong } from './balisong.js';
import { Animator, clipFromPoses } from './anim.js';

const FINGER = ['iB', 'iD', 'mB', 'mD', 'rB', 'rD', 'pB', 'pD', 'sp', 'tF', 'tA', 'tC'];

export const BODY_BASE = {
  hx: 0, hy: 0, hrx: 0, hry: 0, hrz: 0,
  srx: 0.03, sry: 0, srz: 0,
  nrx: 0, nry: 0, nrz: 0,
  luX: 0.05, luY: 0, luZ: 0.12, leX: 0.2, lwX: 0, lwY: 0, lwZ: 0,
  ruX: 0.05, ruY: 0, ruZ: 0.12, reX: 0.25, rwX: 0, rwY: 0, rwZ: 0,
  ltX: 0, ltZ: 0.04, lkX: 0, lfX: 0,
  rtX: 0, rtZ: 0.04, rkX: 0, rfX: 0,
};
for (const c of FINGER) { BODY_BASE['L' + c] = HANDS.loose[c]; BODY_BASE['R' + c] = HANDS.grip[c]; }

function part(geo, mat, ty = 0) {
  geo.translate(0, ty, 0);
  return mesh(geo, mat);
}
function limb(len, r0, r1, mat, sides = 6) {
  // 원점에서 -Y 로 뻗는 팔다리
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1);
  g.translate(0, -len / 2, 0);
  return mesh(g, mat);
}

export class Character {
  constructor(o = {}) {
    const jacket = ps1Mat({ map: tex(o.jacketTex || 'sleeve'), color: o.jacket ?? 0xffffff });
    const jeans = ps1Mat({ map: tex('jeans') });
    const knit = ps1Mat({ map: tex('knit') });
    const shoe = ps1Mat({ map: tex('sneaker') });
    const maskMat = ps1Mat({ map: tex('mask') });
    this.root = new THREE.Group();
    this.root.name = 'character';

    this.hips = new THREE.Group(); this.hips.position.y = 0.92; this.root.add(this.hips);
    this.hips.add(part(new THREE.BoxGeometry(0.34, 0.16, 0.2), jeans, 0.0));

    this.spine = new THREE.Group(); this.spine.position.y = 0.06; this.hips.add(this.spine);
    // 상체(점퍼) – 위가 넓은 사다리꼴
    const chestG = new THREE.BoxGeometry(0.4, 0.48, 0.24, 1, 2, 1);
    const cp = chestG.attributes.position;
    for (let i = 0; i < cp.count; i++) if (cp.getY(i) < 0) { cp.setX(i, cp.getX(i) * 0.86); cp.setZ(i, cp.getZ(i) * 0.92); }
    chestG.computeVertexNormals();
    this.spine.add(part(chestG, jacket, 0.24));
    // 지퍼 라인
    const zip = mesh(new THREE.BoxGeometry(0.012, 0.44, 0.005), ps1Mat({ color: 0x8a8a7a }));
    zip.position.set(0, 0.24, 0.122); this.spine.add(zip);

    this.neck = new THREE.Group(); this.neck.position.y = 0.47; this.spine.add(this.neck);
    this.neck.add(part(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 6), knit, 0.03));
    this.head = new THREE.Group(); this.head.position.y = 0.06; this.neck.add(this.head);
    const headG = new THREE.BoxGeometry(0.22, 0.26, 0.24);
    headG.translate(0, 0.13, 0);
    const hm = new THREE.Mesh(headG, [knit, knit, knit, knit, maskMat, knit]);
    headG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(headG.attributes.position.count * 3).fill(1), 3));
    this.head.add(hm);
    // 비니 꼭지
    this.head.add(part(new THREE.CylinderGeometry(0.03, 0.05, 0.05, 6), knit, 0.28));

    // 팔
    this.arm = {};
    for (const side of [1, -1]) {
      const key = side > 0 ? 'l' : 'r';
      const sh = new THREE.Group(); sh.position.set(0.235 * side, 0.43, 0); this.spine.add(sh);
      sh.add(part(new THREE.SphereGeometry(0.065, 6, 4), jacket));
      sh.add(limb(0.29, 0.06, 0.05, jacket));
      const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
      el.add(limb(0.25, 0.05, 0.042, jacket));
      const wr = new THREE.Group(); wr.position.y = -0.25; el.add(wr);
      const mount = new THREE.Group();
      // 팔을 내렸을 때: 손가락 아래, 손바닥은 몸 안쪽, 엄지는 앞
      const X = side > 0 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
      const Y = new THREE.Vector3(0, -1, 0);
      const Z = new THREE.Vector3().crossVectors(X, Y);
      mount.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
      mount.position.y = -0.005;
      wr.add(mount);
      const hand = new Hand({ side: -side, vm: false });  // 캐릭터 왼쪽(+X) = 왼손
      hand.root.scale.setScalar(1.12);
      mount.add(hand.root);
      this.arm[key] = { sh, el, wr, hand };
    }
    // 오른손 칼
    this.knife = new Balisong({ vm: false });
    const kp = new THREE.Group();
    kp.position.set(0.052, 0.064, 0.03); kp.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    kp.add(this.knife.root);
    this.arm.r.hand.root.add(kp);
    this.knife.set(0, 0);

    // 다리
    this.leg = {};
    for (const side of [1, -1]) {
      const key = side > 0 ? 'l' : 'r';
      const hp = new THREE.Group(); hp.position.set(0.1 * side, -0.04, 0); this.hips.add(hp);
      hp.add(limb(0.43, 0.085, 0.065, jeans));
      const kn = new THREE.Group(); kn.position.y = -0.43; hp.add(kn);
      kn.add(limb(0.41, 0.065, 0.05, jeans));
      const an = new THREE.Group(); an.position.y = -0.41; kn.add(an);
      const foot = part(new THREE.BoxGeometry(0.11, 0.08, 0.25), shoe, 0);
      foot.position.set(0, -0.04, 0.06);
      an.add(foot);
      this.leg[key] = { hp, kn, an };
    }

    this.anim = new Animator(BODY_BASE);
    this.anim.play(BODY_IDLE, { blend: 0 });
    this.pose = this.anim.pose;
    this._hp = {};
  }

  apply(p) {
    this.hips.position.y = 0.92 + p.hy;
    this.hips.position.x = p.hx;
    this.hips.rotation.set(p.hrx, p.hry, p.hrz);
    this.spine.rotation.set(p.srx, p.sry, p.srz);
    this.neck.rotation.set(p.nrx * 0.4, p.nry * 0.4, p.nrz * 0.4);
    this.head.rotation.set(p.nrx * 0.6, p.nry * 0.6, p.nrz * 0.6);
    for (const [k, s] of [['l', 1], ['r', -1]]) {
      const a = this.arm[k];
      a.sh.rotation.set(-p[k + 'uX'], p[k + 'uY'] * s, p[k + 'uZ'] * s, 'XZY');
      a.el.rotation.set(-p[k + 'eX'], 0, 0);
      a.wr.rotation.set(p[k + 'wX'], p[k + 'wY'] * s, p[k + 'wZ'] * s);
      const hp = this._hp;
      const pre = k === 'l' ? 'L' : 'R';
      for (const c of FINGER) hp[c] = p[pre + c];
      a.hand.setPose(hp);
      const g = this.leg[k];
      g.hp.rotation.set(-p[k + 'tX'], 0, p[k + 'tZ'] * s);
      g.kn.rotation.set(p[k + 'kX'], 0, 0);
      g.an.rotation.set(-p[k + 'fX'], 0, 0);
    }
  }
  update(dt) {
    const p = this.anim.update(dt);
    this.apply(p);
  }
}

// ---------- 기본 동작 ----------
export const BODY_IDLE = clipFromPoses({
  name: 'bodyIdle', duration: 3.2, loop: true,
  poses: [
    [0, { srx: 0.03, hy: 0, luX: 0.05, ruX: 0.05, nrx: 0 }],
    [1.6, { srx: 0.05, hy: -0.004, luX: 0.07, ruX: 0.07, nrx: 0.03 }],
    [3.2, { srx: 0.03, hy: 0, luX: 0.05, ruX: 0.05, nrx: 0 }],
  ],
});

export const BODY_WALK = clipFromPoses({
  name: 'bodyWalk', duration: 1.0, loop: true,
  poses: [
    [0, { ltX: 0.45, lkX: 0.1, rtX: -0.35, rkX: 0.25, luX: -0.3, ruX: 0.35, leX: 0.25, reX: 0.45, hy: -0.02, srx: 0.06, lfX: 0.1, rfX: -0.2 }],
    [0.25, { ltX: 0.1, lkX: 0.15, rtX: 0.05, rkX: 0.7, hy: 0.0, rfX: 0.0 }],
    [0.5, { ltX: -0.35, lkX: 0.25, rtX: 0.45, rkX: 0.1, luX: 0.35, ruX: -0.3, leX: 0.45, reX: 0.25, hy: -0.02, lfX: -0.2, rfX: 0.1 }],
    [0.75, { ltX: 0.05, lkX: 0.7, rtX: 0.1, rkX: 0.15, hy: 0.0, lfX: 0.0 }],
    [1.0, { ltX: 0.45, lkX: 0.1, rtX: -0.35, rkX: 0.25, luX: -0.3, ruX: 0.35, leX: 0.25, reX: 0.45, hy: -0.02, lfX: 0.1, rfX: -0.2 }],
  ],
});
