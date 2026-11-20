// 공범 NPC '덕배' – 플레이어가 감정표현을 하면 따라 하고 한마디 함 (다른 사람 화면에서 어떻게 보이는지 확인용)
import * as THREE from 'three';
import { Character, BODY_IDLE } from './character.js';
import { sfx } from './audio.js';

export class Npc {
  constructor(scene, hud, camera) {
    this.hud = hud;
    this.camera = camera;
    this.char = new Character({ jacketTex: 'jacketTan' });
    this.char.root.position.set(1.8, 0, 2.4);
    scene.add(this.char.root);
    this.yaw = 0;
    this.pending = null;
    this.busy = false;
    this.char.knife.set(Math.PI, -Math.PI);
    this.char.anim.onEvent = (type, arg) => {
      if (type !== 'sfx') return;
      const d = this.char.root.position.distanceTo(camera.position);
      sfx(arg.name || arg, (arg.v ?? 1) * Math.max(0, 1 - d / 12) * 0.8, 0);
    };
    this._v = new THREE.Vector3();
  }
  react(e) {
    this.pending = { e, t: e.npcDelay ?? 0.45 };
  }
  // 플레이어가 춤을 멈추면 같이 멈춤
  stopMusicEmote() {
    if (this.char.anim.clip && this.cur?.music) { this.busy = false; this.char.anim.play(BODY_IDLE, { blend: 0.25 }); }
  }
  update(dt, player) {
    // 플레이어 쪽으로 몸을 천천히 돌림
    const p = this.char.root.position;
    const want = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (!this.busy) this.yaw += d * Math.min(1, dt * 2.5);
    this.char.root.rotation.y = this.yaw;

    if (this.pending) {
      this.pending.t -= dt;
      if (this.pending.t <= 0) {
        const e = this.pending.e;
        this.pending = null;
        this.busy = true;
        this.cur = e;
        this.char.anim.play(e.body, {
          blend: 0.15,
          onEnd: () => { this.busy = false; this.char.anim.play(BODY_IDLE, { blend: 0.25 }); },
        });
        const lines = e.npc || [];
        if (lines.length) this.say(lines[Math.floor(Math.random() * lines.length)]);
      }
    }
    this.char.update(dt);

    // 말풍선 위치
    const head = this._v.set(p.x, 2.0, p.z).project(this.camera);
    const visible = head.z < 1 && head.z > -1;
    this.hud.placeBubble('npc', (head.x * 0.5 + 0.5) * innerWidth, (-head.y * 0.5 + 0.5) * innerHeight, visible);
  }
  say(text) {
    this.hud.bubble('덕배: ' + text, 0, 0, 'npc');
  }
}
