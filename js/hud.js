// HUD – 오른쪽 위 키 설명, 트릭 이름, 조준점, 말풍선
export class Hud {
  constructor() {
    this.el = document.getElementById('hud');
    this.toast = document.getElementById('toast');
    this.bubbles = document.getElementById('bubbles');
    this.keys = document.getElementById('keys');
    this._toastT = 0;
    this.keys.innerHTML = [
      ['WASD', '이동'], ['Shift', '달리기'], ['Ctrl', '앉기'], ['Space', '점프'],
      ['F', '칼 펼치기/접기'], ['R', '다음 트릭'], ['1~5', '트릭 고르기'], ['E', '칼 살펴보기'],
      ['좌클릭', '휘두르기'], ['G (꾹)', '감정표현'], ['V', '3인칭 보기'], ['Esc', '설정'],
    ].map(([k, d]) => `<div><b>${k}</b><span>${d}</span></div>`).join('');
  }
  showToast(text) {
    this.toast.textContent = text;
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
  }
  bubble(text, x, y, id = 'npc') {
    let b = this.bubbles.querySelector(`[data-id="${id}"]`);
    if (!b) { b = document.createElement('div'); b.className = 'bubble'; b.dataset.id = id; this.bubbles.appendChild(b); }
    b.textContent = text;
    b.dataset.until = performance.now() + 2600;
    b.style.display = 'block';
    this.placeBubble(id, x, y);
  }
  placeBubble(id, x, y, visible = true) {
    const b = this.bubbles.querySelector(`[data-id="${id}"]`);
    if (!b) return;
    const alive = performance.now() < +b.dataset.until;
    b.style.display = alive && visible ? 'block' : 'none';
    b.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
  setCrosshair(v) { document.getElementById('cross').style.display = v ? 'block' : 'none'; }
}
