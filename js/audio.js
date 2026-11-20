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
