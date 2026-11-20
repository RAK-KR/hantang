// 맵 – 든든은행 금정지점, 영업 끝난 밤 (PS1 로우폴리)
// 영업장(로비) / 카운터 뒤 직원 구역 / 경비실 / 지점장실 / 금고방 / 뒷문
// 좌표: x -10~10, z -13(금고방 끝)~8(정문)
import * as THREE from 'three';
import { ps1Mat, mesh, shared, MAX_POINT } from './ps1.js';
import { tex } from './textures.js';

function uvScale(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return geo;
}
const PI2 = Math.PI / 2;
const H = 3.6;

// 빛 슬롯 (0~5 고정 조명, 6~7 경비 손전등)
export const LIGHT = { FLASH0: 6, FLASH1: 7 };

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];  // {minX,maxX,minZ,maxZ,top,tag}
    this.bounds = { minX: -9.75, maxX: 9.75, minZ: -12.75, maxZ: 7.75 };
    this.ambient = 0.13;
    this.build();
  }
  col(minX, maxX, minZ, maxZ, top, tag) {
    const c = { minX, maxX, minZ, maxZ, top, tag };
    this.colliders.push(c);
    return c;
  }
  box(w, h, d, x, y, z, mat, col = true, uv = [1, 1]) {
    const g = uvScale(new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), Math.max(1, Math.round(d))), uv[0], uv[1]);
    const m = mesh(g, mat);
    m.position.set(x, y, z);
    this.scene.add(m);
    if (col) this.col(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + h / 2);
    return m;
  }
  // 벽(두께 있는 상자) – 시작/끝 좌표로
  wall(x0, z0, x1, z1, mat, t = 0.2) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.01) return;
    const horiz = Math.abs(z1 - z0) < 0.01;
    const w = horiz ? len : t, d = horiz ? t : len;
    const g = uvScale(new THREE.BoxGeometry(w, H, d, Math.max(1, Math.round(w)), 2, Math.max(1, Math.round(d))), Math.max(w, d) / 2, 1.8);
    const m = mesh(g, mat);
    m.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
    this.scene.add(m);
    this.col(m.position.x - w / 2, m.position.x + w / 2, m.position.z - d / 2, m.position.z + d / 2, H);
  }
  build() {
    const S = this.scene;
    const marble = ps1Mat({ map: tex('marble'), spec: 0.25 });
    const wallM = ps1Mat({ map: tex('wall') });
    const ceil = ps1Mat({ map: tex('ceiling') });
    const wood = ps1Mat({ map: tex('wood'), spec: 0.15 });
    const metal = ps1Mat({ map: tex('metal'), spec: 0.4 });
    const carpet = ps1Mat({ map: tex('carpet'), decal: true });
    const tile = ps1Mat({ map: tex('ceiling'), color: 0x8f9298 });

    // 바닥/천장
    const fg = uvScale(new THREE.PlaneGeometry(20, 16, 20, 16), 10, 8).rotateX(-PI2);
    S.add(mesh(fg, marble));
    const vf = uvScale(new THREE.PlaneGeometry(6, 5, 6, 5), 3, 2.5).rotateX(-PI2);
    const vfm = mesh(vf, tile); vfm.position.set(0, 0, -10.5); S.add(vfm);
    const cg = uvScale(new THREE.PlaneGeometry(2.4, 10, 2, 10), 2, 8).rotateX(-PI2);
    const cm = mesh(cg, carpet); cm.position.set(0, 0.012, 3); S.add(cm);
    const ce = uvScale(new THREE.PlaneGeometry(20, 16, 10, 8), 10, 8).rotateX(PI2);
    const cem = mesh(ce, ceil); cem.position.y = H; S.add(cem);
    const vc = uvScale(new THREE.PlaneGeometry(6, 5, 3, 3), 3, 2.5).rotateX(PI2);
    const vcm = mesh(vc, ceil); vcm.position.set(0, H, -10.5); S.add(vcm);

    // 바깥 벽
    this.wall(-10, 8, 10, 8, wallM);                // 정문 쪽
    this.wall(10, -8, 10, 8, wallM);                // 동
    this.wall(-10, -8, -10, -4.6, wallM);           // 서(뒷문 아래)
    this.wall(-10, -3.6, -10, 8, wallM);            // 서(뒷문 위)
    this.wall(-10, -8, -1.4, -8, wallM);            // 북(금고 입구 왼쪽)
    this.wall(1.4, -8, 10, -8, wallM);              // 북(금고 입구 오른쪽)
    this.wall(-3, -13, -3, -8, wallM);              // 금고방
    this.wall(3, -13, 3, -8, wallM);
    this.wall(-3, -13, 3, -13, wallM);

    // 경비실 (x -10~-6.5, z -8~-5.2) – 문 x -8.6~-7.6
    this.wall(-10, -5.2, -8.6, -5.2, wallM);
    this.wall(-7.6, -5.2, -6.5, -5.2, wallM);
    this.wall(-6.5, -8, -6.5, -5.2, wallM);
    const p2 = mesh(new THREE.PlaneGeometry(0.6, 0.15), ps1Mat({ map: tex('plate2'), decal: true }));
    p2.position.set(-8.1, 2.45, -5.09); S.add(p2);
    // 지점장실 (x 6.5~10, z -8~-5.2) – 문 x 7.6~8.6
    this.wall(6.5, -5.2, 7.6, -5.2, wallM);
    this.wall(8.6, -5.2, 10, -5.2, wallM);
    this.wall(6.5, -8, 6.5, -5.2, wallM);
    const p1 = mesh(new THREE.PlaneGeometry(0.6, 0.15), ps1Mat({ map: tex('plate'), decal: true }));
    p1.position.set(8.1, 2.45, -5.09); S.add(p1);
    // 문틀 위 상인방
    for (const x of [-8.1, 8.1]) this.box(1.0, 1.0, 0.2, x, 3.1, -5.2, wallM, false);
    this.box(2.8, 0.9, 0.2, 0, 3.15, -8, wallM, false);

    // 창구 카운터 – 동쪽 끝(x 7.3~8.7)이 직원 출입구
    const pieces = [[-10, -6.7], [-6.7, -3.4], [-3.4, -0.1], [-0.1, 3.2], [3.2, 6.5], [6.5, 7.3], [8.7, 10]];
    for (const [a, b] of pieces) {
      const w = b - a, x = (a + b) / 2;
      this.box(w, 1.1, 0.8, x, 0.55, -3, wood, true, [w / 1.6, 1]);
      this.box(w + 0.05, 0.06, 0.9, x, 1.13, -3, marble, false, [w / 1.6, 1]);
      if (w > 2) {
        const gl = mesh(new THREE.PlaneGeometry(w - 0.1, 1.0), ps1Mat({ color: 0x8fb4c8, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, spec: 0.8 }));
        gl.position.set(x, 1.66, -3.05); S.add(gl);
        this.box(0.06, 1.0, 0.06, a + 0.05, 1.66, -3.05, metal, false);
      }
    }
    const sign = mesh(new THREE.PlaneGeometry(4, 1), ps1Mat({ map: tex('sign'), emissive: 0.35, decal: true }));
    sign.position.set(0, 2.95, -2.98); S.add(sign);

    // 금고 문 (경첩 x=1.3 기준으로 열림)
    this.vaultHinge = new THREE.Group();
    this.vaultHinge.position.set(1.3, 0, -7.85);
    S.add(this.vaultHinge);
    const vg = new THREE.CylinderGeometry(1.25, 1.25, 0.35, 16).rotateX(PI2);
    vg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vg.attributes.position.count * 3).fill(1), 3));
    const vault = new THREE.Mesh(vg, [ps1Mat({ map: tex('metal'), spec: 0.5 }), ps1Mat({ map: tex('vault'), spec: 0.5 }), ps1Mat({ map: tex('metal') })]);
    vault.position.set(-1.3, 1.4, 0);
    this.vaultHinge.add(vault);
    for (let i = 0; i < 3; i++) {
      const sp = mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), metal);
      sp.position.set(-1.3, 1.4, 0.24); sp.rotation.z = i * Math.PI / 3; this.vaultHinge.add(sp);
    }
    this.vaultCol = this.col(-1.4, 1.4, -8.1, -7.6, H, 'vault');
    // 금고 안: 선반 + 돈가방 + 금괴
    const lock = ps1Mat({ map: tex('lockers'), spec: 0.3 });
    this.box(0.5, 2.6, 4.4, -2.7, 1.3, -10.6, lock, true, [2.2, 1.3]);
    this.box(0.5, 2.6, 4.4, 2.7, 1.3, -10.6, lock, true, [2.2, 1.3]);
    this.box(3.6, 0.9, 0.9, 0, 0.45, -12.4, metal, true, [2, 1]);
    const gold = ps1Mat({ color: 0xd9b440, spec: 1.0, emissive: 0.1 });
    for (let i = 0; i < 7; i++) {
      const b = mesh(new THREE.BoxGeometry(0.3, 0.1, 0.14), gold);
      b.position.set(-1.2 + (i % 4) * 0.36, 0.95 + Math.floor(i / 4) * 0.1, -12.35); S.add(b);
    }
    this.cashSpots = [[-1.9, -9.6], [-1.9, -11.6], [1.9, -9.6], [1.9, -11.6]];
    this.cashMeshes = this.cashSpots.map(([x, z]) => {
      const g = new THREE.Group();
      const bag = mesh(new THREE.BoxGeometry(0.5, 0.42, 0.36), ps1Mat({ map: tex('cash') }));
      bag.position.y = 0.21; g.add(bag);
      const knot = mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.12, 5), ps1Mat({ color: 0x4f5d3b }));
      knot.position.y = 0.47; g.add(knot);
      g.position.set(x, 0, z); S.add(g);
      return g;
    });

    // 직원 구역 책상
    const scrM = ps1Mat({ color: 0x3a6a8a, emissive: 0.5, decal: true });
    for (const x of [-4.5, 4.5]) {
      this.box(1.8, 0.75, 0.8, x, 0.375, -5.9, wood);
      const mon = mesh(new THREE.BoxGeometry(0.45, 0.35, 0.3), ps1Mat({ color: 0xcfcab8 }));
      mon.position.set(x, 0.95, -6.0); S.add(mon);
      const scr = mesh(new THREE.PlaneGeometry(0.38, 0.26), scrM);
      scr.position.set(x, 0.96, -5.84); S.add(scr);
    }
    // 서류 캐비닛(엄폐물)
    this.box(1.2, 1.4, 0.5, -2.2, 0.7, -7.6, metal, true, [1, 1]);
    this.box(1.2, 1.4, 0.5, 4.2, 0.7, -7.6, metal, true, [1, 1]);
    // 창구 뒤 현금 서랍
    this.drawerSpots = [[-5.05, -3.55], [-1.75, -3.55], [1.55, -3.55], [4.85, -3.55]];
    for (const [x, z] of this.drawerSpots) {
      const d = mesh(new THREE.BoxGeometry(0.5, 0.12, 0.05), ps1Mat({ color: 0x3a2414 }));
      d.position.set(x, 0.8, z + 0.1); S.add(d);
    }

    // 경비실 안
    this.box(1.6, 0.75, 0.6, -9.1, 0.375, -7.5, wood);
    for (let i = 0; i < 2; i++) {
      const m = mesh(new THREE.BoxGeometry(0.55, 0.42, 0.3), ps1Mat({ color: 0x2b2b30 }));
      m.position.set(-9.45 + i * 0.6, 1.0, -7.62); S.add(m);
      const sc = mesh(new THREE.PlaneGeometry(0.48, 0.34), ps1Mat({ map: tex('monitorScr'), emissive: 0.9, decal: true }));
      sc.position.set(-9.45 + i * 0.6, 1.0, -7.46); S.add(sc);
    }
    this.terminalPos = new THREE.Vector3(-9.1, 0.9, -7.1);
    const chair = ps1Mat({ color: 0x2a2a30 });
    this.box(0.5, 0.45, 0.5, -8.6, 0.225, -6.6, chair, false);
    this.box(0.5, 0.6, 0.08, -8.6, 0.75, -6.33, chair, false);

    // 지점장실 안
    this.box(1.6, 0.75, 0.8, 8.6, 0.375, -7.3, wood);
    const lamp = mesh(new THREE.ConeGeometry(0.14, 0.18, 6), ps1Mat({ color: 0xe8d090, emissive: 0.8 }));
    lamp.position.set(9.2, 0.98, -7.45); S.add(lamp);
    this.keycardPos = new THREE.Vector3(8.3, 0.77, -7.2);
    this.keycard = mesh(new THREE.BoxGeometry(0.09, 0.006, 0.055), ps1Mat({ color: 0xd8d8e8, emissive: 0.3, spec: 0.8 }));
    this.keycard.position.copy(this.keycardPos); this.keycard.rotation.y = 0.4; S.add(this.keycard);
    this.box(0.6, 1.2, 0.5, 6.95, 0.6, -7.6, metal, true);
    const pot = ps1Mat({ color: 0x8a4a2a });
    this.box(0.4, 0.45, 0.4, 9.6, 0.225, -5.6, pot);

    // 로비: 기둥, 대기 의자, ATM, 포스터, 화분, 정문
    for (const [x, z] of [[-4, 0.8], [4, 0.8], [-4, 5.2], [4, 5.2]]) {
      const pg = uvScale(new THREE.CylinderGeometry(0.42, 0.42, H, 8, 3), 4, 3);
      const p = mesh(pg, marble); p.position.set(x, H / 2, z); S.add(p);
      this.col(x - 0.42, x + 0.42, z - 0.42, z + 0.42, H);
    }
    const seat = ps1Mat({ color: 0x2f5d8a, spec: 0.2 });
    for (const sx of [-7, 7]) for (let r = 0; r < 2; r++) {
      const z = 1.8 + r * 2.2;
      this.box(2.6, 0.1, 0.55, sx, 0.45, z, seat, true);
      this.box(2.6, 0.5, 0.08, sx, 0.75, z + 0.27, seat, false);
      for (const lx of [-1.1, 1.1]) this.box(0.06, 0.45, 0.45, sx + lx, 0.22, z, metal, false);
    }
    const atm = mesh(new THREE.BoxGeometry(0.8, 1.7, 0.6), [ps1Mat({ map: tex('metal') }), ps1Mat({ map: tex('metal') }), ps1Mat({ map: tex('metal') }), ps1Mat({ map: tex('metal') }), ps1Mat({ map: tex('atm'), spec: 0.2, emissive: 0.25 }), ps1Mat({ map: tex('metal') })]);
    atm.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(atm.geometry.attributes.position.count * 3).fill(1), 3));
    atm.position.set(-9.5, 0.85, 4.5); atm.rotation.y = PI2; S.add(atm);
    this.col(-9.9, -9.2, 4.0, 5.0, 1.7);
    for (const [x, z, ry] of [[9.88, 2.5, -PI2], [9.88, -0.5, -PI2], [-9.88, 1.5, PI2]]) {
      const p = mesh(new THREE.PlaneGeometry(0.8, 1.2), ps1Mat({ map: tex('poster'), decal: true }));
      p.position.set(x, 1.8, z); p.rotation.y = ry; S.add(p);
    }
    for (const [x, z] of [[-8.8, -2.0], [8.8, 6.9], [-8.8, 6.9]]) {
      this.box(0.5, 0.55, 0.5, x, 0.275, z, pot);
      const leaf = ps1Mat({ color: 0x3f7a3a, side: THREE.DoubleSide });
      for (let i = 0; i < 6; i++) {
        const l = mesh(new THREE.ConeGeometry(0.22, 0.9, 4), leaf);
        l.position.set(x + Math.cos(i) * 0.12, 0.95, z + Math.sin(i) * 0.12);
        l.rotation.set(Math.sin(i * 2) * 0.5, i, Math.cos(i * 3) * 0.5); S.add(l);
      }
    }
    for (const x of [-0.75, 0.75]) {
      const d = mesh(new THREE.PlaneGeometry(1.4, 2.6), ps1Mat({ color: 0x3a4a60, transparent: true, opacity: 0.6, side: THREE.DoubleSide, spec: 0.6, depthWrite: false }));
      d.position.set(x, 1.3, 7.88); S.add(d);
      this.box(0.08, 2.6, 0.08, x * 2, 1.3, 7.85, metal, false);
    }
    this.box(3.1, 0.12, 0.12, 0, 2.62, 7.85, metal, false);
    // 뒷문
    const bd = mesh(new THREE.PlaneGeometry(1.0, 2.3), ps1Mat({ color: 0x5a5f66, spec: 0.3 }));
    bd.position.set(-9.88, 1.15, -4.1); bd.rotation.y = PI2; S.add(bd);
    const ex = mesh(new THREE.PlaneGeometry(0.6, 0.22), ps1Mat({ map: tex('exit'), emissive: 1, decal: true }));
    ex.position.set(-9.87, 2.55, -4.1); ex.rotation.y = PI2; S.add(ex);
    const ex2 = mesh(new THREE.PlaneGeometry(0.6, 0.22), ps1Mat({ map: tex('exit'), emissive: 1, decal: true }));
    ex2.position.set(0, 2.9, 7.88); ex2.rotation.y = Math.PI; S.add(ex2);

    // 출구 구역
    this.exits = [
      { name: '정문', minX: -1.4, maxX: 1.4, minZ: 7.3, maxZ: 9 },
      { name: '뒷문', minX: -11, maxX: -9.3, minZ: -4.6, maxZ: -3.6 },
    ];

    // ---------- 밤 조명 ----------
    shared.uAmbient.value.set(0x22252f);
    shared.uDirColor.value.set(0x262a38);
    shared.uFogColor.value.set(0x05060a);
    shared.uFogNear.value = 4; shared.uFogFar.value = 22;
    const lampM = ps1Mat({ color: 0xf2f4e8, emissive: 1 });
    this.lights = [
      { p: [-6, 3.2, 4.6], c: [0.5, 0.48, 0.42], r: 8, panel: true },
      { p: [5, 3.2, 1.0], c: [0.42, 0.45, 0.42], r: 7.5, panel: true, flicker: true },
      { p: [0.5, 3.2, -5.4], c: [0.42, 0.44, 0.44], r: 7, panel: true },
      { p: [0, 3.0, -10.5], c: [0.6, 0.68, 0.82], r: 6.5, panel: true },
      { p: [-9.0, 1.3, -7.0], c: [0.25, 0.45, 0.62], r: 3.6 },
      { p: [9.1, 1.25, -7.3], c: [0.7, 0.58, 0.36], r: 4.2 },
    ];
    this.lights.forEach((L, i) => {
      if (L.panel) {
        const l = mesh(new THREE.BoxGeometry(1.4, 0.05, 0.4), lampM);
        l.position.set(L.p[0], H - 0.03, L.p[2]); S.add(l);
        L.mesh = l;
      }
      shared.uPointPos.value[i].set(...L.p);
      shared.uPointColor.value[i].setRGB(...L.c);
      shared.uPointRange.value[i] = L.r;
    });
    for (let i = this.lights.length; i < MAX_POINT; i++) shared.uPointColor.value[i].setRGB(0, 0, 0);
    this._t = 0;
  }

  // 깜빡이는 형광등 + 경보 때 붉은 조명
  update(dt, alarm) {
    this._t += dt;
    this.lights.forEach((L, i) => {
      let k = 1;
      if (L.flicker) {
        const f = Math.sin(this._t * 23) * Math.sin(this._t * 7.3) > 0.82 ? 0.25 : 1;
        k = f;
        if (L.mesh) L.mesh.visible = f > 0.5;
      }
      const c = shared.uPointColor.value[i];
      if (alarm) {
        const a = 0.5 + 0.5 * Math.sin(this._t * 6);
        c.setRGB(L.c[0] * k * 0.6 + 0.55 * a, L.c[1] * k * 0.35, L.c[2] * k * 0.35);
      } else c.setRGB(L.c[0] * k, L.c[1] * k, L.c[2] * k);
    });
  }

  // 위치의 밝기(플레이어가 얼마나 잘 보이는지) – 셰이더와 같은 감쇠식, 가림은 무시
  lightAt(p, extra = []) {
    let L = this.ambient;
    const all = [...this.lights.map((l, i) => ({ p: shared.uPointPos.value[i], c: shared.uPointColor.value[i], r: l.r })), ...extra];
    for (const l of all) {
      const pp = l.p.isVector3 ? l.p : new THREE.Vector3(...l.p);
      const d = pp.distanceTo(p);
      const att = Math.max(0, 1 - d / l.r);
      const cc = l.c.isColor ? (l.c.r + l.c.g + l.c.b) / 3 : (l.c[0] + l.c[1] + l.c[2]) / 3;
      L += att * att * cc * 1.6;
    }
    return L;
  }

  openVault() {
    const i = this.colliders.indexOf(this.vaultCol);
    if (i >= 0) this.colliders.splice(i, 1);
    this.vaultOpening = 0.0001;
  }
  animate(dt) {
    if (this.vaultOpening > 0 && this.vaultOpening < 1) {
      this.vaultOpening = Math.min(1, this.vaultOpening + dt / 2.2);
      const t = this.vaultOpening, e = t * t * (3 - 2 * t);
      this.vaultHinge.rotation.y = 1.75 * e;
    }
  }
}
