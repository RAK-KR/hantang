// 캔버스로 직접 그리는 저해상도 텍스처 (외부 이미지 없음)
import * as THREE from 'three';

let seed = 1337;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

function make(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

function noise(g, w, h, base, amt) {
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * amt;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  g.putImageData(img, 0, 0);
}

const cache = {};
export function tex(name) {
  if (cache[name]) return cache[name];
  const f = GEN[name];
  cache[name] = f();
  return cache[name];
}

const GEN = {
  marble: () => make(64, 64, (g, w, h) => {
    g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,84,78,0.45)';
    for (let i = 0; i < 7; i++) {
      g.beginPath(); let x = rnd() * w, y = 0; g.moveTo(x, y);
      while (y < h) { x += (rnd() - 0.5) * 10; y += 4 + rnd() * 6; g.lineTo(x, y); }
      g.lineWidth = 1; g.stroke();
    }
    g.fillStyle = '#8f887d'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h);
    g.fillRect(32, 0, 1, h); g.fillRect(0, 32, w, 1);
    noise(g, w, h, 0, 18);
  }),
  carpet: () => make(32, 32, (g, w, h) => {
    g.fillStyle = '#5a1f22'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      g.fillStyle = ((x + y) / 8) % 2 ? '#6a2729' : '#4e1a1d'; g.fillRect(x + 2, y + 2, 4, 4);
    }
    noise(g, w, h, 0, 22);
  }),
  wall: () => make(64, 64, (g, w, h) => {
    g.fillStyle = '#8c8a7c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6c6a5e'; g.fillRect(0, 44, w, 20);
    g.fillStyle = '#4e4c44'; g.fillRect(0, 43, w, 2);
    for (let x = 0; x < w; x += 16) { g.fillStyle = '#5f5d52'; g.fillRect(x, 45, 1, 19); }
    noise(g, w, h, 0, 16);
  }),
  wood: () => make(64, 32, (g, w, h) => {
    g.fillStyle = '#5b3a22'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = Math.sin(y * 0.9 + rnd()) * 12;
      g.fillStyle = `rgba(${40 + v},${24 + v * 0.6},${12},0.5)`;
      g.fillRect(0, y, w, 1);
    }
    g.fillStyle = '#3a2414'; g.fillRect(0, 0, w, 1); g.fillRect(0, 15, w, 1);
    noise(g, w, h, 0, 14);
  }),
  metal: () => make(32, 32, (g, w, h) => {
    g.fillStyle = '#7d8086'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.08})`; g.fillRect(0, y, w, 1); }
    noise(g, w, h, 0, 10);
  }),
  vault: () => make(64, 64, (g, w, h) => {
    g.fillStyle = '#6f747a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#41454a'; g.lineWidth = 2;
    for (let r = 8; r < 32; r += 6) { g.beginPath(); g.arc(32, 32, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#2f3236';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(32 + Math.cos(a) * 28 - 1, 32 + Math.sin(a) * 28 - 1, 3, 3); }
    noise(g, w, h, 0, 14);
  }, false),
  glove: () => make(16, 16, (g, w, h) => {
    g.fillStyle = '#4a4446'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#585154'; for (let i = 0; i < 16; i += 4) g.fillRect(0, i, w, 1);
    noise(g, w, h, 0, 18);
  }),
  sleeve: () => make(16, 16, (g, w, h) => {
    g.fillStyle = '#5c6b4c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4c5a3e'; for (let i = 0; i < 16; i += 3) g.fillRect(i, 0, 1, h);
    noise(g, w, h, 0, 20);
  }),
  knit: () => make(16, 16, (g, w, h) => {
    g.fillStyle = '#1f1f24'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) for (let x = (y / 2) % 2; x < w; x += 2) { g.fillStyle = '#2a2a31'; g.fillRect(x, y, 1, 1); }
    noise(g, w, h, 0, 14);
  }),
  jacketTan: () => make(16, 16, (g, w, h) => {
    g.fillStyle = '#9a7b55'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#86694a'; for (let i = 0; i < 16; i += 3) g.fillRect(i, 0, 1, h);
    noise(g, w, h, 0, 20);
  }),
  jeans: () => make(16, 16, (g, w, h) => {
    g.fillStyle = '#3b4a6b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i += 2) { g.fillStyle = '#26314a'; g.fillRect(i, 0, 1, h); }
    noise(g, w, h, 0, 20);
  }),
  // 복면(바라클라바) 앞면 – 눈구멍 띠 + 입 구멍
  mask: () => make(32, 32, (g, w, h) => {
    g.fillStyle = '#1f1f24'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) for (let x = (y / 2) % 2; x < w; x += 2) { g.fillStyle = '#2a2a31'; g.fillRect(x, y, 1, 1); }
    g.fillStyle = '#c99a78'; g.fillRect(5, 11, 22, 6);
    g.fillStyle = '#a77a5c'; g.fillRect(5, 16, 22, 1);
    g.fillStyle = '#f2efe8'; g.fillRect(8, 12, 5, 3); g.fillRect(19, 12, 5, 3);
    g.fillStyle = '#2a1d16'; g.fillRect(10, 12, 2, 3); g.fillRect(21, 12, 2, 3);
    g.fillStyle = '#4a3020'; g.fillRect(7, 10, 6, 1); g.fillRect(19, 10, 6, 1);
    g.fillStyle = '#c99a78'; g.fillRect(12, 22, 8, 4);
    g.fillStyle = '#7a3a34'; g.fillRect(13, 23, 6, 2);
    noise(g, w, h, 0, 10);
  }, false),
  sneaker: () => make(16, 16, (g, w, h) => {
    g.fillStyle = '#d9d6cf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9b2b2b'; g.fillRect(0, 6, w, 3);
    g.fillStyle = '#555'; g.fillRect(0, 13, w, 3);
    noise(g, w, h, 0, 12);
  }),
  // 발리송 칼날 – 길이 방향으로 그라데이션, 날 쪽 밝게
  blade: () => make(16, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#9aa0a8'); gr.addColorStop(0.55, '#c9ced5'); gr.addColorStop(1, '#eef1f4');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; g.fillRect(0, y, w, 1); }
  }, false),
  // 손잡이 – 스켈레톤 구멍 무늬
  handle: () => make(16, 64, (g, w, h) => {
    g.fillStyle = '#9aa0aa'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1c20';
    for (let y = 10; y < 56; y += 9) g.fillRect(4, y, 8, 5);
    g.fillStyle = '#c4c9d2'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h); g.fillRect(w - 1, 0, 1, h);
    noise(g, w, h, 0, 12);
  }, false),
  poster: () => make(64, 96, (g, w, h) => {
    g.fillStyle = '#e8e0c8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d3f73'; g.fillRect(0, 0, w, 22);
    g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center';
    g.fillText('든든은행', 32, 14);
    g.fillStyle = '#1d3f73'; g.font = 'bold 8px sans-serif';
    g.fillText('고객님의 돈은', 32, 42); g.fillText('안전합니다', 32, 54);
    g.fillStyle = '#a33'; g.font = '6px sans-serif'; g.fillText('(아마도)', 32, 66);
    g.fillStyle = '#c9a43b'; g.beginPath(); g.arc(32, 82, 8, 0, Math.PI * 2); g.fill();
    noise(g, w, h, 0, 14);
  }, false),
  sign: () => make(256, 64, (g, w, h) => {
    g.fillStyle = '#123366'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f1d46a'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('든든은행 금정지점', 128, 34);
    noise(g, w, h, 0, 10);
  }, false),
  ceiling: () => make(32, 32, (g, w, h) => {
    g.fillStyle = '#a5a397'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7f7d72'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h);
    for (let i = 0; i < 30; i++) { g.fillStyle = '#8f8d82'; g.fillRect(rnd() * w, rnd() * h, 1, 1); }
    noise(g, w, h, 0, 10);
  }),
  atm: () => make(32, 64, (g, w, h) => {
    g.fillStyle = '#c7c9cc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#123366'; g.fillRect(0, 0, w, 10);
    g.fillStyle = '#1a2a1a'; g.fillRect(5, 14, 22, 16);
    g.fillStyle = '#5fe08a'; g.fillRect(7, 17, 10, 2); g.fillRect(7, 21, 14, 2);
    g.fillStyle = '#555'; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) g.fillRect(8 + x * 6, 34 + y * 5, 4, 3);
    g.fillStyle = '#222'; g.fillRect(6, 54, 20, 3);
    noise(g, w, h, 0, 10);
  }, false),
};
