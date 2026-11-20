// 설정 메뉴(Esc) – 마우스 감도, 화질(PS1 해상도), 디더, 폴리곤 흔들림, 볼륨
const DEFAULTS = { sens: 1, res: 240, dither: true, jitter: true, volume: 0.8, bright: 1.15 };
const KEY = 'hantang.settings';

export class Settings {
  constructor({ apply }) {
    this.applyFn = apply;
    this.el = document.getElementById('menu');
    this.open = false;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { saved = {}; }
    this.s = { ...DEFAULTS, ...saved };
    this.build();
    this.applyFn(this.s);
  }
  build() {
    this.el.innerHTML = `
      <div class="panel">
        <h2>일시정지</h2>
        <label>마우스 감도 <output id="o-sens"></output>
          <input id="s-sens" type="range" min="0.2" max="3" step="0.05"></label>
        <label>화면 해상도
          <select id="s-res"><option value="240">240p (PS1 원본 느낌)</option><option value="360">360p</option><option value="480">480p</option><option value="0">원본 해상도</option></select></label>
        <label>밝기 <output id="o-bri"></output>
          <input id="s-bri" type="range" min="0.8" max="1.8" step="0.05"></label>
        <label class="chk"><input id="s-dither" type="checkbox"> 디더링(색 번짐)</label>
        <label class="chk"><input id="s-jitter" type="checkbox"> 폴리곤 흔들림 / 텍스처 일그러짐</label>
        <label>볼륨 <output id="o-vol"></output>
          <input id="s-vol" type="range" min="0" max="1" step="0.05"></label>
        <button id="s-resume">계속하기</button>
      </div>`;
    const $ = (id) => this.el.querySelector('#' + id);
    const sync = () => {
      $('s-sens').value = this.s.sens; $('o-sens').textContent = (+this.s.sens).toFixed(2);
      $('s-res').value = String(this.s.res);
      $('s-dither').checked = this.s.dither; $('s-jitter').checked = this.s.jitter;
      $('s-bri').value = this.s.bright; $('o-bri').textContent = Math.round(this.s.bright * 100) + '%';
      $('s-vol').value = this.s.volume; $('o-vol').textContent = Math.round(this.s.volume * 100) + '%';
    };
    sync();
    const upd = () => {
      this.s.sens = +$('s-sens').value; this.s.res = +$('s-res').value;
      this.s.dither = $('s-dither').checked; this.s.jitter = $('s-jitter').checked;
      this.s.volume = +$('s-vol').value; this.s.bright = +$('s-bri').value;
      sync();
      try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch { /* 저장 불가 환경 */ }
      this.applyFn(this.s);
    };
    this.el.querySelectorAll('input,select').forEach((i) => i.addEventListener('input', upd));
    $('s-resume').addEventListener('click', () => this.onResume && this.onResume());
  }
  show() { this.open = true; this.el.classList.add('open'); }
  hide() { this.open = false; this.el.classList.remove('open'); }
}
