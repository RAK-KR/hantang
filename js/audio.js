// 효과음 – 전부 WebAudio로 합성 (외부 파일 없음)
let ctx = null, master = null, noiseBuf = null;
export const audio = { volume: 0.8 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = audio.volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolume(v) { audio.volume = v; if (master) master.gain.value = v; }

function noise(t, dur, f, q, gain, type = 'bandpass', pan = 0) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const bq = ctx.createBiquadFilter(); bq.type = type; bq.frequency.value = f; bq.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  s.connect(bq).connect(g).connect(p).connect(master);
  s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  return bq;
}
function tone(t, f, dur, gain, type = 'sine', pan = 0, fEnd) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  o.connect(g).connect(p).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

const SFX = {
  // 발리송 손잡이가 맞물리는 '딸깍' – 묵직한 바디 + 금속 울림
  clack(v = 1, pan = 0.3) {
    const t = ctx.currentTime;
    const j = 1 + (Math.random() - 0.5) * 0.12;
    noise(t, 0.035, 2600 * j, 4, 0.55 * v, 'bandpass', pan);
    noise(t, 0.06, 900 * j, 2, 0.35 * v, 'bandpass', pan);
    tone(t, 1720 * j, 0.07, 0.07 * v, 'triangle', pan);
    tone(t, 2410 * j, 0.05, 0.04 * v, 'sine', pan);
    tone(t, 190 * j, 0.045, 0.22 * v, 'sine', pan, 120);
  },
  // 핀이 도는 가벼운 '틱'
  tick(v = 1, pan = 0.3) {
    const t = ctx.currentTime;
    noise(t, 0.018, 3600, 6, 0.22 * v, 'bandpass', pan);
    tone(t, 2900, 0.025, 0.025 * v, 'sine', pan);
  },
  // 칼이 빠르게 도는 바람 소리
  swish(v = 1, pan = 0.3) {
    const t = ctx.currentTime;
    const bq = noise(t, 0.16, 700, 1.4, 0.18 * v, 'bandpass', pan);
    bq.frequency.setValueAtTime(600, t);
    bq.frequency.exponentialRampToValueAtTime(2200, t + 0.08);
    bq.frequency.exponentialRampToValueAtTime(900, t + 0.16);
  },
  // 손에 칼이 착 잡히는 소리
  catch(v = 1, pan = 0.3) {
    const t = ctx.currentTime;
    noise(t, 0.05, 500, 1.2, 0.35 * v, 'bandpass', pan);
    noise(t, 0.03, 2400, 3, 0.2 * v, 'bandpass', pan);
  },
  slash(v = 1) {
    const t = ctx.currentTime;
    const bq = noise(t, 0.22, 500, 1.1, 0.35 * v, 'bandpass', 0.2);
    bq.frequency.setValueAtTime(400, t);
    bq.frequency.exponentialRampToValueAtTime(1800, t + 0.1);
    bq.frequency.exponentialRampToValueAtTime(500, t + 0.22);
  },
  clap(v = 1, pan = 0) {
    const t = ctx.currentTime;
    noise(t, 0.08, 1300, 1.2, 0.6 * v, 'bandpass', pan);
    noise(t + 0.004, 0.05, 2400, 2, 0.3 * v, 'bandpass', pan);
    tone(t, 160, 0.04, 0.15 * v, 'sine', pan);
  },
  pat(v = 1, pan = 0) {
    const t = ctx.currentTime;
    noise(t, 0.07, 600, 1, 0.45 * v, 'bandpass', pan);
    tone(t, 120, 0.05, 0.2 * v, 'sine', pan);
  },
  rub(v = 1, pan = -0.3) {
    const t = ctx.currentTime;
    noise(t, 0.06, 3200, 2, 0.12 * v, 'bandpass', pan);
  },
  whoosh(v = 1, pan = 0) {
    const t = ctx.currentTime;
    const bq = noise(t, 0.3, 400, 0.8, 0.22 * v, 'bandpass', pan);
    bq.frequency.setValueAtTime(300, t);
    bq.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
    bq.frequency.exponentialRampToValueAtTime(400, t + 0.3);
  },
  step(v = 1) {
    const t = ctx.currentTime;
    noise(t, 0.07, 260 + Math.random() * 80, 1.5, 0.28 * v, 'bandpass', 0);
    noise(t, 0.03, 1800, 2, 0.06 * v, 'bandpass', 0);
  },
  ui(v = 1) {
    const t = ctx.currentTime;
    tone(t, 520, 0.05, 0.06 * v, 'triangle', 0);
  },
  uiSel(v = 1) {
    const t = ctx.currentTime;
    tone(t, 660, 0.06, 0.07 * v, 'triangle', 0);
    tone(t + 0.05, 880, 0.08, 0.06 * v, 'triangle', 0);
  },
  // 쉬잇
  shh(v = 1) {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bq = ctx.createBiquadFilter(); bq.type = 'bandpass'; bq.frequency.value = 3400; bq.Q.value = 1.2;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.12);
    g.gain.setValueAtTime(0.16 * v, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    s.connect(bq).connect(hp).connect(g).connect(master);
    s.start(t); s.stop(t + 0.8);
  },
  whistle(v = 1) {
    const t = ctx.currentTime;
    tone(t, 1500, 0.16, 0.06 * v, 'sine', 0, 2300);
    tone(t + 0.2, 2300, 0.25, 0.06 * v, 'sine', 0, 1300);
  },
};

export function sfx(name, v, pan) {
  if (!ctx || !SFX[name]) return;
  SFX[name](v, pan);
}

// ---------------- 배경 비트(전부 직접 합성한 오리지널 루프) ----------------
// 16분음표 스텝 시퀀서. 스타일마다 드럼 패턴·베이스·코드가 다름 (코드 진행은 흔한 진행만 사용)
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const S = (str) => str.split('').map((c) => c === 'x');   // "x...x..." → 스텝 배열

const STYLES = {
  // 유로비트: 4비트 킥, 옥타브 베이스, 스탭 + 아르페지오
  parapara: {
    kick: S('x...x...x...x...'), clap: S('....x.......x...'), hatO: S('..x...x...x...x.'), hatC: S('x.x.x.x.x.x.x.x.'),
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
    bass: (s) => (s % 2 === 0 ? (s % 4 === 2 ? 12 : 0) : null), bassType: 'sawtooth', bassCut: 900, bassLen: 1.8,
    stab: S('x..x..x...x.x...'), stabType: 'square', arp: [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1, 2],
  },
  // 저지클럽: 킥 5연타 패턴, 부드러운 패드
  jersey: {
    kick: S('x..x..x.x.x.....'), clap: S('....x.......x...'), hatC: S('x.xxx.xxx.xxx.xx'),
    chords: [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]],
    bass: (s) => (s === 0 || s === 6 || s === 10 ? 0 : null), bassType: 'sine', bassCut: 500, bassLen: 2.5,
    stab: S('x.......x.......'), stabType: 'triangle', stabLen: 7, arp: null, bell: S('......x.......x.'),
  },
  // 트랩: 하프타임 스네어, 16분 하이햇, 808 베이스
  trap: {
    kick: S('x......x..x.....'), clap: S('........x.......'), hatC: S('xxxxxxxxxxxxxxxx'), hatRoll: true,
    chords: [[60, 63, 67], [56, 60, 63], [63, 67, 70], [58, 62, 65]],
    bass: (s) => (s === 0 || s === 7 || s === 10 ? 0 : null), bassType: 'sine', bassCut: 300, bassLen: 3.5, bassSlide: true,
    stab: S('x...............'), stabType: 'sawtooth', stabLen: 10, arp: null, bell: S('..x.......x.....'),
  },
  // 하우스: 4비트, 오프비트 오픈햇과 베이스, 피아노 스탭
  house: {
    kick: S('x...x...x...x...'), clap: S('....x.......x...'), hatO: S('..x...x...x...x.'), hatC: S('.x.x.x.x.x.x.x.x'),
    chords: [[57, 60, 64, 67], [62, 65, 69, 72], [60, 64, 67, 71], [55, 59, 62, 65]],
    bass: (s) => (s % 4 === 2 ? 0 : null), bassType: 'square', bassCut: 600, bassLen: 1.5,
    stab: S('..x...x.....x...'), stabType: 'triangle', stabLen: 1.6, arp: null,
  },
  // 디스코: 옥타브 베이스 8분, 스트링 스탭
  disco: {
    kick: S('x...x...x...x...'), clap: S('....x.......x...'), hatO: S('..x...x...x...x.'), hatC: S('x.x.x.x.x.x.x.x.'),
    chords: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 61, 64, 67]],
    bass: (s) => (s % 2 === 0 ? (s % 4 === 2 ? 12 : 0) : null), bassType: 'sawtooth', bassCut: 1200, bassLen: 1.6,
    stab: S('x.....x...x.....'), stabType: 'sawtooth', stabLen: 3, arp: null,
  },
  // 일렉트로: 각진 사각파 베이스, 삑삑 소리
  electro: {
    kick: S('x.....x...x.....'), clap: S('....x.......x...'), hatC: S('x.x.x.x.x.x.x.x.'),
    chords: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    bass: (s) => ([0, 3, 6, 8, 11, 14].includes(s) ? (s === 8 ? 12 : 0) : null), bassType: 'square', bassCut: 800, bassLen: 1.2,
    stab: null, arp: [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2], arpType: 'square', bell: S('...x.....x....x.'),
  },
  // 트로트 뽕짝: 박마다 킥, 엇박마다 스네어, 근음-5도 베이스
  trot: {
    kick: S('x...x...x...x...'), clap: S('..x...x...x...x.'), hatC: S('x.x.x.x.x.x.x.x.'),
    chords: [[57, 60, 64], [62, 65, 69], [64, 68, 71], [57, 60, 64]],
    bass: (s) => (s % 4 === 0 ? (s % 8 === 4 ? 7 : 0) : null), bassType: 'triangle', bassCut: 900, bassLen: 2.5,
    stab: S('..x...x...x...x.'), stabType: 'square', stabLen: 1.2, arp: null,
  },
};

function kick(t, g) {
  const o = ctx.createOscillator(); const a = ctx.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  a.gain.setValueAtTime(0.9 * g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(a).connect(musicBus); o.start(t); o.stop(t + 0.22);
}
function hat(t, g, open) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const a = ctx.createGain(); const d = open ? 0.12 : 0.035;
  a.gain.setValueAtTime(0.25 * g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f).connect(a).connect(musicBus); s.start(t, Math.random() * 0.3); s.stop(t + d + 0.02);
}
function clapHit(t, g) {
  for (let i = 0; i < 3; i++) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.1;
    const a = ctx.createGain(); const tt = t + i * 0.012;
    a.gain.setValueAtTime(0.35 * g, tt); a.gain.exponentialRampToValueAtTime(0.0001, tt + (i === 2 ? 0.14 : 0.03));
    s.connect(f).connect(a).connect(musicBus); s.start(tt, Math.random() * 0.3); s.stop(tt + 0.16);
  }
}
function synth(t, freq, dur, g, type = 'sawtooth', cut = 2400, detune = 0, slideTo = 0) {
  const a = ctx.createGain(); const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(cut * 0.35, t + dur);
  a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + 0.005); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(a).connect(musicBus);
  for (const d of detune ? [-detune, detune] : [0]) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = d;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur * 0.6);
    o.connect(f); o.start(t); o.stop(t + dur + 0.02);
  }
}

let musicBus = null;
let music = null;
export function startMusic(name, bpm = 120) {
  if (!ctx) return;
  stopMusic();
  const st = STYLES[name];
  if (!st) return;
  musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  const step = 60 / bpm / 4;
  const t0 = ctx.currentTime + 0.03;
  const bus = musicBus;
  let n = 0;
  const tick = () => {
    if (bus !== musicBus) return;
    while (t0 + n * step < ctx.currentTime + 0.12) {
      const t = t0 + n * step, s = n % 16, bar = Math.floor(n / 16) % 4, ch = st.chords[bar];
      if (st.kick[s]) kick(t, 1);
      if (st.clap[s]) clapHit(t, 1);
      if (st.hatO && st.hatO[s]) hat(t, 1, true);
      else if (st.hatC && st.hatC[s]) hat(t, s % 2 ? 0.35 : 0.5, false);
      if (st.hatRoll && bar % 2 === 1 && s >= 12) hat(t + step / 2, 0.3, false);
      const bo = st.bass(s);
      if (bo !== null && bo !== undefined) {
        const f = mtof(ch[0] - 24 + bo);
        synth(t, f, step * st.bassLen, 0.24, st.bassType, st.bassCut, 0, st.bassSlide && s === 10 ? f * 0.75 : 0);
      }
      if (st.stab && st.stab[s]) for (const m of ch) synth(t, mtof(m), step * (st.stabLen || 1.5), 0.045, st.stabType, 3000, 9);
      if (st.arp) synth(t, mtof(ch[st.arp[s] % ch.length] + 12), step * 0.9, 0.025, st.arpType || 'triangle', 5000);
      if (st.bell && st.bell[s]) synth(t, mtof(ch[ch.length - 1] + 12), step * 3, 0.03, 'sine', 8000);
      n++;
    }
    music.timer = setTimeout(tick, 25);
  };
  music = { timer: 0, bus };
  tick();
}
export function stopMusic() {
  if (!music) return;
  clearTimeout(music.timer);
  const b = music.bus;
  b.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  setTimeout(() => b.disconnect(), 600);
  music = null; musicBus = null;
}

// ---------------- 경보 사이렌 ----------------
let siren = null;
export function startSiren() {
  if (!ctx || siren) return;
  const o = ctx.createOscillator(); o.type = 'square';
  const lfo = ctx.createOscillator(); lfo.frequency.value = 1.6;
  const lg = ctx.createGain(); lg.gain.value = 220;
  lfo.connect(lg).connect(o.frequency);
  o.frequency.value = 760;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
  const g = ctx.createGain(); g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.3);
  o.connect(f).connect(g).connect(master);
  o.start(); lfo.start();
  siren = { o, lfo, g };
}
export function stopSiren() {
  if (!siren) return;
  const s = siren; siren = null;
  s.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
  setTimeout(() => { s.o.stop(); s.lfo.stop(); }, 500);
}
