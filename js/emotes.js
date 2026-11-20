// 감정표현 – 1인칭(왼손) 클립 + 3인칭(전신) 클립
// 1인칭 손 제스처는 내 화면에 왼손으로, 전신 동작(항복/춤)은 카메라가 앞으로 빠져서 보여 줌
// 모든 감정표현은 전신 클립도 있어서 3인칭(V)·다른 사람(덕배) 화면에서 똑같이 보임
import { clipFromPoses } from './anim.js';
import { HANDS } from './hand.js';
import { L_BASE } from './knifeClips.js';
import { DANCES } from './dances.js';

const PI = Math.PI;
const sfx = (t, name, v = 1) => [t, 'sfx', { name, v }];
const H = (name, extra = {}) => ({ ...HANDS[name], ...extra });
// 왼손(카메라 공간) 위치+회전
const LP = (x, y, z, r, o = {}) => ({ x, y, z, rx: r[0], ry: r[1], rz: r[2], ...o });
const OFF = () => ({ ...L_BASE });
// 손가락 채널 접두사 붙이기(전신용)
const LH = (name, extra = {}) => pre('L', { ...HANDS[name], ...extra });
const RH = (name, extra = {}) => pre('R', { ...HANDS[name], ...extra });
function pre(p, o) { const r = {}; for (const k in o) r[p + k] = o[k]; return r; }

const ROT = {
  thumb: [-0.542, 1.311, -1.169],
  wave: [-2.94, -0.049, -3.132],
  point: [1.611, 0.0, -3.142],
  shush: [0.0, 1.571, 0.0],
  money: [-1.522, -0.007, -0.149],
  face: [-0.015, -0.048, -0.306],
};

// ===================== 1인칭(왼손) =====================
// 손을 내릴 때는 같은 방향을 유지한 채 아래로 빼서(화면 가까이 지나가지 않게) 화면 밖으로
const DOWN = (p) => ({ ...p, y: p.y - 0.32, z: p.z + 0.02 });
const FP = {};

{
  const P = LP(-0.115, -0.088, -0.36, ROT.thumb, { fx: 0, tw: 0, fl: 0 });
  FP.thumb = clipFromPoses({
    name: 'fpThumb', duration: 1.75,
    poses: [
      [0, { ...OFF() }],
      [0.2, { ...P, y: -0.105, z: -0.355, fx: 0.22, tw: 0.1, ...H('thumbUp') }],
      [0.3, { ...P, fx: -0.06 }],
      [0.48, { z: -0.395, y: -0.082, fx: 0.12 }],
      [0.6, { z: -0.36, y: -0.088, fx: -0.04 }],
      [0.76, { z: -0.395, y: -0.082, fx: 0.12 }],
      [0.9, { ...P }],
      [1.32, { ...P, y: -0.09, tw: 0.06, ...H('thumbUp') }],
      [1.6, { ...DOWN(P), ...H('loose') }],
      [1.75, { ...OFF() }],
    ],
    events: [sfx(0.05, 'whoosh', 0.3)],
  });
}
{
  const P = LP(-0.172, 0.0, -0.43, ROT.wave, { fl: 0, fx: 0, tw: 0 });
  const OPEN = H('open', { tA: 0.05, tF: 0.2, tC: 0.1, sp: 0.45 });
  FP.wave = clipFromPoses({
    name: 'fpWave', duration: 2.0,
    poses: [
      [0, { ...OFF() }],
      [0.25, { ...P, ...OPEN, y: -0.02 }],
      [0.42, { ...P, fl: 0.38, x: -0.165 }],
      [0.62, { fl: -0.3, x: -0.18 }],
      [0.82, { fl: 0.38, x: -0.165 }],
      [1.02, { fl: -0.3, x: -0.18 }],
      [1.22, { fl: 0.38, x: -0.165 }],
      [1.42, { ...P, fl: -0.06, ...OPEN }],
      [1.75, { ...DOWN(P), ...H('loose') }],
      [2.0, { ...OFF() }],
    ],
    events: [sfx(0.05, 'whoosh', 0.3)],
  });
}
{
  const P = LP(-0.16, -0.06, -0.36, [1.797, 0.118, -2.668], { fx: 0, tw: 0, fl: 0 });
  FP.point = clipFromPoses({
    name: 'fpPoint', duration: 1.55,
    poses: [
      [0, { ...OFF() }],
      [0.22, { ...P, x: -0.18, z: -0.32, y: -0.075, fx: 0.12, ...H('point') }],
      [0.32, { ...P, x: -0.145, z: -0.39, y: -0.05, fx: -0.06 }],
      [0.4, { ...P }],
      [1.1, { ...P, x: -0.158, y: -0.062, ...H('point') }],
      [1.38, { ...DOWN(P), ...H('loose') }],
      [1.55, { ...OFF() }],
    ],
    events: [sfx(0.05, 'whoosh', 0.35), sfx(0.3, 'pat', 0.2)],
  });
}
{
  const P = LP(-0.03, -0.155, -0.2, [-0.644, 1.385, 0.635], { fx: 0, tw: 0, fl: 0 });
  FP.shush = clipFromPoses({
    name: 'fpShush', duration: 1.9,
    poses: [
      [0, { ...OFF() }],
      [0.18, { ...DOWN(P), ...H('shush') }],
      [0.32, { ...P, y: P.y + 0.008, fx: 0.08 }],
      [0.42, { ...P }],
      [1.3, { ...P, y: P.y + 0.003, tw: 0.04, ...H('shush') }],
      [1.62, { ...DOWN(P), ...H('loose') }],
      [1.9, { ...OFF() }],
    ],
    events: [sfx(0.42, 'shh', 0.8)],
  });
}
{
  const P = LP(-0.095, -0.1, -0.31, [-0.968, 0.001, -0.203], { fx: 0, tw: 0, fl: 0 });
  const A = { tA: 0.75, tF: 0.62, iB: 0.3, mB: 0.36 }, Bq = { tA: 0.3, tF: 0.48, iB: 0.42, mB: 0.46 };
  FP.money = clipFromPoses({
    name: 'fpMoney', duration: 2.1,
    poses: [
      [0, { ...OFF() }],
      [0.25, { ...P, fx: -0.12, ...H('rub') }],
      [0.4, { ...P, ...A }],
      [0.55, { ...Bq }], [0.7, { ...A }], [0.85, { ...Bq }], [1.0, { ...A }], [1.15, { ...Bq }],
      [1.3, { ...A, fx: -0.05 }],
      [1.6, { ...P, ...H('rub'), fx: -0.1 }],
      [1.88, { ...DOWN(P), ...H('loose') }],
      [2.1, { ...OFF() }],
    ],
    events: [sfx(0.4, 'rub'), sfx(0.7, 'rub'), sfx(1.0, 'rub'), sfx(1.3, 'rub')],
  });
}
{
  const P = LP(-0.035, -0.035, -0.12, ROT.face, { fx: 0, tw: 0, fl: 0 });
  FP.face = clipFromPoses({
    name: 'fpFace', duration: 2.2,
    poses: [
      [0, { ...OFF() }],
      [0.2, { ...P, x: -0.07, y: -0.1, z: -0.2, fx: 0.15, ...H('flat', { sp: 0.25 }) }],
      [0.32, { ...P }],
      [0.4, { ...P, z: -0.115 }],
      [1.25, { ...P, y: -0.075, x: -0.04, z: -0.118, fx: -0.08, ...H('flat', { sp: 0.4, iB: 0.15, mB: 0.15 }) }],
      [1.6, { ...P, y: -0.14, x: -0.06, z: -0.17, fx: -0.15, ...H('loose') }],
      [1.95, { ...DOWN({ ...P, y: -0.14, x: -0.06, z: -0.17 }) }],
      [2.2, { ...OFF() }],
    ],
    events: [sfx(0.32, 'pat', 0.9)],
  });
}

// ===================== 3인칭(전신) =====================
const BD = {};
// 차렷(왼팔 기본) – 끝날 때 돌아갈 자세
const REST_L = { luX: 0.05, luY: 0, luZ: 0.12, leX: 0.2, lwX: 0, lwY: 0, lwZ: 0, ...LH('loose'), srx: 0.03, sry: 0, nrx: 0, nry: 0, nrz: 0 };

{
  const P = { luX: 1.0, leX: 0.75, luZ: 0.2, luY: 0.1, lwX: 0.1, lwZ: 0, ...LH('thumbUp'), srx: 0.0, nrx: -0.05 };
  BD.thumb = clipFromPoses({
    name: 'bdThumb', duration: 1.75,
    poses: [
      [0, { ...REST_L }],
      [0.22, { ...P }],
      [0.48, { luX: 1.15, leX: 0.55 }], [0.6, { luX: 0.95, leX: 0.8 }],
      [0.76, { luX: 1.15, leX: 0.55 }], [0.9, { ...P }],
      [1.35, { ...P, nrx: 0.05, nry: 0.1 }],
      [1.75, { ...REST_L }],
    ],
  });
}
{
  const P = { luX: 0.35, luZ: 1.15, luY: 1.3, leX: 1.5, lwX: -0.1, lwZ: 0, ...LH('open'), nry: 0.15, nrz: 0.06, srx: 0.03 };
  BD.wave = clipFromPoses({
    name: 'bdWave', duration: 2.0,
    poses: [
      [0, { ...REST_L }],
      [0.25, { ...P }],
      [0.42, { lwZ: 0.4, luY: 1.15 }], [0.62, { lwZ: -0.35, luY: 1.45 }],
      [0.82, { lwZ: 0.4, luY: 1.15 }], [1.02, { lwZ: -0.35, luY: 1.45 }],
      [1.22, { lwZ: 0.4, luY: 1.15 }], [1.42, { ...P }],
      [2.0, { ...REST_L }],
    ],
  });
}
{
  const P = { luX: 1.4, leX: 0.1, luZ: 0.35, luY: 0.4, lwX: 0, ...LH('point'), sry: -0.1, srx: 0.06 };
  BD.point = clipFromPoses({
    name: 'bdPoint', duration: 1.5,
    poses: [
      [0, { ...REST_L }],
      [0.22, { ...P, luX: 1.25, leX: 0.35, srx: 0.03 }],
      [0.32, { luX: 1.45, leX: 0.05, srx: 0.1 }],
      [0.42, { ...P }],
      [1.05, { ...P, luX: 1.38 }],
      [1.5, { ...REST_L }],
    ],
  });
}
{
  const P = { luX: 0.4, luZ: -0.5, luY: 0.3, leX: 2.45, lwX: -0.2, ...LH('shush'), nrx: 0.12, srx: 0.08 };
  BD.shush = clipFromPoses({
    name: 'bdShush', duration: 1.9,
    poses: [
      [0, { ...REST_L }],
      [0.3, { ...P }],
      [1.3, { ...P, nrx: 0.16, nry: 0.15 }],
      [1.9, { ...REST_L }],
    ],
  });
}
{
  const P = { luX: 0.45, leX: 1.25, luZ: 0.15, luY: 1.2, lwX: -0.2, ...LH('rub'), srx: 0.1, nrx: 0.08 };
  BD.money = clipFromPoses({
    name: 'bdMoney', duration: 2.1,
    poses: [
      [0, { ...REST_L }],
      [0.25, { ...P }],
      [0.4, { LtA: 0.75, LtF: 0.6 }], [0.55, { LtA: 0.35, LtF: 0.5 }],
      [0.7, { LtA: 0.75, LtF: 0.6 }], [0.85, { LtA: 0.35, LtF: 0.5 }],
      [1.0, { LtA: 0.75, LtF: 0.6 }], [1.15, { LtA: 0.35, LtF: 0.5 }],
      [1.3, { LtA: 0.75, LtF: 0.6, nry: -0.1 }],
      [1.6, { ...P, nry: -0.1 }],
      [2.1, { ...REST_L }],
    ],
  });
}
{
  const P = { luX: 0.7, luZ: -0.2, luY: 0.4, leX: 2.35, lwX: -0.35, ...LH('flat'), nrx: 0.3, srx: 0.18 };
  BD.face = clipFromPoses({
    name: 'bdFace', duration: 2.2,
    poses: [
      [0, { ...REST_L }],
      [0.32, { ...P }],
      [0.6, { nry: 0.15 }], [0.85, { nry: -0.15 }], [1.1, { nry: 0.12 }], [1.3, { ...P, nry: 0 }],
      [1.6, { ...P, luX: 0.5, leX: 1.9, nrx: 0.25 }],
      [2.2, { ...REST_L }],
    ],
  });
}

// 항복 – 두 손 번쩍, 다리가 후들후들
BD.surrender = clipFromPoses({
  name: 'bdSurrender', duration: 2.8,
  poses: [
    [0, { luX: 0.05, leX: 0.2, luZ: 0.12, luY: 0, ruX: 0.05, reX: 0.25, ruZ: 0.12, ruY: 0, ...LH('loose'), ...RH('grip'), lkX: 0, rkX: 0, hy: 0, nrx: 0 }],
    [0.22, { luX: 0.2, luZ: 1.4, luY: 1.5, leX: 1.7, lwX: -0.15, ruX: 0.2, ruZ: 1.4, ruY: 1.5, reX: 1.7, rwX: -0.15, ...LH('open'), lkX: 0.12, rkX: 0.12, ltX: 0.06, rtX: 0.06, hy: -0.02, srx: -0.05, nrx: -0.08 }],
    [0.32, { luZ: 1.55, ruZ: 1.55, hy: -0.015 }],
    [0.5, { lkX: 0.18, rkX: 0.08, nry: 0.35, hy: -0.025 }],
    [0.62, { lkX: 0.08, rkX: 0.18, hy: -0.018 }],
    [0.74, { lkX: 0.18, rkX: 0.08, hy: -0.025 }],
    [0.86, { lkX: 0.08, rkX: 0.18, nry: -0.35, hy: -0.018 }],
    [0.98, { lkX: 0.18, rkX: 0.08, hy: -0.025 }],
    [1.1, { lkX: 0.08, rkX: 0.18, hy: -0.018 }],
    [1.3, { lkX: 0.18, rkX: 0.08, nry: 0, nrx: 0.1, hy: -0.025 }],
    [1.5, { lkX: 0.08, rkX: 0.18, hy: -0.018 }],
    [1.7, { lkX: 0.18, rkX: 0.08, hy: -0.025 }],
    [1.9, { lkX: 0.12, rkX: 0.12, hy: -0.02, luX: 0.2, luZ: 1.5, luY: 1.5, leX: 1.7, lwX: -0.15, ruX: 0.2, ruZ: 1.5, ruY: 1.5, reX: 1.7, rwX: -0.15, ltX: 0.06, rtX: 0.06, srx: -0.05 }],
    [2.25, { luX: 0.1, leX: 0.4, luZ: 0.4, luY: 0.3, ruX: 0.1, reX: 0.4, ruZ: 0.4, ruY: 0.3, lkX: 0.03, rkX: 0.03, ltX: 0, rtX: 0, hy: 0, srx: 0.03, nrx: 0 }],
    [2.8, { luX: 0.05, leX: 0.2, luZ: 0.12, luY: 0, lwX: 0, ruX: 0.05, reX: 0.25, ruZ: 0.12, ruY: 0, rwX: 0, ...LH('loose'), ...RH('grip'), lkX: 0, rkX: 0, hy: 0 }],
  ],
  events: [sfx(0.2, 'whoosh', 0.6), sfx(0.9, 'whistle', 0.7)],
});

// ===================== 목록 =====================
const D = (id, name, icon, desc, npc) => ({
  id, name, icon, desc, tp: true, dance: true, body: DANCES[id].clip, music: DANCES[id].music, bpm: DANCES[id].bpm, npcDelay: 0, npc,
});

// 탭 1: 손 제스처 / 탭 2: 춤 – 휠을 연 채로 숫자 1, 2 로 탭 전환
export const EMOTE_TABS = [
  { name: '제스처', list: [
    { id: 'thumb', name: '따봉', icon: '👍', desc: '엄지 척', fp: FP.thumb, body: BD.thumb, npc: ['ㅇㅋ 형님', '따봉은 무슨...', '좋아 좋아'] },
    { id: 'wave', name: '인사', icon: '👋', desc: '손 흔들기', fp: FP.wave, body: BD.wave, npc: ['어 왔냐', '안녕하세요~ 강도입니다', '손 흔들 때가 아니야'] },
    { id: 'point', name: '저기!', icon: '👉', desc: '가리키기', fp: FP.point, body: BD.point, npc: ['어디? 금고?', '저기 뭐!', 'CCTV 말하는 거지?'] },
    { id: 'shush', name: '쉿', icon: '🤫', desc: '조용히', fp: FP.shush, body: BD.shush, npc: ['(속닥) 알겠다고...', '네가 제일 시끄러워', '(끄덕)'] },
    { id: 'money', name: '돈 내놔', icon: '💰', desc: '손가락 비비기', fp: FP.money, body: BD.money, npc: ['그건 은행원한테 해', '나도 없어', '반띵이다?'] },
    { id: 'face', name: '이마짚기', icon: '🤦', desc: '하...', fp: FP.face, body: BD.face, npc: ['내가 뭘 했다고', '하... 나도', '복면 쓰고 이마짚기 ㅋㅋ'] },
    { id: 'surrender', name: '항복', icon: '🙌', desc: '전신 · 3인칭', tp: true, body: BD.surrender, npc: ['벌써?!', '경찰 아직 안 왔어', '나도 같이 들어?'] },
  ] },
  { name: '춤', list: [
    D('parapara', '파라파라', '🕺', '유로비트 · 팔 꽂기', ['파라파라나 춰야겠다...', '은행에서 이걸 춘다고?', '나도 안다 이거!']),
    D('heart', '하트 시그널', '💗', '걸그룹 포인트 안무 풍', ['형... 그 복면으로?', '꺄악 (영혼 없음)', '하트는 금고한테 해']),
    D('sync', '칼군무', '🔥', '보이그룹 퍼포먼스 풍', ['각 잡혔다...', '데뷔해도 되겠는데', '나도 맞춰 볼게']),
    D('shuffle', '셔플', '👟', '러닝맨 스텝', ['발 바쁘다 발', '도망칠 때 그렇게 뛰어', '클럽 아니야 여기']),
    D('disco', '디스코', '🪩', '하늘 찌르기', ['70년대냐고', '조명 어디 갔어', '쿵짝쿵짝']),
    D('robot', '로봇', '🤖', '끊어지는 팔', ['삐빅 강도 로봇', 'CCTV인 척하는 거지?', '기름칠 좀 해']),
    D('bus', '관광버스', '🚌', '트로트 어깨춤', ['삼촌 여기 은행이야', '어깨가 절로 들썩', '노래방 가자 끝나고']),
  ] },
];
export const EMOTES = EMOTE_TABS.flatMap((t) => t.list);

export { FP, BD };
