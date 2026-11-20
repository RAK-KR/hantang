// 길찾기 그래프 + 시야/이동 가림 계산
import * as THREE from 'three';

// 선분(2D, xz)과 상자의 교차 구간 [t0,t1] (pad 만큼 상자를 키움) – 없으면 null
export function segBox(ax, az, bx, bz, c, pad = 0) {
  const dx = bx - ax, dz = bz - az;
  let t0 = 0, t1 = 1;
  const minX = c.minX - pad, maxX = c.maxX + pad, minZ = c.minZ - pad, maxZ = c.maxZ + pad;
  for (const [p, d, lo, hi] of [[ax, dx, minX, maxX], [az, dz, minZ, maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return null; }
    else {
      let u0 = (lo - p) / d, u1 = (hi - p) / d;
      if (u0 > u1) [u0, u1] = [u1, u0];
      t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
      if (t0 > t1) return null;
    }
  }
  return [t0, t1];
}

// 걸어서 지나갈 수 있는지 (낮은 물건도 막음)
export function walkBlocked(world, a, b, pad = 0.3) {
  for (const c of world.colliders) {
    if (c.top < 0.25) continue;
    if (segBox(a.x, a.z, b.x, b.z, c, pad)) return true;
  }
  return false;
}

// 시선이 막혔는지 – 3D 선분 높이가 상자 높이보다 낮게 지나가면 막힘
export function sightBlocked(world, a, b) {
  for (const c of world.colliders) {
    const r = segBox(a.x, a.z, b.x, b.z, c, 0);
    if (!r) continue;
    const y0 = a.y + (b.y - a.y) * r[0], y1 = a.y + (b.y - a.y) * r[1];
    if (Math.min(y0, y1) < c.top) return true;
  }
  return false;
}

// 원(반지름 r)을 상자 밖으로 밀어내기
export function collideCircle(world, p, r) {
  const b = world.bounds;
  p.x = THREE.MathUtils.clamp(p.x, b.minX + r, b.maxX - r);
  p.z = THREE.MathUtils.clamp(p.z, b.minZ + r, b.maxZ - r);
  for (const c of world.colliders) {
    const cx = THREE.MathUtils.clamp(p.x, c.minX, c.maxX);
    const cz = THREE.MathUtils.clamp(p.z, c.minZ, c.maxZ);
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else {
        const ox = Math.min(p.x - c.minX, c.maxX - p.x), oz = Math.min(p.z - c.minZ, c.maxZ - p.z);
        if (ox < oz) p.x = p.x - c.minX < c.maxX - p.x ? c.minX - r : c.maxX + r;
        else p.z = p.z - c.minZ < c.maxZ - p.z ? c.minZ - r : c.maxZ + r;
      }
    }
  }
}

// 길찾기 노드(걸을 수 있는 곳에 직접 찍은 점)
const NODES = [
  // 로비
  [0, 6.6], [-6, 6.6], [6, 6.6], [-6.2, 3], [6.2, 3], [0, 3], [-2.2, 0.8], [2.2, 0.8], [-6.2, -1.6], [6.2, -1.6], [0, -1.6], [-8.6, 0.5], [8.6, 0.5], [8.0, -1.9],
  // 직원 출입구 + 직원 구역
  [8.0, -3.0], [8.0, -4.2], [4.5, -4.3], [1.2, -4.3], [-1.6, -4.3], [-4.5, -4.3], [-8.1, -4.2], [-9.3, -4.1],
  [0, -6.8], [2.2, -6.6], [-1.2, -6.6], [-4.5, -7.2], [5.8, -6.8],
  // 경비실 / 지점장실
  [-8.1, -5.9], [-8.4, -6.6], [-7.2, -7.4], [8.1, -5.9], [7.7, -6.8], [9.2, -6.3],
  // 금고방
  [0, -8.9], [0, -10.4], [-1.2, -11.7], [1.2, -11.7], [-1.2, -9.4], [1.2, -9.4],
];

export class Nav {
  constructor(world) {
    this.world = world;
    this.nodes = NODES.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.rebuild();
  }
  rebuild() {
    const n = this.nodes.length;
    this.adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = this.nodes[i], b = this.nodes[j];
      const d = a.distanceTo(b);
      if (d > 9) continue;
      if (!walkBlocked(this.world, a, b, 0.28)) { this.adj[i].push([j, d]); this.adj[j].push([i, d]); }
    }
  }
  nearest(p, needLos = true) {
    let best = -1, bd = Infinity;
    this.nodes.forEach((n, i) => {
      const d = n.distanceTo(p);
      if (d < bd && (!needLos || !walkBlocked(this.world, p, n, 0.2))) { bd = d; best = i; }
    });
    if (best < 0 && needLos) return this.nearest(p, false);
    return best;
  }
  // a→b 경로(점 목록). 직선으로 갈 수 있으면 바로
  path(a, b) {
    if (!walkBlocked(this.world, a, b, 0.28)) return [b.clone()];
    const s = this.nearest(a), g = this.nearest(b);
    if (s < 0 || g < 0) return [b.clone()];
    const n = this.nodes.length;
    const dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
    dist[s] = 0;
    for (;;) {
      let u = -1, ud = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < ud) { ud = dist[i]; u = i; }
      if (u < 0 || u === g) break;
      done[u] = true;
      for (const [v, w] of this.adj[u]) {
        const nd = dist[u] + w + this.nodes[v].distanceTo(this.nodes[g]) * 0;
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
      }
    }
    if (!isFinite(dist[g])) return [b.clone()];
    const out = [];
    for (let v = g; v >= 0; v = prev[v]) out.unshift(this.nodes[v].clone());
    out.push(b.clone());
    // 지름길: 앞쪽 점으로 바로 갈 수 있으면 건너뜀
    const smooth = [];
    let cur = a.clone();
    let i = 0;
    while (i < out.length) {
      let j = out.length - 1;
      while (j > i && walkBlocked(this.world, cur, out[j], 0.28)) j--;
      smooth.push(out[j]);
      cur = out[j];
      i = j + 1;
    }
    return smooth;
  }
}
