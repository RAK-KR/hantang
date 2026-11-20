// 감정표현 원형 휠 – G 를 누르고 있는 동안 열림, 마우스를 움직여 고르고 G 를 떼면 실행
// (클릭으로도 실행 가능 / 우클릭·Esc 는 취소) – 한 번 열고 닫을 때 실행은 정확히 한 번
import { sfx } from './audio.js';

export class EmoteWheel {
  constructor(emotes, onPick) {
    this.emotes = emotes;
    this.onPick = onPick;
    this.el = document.getElementById('wheel');
    this.open = false;
    this.sel = -1;
    this.vx = 0; this.vy = 0;
    this.build();
  }
  build() {
    const n = this.emotes.length;
    const R = 150, r = 62;
    const parts = [];
    const svgNS = 'http://www.w3.org/2000/svg';
    let svg = `<svg viewBox="-180 -180 360 360" width="360" height="360">`;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n;
      const a1 = a0 + (Math.PI * 2) / n;
      const p = (a, rr) => `${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
      const gap = 0.025;
      svg += `<path class="seg" data-i="${i}" d="M ${p(a0 + gap, r)} L ${p(a0 + gap, R)} A ${R} ${R} 0 0 1 ${p(a1 - gap, R)} L ${p(a1 - gap, r)} A ${r} ${r} 0 0 0 ${p(a0 + gap, r)} Z"/>`;
      const am = (a0 + a1) / 2;
      parts.push({ x: Math.cos(am) * (r + R) / 2, y: Math.sin(am) * (r + R) / 2 });
    }
    svg += `<circle class="hub" r="${r - 8}"/></svg>`;
    this.el.innerHTML = svg + parts.map((p, i) => {
      const e = this.emotes[i];
      return `<div class="lab" data-i="${i}" style="transform:translate(${p.x}px,${p.y}px) translate(-50%,-50%)"><i>${e.icon}</i><span>${e.name}</span></div>`;
    }).join('') + `<div class="center"><b id="wheelName">감정표현</b><small id="wheelDesc">마우스로 고르기</small></div><div class="cursor" id="wheelCursor"></div>`;
    void svgNS;
  }
  show() {
    if (this.open) return;
    this.open = true; this.sel = -1; this.vx = 0; this.vy = 0;
    this.el.classList.add('open');
    this.render();
    sfx('ui', 0.8);
  }
  hide() {
    this.open = false;
    this.el.classList.remove('open');
  }
  move(dx, dy) {
    if (!this.open) return;
    this.vx += dx; this.vy += dy;
    const len = Math.hypot(this.vx, this.vy);
    const max = 120;
    if (len > max) { this.vx *= max / len; this.vy *= max / len; }
    const n = this.emotes.length;
    let sel = -1;
    if (len > 28) {
      let a = Math.atan2(this.vy, this.vx) + Math.PI / 2 + Math.PI / n;
      a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      sel = Math.floor(a / ((Math.PI * 2) / n)) % n;
    }
    if (sel !== this.sel) { this.sel = sel; if (sel >= 0) sfx('ui', 0.5); }
    this.render();
  }
  render() {
    this.el.querySelectorAll('.seg').forEach((s) => s.classList.toggle('on', +s.dataset.i === this.sel));
    this.el.querySelectorAll('.lab').forEach((s) => s.classList.toggle('on', +s.dataset.i === this.sel));
    const e = this.emotes[this.sel];
    document.getElementById('wheelName').textContent = e ? e.name : '감정표현';
    document.getElementById('wheelDesc').textContent = e ? e.desc : '마우스로 고르기';
    document.getElementById('wheelCursor').style.transform = `translate(${this.vx}px, ${this.vy}px) translate(-50%,-50%)`;
  }
  // 확정 – 선택이 있으면 실행하고 닫음
  commit() {
    if (!this.open) return;
    const sel = this.sel;
    this.hide();
    if (sel >= 0) { sfx('uiSel', 0.7); this.onPick(this.emotes[sel]); }
  }
  cancel() { this.hide(); }
}
