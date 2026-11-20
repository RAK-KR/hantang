// 손가락 관절이 모두 움직이는 장갑 낀 손
// 손 좌표계: 원점 = 손목, +Y = 손가락 방향, +Z = 손바닥이 향하는 쪽, 오른손은 엄지가 +X
import * as THREE from 'three';
import { ps1Mat, mesh } from './ps1.js';
import { tex } from './textures.js';

const FINGERS = [
  // 이름, x(오른손 기준), 마디 길이, 굵기
  ['i', 0.0265, [0.037, 0.024, 0.021], 0.0092],
  ['m', 0.0088, [0.041, 0.027, 0.022], 0.0096],
  ['r', -0.0088, [0.038, 0.025, 0.021], 0.0091],
  ['p', -0.0255, [0.030, 0.020, 0.018], 0.0082],
];
const SPREAD = { i: -0.22, m: -0.04, r: 0.1, p: 0.26 };

// 기본(편 손) 포즈
export const HAND_REST = {
  iB: 0.12, iD: 0.12, mB: 0.14, mD: 0.14, rB: 0.16, rD: 0.16, pB: 0.18, pD: 0.18,
  sp: 0.25, tF: 0.15, tA: 0.0, tC: 0.15,
};

function seg(len, r, mat, tip = false) {
  // 6각 기둥 – 원점에서 +Y로 len 만큼
  const g = new THREE.CylinderGeometry(r * (tip ? 0.8 : 0.93), r, len, 6, 1);
  g.translate(0, len / 2, 0);
  g.rotateY(Math.PI / 6);
  return mesh(g, mat);
}

export class Hand {
  /**
   * @param {object} o { side: 1(오른손) | -1(왼손), vm: 뷰모델 여부, glove/sleeve 색 }
   */
  constructor(o = {}) {
    const side = this.side = o.side ?? 1;
    const vm = o.vm ?? true;
    const glove = ps1Mat({ map: tex('glove'), color: o.gloveColor ?? 0xffffff, vm, spec: 0.12 });
    this.mat = glove;
    this.root = new THREE.Group();
    this.root.name = side > 0 ? 'handR' : 'handL';

    // 손바닥 – 약간 사다리꼴(손목쪽이 좁음)
    const palmG = new THREE.BoxGeometry(0.074, 0.082, 0.026, 1, 1, 1);
    const p = palmG.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < 0) p.setX(i, p.getX(i) * 0.86);
      if (p.getZ(i) < 0) p.setZ(i, p.getZ(i) * 0.8); // 손등 쪽 살짝 얇게
    }
    palmG.translate(0, 0.045, 0);
    palmG.computeVertexNormals();
    this.palm = mesh(palmG, glove);
    this.root.add(this.palm);

    // 손목 밴드(장갑 끝단)
    const cuffG = new THREE.CylinderGeometry(0.032, 0.034, 0.03, 8);
    cuffG.scale(1.08, 1, 0.62);
    cuffG.translate(0, -0.006, 0);
    this.root.add(mesh(cuffG, glove));

    // 손가락
    this.fingers = {};
    for (const [name, x, lens, r] of FINGERS) {
      const joints = [];
      let parent = this.root;
      for (let k = 0; k < 3; k++) {
        const j = new THREE.Group();
        if (k === 0) j.position.set(x * side, 0.084 + (name === 'm' ? 0.002 : name === 'p' ? -0.006 : 0), 0.002);
        else j.position.set(0, lens[k - 1], 0);
        j.add(seg(lens[k] + 0.002, r * (1 - k * 0.07), glove, k === 2));
        parent.add(j);
        parent = j;
        joints.push(j);
      }
      this.fingers[name] = joints;
    }

    // 엄지 – 고정 마운트(방향 기준) + 관절 3개
    const mount = new THREE.Group();
    mount.position.set(0.031 * side, 0.016, 0.005);
    const Y = new THREE.Vector3(0.72 * side, 0.68, 0.16).normalize();
    let Z = new THREE.Vector3(-0.55 * side, 0.18, 0.82);
    Z.sub(Y.clone().multiplyScalar(Z.dot(Y))).normalize();
    const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
    const mtx = new THREE.Matrix4().makeBasis(X, Y, Z);
    mount.quaternion.setFromRotationMatrix(mtx);
    this.root.add(mount);
    const tl = [0.034, 0.028, 0.024];
    const tr = 0.0115;
    let par = mount;
    this.thumb = [];
    for (let k = 0; k < 3; k++) {
      const j = new THREE.Group();
      if (k > 0) j.position.set(0, tl[k - 1], 0);
      const s = seg(tl[k] + 0.002, tr * (1 - k * 0.1), glove, k === 2);
      if (k === 0) s.scale.set(1.25, 1, 1.15);
      j.add(s);
      par.add(j);
      par = j;
      this.thumb.push(j);
    }
    this.pose = { ...HAND_REST };
    this.setPose(this.pose);
  }

  setPose(p) {
    const side = this.side;
    const sp = p.sp ?? 0.2;
    for (const [name] of FINGERS) {
      const B = p[name + 'B'] ?? 0.1;
      const D = p[name + 'D'] ?? 0.1;
      const j = this.fingers[name];
      j[0].rotation.set(B * 1.55, 0, SPREAD[name] * sp * side * (1 - Math.min(1, Math.max(0, B)) * 0.6));
      j[1].rotation.set(D * 1.7, 0, 0);
      j[2].rotation.set(D * 1.15, 0, 0);
    }
    const tF = p.tF ?? 0.1, tA = p.tA ?? 0, tC = p.tC ?? 0.1;
    // tF: 손바닥 쪽으로 접기(+), tA: 검지 쪽으로 붙이기(+)/벌리기(-)
    this.thumb[0].rotation.set(tF * 1.05, 0, tA * 0.7 * side);
    this.thumb[1].rotation.set(tC * 0.9, 0, 0);
    this.thumb[2].rotation.set(tC * 1.2, 0, 0);
  }
}

// 자주 쓰는 손 모양
export const HANDS = {
  rest: { ...HAND_REST },
  fist: { iB: 1, iD: 1, mB: 1, mD: 1, rB: 1, rD: 1, pB: 1, pD: 1, sp: 0, tF: 0.9, tA: 0.4, tC: 0.6 },
  grip: { iB: 0.86, iD: 0.82, mB: 0.9, mD: 0.85, rB: 0.92, rD: 0.86, pB: 0.95, pD: 0.88, sp: 0.02, tF: 0.75, tA: 0.2, tC: 0.45 },
  loose: { iB: 0.55, iD: 0.45, mB: 0.6, mD: 0.5, rB: 0.65, rD: 0.55, pB: 0.7, pD: 0.6, sp: 0.15, tF: 0.4, tA: 0.0, tC: 0.25 },
  open: { iB: 0.02, iD: 0.04, mB: 0.02, mD: 0.04, rB: 0.03, rD: 0.05, pB: 0.04, pD: 0.06, sp: 0.6, tF: 0.25, tA: 0.1, tC: 0.12 },
  flat: { iB: 0.0, iD: 0.02, mB: 0.0, mD: 0.02, rB: 0.0, rD: 0.02, pB: 0.0, pD: 0.02, sp: 0.05, tF: 0.1, tA: 0.45, tC: 0.05 },
  point: { iB: 0.0, iD: 0.02, mB: 1, mD: 1, rB: 1, rD: 1, pB: 1, pD: 1, sp: 0, tF: 0.8, tA: 0.5, tC: 0.6 },
  thumbUp: { iB: 1, iD: 1, mB: 1, mD: 1, rB: 1, rD: 1, pB: 1, pD: 1, sp: 0, tF: -0.35, tA: -0.2, tC: -0.1 },
  shush: { iB: 0.0, iD: 0.0, mB: 1, mD: 1, rB: 1, rD: 1, pB: 1, pD: 1, sp: 0, tF: 0.9, tA: 0.5, tC: 0.6 },
  // 트릭용: 검지+엄지로 세이프 핸들만 잡고 나머지는 풀어 줌
  pinch: { iB: 0.62, iD: 0.55, mB: 0.22, mD: 0.18, rB: 0.2, rD: 0.16, pB: 0.22, pD: 0.18, sp: 0.35, tF: 0.6, tA: 0.45, tC: 0.35 },
  // 칼을 받기 직전 – 반쯤 오므림
  catch: { iB: 0.45, iD: 0.4, mB: 0.5, mD: 0.42, rB: 0.52, rD: 0.45, pB: 0.55, pD: 0.48, sp: 0.2, tF: 0.35, tA: 0.1, tC: 0.2 },
  // 검지만 펴고 나머지는 말아 쥠(팬 회전 축)
  axle: { iB: 0.12, iD: 0.18, mB: 0.95, mD: 0.9, rB: 0.97, rD: 0.92, pB: 1, pD: 0.95, sp: 0.1, tF: 0.55, tA: 0.1, tC: 0.4 },
  rub: { iB: 0.35, iD: 0.3, mB: 0.4, mD: 0.35, rB: 0.85, rD: 0.9, pB: 0.9, pD: 0.9, sp: 0.0, tF: 0.55, tA: 0.55, tC: 0.2 },
};

// 두 손 모양 보간
export function mixHand(a, b, t, out = {}) {
  for (const k in a) out[k] = a[k] + ((b[k] ?? a[k]) - a[k]) * t;
  return out;
}
