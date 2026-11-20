// 키프레임 애니메이션 – 채널(숫자) 단위 트랙, 단조 3차 보간(튀지 않는 부드러운 곡선) + 이징 선택
// 트랙 키: [시간, 값, 이징?]  이징은 '이전 키 -> 이 키' 구간에 적용
//  c: 단조 3차(기본, 속도가 이어짐)  l: 선형  i: 가속  o: 감속  io: 가감속  s: 계단  b: 살짝 튕김

const EASE = {
  l: (s) => s,
  i: (s) => s * s * s,
  o: (s) => 1 - Math.pow(1 - s, 3),
  io: (s) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2),
  s: (s) => (s < 1 ? 0 : 1),
  b: (s) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(s - 1, 3) + c1 * Math.pow(s - 1, 2); },
};

function prepTrack(keys) {
  const n = keys.length;
  const t = keys.map((k) => k[0]);
  const v = keys.map((k) => k[1]);
  const e = keys.map((k) => k[2] || 'c');
  // 단조 3차 탄젠트 (Fritsch–Carlson)
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((v[i + 1] - v[i]) / Math.max(1e-6, t[i + 1] - t[i]));
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * (t[i + 1] - t[i]) + (t[i] - t[i - 1]);
      const w2 = (t[i + 1] - t[i]) + 2 * (t[i] - t[i - 1]);
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  // 양 끝은 멈춘 상태에서 시작/끝 (단, 끝 키가 선형이면 기울기 유지)
  return { t, v, e, m, n };
}

function sampleTrack(tr, time) {
  const { t, v, e, m, n } = tr;
  if (n === 1 || time <= t[0]) return v[0];
  if (time >= t[n - 1]) return v[n - 1];
  let i = 0;
  while (i < n - 2 && time > t[i + 1]) i++;
  const h = t[i + 1] - t[i];
  const s = (time - t[i]) / h;
  const ease = e[i + 1];
  if (ease !== 'c') return v[i] + (v[i + 1] - v[i]) * EASE[ease](s);
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  return h00 * v[i] + h10 * h * m[i] + h01 * v[i + 1] + h11 * h * m[i + 1];
}

export class Clip {
  /**
   * @param {object} def { name, duration, loop, tracks: {ch: [[t,v,ease]...]}, events: [[t, type, arg]] }
   */
  constructor(def) {
    this.name = def.name;
    this.duration = def.duration;
    this.loop = !!def.loop;
    this.events = (def.events || []).slice().sort((a, b) => a[0] - b[0]);
    this.tracks = {};
    for (const ch in def.tracks) this.tracks[ch] = prepTrack(def.tracks[ch]);
    this.meta = def.meta || {};
  }
  sample(time, out) {
    for (const ch in this.tracks) out[ch] = sampleTrack(this.tracks[ch], time);
    return out;
  }
}

// 여러 키프레임을 [시간, {채널:값}] 형태로 적는 헬퍼 – 사람 손으로 쓰기 쉽게
// poses: [[t, {ch: v | [v, ease]}], ...]
export function clipFromPoses(def) {
  const tracks = {};
  for (const [t, p] of def.poses) {
    for (const ch in p) {
      const val = p[ch];
      const [v, ease] = Array.isArray(val) ? val : [val, undefined];
      (tracks[ch] ||= []).push(ease ? [t, v, ease] : [t, v]);
    }
  }
  return new Clip({ ...def, tracks });
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

/**
 * 클립 재생기 – 이전 포즈에서 새 클립으로 블렌딩, 이벤트(소리 등) 발생
 */
export class Animator {
  constructor(base) {
    this.base = { ...base };     // 기본 포즈(모든 채널의 기본값)
    this.pose = { ...base };     // 현재 출력
    this.from = null;            // 블렌드 시작 포즈
    this.clip = null;
    this.time = 0;
    this.blend = 0;
    this.blendT = 0;
    this.speed = 1;
    this.onEvent = null;
    this.onEnd = null;
    this.wrap = null;            // 2π 단위로 감아 줄 채널 목록
    this._tmp = {};
  }
  play(clip, opt = {}) {
    this.from = { ...this.pose };
    // 회전 채널은 2π 단위로 가장 가까운 값에서 이어지게(여러 바퀴 돈 뒤 되감기 방지)
    if (this.wrap) {
      const first = {};
      clip.sample(opt.start || 0, first);
      for (const k of this.wrap) {
        if (first[k] === undefined || this.from[k] === undefined) continue;
        const T = Math.PI * 2;
        this.from[k] += Math.round((first[k] - this.from[k]) / T) * T;
        this.pose[k] = this.from[k];
      }
    }
    this.clip = clip;
    this.time = opt.start || 0;
    this.blend = opt.blend ?? 0.08;
    this.blendT = 0;
    this.speed = opt.speed ?? 1;
    this.onEnd = opt.onEnd || null;
    this.hold = !!opt.hold;
  }
  get playing() { return !!this.clip; }
  get progress() { return this.clip ? this.time / this.clip.duration : 0; }

  update(dt) {
    const clip = this.clip;
    if (!clip) return this.pose;
    const prev = this.time;
    this.time += dt * this.speed;
    // 이벤트
    if (this.onEvent) {
      for (const ev of clip.events) {
        if (ev[0] > prev && ev[0] <= this.time) this.onEvent(ev[1], ev[2], ev);
        else if (prev === 0 && ev[0] === 0 && this.time > 0) this.onEvent(ev[1], ev[2], ev);
      }
    }
    let ended = false;
    if (this.time >= clip.duration) {
      if (clip.loop) this.time %= clip.duration;
      else { this.time = clip.duration; ended = true; }
    }
    const s = this._tmp;
    for (const k in this.base) s[k] = this.base[k];
    clip.sample(this.time, s);
    this.blendT += dt;
    const w = this.blend > 0 ? smooth(this.blendT / this.blend) : 1;
    for (const k in s) this.pose[k] = w >= 1 || !this.from ? s[k] : lerp(this.from[k] ?? s[k], s[k], w);
    if (ended && !this.hold) {
      const cb = this.onEnd;
      this.clip = null;
      if (cb) cb();
    }
    return this.pose;
  }
}
