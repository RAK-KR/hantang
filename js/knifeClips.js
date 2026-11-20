// 발리송 트릭 키프레임
// 채널 – 손목(카메라 공간): x y z rx ry rz
//        손 기준 회전: tw(팔뚝 비틀기) fx(손목 굽힘) fl(칼 핀 축으로 튕기기)
//        손가락: iB iD mB mD rB rD pB pD sp tF tA tC (0=펴짐 1=완전히 굽힘)
//        칼 장착: kpx kpy kpz(손 기준 회전축 위치) krx kry krz(회전) kox koy koz(회전축 -> 칼 핀)
//        cx cy cz: 칼을 던질 때 카메라 기준 오프셋
//        칼 상태: a(칼날, 0=펼침 π=접힘) b(바이트 핸들, 0=펼침 -π=접힘)  kv(보이기)
// 이벤트: ['sfx', {name, v}] – clack(딸깍) tick swish catch
import * as THREE from 'three';
import { clipFromPoses } from './anim.js';
import { HANDS } from './hand.js';
import { PIN } from './balisong.js';

const PI = Math.PI;
const TAU = PI * 2;

// ---- 그립 기준값 ----
const PIN_POS = [0.044, 0.08, 0.026];             // 주먹 쥐었을 때 칼 핀 위치(손 좌표)
const KR_GRIP = [-PI / 2, -PI / 4, -PI / 2];       // 손바닥에 대각선으로 쥔 회전
const KR_AXLE = [-PI / 2, 0, -PI / 2];             // 핀 축이 손가락(손 Y)과 평행 – 손가락 축 회전용
const COM_OPEN = [PIN, 0.035, 0];                  // 펼친 칼의 무게중심 근처(칼 기준) – 회전 중심 오프셋

// 회전(rot)과 오프셋(off)이 주어졌을 때, 칼 핀이 pin 위치에 오도록 하는 회전축 위치
function pivotFor(rot, off, pin = PIN_POS) {
  if (!pin) pin = [0, 0, 0];
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
  const v = new THREE.Vector3(...off).applyQuaternion(q);
  return { kpx: pin[0] - v.x, kpy: pin[1] - v.y, kpz: pin[2] - v.z };
}
const K = (rot, off = [0, 0, 0], pin = PIN_POS) => ({
  ...pivotFor(rot, off, pin), krx: rot[0], kry: rot[1], krz: rot[2], kox: off[0], koy: off[1], koz: off[2],
});
const KG = K(KR_GRIP);

// 펼친 칼을 주먹에 쥔 기본 자세
export const R_BASE = {
  x: 0.13, y: -0.125, z: -0.385, rx: -0.278, ry: -0.936, rz: 1.192,
  tw: 0, fx: 0, fl: 0,
  ...HANDS.grip,
  ...KG,
  cx: 0, cy: 0, cz: 0,
  a: 0, b: 0, kv: 1, hb: 0, sy: 0, cmy: -0.035, trail: 0,
};
export const L_BASE = {
  x: -0.3, y: -0.8, z: -0.3, rx: 0.8, ry: 1.2, rz: 0.6, tw: 0, fx: 0, fl: 0,
  ...HANDS.loose,
};

const B = R_BASE;
// 손목 위치/회전을 기본 자세 기준 차이로 적는 헬퍼
const W = (dx = 0, dy = 0, dz = 0, o = {}) => ({ x: B.x + dx, y: B.y + dy, z: B.z + dz, rx: B.rx, ry: B.ry, rz: B.rz, ...o });
const H = (name, extra = {}) => ({ ...HANDS[name], ...extra });
const sfx = (t, name, v = 1) => [t, 'sfx', { name, v }];
const OPEN = { a: 0, b: 0 };
const CLOSED = { a: PI, b: -PI };
// 접힌 칼을 쥔 자세 – 칼끝이 없으니 손을 조금 낮추고 눕힘
const WC = () => W(0.006, -0.012, 0.01, { fl: -0.12, tw: 0.08 });

export const IDLE_OPEN = clipFromPoses({
  name: 'idleOpen', duration: 4, loop: true,
  poses: [
    [0, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip'), ...KG, ...OPEN }],
    [2, { ...W(0, 0.004, 0, { fx: 0.03, tw: 0.025 }), ...H('grip', { iB: 0.82, pB: 0.98 }) }],
    [4, { ...W(), fx: 0, tw: 0, ...H('grip') }],
  ],
});

export const IDLE_CLOSED = clipFromPoses({
  name: 'idleClosed', duration: 4, loop: true,
  poses: [
    [0, { ...WC(), fx: 0, ...H('grip'), ...KG, ...CLOSED }],
    [2, { ...WC(), y: B.y - 0.008, fx: 0.035, ...H('grip', { iB: 0.82 }) }],
    [4, { ...WC(), fx: 0, ...H('grip') }],
  ],
});

export const KNIFE = {};

// ------------------------------------------------------------------
// 펼치기 – 바이트 핸들을 떨어뜨려 반바퀴(딸깍) → 손목을 되돌려 칼날+핸들 반바퀴(딸깍) → 쥐기
// ------------------------------------------------------------------
KNIFE.open = clipFromPoses({
  name: 'open', duration: 0.66, meta: { from: 'closed', to: 'open', label: '', blend: 0.06 },
  poses: [
    [0.0, { ...WC(), ...H('grip'), ...KG, ...CLOSED }],
    [0.07, { fl: 0.26, tw: 0.12, fx: -0.06, ...H('pinch'), y: B.y - 0.006 }],
    [0.095, { b: -PI }],
    [0.19, { b: [0, 'i'], fl: [-0.36, 'o'], tw: -0.05, y: B.y + 0.004 }],
    [0.215, { b: -0.13 }],
    [0.245, { b: 0, a: PI }],
    [0.37, { a: [0, 'i'], fl: [0.3, 'o'], tw: 0.06, ...H('catch'), x: B.x + 0.004 }],
    [0.395, { a: 0.07 }],
    [0.425, { a: 0 }],
    [0.45, { ...H('grip', { iB: 0.92, mB: 0.95 }), fl: -0.05, fx: 0.03 }],
    [0.66, { ...W(), fl: 0, tw: 0, fx: 0, ...H('grip') }],
  ],
  events: [sfx(0.1, 'tick', 0.5), sfx(0.14, 'swish', 0.5), sfx(0.19, 'clack', 0.75), sfx(0.3, 'swish', 0.8), sfx(0.37, 'clack', 1), sfx(0.45, 'catch', 0.45)],
});

// ------------------------------------------------------------------
// 접기 – 칼날+핸들을 반바퀴 넘겨 칼날을 세이프 핸들에 넣음(딸깍) → 바이트 핸들을 덮음(딸깍)
// ------------------------------------------------------------------
KNIFE.close = clipFromPoses({
  name: 'close', duration: 0.64, meta: { from: 'open', to: 'closed', label: '', blend: 0.06 },
  poses: [
    [0.0, { ...W(), fl: 0, tw: 0, fx: 0, ...H('grip'), ...KG, ...OPEN }],
    [0.07, { fl: -0.22, fx: -0.05, ...H('catch'), y: B.y - 0.004 }],
    [0.09, { a: 0 }],
    [0.2, { a: [PI, 'i'], fl: [0.32, 'o'], tw: 0.08 }],
    [0.225, { a: PI - 0.1 }],
    [0.255, { a: PI, b: 0, ...H('pinch') }],
    [0.37, { b: [-PI, 'i'], fl: [-0.3, 'o'], tw: 0.1 }],
    [0.39, { b: -PI + 0.08 }],
    [0.415, { b: -PI }],
    [0.44, { ...H('grip', { iB: 0.92 }), fl: -0.1 }],
    [0.64, { ...WC(), fx: 0, ...H('grip') }],
  ],
  events: [sfx(0.13, 'swish', 0.7), sfx(0.2, 'clack', 0.95), sfx(0.31, 'swish', 0.55), sfx(0.37, 'clack', 0.8), sfx(0.44, 'catch', 0.4)],
});

// ==================================================================
// 트릭 빌더 – 키마다 전체 포즈를 기록해서(유지 구간이 풀리지 않음) 기술을 이어 붙임
// ==================================================================
const CH = Object.keys(R_BASE);
class Seq {
  constructor(name, meta) {
    this.name = name; this.meta = meta;
    this.t = 0; this.poses = []; this.events = [];
    this.cur = { ...R_BASE };
    this.turn = 0;     // 칼 평면 회전 누적(2π 단위)
    this.spin = 0;     // 길이축 회전 누적
    this.at(0, {});
  }
  at(dt, ch) {
    this.t += dt;
    const ease = {};
    for (const k in ch) {
      const v = ch[k];
      if (Array.isArray(v)) { this.cur[k] = v[0]; ease[k] = v[1]; } else this.cur[k] = v;
    }
    const pose = {};
    for (const k of CH) pose[k] = ease[k] ? [this.cur[k], ease[k]] : this.cur[k];
    // 같은 시각 키가 겹치지 않게
    if (this.poses.length && this.poses[this.poses.length - 1][0] >= this.t - 1e-4) this.poses.pop();
    this.poses.push([this.t, pose]);
    return this;
  }
  sfx(name, v = 1, off = 0) { this.events.push([this.t + off, 'sfx', { name, v }]); return this; }
  grip() { return { ...KG, krz: KG.krz + this.turn }; }
  build() {
    return clipFromPoses({ name: this.name, duration: this.t, meta: this.meta, poses: this.poses, events: this.events });
  }
}

// ---------- 기본 동작 조각 ----------
// 세이프 핸들(A)을 잡고 접기 / 펼치기
function closeA(s, k = 1, hi = 0) {
  s.at(0.05 * k, { fl: -0.22, ...H('catch') });
  s.sfx('swish', 0.5, 0.03).at(0.11 * k, { a: [PI, 'i'], fl: [0.3, 'o'], y: B.y + hi }).sfx('clack', 0.9);
  s.at(0.025, { a: PI - 0.08, ...H('pinch') }).at(0.025, { a: PI });
  s.sfx('swish', 0.4, 0.02).at(0.1 * k, { b: [-PI, 'i'], fl: [-0.3, 'o'] }).sfx('clack', 0.8);
  s.at(0.02, { b: -PI + 0.07 }).at(0.02, { b: -PI });
}
function openA(s, k = 1, hi = 0) {
  s.at(0.05 * k, { fl: 0.24, ...H('pinch') });
  s.sfx('swish', 0.45, 0.03).at(0.1 * k, { b: [0, 'i'], fl: [-0.33, 'o'], y: B.y + hi }).sfx('clack', 0.75);
  s.at(0.02, { b: -0.12 }).at(0.025, { b: 0 });
  s.sfx('swish', 0.6, 0.03).at(0.11 * k, { a: [0, 'i'], fl: [0.3, 'o'], ...H('catch') }).sfx('clack', 1);
  s.at(0.02, { a: 0.07 }).at(0.025, { a: 0, ...H('grip', { iB: 0.93 }) });
}
// 바이트 핸들(B)을 잡고 접기 / 펼치기 – 반대쪽 손잡이가 돌아가서 칼이 번갈아 번쩍임
function closeB(s, k = 1, hi = 0) {
  s.at(0.05 * k, { fl: 0.22, ...H('catch') });
  s.sfx('swish', 0.5, 0.03).at(0.11 * k, { b: [-PI, 'i'], fl: [-0.3, 'o'], y: B.y + hi }).sfx('clack', 0.9);
  s.at(0.025, { b: -PI + 0.08, ...H('pinch') }).at(0.025, { b: -PI });
  s.sfx('swish', 0.4, 0.02).at(0.1 * k, { a: [PI, 'i'], fl: [0.3, 'o'] }).sfx('clack', 0.8);
  s.at(0.02, { a: PI - 0.07 }).at(0.02, { a: PI });
}
function openB(s, k = 1, hi = 0) {
  s.at(0.05 * k, { fl: -0.24, ...H('pinch') });
  s.sfx('swish', 0.45, 0.03).at(0.1 * k, { a: [0, 'i'], fl: [0.33, 'o'], y: B.y + hi }).sfx('clack', 0.75);
  s.at(0.02, { a: 0.12 }).at(0.025, { a: 0 });
  s.sfx('swish', 0.6, 0.03).at(0.11 * k, { b: [0, 'i'], fl: [-0.3, 'o'], ...H('catch') }).sfx('clack', 1);
  s.at(0.02, { b: -0.07 }).at(0.025, { b: 0, ...H('grip', { iB: 0.93 }) });
}
// 잡는 손잡이 바꾸기(완전히 펼쳤거나 접혔을 때만)
const toB = (s) => s.at(0.035, { hb: 1, ...H('catch') }).sfx('tick', 0.35);
const toA = (s) => s.at(0.035, { hb: 0, ...H('catch') }).sfx('tick', 0.35);

// 검지 축 팬 회전 n 바퀴
const IDX = [0.03, 0.118, 0.012];
function twirl(s, n = 2, dur = 1.0) {
  const r0 = KR_AXLE[2] + s.turn;
  const sp = (rz) => ({ ...K([KR_AXLE[0], KR_AXLE[1], rz], COM_OPEN, null), kpx: IDX[0], kpy: IDX[1], kpz: IDX[2] });
  s.at(0.1, { ...W(-0.01, 0.01, 0), tw: -0.25, fx: -0.15, ...H('catch') });
  s.at(0.09, { ...sp(r0 + 0.25), ...H('axle'), tw: -0.4, fx: -0.25, fl: 0 });
  const halves = n * 2;
  for (let i = 1; i <= halves; i++) {
    const e = i === 1 ? 'i' : 'l';
    const bob = i % 2 ? 0.006 : -0.004;
    s.at(dur / halves, { krz: [r0 + 0.25 - PI * i, e], y: B.y + 0.01 + bob, tw: -0.4 + (i % 2 ? 0.05 : -0.05) });
    s.sfx('swish', 0.45 + 0.3 * Math.sin((i / halves) * PI), -dur / halves / 2);
  }
  s.turn -= TAU * n;
  s.at(0.09, { ...s.grip(), ...H('catch'), tw: -0.1, fx: -0.05, y: B.y }).sfx('catch', 0.7);
  s.at(0.05, { ...H('grip', { iB: 0.94 }), fl: 0.08 }).sfx('tick', 0.45);
  s.at(0.1, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip') });
}
// 손등 위로 굴려 넘기기 (dir = 1 앞으로, -1 되돌아오기)
function rollover(s, dir = 1, dur = 0.7) {
  const r0 = KR_AXLE[2] + s.turn;
  const at = (p, rz) => ({ ...K([KR_AXLE[0], KR_AXLE[1], rz], COM_OPEN, null), kpx: p[0], kpy: p[1], kpz: p[2] });
  const P0 = [0.045 * dir, 0.09, 0.01], P1 = [0.0, 0.1, -0.03], P2 = [-0.045 * dir, 0.085, 0.0];
  s.at(0.09, { ...W(0, 0.01, 0), tw: -0.4, fx: -0.1, ...H('catch') });
  s.at(0.09, { ...at(P0, r0 + 0.2 * dir), ...H('flat', { tF: 0.3 }), tw: -0.75 });
  s.at(dur * 0.36, { ...at(P1, r0 - PI * 0.9 * dir), tw: -0.95, fx: -0.15 }).sfx('swish', 0.55, -0.1);
  s.at(dur * 0.36, { ...at(P2, r0 - PI * 1.9 * dir), tw: -0.8, fx: -0.1 }).sfx('swish', 0.45, -0.1);
  s.at(dur * 0.28, { ...at([0.0, 0.088, 0.02], r0 - (TAU + 0.2) * dir), ...H('catch'), tw: -0.4 });
  s.turn -= TAU * dir;
  s.at(0.08, { ...s.grip(), ...H('grip', { iB: 0.94 }), tw: -0.05, fl: 0.06 }).sfx('catch', 0.7).sfx('tick', 0.45, 0.01);
  s.at(0.1, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip') });
}
// 공중으로 던지기 – mode 'flip'(앞뒤로 도는) | 'heli'(길이축으로 도는 헬리콥터)
function toss(s, mode = 'flip', turns = 2, height = 0.26, air = 0.62) {
  const C = { ...K(KR_GRIP, COM_OPEN), krz: KR_GRIP[2] + s.turn };
  s.at(0.12, { ...W(0.005, -0.035, 0.012), fx: 0.2, fl: 0.12, ...C });
  s.at(0.11, { ...W(-0.005, 0.03, -0.01), fx: -0.22, fl: -0.15, ...H('grip') }).sfx('swish', 0.8);
  s.at(0.05, { ...H('open'), cy: 0.045, cx: -0.005 });
  const r0 = C.krz;
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const up = f <= 0.5;
    const y = height * Math.sin(f * PI) + 0.03 * (1 - f);
    const ch = { cy: [y, up ? 'o' : 'i'], cx: -0.02 * Math.sin(f * PI), cz: -0.02 * Math.sin(f * PI) };
    if (mode === 'flip') ch.krz = [r0 - TAU * turns * f, 'l'];
    else { ch.sy = [s.spin + TAU * turns * f, 'l']; ch.krz = r0 - 0.25 * Math.sin(f * PI); }
    // 공중에서 손잡이가 벌어졌다 다시 닫힘(딸깍)
    if (f > 0.15 && f < 0.85) {
      const g = Math.sin(((f - 0.15) / 0.7) * PI);
      ch.a = mode === 'flip' ? PI * 0.92 * g : 0.7 * g;
      ch.b = mode === 'flip' ? -PI * 0.92 * g : -1.3 * g;
    } else { ch.a = 0; ch.b = 0; }
    if (i === n - 1) Object.assign(ch, H('catch'), W(0, 0.012, 0), { fx: -0.1 });
    s.at(air / n, ch);
    if (i === Math.ceil(n * 0.85)) s.sfx('clack', 0.7, -air / n * 0.4);
    if (mode === 'heli' || i % 2) s.sfx('swish', 0.5, -air / n / 2);
  }
  if (mode === 'flip') s.turn -= TAU * turns; else s.spin += TAU * turns;
  s.at(0.06, { cy: 0, cx: 0, cz: 0, ...s.grip(), a: 0, b: 0, ...W(0, -0.024, 0.006), fx: 0.14, ...H('grip', { iB: 0.95 }) }).sfx('catch', 1).sfx('clack', 0.45);
  s.at(0.1, { ...W(0, 0.005, 0), fx: -0.03 });
  s.at(0.16, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip') });
}
// 칼날을 얼굴 앞으로 세워 보여 주는 마무리
function present(s, hold = 0.7) {
  s.at(0.35, { ...W(-0.05, 0.035, 0.02), tw: -0.8, fx: 0.0, fl: 0.6 });
  s.at(hold, { ...W(-0.053, 0.04, 0.02), tw: -0.9, fx: -0.04, fl: 0.66, ...H('grip', { iB: 0.8, tC: 0.3 }) });
  s.at(0.16, { ...W(0.01, -0.01, 0), tw: 0.1, fx: 0.06, fl: -0.08, ...H('grip') }).sfx('swish', 0.35, -0.08);
  s.at(0.25, { ...W(), tw: 0, fx: 0, fl: 0 });
}

const meta = (label) => ({ from: 'open', to: 'open', label });

// ---------- 개별 트릭 ----------
// 1 팬 회전: 검지로 세 바퀴 → 손등 롤오버로 이어서 마무리
{
  const s = new Seq('twirl', meta('팬 회전'));
  twirl(s, 3, 1.15);
  rollover(s, 1, 0.65);
  KNIFE.twirl = s.build();
}
// 2 에어리얼: 앞뒤로 두 바퀴 돌며 공중에서 칼이 접혔다 펴짐 → 받자마자 접고 다시 펼치기
{
  const s = new Seq('aerial', meta('에어리얼'));
  toss(s, 'flip', 2, 0.27, 0.66);
  closeA(s, 0.85); openA(s, 0.85, 0.008);
  KNIFE.aerial = s.build();
}
// 3 연속 플립(젠): 세이프/바이트 핸들을 번갈아 잡으며 여덟 번 넘기기
{
  const s = new Seq('rapid', meta('연속 플립'));
  const hs = [0, 0.012, 0.004, 0.016];
  for (let r = 0; r < 2; r++) {
    closeA(s, 0.9, hs[r * 2]); toB(s);
    openB(s, 0.9, hs[r * 2 + 1]); closeB(s, 0.85); toA(s);
    openA(s, 0.85, 0.006);
  }
  s.at(0.15, { ...W(), fl: 0, ...H('grip') });
  KNIFE.rapid = s.build();
}
// 4 헬리콥터: 길이축으로 세 바퀴 돌며 손잡이가 벌어지는 토스 → 롤오버 왕복
{
  const s = new Seq('helicopter', meta('헬리콥터'));
  toss(s, 'heli', 3, 0.24, 0.7);
  rollover(s, 1, 0.6);
  rollover(s, -1, 0.6);
  KNIFE.helicopter = s.build();
}
// 6 프리스타일 콤보
{
  const s = new Seq('combo', meta('프리스타일 콤보'));
  closeA(s, 0.85); toB(s); openB(s, 0.85, 0.012); closeB(s, 0.8); toA(s); openA(s, 0.8);
  twirl(s, 2, 0.75);
  rollover(s, 1, 0.6);
  toss(s, 'heli', 3, 0.25, 0.7);
  closeA(s, 0.75, 0.01); openA(s, 0.75);
  toss(s, 'flip', 2, 0.23, 0.66);
  rollover(s, -1, 0.55);
  closeA(s, 0.8); toB(s); openB(s, 0.8, 0.01);
  s.at(0.04, { hb: 0 });
  present(s, 0.8);
  KNIFE.combo = s.build();
}

// ------------------------------------------------------------------
// 살펴보기 – 칼을 화면 가운데로 가져와 양면을 천천히 봄
// ------------------------------------------------------------------
KNIFE.inspect = clipFromPoses({
  name: 'inspect', duration: 2.7, meta: { from: 'open', to: 'open', label: '살펴보기', blend: 0.12 },
  poses: [
    [0.0, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip'), ...KG, ...OPEN }],
    [0.45, { ...W(-0.05, 0.035, 0.02, { tw: -0.8, fx: 0.0, fl: 0.6 }) }],
    [1.05, { ...W(-0.053, 0.04, 0.02, { tw: -0.9, fx: -0.04, fl: 0.66 }), ...H('grip', { iB: 0.78, tC: 0.3 }) }],
    [1.5, { ...W(-0.05, 0.03, 0.02, { tw: -1.2, fx: 0.3, fl: 0.2 }), ...H('grip') }],
    [2.05, { ...W(-0.046, 0.028, 0.018, { tw: -1.26, fx: 0.36, fl: 0.16 }), ...H('grip', { iB: 0.84 }) }],
    [2.35, { ...W(0.006, -0.008, 0, { tw: 0.08, fx: -0.04, fl: -0.05 }), ...H('grip') }],
    [2.7, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip') }],
  ],
  events: [sfx(1.3, 'swish', 0.22), sfx(2.3, 'tick', 0.35)],
});

// ------------------------------------------------------------------
// 휘두르기
// ------------------------------------------------------------------
// 각도를 기준값에서 가장 가까운 2π 등가로 맞춤(손목이 엉뚱하게 한 바퀴 도는 것 방지)
const near = (v, ref) => v + Math.round((ref - v) / TAU) * TAU;
const R3 = (r, ref) => ({ rx: near(r[0], ref.rx), ry: near(r[1], ref.ry), rz: near(r[2], ref.rz) });
function slashClip(name, keys, ev) {
  // keys: [시간, 위치[x,y,z], 회전[rx,ry,rz], 이징, 추가]
  const poses = [[0, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip'), ...KG, ...OPEN, trail: 0 }]];
  let ref = { rx: B.rx, ry: B.ry, rz: B.rz };
  for (const [t, p, r, e, extra] of keys) {
    const rr = R3(r, ref); ref = rr;
    const ch = { x: p[0], y: p[1], z: p[2], ...rr, tw: 0, fx: 0, fl: 0, ...(extra || {}) };
    const o = {};
    for (const k in ch) o[k] = e && 'xyzrxryrz'.includes(k) && k.length <= 2 ? [ch[k], e] : ch[k];
    poses.push([t, o]);
  }
  const end = keys[keys.length - 1][0] + 0.26;
  const back = R3([B.rx, B.ry, B.rz], ref);
  poses.push([end, { ...W(), ...back, tw: 0, fx: 0, fl: 0, ...H('grip'), trail: 0 }]);
  // 다음 클립과는 Animator.wrap 이 이어 줌
  return clipFromPoses({ name, duration: end, meta: { from: 'open', to: 'open', label: '', blend: 0.05, cancelAt: keys[keys.length - 1][0] + 0.02 }, poses, events: ev });
}
const RF_W = [2.458, -0.499, -2.781], RF_M = [1.925, 0.102, 2.834];
const RB_M = [-0.816, 0.281, -0.454], RB_E = [-0.663, -0.57, -0.528];
// 정방향: 오른쪽 위로 크게 젖혔다가 화면을 가로질러 왼쪽 아래까지
KNIFE.slash = slashClip('slash', [
  [0.07, [0.215, 0.035, -0.33], RF_W, 'o', { ...H('grip', { iB: 1, mB: 1 }) }],
  [0.12, [0.235, 0.05, -0.325], [RF_W[0] + 0.08, RF_W[1], RF_W[2] - 0.1], 'o'],
  [0.185, [0.02, -0.055, -0.43], RF_M, 'i', { trail: 1 }],
  [0.235, [-0.17, -0.13, -0.4], [RF_M[0] + 0.25, RF_M[1] + 0.15, RF_M[2] - 0.55], 'o', { trail: 1 }],
  [0.3, [-0.185, -0.14, -0.39], [RF_M[0] + 0.3, RF_M[1] + 0.17, RF_M[2] - 0.62], 'o', { trail: 0 }],
], [sfx(0.12, 'slash', 1), [0.19, 'shake', 0.9]]);
// 역방향: 왼쪽 아래에서 오른쪽 위로 걷어 올리기
KNIFE.slash2 = slashClip('slash2', [
  [0.08, [-0.17, -0.13, -0.4], [RF_M[0] + 0.25, RF_M[1] + 0.15, RF_M[2] - 0.55], 'o', { ...H('grip', { iB: 1, mB: 1 }) }],
  [0.125, [-0.19, -0.145, -0.39], [RF_M[0] + 0.3, RF_M[1] + 0.17, RF_M[2] - 0.62], 'o'],
  [0.185, [0.02, -0.05, -0.43], RB_M, 'i', { trail: 1 }],
  [0.235, [0.19, 0.03, -0.37], RB_E, 'o', { trail: 1 }],
  [0.3, [0.205, 0.04, -0.36], [RB_E[0] - 0.06, RB_E[1] - 0.05, RB_E[2] - 0.08], 'o', { trail: 0 }],
], [sfx(0.13, 'slash', 1), [0.19, 'shake', -0.9]]);

KNIFE.leftIdle = clipFromPoses({
  name: 'leftIdle', duration: 1, loop: true,
  poses: [[0, { ...L_BASE }], [1, { ...L_BASE }]],
});

export const TRICK_ORDER = ['twirl', 'aerial', 'rapid', 'helicopter', 'combo'];
export const TRICK_KEYS = ['twirl', 'aerial', 'rapid', 'helicopter', 'inspect', 'combo'];
