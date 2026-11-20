// HUD – 키 설명, 목표, 돈, 무전, 경보, 상호작용 진행, 체력, 노출도, 감지 아이콘, 결과 화면
import * as THREE from 'three';

const _v = new THREE.Vector3();

export class Hud {
  constructor() {
    this.el = document.getElementById('hud');
    this.toast = document.getElementById('toast');
    this.bubbles = document.getElementById('bubbles');
    this.keys = document.getElementById('keys');
    this.keys.innerHTML = [
      ['WASD', '이동'], ['Shift', '달리기(시끄러움)'], ['Ctrl', '앉기(조용·덜 보임)'], ['Space', '점프'],
      ['E (꾹)', '상호작용 · 뒤에서 기절'], ['좌클릭', '휘두르기'],
      ['F', '칼 펼치기/접기'], ['R', '다음 트릭'], ['1~6', '트릭(딸깍 소리 주의)'],
      ['G (꾹)', '감정표현'], ['G+1·2', '휠 탭 전환'], ['V', '3인칭 보기'], ['H', '키 설명 숨기기'], ['Esc', '설정'],
    ].map(([k, d]) => `<div><b>${k}</b><span>${d}</span></div>`).join('');
    this.$ = (id) => document.getElementById(id);
    this.icons = {};
    this.radioT = 0;
  }
  toggleKeys() { this.keys.classList.toggle('hide'); }
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
    b.dataset.until = performance.now() + 2200;
    b.style.display = 'block';
  }
  placeBubble(id, x, y, visible = true) {
    const b = this.bubbles.querySelector(`[data-id="${id}"]`);
    if (!b) return;
    const alive = performance.now() < +b.dataset.until;
    b.style.display = alive && visible ? 'block' : 'none';
    b.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
  setCrosshair(v) { this.$('cross').style.display = v ? 'block' : 'none'; }

  radio(text) {
    const r = this.$('radio');
    r.innerHTML = `<b>📻 덕배</b> ${text}`;
    r.classList.remove('show'); void r.offsetWidth; r.classList.add('show');
    this.radioT = Math.max(3, text.length * 0.1);
  }
  hurt() {
    const d = this.$('dmg');
    d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
  }

  // 화면 위 점 → 화면 좌표(밖이면 가장자리로)
  project(p, camera) {
    _v.copy(p).project(camera);
    const behind = _v.z > 1;
    let x = _v.x, y = _v.y;
    if (behind) { x = -x; y = -y; }
    const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.9;
    if (off) {
      const m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.85, 1e-6);
      x /= m; y /= m;
      if (behind && Math.abs(y) < 0.85) y = -0.85;
    }
    return { x: (x * 0.5 + 0.5) * innerWidth, y: (-y * 0.5 + 0.5) * innerHeight, off, ang: Math.atan2(-y, x) };
  }

  icon(id, kind, level, sx, sy, off, ang) {
    let el = this.icons[id];
    if (!el) {
      el = document.createElement('div'); el.className = 'det';
      el.innerHTML = '<i></i><span></span>';
      this.$('icons').appendChild(el);
      this.icons[id] = el;
    }
    if (!kind) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.className = 'det ' + kind + (off ? ' off' : '');
    el.querySelector('span').textContent = kind === 'alert' ? '!' : kind === 'cam' ? '●' : '?';
    el.querySelector('i').style.height = Math.round(Math.min(1, level) * 100) + '%';
    el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)` + (off ? ` rotate(${ang}rad)` : '');
  }

  // 매 프레임 갱신
  update(dt, h, camera) {
    if (!h) return;
    // 목표
    this.$('obj').innerHTML = `<div class="money">${h.moneyText}</div>` + h.objectives().map(([done, t, sub]) =>
      `<div class="${done ? 'done' : ''}"><em>${done ? '■' : '□'}</em>${t}${sub ? ` <small>${sub}</small>` : ''}</div>`).join('');
    // 경보
    const al = this.$('alarm');
    if (h.alarm && !h.ended) {
      al.style.display = 'block';
      const t = Math.max(0, h.policeT);
      al.innerHTML = `경보 발령 · 경찰 도착까지 <b>${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}</b>`;
    } else al.style.display = 'none';
    // 상호작용
    const pr = this.$('prompt');
    const t = h.target;
    if (t && !h.ended) {
      const blocked = t.need && !t.need();
      pr.style.display = 'block';
      pr.className = blocked ? 'blocked' : '';
      pr.querySelector('span').textContent = blocked ? t.label() : `E ${t.hold > 0 ? '꾹 · ' : ''}${t.label()}`;
      pr.querySelector('i').style.width = Math.round(h.hold * 100) + '%';
    } else pr.style.display = 'none';
    // 체력
    const hp = this.$('hp');
    hp.style.display = h.hp < 99.5 || h.alarm ? 'block' : 'none';
    hp.querySelector('i').style.width = Math.max(0, h.hp) + '%';
    // 노출도
    const vis = this.$('vis');
    const e = THREE.MathUtils.clamp((h.exposure - 0.12) / 1.0, 0, 1);
    vis.querySelector('i').style.width = Math.round(e * 100) + '%';
    vis.querySelector('span').textContent = e < 0.25 ? '어둠 속' : e < 0.55 ? '희미함' : e < 0.8 ? '보임' : '훤히 보임';
    vis.className = e < 0.25 ? 'lo' : e < 0.55 ? 'mid' : 'hi';
    // 감지 아이콘
    for (const g of h.guards) {
      const head = new THREE.Vector3(g.pos.x, 2.15, g.pos.z);
      const s = this.project(head, camera);
      let kind = null;
      if (g.state === 'alert' || g.state === 'attack') kind = 'alert';
      else if (g.state !== 'down' && g.state !== 'sleep' && (g.sus > 0.04 || g.state === 'investigate' || g.state === 'search' || g.state === 'suspicious')) kind = 'sus';
      this.icon('g_' + g.name, kind, kind === 'alert' ? 1 : g.sus, s.x, s.y, s.off, s.ang);
      const b = this.project(new THREE.Vector3(g.pos.x, 2.35, g.pos.z), camera);
      this.placeBubble('g_' + g.name, b.x, b.y, !b.off);
    }
    for (const c of h.cams) {
      const s = this.project(c.pos, camera);
      this.icon('c_' + c.name, !c.off && c.meter > 0.02 ? 'cam' : null, c.meter, s.x, s.y, s.off, s.ang);
    }
  }

  result(r, won) {
    const el = this.$('result');
    const mm = Math.floor(r.time / 60), ss = Math.floor(r.time % 60);
    el.innerHTML = `<div class="panel ${r.success ? 'ok' : 'fail'}">
      <h2>${r.success ? '한탕 성공' : '체포'}</h2>
      <p class="why">${r.reason}</p>
      <table>
        <tr><td>훔친 돈</td><td>${won(r.money)}</td></tr>
        <tr><td>돈가방</td><td>${r.bags} / 4</td></tr>
        <tr><td>걸린 시간</td><td>${mm}분 ${ss}초</td></tr>
        <tr><td>들킨 횟수</td><td>${r.spotted}</td></tr>
        <tr><td>기절시킨 경비</td><td>${r.knocked}</td></tr>
        <tr><td>경보</td><td>${r.alarm ? '울림' : '조용히'}</td></tr>
      </table>
      <div class="grade">등급 <b>${r.grade}</b></div>
      <button id="again">다시 하기</button>
    </div>`;
    el.classList.add('open');
    document.exitPointerLock?.();
    el.querySelector('#again').addEventListener('click', () => location.reload());
  }
}
