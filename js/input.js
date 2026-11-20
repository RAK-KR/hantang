// 키보드/마우스 입력 – 포인터 잠금, 키 반복 무시(한 번 누르면 한 번만 처리)
export const KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  run: 'ShiftLeft', jump: 'Space', crouch: 'ControlLeft', crouch2: 'KeyC',
  flip: 'KeyF', trick: 'KeyR', emote: 'KeyG', view: 'KeyV',
};

export class Input {
  constructor(el) {
    this.el = el;
    this.down = new Set();
    this.pressed = new Set();   // 이번 프레임에 눌림
    this.released = new Set();  // 이번 프레임에 뗌
    this.mdx = 0; this.mdy = 0;
    this.mouseDown = [false, false, false];
    this.mousePressed = [false, false, false];
    this.locked = false;
    this.sens = 1;
    addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.ctrlKey && e.code !== 'ControlLeft') e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code); this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => { this.down.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => { for (const c of this.down) this.released.add(c); this.down.clear(); });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mdx += e.movementX; this.mdy += e.movementY;
    });
    el.addEventListener('mousedown', (e) => { this.mouseDown[e.button] = true; this.mousePressed[e.button] = true; });
    addEventListener('mouseup', (e) => { this.mouseDown[e.button] = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }
  lock() { if (!this.locked) this.el.requestPointerLock?.(); }
  unlock() { if (this.locked) document.exitPointerLock?.(); }
  isDown(name) { return this.down.has(KEYS[name] || name); }
  wasPressed(name) { return this.pressed.has(KEYS[name] || name); }
  wasReleased(name) { return this.released.has(KEYS[name] || name); }
  consumeMouse() { const d = [this.mdx, this.mdy]; this.mdx = 0; this.mdy = 0; return d; }
  endFrame() { this.pressed.clear(); this.released.clear(); this.mousePressed = [false, false, false]; }
}
