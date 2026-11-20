// 버터플라이 나이프(발리송) – 실제 구조대로 손잡이 두 개가 칼날 탱의 핀 두 개에 각각 따로 돈다
// 기준(root) = 세이프 핸들(A)의 핀. A 손잡이는 root 에서 -Y 방향으로 뻗음.
//  a(알파): A 기준 칼날 각도   0 = 펼침, π = 접힘(칼날이 A 쪽으로 들어감)
//  b(베타): 칼날 기준 바이트 핸들(B) 각도   0 = 칼날과 일직선(펼침), -π = 칼날 위로 접힘
//  완전히 펼침: a=0, b=0   완전히 접힘: a=π, b=-π
import * as THREE from 'three';
import { ps1Mat, mesh } from './ps1.js';
import { tex } from './textures.js';

export const PIN = 0.0048;      // 핀이 칼날 중심선에서 떨어진 거리
const HANDLE_LEN = 0.128;
const HANDLE_W = PIN * 2 * 0.99;
const HANDLE_T = 0.0118;

function bladeGeometry() {
  const s = new THREE.Shape();
  // 칼날 좌표: +X = 날(세이프 핸들 쪽), -X = 등, +Y = 칼끝
  s.moveTo(-0.0086, -0.0072);
  s.lineTo(0.0086, -0.0072);
  s.lineTo(0.0088, 0.0062);
  s.lineTo(0.0062, 0.0098);            // 초일(손가락 홈)
  s.quadraticCurveTo(0.0068, 0.0128, 0.0088, 0.0142);
  s.lineTo(0.0088, 0.074);              // 날
  s.quadraticCurveTo(0.0086, 0.093, 0.0012, 0.1065); // 배 -> 칼끝
  s.lineTo(-0.0032, 0.088);             // 클립 포인트
  s.quadraticCurveTo(-0.0072, 0.080, -0.0086, 0.072);
  s.lineTo(-0.0086, -0.0072);           // 등
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0024, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -0.0012);
  // UV 다시: 가로 = 등->날, 세로 = 길이
  const p = g.attributes.position, uv = g.attributes.uv;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    uv.setXY(i, (x + 0.009) / 0.018, (y + 0.008) / 0.115);
    // 날 쪽 가장자리를 밝게(연마면 느낌)
    const e = x > 0.0072 && y > 0.012 ? 1.25 : 1.0;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = e;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function handleGeometry() {
  const g = new THREE.BoxGeometry(HANDLE_W, HANDLE_LEN, HANDLE_T, 1, 4, 1);
  g.translate(0, 0.0072 - HANDLE_LEN / 2, 0);
  // 끝을 살짝 둥글게
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > 0.006 || y < -0.119) { p.setZ(i, p.getZ(i) * 0.82); }
  }
  g.computeVertexNormals();
  return g;
}

export class Balisong {
  constructor(o = {}) {
    const vm = o.vm ?? true;
    this.root = new THREE.Group();
    this.root.name = 'balisong';
    const steel = ps1Mat({ map: tex('blade'), vm, spec: 0.9 });
    const hMat = ps1Mat({ map: tex('handle'), color: o.handleColor ?? 0xb8bcc6, vm, spec: 0.45 });
    const pinMat = ps1Mat({ color: 0xc9a85a, vm, spec: 0.6 });
    const latchMat = ps1Mat({ color: 0x9a9da4, vm, spec: 0.5 });

    // 세이프 핸들 A (root 자체)
    this.handleA = mesh(handleGeometry(), hMat);
    this.root.add(this.handleA);

    // 칼날: A 핀을 축으로 회전
    this.bladePivot = new THREE.Group();
    this.root.add(this.bladePivot);
    this.blade = mesh(bladeGeometry(), steel);
    this.blade.position.x = -PIN;
    this.bladePivot.add(this.blade);

    // 바이트 핸들 B: 칼날의 B 핀(칼날 중심 기준 -PIN)을 축으로 회전
    this.bPivot = new THREE.Group();
    this.bPivot.position.x = -PIN * 2;
    this.bladePivot.add(this.bPivot);
    this.handleB = mesh(handleGeometry(), hMat);
    this.bPivot.add(this.handleB);

    // 래치(바이트 핸들 끝) – 손잡이 구분용
    const latch = mesh(new THREE.BoxGeometry(HANDLE_W * 0.9, 0.016, 0.0028), latchMat);
    latch.position.set(0, -0.112, HANDLE_T / 2 + 0.0012);
    this.handleB.add(latch);
    const latchPin = mesh(new THREE.CylinderGeometry(0.0016, 0.0016, HANDLE_T + 0.004, 6).rotateX(Math.PI / 2), pinMat);
    latchPin.position.set(0, -0.106, 0);
    this.handleB.add(latchPin);

    // 핀 캡
    const capG = () => new THREE.CylinderGeometry(0.0026, 0.0026, HANDLE_T + 0.0016, 8).rotateX(Math.PI / 2);
    this.handleA.add(mesh(capG(), pinMat));
    this.handleB.add(mesh(capG(), pinMat));
    // 손잡이 끝 쪽 볼트(장식)
    for (const h of [this.handleA, this.handleB]) {
      const c = mesh(capG(), pinMat); c.scale.set(0.7, 0.7, 1); c.position.y = -0.06; h.add(c);
    }

    this.a = Math.PI; this.b = -Math.PI;
    this.set(this.a, this.b);
  }
  set(a, b) {
    this.a = a; this.b = b;
    this.bladePivot.rotation.z = a;
    this.bPivot.rotation.z = b;
  }
  get isOpen() { return Math.abs(this.a) < 0.3; }
}
