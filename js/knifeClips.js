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
  a: 0, b: 0, kv: 1,
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

// ------------------------------------------------------------------
// 팬 회전 – 검지를 축으로 펼친 칼을 두 바퀴 돌리고 다시 쥠
// ------------------------------------------------------------------
{
  const IDX = [0.03, 0.118, 0.012];           // 검지 가운데 마디 근처(손 좌표)
  const spin = (rz) => ({ ...K([KR_AXLE[0], KR_AXLE[1], rz], COM_OPEN, null), kpx: IDX[0], kpy: IDX[1], kpz: IDX[2] });
  const r0 = KR_AXLE[2];
  KNIFE.twirl = clipFromPoses({
    name: 'twirl', duration: 1.3, meta: { from: 'open', to: 'open', label: '팬 회전' },
    poses: [
      [0.0, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip'), ...KG, ...OPEN }],
      [0.1, { ...W(-0.01, 0.01, 0, { tw: -0.25, fx: -0.15 }), ...H('catch') }],
      [0.2, { ...spin(r0 + 0.25), ...H('axle'), tw: -0.4, fx: -0.25, fl: 0 }],
      [0.36, { krz: [r0 - PI * 0.7, 'i'] }],
      [0.84, { krz: [r0 - PI * 3.5, 'l'] }],
      [1.0, { ...spin(r0 - TAU * 2 + 0.25), krz: [r0 - TAU * 2 + 0.25, 'o'], tw: -0.35, fx: -0.2 }],
      [1.08, { ...KG, krz: KG.krz - TAU * 2, ...H('catch'), tw: -0.1 }],
      [1.13, { ...H('grip', { iB: 0.94 }), fl: 0.08 }],
      [1.3, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip') }],
    ],
    events: [sfx(0.3, 'swish', 0.5), sfx(0.5, 'swish', 0.75), sfx(0.66, 'swish', 0.8), sfx(0.82, 'swish', 0.7), sfx(0.95, 'swish', 0.4), sfx(1.1, 'catch', 0.7), sfx(1.12, 'tick', 0.5)],
  });
}

// ------------------------------------------------------------------
// 에어리얼 – 위로 던져 두 바퀴 돌려 받기
// ------------------------------------------------------------------
{
  const C = K(KR_GRIP, COM_OPEN);           // 무게중심을 축으로 도는 자세(시작 시 위치는 그립과 동일)
  const r0 = KR_GRIP[2];
  KNIFE.aerial = clipFromPoses({
    name: 'aerial', duration: 1.25, meta: { from: 'open', to: 'open', label: '에어리얼' },
    poses: [
      [0.0, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip'), ...KG, cx: 0, cy: 0, cz: 0, ...OPEN }],
      [0.12, { ...W(0.005, -0.03, 0.01, { fx: 0.18 }), fl: 0.12, ...C }],
      [0.24, { ...W(-0.005, 0.03, -0.01, { fx: -0.2 }), fl: -0.15, ...H('grip') }],
      [0.3, { ...H('open'), cy: 0.04, cx: -0.005, krz: r0 - 0.5 }],
      [0.58, { cy: [0.24, 'o'], cx: -0.02, cz: -0.02 }],
      [0.86, { cy: [0.03, 'i'], cx: -0.004, cz: 0, krz: [r0 - TAU * 2 + 0.25, 'l'], ...W(0, 0.012, 0, { fx: -0.1 }), ...H('catch') }],
      [0.92, { cy: 0, cx: 0, ...KG, krz: KG.krz - TAU * 2, ...W(0, -0.022, 0.005, { fx: 0.12 }), ...H('grip', { iB: 0.95 }) }],
      [1.02, { ...W(0, 0.004, 0, { fx: -0.03 }) }],
      [1.25, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip') }],
    ],
    events: [sfx(0.27, 'swish', 0.8), sfx(0.45, 'swish', 0.55), sfx(0.62, 'swish', 0.6), sfx(0.78, 'swish', 0.5), sfx(0.91, 'catch', 1), sfx(0.92, 'clack', 0.45)],
  });
}

// ------------------------------------------------------------------
// 연속 플립 – 접기/펼치기를 빠르게 두 번 (손목 좌우 튕기기)
// ------------------------------------------------------------------
KNIFE.rapid = clipFromPoses({
  name: 'rapid', duration: 1.32, meta: { from: 'open', to: 'open', label: '연속 플립' },
  poses: [
    [0.0, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip'), ...KG, ...OPEN }],
    [0.05, { fl: -0.2, ...H('catch'), a: 0 }],
    [0.15, { a: [PI, 'i'], fl: [0.32, 'o'], b: 0 }],
    [0.17, { a: PI - 0.07, ...H('pinch') }],
    [0.19, { a: PI }],
    [0.27, { b: [-PI, 'i'], fl: [-0.3, 'o'] }],
    [0.29, { b: -PI + 0.07 }],
    [0.31, { b: -PI }],
    [0.4, { b: [0, 'i'], fl: [0.3, 'o'] }],
    [0.42, { b: -0.08, a: PI }],
    [0.44, { b: 0 }],
    [0.53, { a: [0, 'i'], fl: [-0.32, 'o'], ...H('catch') }],
    [0.55, { a: 0.07 }],
    [0.57, { a: 0 }],
    // 두 번째(손 높이를 바꿔서)
    [0.66, { a: [PI, 'i'], fl: [0.34, 'o'], y: B.y + 0.012, b: 0, ...H('pinch') }],
    [0.68, { a: PI - 0.06 }],
    [0.7, { a: PI }],
    [0.77, { b: [-PI, 'i'], fl: [-0.32, 'o'] }],
    [0.79, { b: -PI + 0.06 }],
    [0.81, { b: -PI }],
    [0.89, { b: [0, 'i'], fl: [0.32, 'o'], y: B.y }],
    [0.91, { b: -0.07, a: PI }],
    [0.93, { b: 0 }],
    [1.02, { a: [0, 'i'], fl: [-0.3, 'o'], ...H('catch') }],
    [1.045, { a: 0.07 }],
    [1.07, { a: 0, ...H('grip', { iB: 0.94 }), fl: 0.06 }],
    [1.32, { ...W(), fl: 0, ...H('grip') }],
  ],
  events: [
    sfx(0.15, 'clack', 0.8), sfx(0.27, 'clack', 0.7), sfx(0.4, 'clack', 0.7), sfx(0.53, 'clack', 0.9),
    sfx(0.66, 'clack', 0.8), sfx(0.77, 'clack', 0.7), sfx(0.89, 'clack', 0.7), sfx(1.02, 'clack', 1),
    sfx(0.1, 'swish', 0.4), sfx(0.47, 'swish', 0.5), sfx(0.61, 'swish', 0.4), sfx(0.97, 'swish', 0.5), sfx(1.07, 'catch', 0.4),
  ],
});

// ------------------------------------------------------------------
// 롤오버 – 펼친 칼이 손등 위를 굴러 넘어가 반대편에서 다시 잡힘
// ------------------------------------------------------------------
{
  const P0 = [0.045, 0.09, 0.01], P1 = [0.0, 0.1, -0.03], P2 = [-0.045, 0.085, 0.0];
  const at = (p, rz) => ({ ...K([KR_AXLE[0], KR_AXLE[1], rz], COM_OPEN, null), kpx: p[0], kpy: p[1], kpz: p[2] });
  const r0 = KR_AXLE[2];
  KNIFE.rollover = clipFromPoses({
    name: 'rollover', duration: 1.15, meta: { from: 'open', to: 'open', label: '롤오버' },
    poses: [
      [0.0, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip'), ...KG, ...OPEN }],
      [0.1, { ...W(0, 0.01, 0, { tw: -0.4, fx: -0.1 }), ...H('catch') }],
      [0.2, { ...at(P0, r0 + 0.2), ...H('flat', { tF: 0.3 }), tw: -0.75 }],
      [0.45, { ...at(P1, r0 - PI * 0.9), tw: -0.95, fx: -0.15 }],
      [0.7, { ...at(P2, r0 - PI * 1.9), tw: -0.8 }],
      [0.84, { ...at([0.0, 0.088, 0.02], r0 - TAU - 0.2), ...H('catch'), tw: -0.4 }],
      [0.93, { ...KG, krz: KG.krz - TAU, ...H('grip', { iB: 0.94 }), tw: -0.05, fl: 0.06 }],
      [1.15, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip') }],
    ],
    events: [sfx(0.32, 'swish', 0.5), sfx(0.55, 'swish', 0.6), sfx(0.72, 'swish', 0.4), sfx(0.92, 'catch', 0.7), sfx(0.93, 'tick', 0.5)],
  });
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
KNIFE.slash = clipFromPoses({
  name: 'slash', duration: 0.48, meta: { from: 'open', to: 'open', label: '', blend: 0.04 },
  poses: [
    [0.0, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip'), ...KG, ...OPEN }],
    [0.08, { ...W(0.04, 0.05, 0.03, { tw: -0.3, fx: -0.4, fl: 0.2 }), ...H('grip', { iB: 1, mB: 1 }) }],
    [0.17, { ...W(-0.14, -0.06, -0.08, { tw: 0.5, fx: 0.55, fl: -0.4 }) }],
    [0.24, { ...W(-0.16, -0.08, -0.06, { tw: 0.55, fx: 0.6, fl: -0.45 }) }],
    [0.48, { ...W(), tw: 0, fx: 0, fl: 0, ...H('grip') }],
  ],
  events: [sfx(0.1, 'slash', 1)],
});

KNIFE.leftIdle = clipFromPoses({
  name: 'leftIdle', duration: 1, loop: true,
  poses: [[0, { ...L_BASE }], [1, { ...L_BASE }]],
});

export const TRICK_ORDER = ['twirl', 'aerial', 'rapid', 'rollover'];
export const TRICK_KEYS = ['twirl', 'aerial', 'rapid', 'rollover', 'inspect'];
