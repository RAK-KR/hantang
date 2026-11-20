// 춤 모음 – 전부 오리지널 안무(요즘 아이돌 무대/챌린지에서 유행하는 '스타일'만 참고)
// 박자마다 팔 자세를 딱 꽂고(SNAP 초 전에 출발해서 박에 도착), 반박자에 무릎을 펴는 구조
import { clipFromPoses } from './anim.js';
import { HANDS } from './hand.js';

function pre(p, o) { const r = {}; for (const k in o) r[p + k] = o[k]; return r; }
const LH = (n) => pre('L', HANDS[n]);
const RH = (n) => pre('R', HANDS[n]);

// 팔 자세 라이브러리(왼팔 기준 값 – 오른팔은 코드에서 좌우 대칭)
export const ARM = {
  rest: { uX: 0.05, uY: 0, uZ: 0.12, eX: 0.2 },
  hip: { uX: 0.35, uZ: 0.75, uY: -0.6, eX: 1.75 },
  upd: { uX: 2.4, uZ: 0.55, uY: 0, eX: 0.15 },
  downd: { uX: -0.3, uZ: 0.3, uY: 0.4, eX: 0.1 },
  side: { uX: 0, uZ: 1.55, uY: 0, eX: 0.05 },
  front: { uX: 1.55, uZ: 0, uY: 0, eX: 0.05 },
  face: { uX: 1.2, uZ: -0.6, uY: 0.2, eX: 1.4 },
  head: { uX: 3.0, uZ: -0.3, uY: 0, eX: 1.2 },
  up: { uX: 3.1, uZ: 0.15, uY: 0, eX: 0.05 },
  cross: { uX: 1.4, uZ: -0.7, uY: -0.3, eX: 0.1 },
  flex: { uX: 0.3, uZ: 0.9, uY: 0.8, eX: 1.6 },
  over: { uX: 2.0, uZ: -0.2, uY: 1.0, eX: 1.0 },
  rollA: { uX: 1.15, uZ: 0.1, uY: -1.0, eX: 1.5 },
  rollB: { uX: 0.72, uZ: 0.1, uY: -1.0, eX: 1.55 },
  clap: { uX: 3.0, uZ: -0.1, uY: 0, eX: 0.15 },
  heart: { uX: 2.6, uZ: 0.3, uY: -0.6, eX: 1.9 },          // 머리 위 큰 하트
  cute: { uX: 0.9, uZ: -0.5, uY: 0.3, eX: 2.1 },           // 볼 옆 주먹
  cheek: { uX: 0.9, uZ: -0.35, uY: 0.5, eX: 2.5 },         // 볼에 손가락
  rUp: { uX: 0.2, uZ: 1.5, uY: 1.5, eX: 1.6 },             // 로봇: 팔 옆, 아래팔 위
  rDown: { uX: 0, uZ: 1.5, uY: -1.5, eX: 1.6 },            // 로봇: 팔 옆, 아래팔 아래
  rFwd: { uX: 0.05, uZ: 0.1, uY: 0, eX: 1.57 },            // 로봇: 아래팔 앞으로 직각
  pull: { uX: -0.5, uZ: 0.2, uY: 0, eX: 1.8 },             // 팔꿈치 뒤로 당기기
  bus: { uX: 0.3, uZ: 0.6, uY: 1.2, eX: 2.0 },             // 손 들고 까딱(관광버스)
  discoX: { uX: -0.2, uZ: -0.4, uY: 0, eX: 0.1 },          // 몸 앞을 가로질러 아래 찌르기
  fold: { uX: 1.3, uZ: 0.1, uY: -1.4, eX: 1.6 },           // 가슴 앞 팔짱
  lowV: { uX: 0, uZ: 0.6, uY: -0.3, eX: 0.1 },
  punch: { uX: 1.5, uZ: 0.1, uY: 0, eX: 0.05 },
  mid: { uX: 0.8, uZ: 0.3, uY: 0.6, eX: 1.2 },             // 반쯤 든 팔(흔들기용)
};
const arm = (side, name) => { const a = ARM[name]; return { [side + 'uX']: a.uX, [side + 'uY']: a.uY, [side + 'uZ']: a.uZ, [side + 'eX']: a.eX, [side + 'wX']: 0, [side + 'wZ']: 0 }; };

const REST = {
  ...arm('l', 'rest'), ...arm('r', 'rest'), ...LH('loose'), ...RH('grip'),
  hx: 0, hy: 0, hrx: 0, hry: 0, hrz: 0, srx: 0.03, sry: 0, srz: 0, nrx: 0, nry: 0, nrz: 0,
  ltX: 0, ltZ: 0.04, lkX: 0, lfX: 0, rtX: 0, rtZ: 0.04, rkX: 0, rfX: 0,
};
const LEG0 = { ltX: 0, rtX: 0, ltZ: 0.04, rtZ: 0.04, lkX: 0.08, rkX: 0.08, lfX: 0, rfX: 0, hx: 0, hrz: 0, hry: 0, srx: 0.03, sry: 0, srz: 0, hrx: 0 };

/**
 * 박자 목록으로 춤 클립 만들기
 * beat: [오른팔, 왼팔, 왼손모양, 고개[nry,nrz,nrx], 추가채널{}, 반박자{r,l,b}]
 * steps: 다리 패턴 배열 – { on:{}, mid:{} } (박에 / 반박자에)
 */
function buildDance({ name, bpm, beats, steps, snap = 0.12, dip = -0.04 }) {
  const BEAT = 60 / bpm;
  const cur = { ...REST };
  const poses = [];
  const key = (t, ch = {}, ease) => {
    Object.assign(cur, ch);
    const p = {};
    for (const k in cur) p[k] = ease && k in ch ? [cur[k], ease] : cur[k];
    poses.push([t, p]);
  };
  key(0);
  beats.forEach((b, i) => {
    const t = (i + 1) * BEAT;
    const [ra, la, lh = 'flat', hd = [0, 0, 0], extra = {}, mid] = b;
    const st = steps[i % steps.length];
    key(t - snap, {});
    key(t, {
      ...arm('r', ra), ...arm('l', la), ...LH(lh),
      nry: hd[0], nrz: hd[1], nrx: hd[2] || 0,
      ...LEG0, hy: dip, ...(st.on || {}), ...extra,
    }, 'o');
    const m = { ...(st.mid || {}) };
    if (mid?.r) Object.assign(m, arm('r', mid.r));
    if (mid?.l) Object.assign(m, arm('l', mid.l));
    if (mid?.b) Object.assign(m, mid.b);
    key(t + BEAT / 2, m, mid ? 'o' : undefined);
  });
  const end = (beats.length + 1) * BEAT;
  key(end + 0.45, { hy: -0.01 });
  key(end + 1.0, { ...REST });
  return clipFromPoses({ name, duration: end + 1.0, poses });
}

// ---------------- 다리 패턴 ----------------
const STEP_TOUCH = [
  { on: { hx: -0.05, rtZ: 0.12, ltZ: 0.02, hry: -0.12, lkX: 0.1 }, mid: { hy: -0.008 } },
  { on: { hx: -0.05, rtZ: 0.08, hry: -0.06, lkX: 0.45, lfX: 0.35 }, mid: { hy: -0.008 } },
  { on: { hx: 0.05, ltZ: 0.12, rtZ: 0.02, hry: 0.12, rkX: 0.1 }, mid: { hy: -0.008 } },
  { on: { hx: 0.05, ltZ: 0.08, hry: 0.06, rkX: 0.45, rfX: 0.35 }, mid: { hy: -0.008 } },
];
const BOUNCE = [
  { on: { hy: -0.07, lkX: 0.4, rkX: 0.4, ltX: 0.2, rtX: 0.2, hx: -0.03, hrz: -0.06 }, mid: { hy: -0.015, lkX: 0.12, rkX: 0.12, ltX: 0.05, rtX: 0.05 } },
  { on: { hy: -0.07, lkX: 0.4, rkX: 0.4, ltX: 0.2, rtX: 0.2, hx: 0.03, hrz: 0.06 }, mid: { hy: -0.015, lkX: 0.12, rkX: 0.12, ltX: 0.05, rtX: 0.05 } },
];
const WIDE = [
  { on: { ltZ: 0.22, rtZ: 0.22, lkX: 0.35, rkX: 0.35, ltX: 0.2, rtX: 0.2, hy: -0.08, srx: 0.16 }, mid: { hy: -0.05, srx: 0.06 } },
  { on: { ltZ: 0.22, rtZ: 0.22, lkX: 0.35, rkX: 0.35, ltX: 0.2, rtX: 0.2, hy: -0.08, srx: -0.05, hry: 0.15 }, mid: { hy: -0.05, srx: 0.04 } },
  { on: { ltZ: 0.22, rtZ: 0.22, lkX: 0.35, rkX: 0.35, ltX: 0.2, rtX: 0.2, hy: -0.08, srx: 0.16 }, mid: { hy: -0.05, srx: 0.06 } },
  { on: { ltZ: 0.22, rtZ: 0.22, lkX: 0.35, rkX: 0.35, ltX: 0.2, rtX: 0.2, hy: -0.08, srx: -0.05, hry: -0.15 }, mid: { hy: -0.05, srx: 0.04 } },
];
const RUNNING_MAN = [
  { on: { ltX: 0.75, lkX: 0.95, rtX: -0.35, rkX: 0.25, rfX: -0.2, hy: -0.03, srx: 0.08 }, mid: { ltX: 0.15, lkX: 0.4, rtX: 0.15, rkX: 0.4, lfX: 0, rfX: 0, hy: -0.07 } },
  { on: { rtX: 0.75, rkX: 0.95, ltX: -0.35, lkX: 0.25, lfX: -0.2, hy: -0.03, srx: 0.08 }, mid: { ltX: 0.15, lkX: 0.4, rtX: 0.15, rkX: 0.4, lfX: 0, rfX: 0, hy: -0.07 } },
];
const DISCO = [
  { on: { hx: -0.06, rtZ: 0.14, hrz: -0.1, srz: 0.08, lkX: 0.25, hry: -0.15 }, mid: { hy: -0.01 } },
  { on: { hx: -0.06, rtZ: 0.1, hrz: -0.12, srz: 0.1, lkX: 0.5, lfX: 0.4, hry: -0.1 }, mid: { hy: -0.01 } },
  { on: { hx: 0.06, ltZ: 0.14, hrz: 0.1, srz: -0.08, rkX: 0.25, hry: 0.15 }, mid: { hy: -0.01 } },
  { on: { hx: 0.06, ltZ: 0.1, hrz: 0.12, srz: -0.1, rkX: 0.5, rfX: 0.4, hry: 0.1 }, mid: { hy: -0.01 } },
];
const ROBOT = [
  { on: { hy: -0.02, hry: 0.0 } }, { on: { hy: -0.02, hx: 0.03 } }, { on: { hy: -0.02 } }, { on: { hy: -0.02, hx: -0.03 } },
];
const TROT = [
  { on: { hy: -0.05, lkX: 0.3, rkX: 0.15, hx: -0.04, hry: -0.25, srz: 0.12 }, mid: { hy: -0.01, lkX: 0.1, rkX: 0.1, srz: 0 } },
  { on: { hy: -0.05, rkX: 0.3, lkX: 0.15, hx: 0.04, hry: 0.25, srz: -0.12 }, mid: { hy: -0.01, lkX: 0.1, rkX: 0.1, srz: 0 } },
];

// ---------------- 춤 ----------------
export const DANCES = {};

// 1. 파라파라 (유로비트 150)
DANCES.parapara = { bpm: 150, music: 'parapara', clip: buildDance({ name: 'parapara', bpm: 150, steps: STEP_TOUCH, beats: [
  ['upd', 'hip', 'point', [-0.3, 0.1]], ['hip', 'upd', 'point', [0.3, -0.1]], ['upd', 'upd'], ['downd', 'downd', 'flat', [0, 0.1]],
  ['front', 'hip', 'flat', [-0.2, 0]], ['front', 'front', 'flat', [0.2, 0]], ['clap', 'clap'], ['head', 'hip', 'flat', [-0.2, 0.15]],
  ['rollA', 'rollB', 'flat', [0, 0], {}, { r: 'rollB', l: 'rollA' }], ['rollA', 'rollB', 'flat', [0, 0], {}, { r: 'rollB', l: 'rollA' }], ['side', 'side'], ['face', 'face', 'flat', [0, -0.1]],
  ['rollA', 'rollB', 'flat', [0, 0], {}, { r: 'rollB', l: 'rollA' }], ['rollA', 'rollB', 'flat', [0, 0], {}, { r: 'rollB', l: 'rollA' }], ['upd', 'downd', 'point', [-0.3, 0.12]], ['downd', 'upd', 'point', [0.3, -0.12]],
  ['face', 'hip', 'flat', [-0.25, 0.15]], ['side', 'hip', 'flat', [-0.35, 0]], ['hip', 'face', 'flat', [0.25, -0.15]], ['hip', 'side', 'flat', [0.35, 0]],
  ['flex', 'flex', 'fist'], ['front', 'front'], ['up', 'up', 'open'], ['downd', 'downd', 'flat', [0, 0.1]],
  ['over', 'hip', 'flat', [-0.2, 0.1]], ['hip', 'over', 'flat', [0.2, -0.1]], ['over', 'hip', 'flat', [-0.2, 0.1]], ['hip', 'over', 'flat', [0.2, -0.1]],
  ['cross', 'cross'], ['side', 'side', 'open'], ['up', 'up', 'open'], ['upd', 'hip', 'point', [-0.35, 0.2]],
] }) };

// 2. 하트 시그널 – 걸그룹 포인트 안무 풍 (저지클럽 140): 머리 위 하트, 볼 옆 주먹, 윙크 고개 까딱
DANCES.heart = { bpm: 140, music: 'jersey', clip: buildDance({ name: 'heart', bpm: 140, steps: BOUNCE, beats: [
  ['heart', 'heart', 'flat', [0, 0.15]], ['heart', 'heart', 'flat', [0, -0.15]], ['cute', 'cute', 'fist', [0.15, 0.2]], ['cute', 'cute', 'fist', [-0.15, -0.2]],
  ['hip', 'cheek', 'point', [0.3, -0.25, 0.1]], ['hip', 'upd', 'point', [0.2, -0.1]], ['hip', 'cheek', 'point', [0.3, -0.25, 0.1]], ['hip', 'lowV', 'open', [0, 0]],
  ['lowV', 'lowV', 'open', [0, 0.1], { hx: -0.06 }], ['lowV', 'lowV', 'open', [0, -0.1], { hx: 0.06 }], ['fold', 'fold', 'flat', [0, 0, 0.1]], ['side', 'side', 'open', [0, 0, -0.1]],
  ['mid', 'mid', 'open', [0, 0.1], {}, { r: 'bus', l: 'bus' }], ['mid', 'mid', 'open', [0, -0.1], {}, { r: 'bus', l: 'bus' }], ['downd', 'downd', 'flat', [0, 0, 0.15]], ['heart', 'heart', 'flat', [0, 0.2]],
  ['cheek', 'hip', 'point', [-0.3, 0.25, 0.1]], ['upd', 'hip', 'point', [-0.2, 0.1]], ['cheek', 'hip', 'point', [-0.3, 0.25, 0.1]], ['lowV', 'hip', 'open'],
  ['cute', 'cute', 'fist', [0.15, 0.2], { hrz: -0.12 }], ['cute', 'cute', 'fist', [-0.15, -0.2], { hrz: 0.12 }], ['heart', 'heart', 'flat', [0, 0.18]], ['hip', 'cheek', 'point', [0.35, -0.3, 0.12], { lkX: 0.6, lfX: 0.5 }],
] }) };

// 3. 칼군무 – 보이그룹 퍼포먼스 풍 (트랩 96): 넓은 스탠스, 가슴 팝, 반박자 히트
DANCES.sync = { bpm: 96, music: 'trap', clip: buildDance({ name: 'sync', bpm: 96, steps: WIDE, snap: 0.09, dip: -0.08, beats: [
  ['punch', 'pull', 'fist', [-0.2, 0], {}, { r: 'pull', l: 'punch' }], ['punch', 'pull', 'fist', [-0.2, 0], {}, { r: 'pull', l: 'punch' }], ['upd', 'upd', 'fist', [0, 0, -0.2]], ['fold', 'fold', 'fist', [0, 0, 0.2]],
  ['side', 'side', 'flat', [0, 0], {}, { r: 'rDown', l: 'rDown' }], ['rUp', 'rUp', 'fist', [0.3, 0]], ['cross', 'cross', 'flat', [0, 0, 0.1]], ['flex', 'flex', 'fist', [0, 0, -0.15]],
  ['over', 'hip', 'flat', [-0.3, 0.15], {}, { r: 'side' }], ['hip', 'over', 'flat', [0.3, -0.15], {}, { l: 'side' }], ['punch', 'punch', 'fist', [0, 0], { srx: 0.3 }], ['downd', 'downd', 'flat', [0, 0, 0.25], { hy: -0.16, lkX: 0.8, rkX: 0.8, ltX: 0.5, rtX: 0.5 }],
  ['pull', 'punch', 'fist', [0.2, 0], {}, { r: 'punch', l: 'pull' }], ['pull', 'punch', 'fist', [0.2, 0], {}, { r: 'punch', l: 'pull' }], ['up', 'up', 'fist', [0, 0, -0.25]], ['fold', 'fold', 'fist'],
  ['face', 'face', 'flat', [0, 0, 0.1], {}, { r: 'side', l: 'side' }], ['upd', 'downd', 'point', [-0.4, 0.1]], ['downd', 'upd', 'point', [0.4, -0.1]], ['hip', 'hip', 'flat', [0, 0, 0.2], { srx: 0.25 }],
  ['rUp', 'rDown', 'fist', [0.3, 0], {}, { r: 'rDown', l: 'rUp' }], ['rUp', 'rDown', 'fist', [-0.3, 0], {}, { r: 'rDown', l: 'rUp' }], ['punch', 'hip', 'fist', [-0.3, 0], { srx: 0.2 }], ['upd', 'hip', 'fist', [-0.3, 0.1, -0.15]],
] }) };

// 4. 셔플 – 러닝맨 스텝 (하우스 124)
DANCES.shuffle = { bpm: 124, music: 'house', clip: buildDance({ name: 'shuffle', bpm: 124, steps: RUNNING_MAN, snap: 0.1, dip: -0.04, beats: [
  ['pull', 'front', 'fist'], ['front', 'pull', 'fist'], ['pull', 'front', 'fist'], ['front', 'pull', 'fist'],
  ['pull', 'front', 'fist'], ['front', 'pull', 'fist'], ['upd', 'upd', 'fist', [0, 0, -0.15]], ['downd', 'downd', 'fist'],
  ['side', 'side', 'open'], ['lowV', 'lowV', 'open'], ['side', 'side', 'open'], ['lowV', 'lowV', 'open'],
  ['upd', 'hip', 'point', [-0.3, 0.1]], ['hip', 'upd', 'point', [0.3, -0.1]], ['upd', 'hip', 'point', [-0.3, 0.1]], ['hip', 'upd', 'point', [0.3, -0.1]],
  ['pull', 'front', 'fist', [0.2, 0]], ['front', 'pull', 'fist', [-0.2, 0]], ['pull', 'front', 'fist', [0.2, 0]], ['front', 'pull', 'fist', [-0.2, 0]],
  ['up', 'up', 'open'], ['flex', 'flex', 'fist'], ['up', 'up', 'open'], ['flex', 'flex', 'fist'],
  ['pull', 'front', 'fist'], ['front', 'pull', 'fist'], ['pull', 'front', 'fist'], ['front', 'pull', 'fist'],
  ['cross', 'cross'], ['side', 'side', 'open'], ['upd', 'upd', 'open'], ['upd', 'hip', 'point', [-0.3, 0.15]],
] }) };

// 5. 디스코 – 하늘 찌르고 몸 가로질러 내리기 + 롤 (디스코 118)
DANCES.disco = { bpm: 118, music: 'disco', clip: buildDance({ name: 'disco', bpm: 118, steps: DISCO, beats: [
  ['upd', 'hip', 'point', [-0.35, 0.1]], ['discoX', 'hip', 'point', [0.2, -0.05]], ['upd', 'hip', 'point', [-0.35, 0.1]], ['discoX', 'hip', 'point', [0.2, -0.05]],
  ['hip', 'upd', 'point', [0.35, -0.1]], ['hip', 'discoX', 'point', [-0.2, 0.05]], ['hip', 'upd', 'point', [0.35, -0.1]], ['hip', 'discoX', 'point', [-0.2, 0.05]],
  ['rollA', 'rollB', 'flat', [0, 0.1], {}, { r: 'rollB', l: 'rollA' }], ['rollA', 'rollB', 'flat', [0, -0.1], {}, { r: 'rollB', l: 'rollA' }], ['rollA', 'rollB', 'flat', [0, 0.1], {}, { r: 'rollB', l: 'rollA' }], ['upd', 'upd', 'point', [0, 0, -0.2]],
  ['clap', 'clap', 'flat'], ['lowV', 'lowV', 'open'], ['clap', 'clap', 'flat'], ['lowV', 'lowV', 'open'],
  ['flex', 'flex', 'fist', [-0.2, 0]], ['flex', 'flex', 'fist', [0.2, 0]], ['over', 'over', 'flat'], ['side', 'side', 'open'],
  ['upd', 'discoX', 'point', [-0.3, 0.1]], ['discoX', 'upd', 'point', [0.3, -0.1]], ['upd', 'hip', 'point', [-0.4, 0.15]], ['upd', 'hip', 'point', [-0.4, 0.15], { lkX: 0.6, lfX: 0.5 }],
] }) };

// 6. 로봇 – 직각으로 끊어지는 팔과 고개 (일렉트로 100)
DANCES.robot = { bpm: 100, music: 'electro', clip: buildDance({ name: 'robot', bpm: 100, steps: ROBOT, snap: 0.06, dip: -0.02, beats: [
  ['rFwd', 'rest', 'flat', [0, 0]], ['rFwd', 'rFwd', 'flat', [0, 0]], ['rUp', 'rFwd', 'flat', [-0.6, 0]], ['rUp', 'rUp', 'flat', [0, 0]],
  ['rDown', 'rUp', 'flat', [0.6, 0]], ['rUp', 'rDown', 'flat', [-0.6, 0]], ['rDown', 'rDown', 'flat', [0, 0, 0.2]], ['side', 'side', 'flat', [0, 0, -0.1]],
  ['rFwd', 'rFwd', 'flat', [0.7, 0], { hry: 0.5 }], ['rFwd', 'rFwd', 'flat', [0, 0], { hry: 0 }], ['rFwd', 'rFwd', 'flat', [-0.7, 0], { hry: -0.5 }], ['rFwd', 'rFwd', 'flat', [0, 0], { hry: 0 }],
  ['punch', 'rest', 'flat', [0, 0], { srx: 0.15 }], ['rest', 'punch', 'flat', [0, 0], { srx: 0.15 }], ['punch', 'punch', 'flat', [0, 0, 0.2], { srx: 0.25 }], ['rUp', 'rUp', 'flat', [0, 0, -0.1], { srx: 0 }],
  ['rUp', 'rDown', 'flat', [0, 0.3]], ['rDown', 'rUp', 'flat', [0, -0.3]], ['rUp', 'rDown', 'flat', [0, 0.3]], ['rDown', 'rUp', 'flat', [0, -0.3]],
  ['front', 'front', 'flat', [0, 0, 0.3], { srx: 0.4, hy: -0.08, lkX: 0.4, rkX: 0.4, ltX: 0.25, rtX: 0.25 }], ['rFwd', 'rFwd', 'flat', [0, 0, 0]], ['rUp', 'rUp', 'flat', [0.8, 0]], ['rUp', 'rFwd', 'flat', [0.8, 0.2, 0.1]],
] }) };

// 7. 관광버스 – 트로트 어깨춤 (뽕짝 130)
DANCES.bus = { bpm: 130, music: 'trot', clip: buildDance({ name: 'bus', bpm: 130, steps: TROT, beats: [
  ['bus', 'bus', 'open', [-0.2, 0.15]], ['bus', 'bus', 'open', [0.2, -0.15]], ['bus', 'bus', 'open', [-0.2, 0.15]], ['bus', 'bus', 'open', [0.2, -0.15]],
  ['flex', 'mid', 'fist', [-0.3, 0.1], {}, { r: 'mid', l: 'flex' }], ['flex', 'mid', 'fist', [0.3, -0.1], {}, { r: 'mid', l: 'flex' }], ['flex', 'mid', 'fist', [-0.3, 0.1], {}, { r: 'mid', l: 'flex' }], ['up', 'up', 'open', [0, 0, -0.2]],
  ['upd', 'hip', 'point', [-0.4, 0.2]], ['upd', 'hip', 'point', [-0.4, 0.2], { hy: -0.1 }], ['hip', 'upd', 'point', [0.4, -0.2]], ['hip', 'upd', 'point', [0.4, -0.2], { hy: -0.1 }],
  ['over', 'over', 'flat', [0, 0.2]], ['over', 'over', 'flat', [0, -0.2]], ['clap', 'clap', 'flat'], ['clap', 'clap', 'flat', [0, 0, 0.1]],
  ['bus', 'bus', 'open', [-0.3, 0.2], { srz: 0.2 }], ['bus', 'bus', 'open', [0.3, -0.2], { srz: -0.2 }], ['mid', 'mid', 'fist', [-0.3, 0.2], { srz: 0.2 }, { r: 'flex', l: 'flex' }], ['mid', 'mid', 'fist', [0.3, -0.2], { srz: -0.2 }, { r: 'flex', l: 'flex' }],
  ['up', 'up', 'open', [0, 0, -0.2]], ['bus', 'bus', 'open', [0, 0]], ['up', 'up', 'open', [0, 0, -0.2]], ['upd', 'upd', 'open', [0, 0, -0.25], { hy: -0.02 }],
] }) };
