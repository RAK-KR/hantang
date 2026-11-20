// 테스트 맵 – 든든은행 금정지점 로비 (PS1 로우폴리)
import * as THREE from 'three';
import { ps1Mat, mesh, shared, MAX_POINT } from './ps1.js';
import { tex } from './textures.js';

// 반복 텍스처용 – UV 자체를 늘려서(셰이더가 repeat를 안 씀) 타일링
function uvScale(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return geo;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];  // {minX,maxX,minZ,maxZ,top}
    this.bounds = { minX: -9.6, maxX: 9.6, minZ: -7.6, maxZ: 7.6 };
    this.build();
  }
  box(w, h, d, x, y, z, mat, col = true, uv = [1, 1]) {
    const g = uvScale(new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), Math.max(1, Math.round(d))), uv[0], uv[1]);
    const m = mesh(g, mat);
    m.position.set(x, y, z);
    this.scene.add(m);
    if (col) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y + h / 2 });
    return m;
  }
  build() {
    const S = this.scene;
    const H = 3.6;
    const marble = ps1Mat({ map: tex('marble'), spec: 0.25 });
    const wall = ps1Mat({ map: tex('wall') });
    const ceil = ps1Mat({ map: tex('ceiling') });
    const wood = ps1Mat({ map: tex('wood'), spec: 0.15 });
    const metal = ps1Mat({ map: tex('metal'), spec: 0.4 });
    const carpet = ps1Mat({ map: tex('carpet') });

    // 바닥(잘게 나눠서 아핀 왜곡이 과하지 않게)
    const fg = uvScale(new THREE.PlaneGeometry(20, 16, 20, 16), 10, 8).rotateX(-PI2);
    S.add(mesh(fg, marble));
    const cg = uvScale(new THREE.PlaneGeometry(2.4, 10, 2, 10), 2, 8).rotateX(-PI2);
    const cm = mesh(cg, carpet); cm.position.set(0, 0.005, 3); S.add(cm);
    // 천장
    const ce = uvScale(new THREE.PlaneGeometry(20, 16, 10, 8), 10, 8).rotateX(PI2);
    const cem = mesh(ce, ceil); cem.position.y = H; S.add(cem);
    // 벽
    const wallAt = (w, x, z, ry) => {
      const g = uvScale(new THREE.PlaneGeometry(w, H, Math.round(w), 2), w / 2, 1.8);
      const m = mesh(g, wall); m.position.set(x, H / 2, z); m.rotation.y = ry; S.add(m);
    };
    wallAt(20, 0, -8, 0); wallAt(20, 0, 8, Math.PI); wallAt(16, -10, 0, PI2); wallAt(16, 10, 0, -PI2);

    // 창구 카운터
    for (const x of [-5.5, -1.8, 1.8, 5.5]) {
      this.box(3.2, 1.1, 0.8, x, 0.55, -3, wood, true, [2, 1]);
      this.box(3.3, 0.06, 0.9, x, 1.13, -3, marble, false, [2, 1]);
      // 유리 칸막이
      const gl = mesh(new THREE.PlaneGeometry(3.1, 1.0), ps1Mat({ color: 0x8fb4c8, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, spec: 0.8 }));
      gl.position.set(x, 1.66, -3.05); S.add(gl);
      this.box(0.06, 1.0, 0.06, x - 1.55, 1.66, -3.05, metal, false);
      this.box(0.06, 1.0, 0.06, x + 1.55, 1.66, -3.05, metal, false);
      // 번호표
      const n = mesh(new THREE.BoxGeometry(0.3, 0.18, 0.04), ps1Mat({ color: 0x18305a, emissive: 0.6 }));
      n.position.set(x, 2.3, -3.05); S.add(n);
    }
    this.colliders.push({ minX: -9.6, maxX: 9.6, minZ: -3.5, maxZ: -2.6, top: 1.1 }); // 카운터 전체 막기

    // 간판
    const sign = mesh(new THREE.PlaneGeometry(4, 1), ps1Mat({ map: tex('sign'), emissive: 0.5 }));
    sign.position.set(0, 2.95, -2.98); S.add(sign);

    // 금고 문
    const vg = new THREE.CylinderGeometry(1.25, 1.25, 0.35, 16).rotateX(PI2);
    const vm = [ps1Mat({ map: tex('metal'), spec: 0.5 }), ps1Mat({ map: tex('vault'), spec: 0.5 }), ps1Mat({ map: tex('metal') })];
    const vault = new THREE.Mesh(vg, vm.map((m) => m));
    vg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vg.attributes.position.count * 3).fill(1), 3));
    vault.position.set(0, 1.45, -7.8); S.add(vault);
    this.box(3.0, 3.2, 0.2, 0, 1.6, -7.95, metal, false, [2, 2]);
    // 금고 핸들
    for (let i = 0; i < 3; i++) {
      const sp = mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), metal);
      sp.position.set(0, 1.45, -7.55); sp.rotation.z = i * Math.PI / 3; S.add(sp);
    }
    // 금고 뒤 책상
    for (const x of [-5, 5]) {
      this.box(1.6, 0.75, 0.8, x, 0.375, -5.5, wood);
      const mon = mesh(new THREE.BoxGeometry(0.45, 0.35, 0.3), ps1Mat({ color: 0xcfcab8 }));
      mon.position.set(x, 0.95, -5.6); S.add(mon);
      const scr = mesh(new THREE.PlaneGeometry(0.38, 0.26), ps1Mat({ color: 0x3a6a8a, emissive: 0.7 }));
      scr.position.set(x, 0.96, -5.44); S.add(scr);
    }

    // 기둥
    for (const [x, z] of [[-4, 0.8], [4, 0.8], [-4, 5.2], [4, 5.2]]) {
      const pg = uvScale(new THREE.CylinderGeometry(0.42, 0.42, H, 8, 3), 4, 3);
      const p = mesh(pg, marble); p.position.set(x, H / 2, z); S.add(p);
      this.colliders.push({ minX: x - 0.42, maxX: x + 0.42, minZ: z - 0.42, maxZ: z + 0.42, top: H });
    }

    // 대기 의자
    const seat = ps1Mat({ color: 0x2f5d8a, spec: 0.2 });
    for (const sx of [-7, 7]) for (let r = 0; r < 2; r++) {
      const z = 1.8 + r * 2.2;
      this.box(2.6, 0.1, 0.55, sx, 0.45, z, seat, true);
      this.box(2.6, 0.5, 0.08, sx, 0.75, z + 0.27, seat, false);
      for (const lx of [-1.1, 1.1]) this.box(0.06, 0.45, 0.45, sx + lx, 0.22, z, metal, false);
    }

    // ATM
    const atm = mesh(new THREE.BoxGeometry(0.8, 1.7, 0.6), [ps1Mat({ map: tex('metal') }), ps1Mat({ map: tex('metal') }), ps1Mat({ map: tex('metal') }), ps1Mat({ map: tex('metal') }), ps1Mat({ map: tex('atm'), spec: 0.2 }), ps1Mat({ map: tex('metal') })]);
    atm.position.set(-9.55, 0.85, 4.5); atm.rotation.y = PI2; S.add(atm);
    this.colliders.push({ minX: -9.9, maxX: -9.2, minZ: 4.0, maxZ: 5.0, top: 1.7 });

    // 포스터
    for (const [x, z, ry] of [[9.97, 2.5, -PI2], [9.97, -0.5, -PI2], [-9.97, 1.5, PI2]]) {
      const p = mesh(new THREE.PlaneGeometry(0.8, 1.2), ps1Mat({ map: tex('poster') }));
      p.position.set(x, 1.8, z); p.rotation.y = ry; S.add(p);
    }

    // 화분
    for (const [x, z] of [[-8.8, -2.2], [8.8, -2.2], [-8.8, 7.2], [8.8, 7.2]]) {
      this.box(0.5, 0.55, 0.5, x, 0.275, z, ps1Mat({ color: 0x8a4a2a }));
      const leaf = ps1Mat({ color: 0x3f7a3a, side: THREE.DoubleSide });
      for (let i = 0; i < 6; i++) {
        const l = mesh(new THREE.ConeGeometry(0.22, 0.9, 4), leaf);
        l.position.set(x + Math.cos(i) * 0.12, 0.95, z + Math.sin(i) * 0.12);
        l.rotation.set(Math.sin(i * 2) * 0.5, i, Math.cos(i * 3) * 0.5); S.add(l);
      }
    }

    // 입구 문
    for (const x of [-0.75, 0.75]) {
      const d = mesh(new THREE.PlaneGeometry(1.4, 2.6), ps1Mat({ color: 0x6f8fa0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, spec: 0.6, depthWrite: false }));
      d.position.set(x, 1.3, 7.97); S.add(d);
      this.box(0.08, 2.6, 0.08, x * 2, 1.3, 7.95, metal, false);
    }
    this.box(3.1, 0.12, 0.12, 0, 2.62, 7.95, metal, false);

    // 천장 조명(형광등 판) + 포인트 라이트
    const lamp = ps1Mat({ color: 0xf2f4e8, emissive: 1 });
    const lights = [[-5, -5], [5, -5], [-5, 1.5], [5, 1.5], [0, -6.5], [0, 5.5]];
    lights.forEach(([x, z], i) => {
      const l = mesh(new THREE.BoxGeometry(1.4, 0.05, 0.4), lamp);
      l.position.set(x, H - 0.03, z); S.add(l);
      if (i < MAX_POINT) {
        shared.uPointPos.value[i].set(x, H - 0.4, z);
        shared.uPointColor.value[i].setRGB(0.78, 0.78, 0.72);
        shared.uPointRange.value[i] = 8.5;
      }
    });
    shared.uPointColor.value[4].setRGB(0.65, 0.72, 0.85); // 금고 쪽은 차갑게
  }
}
const PI2 = Math.PI / 2;
