// 강도 진행 – 목표, 상호작용(E 꾹), 소리, 노출도, 경보/경찰, 체력, 무전(덕배), 결과
import * as THREE from 'three';
import { Guard, Cctv } from './guards.js';
import { Nav } from './nav.js';
import { LIGHT } from './world.js';
import { sfx, startSiren, stopSiren } from './audio.js';

const won = (n) => '₩' + n.toLocaleString('ko-KR');
const CASH_BAG = 50000000, DRAWER = [1200000, 2700000, 800000, 3300000];
const POLICE_TIME = 75;

export class Heist {
  constructor({ scene, world, player, camera, hud, vm }) {
    Object.assign(this, { scene, world, player, camera, hud, vm });
    this.nav = new Nav(world);
    this.money = 0;
    this.keycard = false;
    this.camsOff = false;
    this.vaultOpen = false;
    this.bags = 0;
    this.drawers = new Set();
    this.alarm = false;
    this.policeT = POLICE_TIME;
    this.hp = 100;
    this.hurtT = 9;
    this.time = 0;
    this.spotted = 0;
    this.knocked = 0;
    this.ended = false;
    this.hold = 0;
    this.exposure = 0.5;
    this.radioQ = [];
    this.flags = {};
    this.guards = [
      // 로비 순찰
      new Guard(this, { name: '최경비', pos: [6.2, -1.6], yaw: -Math.PI / 2, flashSlot: LIGHT.FLASH0, route: [
        [0, -1.6, 1.0], [-6.2, -1.6, 2.0, Math.PI], [-6.2, 3, 0.4], [-6, 6.6, 1.5, Math.PI / 2], [6, 6.6, 1.2], [6.2, 3, 0.4], [6.2, -1.6, 2.0, Math.PI],
      ] }),
      // 직원 구역 순찰
      new Guard(this, { name: '박경비', pos: [8, -4.2], yaw: -Math.PI / 2, flashSlot: LIGHT.FLASH1, route: [
        [8.0, -4.2, 0.8], [8.1, -5.9, 2.2, Math.PI], [8.0, -4.2, 0.3], [1.2, -4.3, 0.3], [0, -6.8, 2.5, Math.PI], [-4.5, -4.3, 0.5], [-8.1, -4.2, 1.0], [-8.1, -5.9, 2.0, Math.PI], [-8.1, -4.2, 0.3], [1.2, -4.3, 0.3],
      ] }),
      // 경비실에서 조는 경비
      new Guard(this, { name: '김경비', pos: [-8.6, -6.6], yaw: Math.PI, sleeping: true }),
    ];
    this.cams = [
      new Cctv(this, { name: 'cam1', pos: [9.55, 3.1, 7.55], yaw: -2.45, sweep: 0.55, period: 9 }),
      new Cctv(this, { name: 'cam2', pos: [9.55, 3.1, -3.75], yaw: -Math.PI / 2, sweep: 0.5, period: 7, pitch: -0.5, range: 9 }),
      new Cctv(this, { name: 'cam3', pos: [2.75, 2.8, -12.75], yaw: -0.5, sweep: 0.35, period: 6, pitch: -0.5, range: 8 }),
    ];
    this.buildInteractables();
    this.say('어 들리냐? 금고는 맨 안쪽. 카드키는 지점장실 책상에 있대.', 1.2);
    this.say('경비는 둘이야. 아마. 셋일 수도 있고.');
    this.say('CCTV는 경비실에서 끌 수 있다더라. 조심해~');
  }

  // ---------- 무전 ----------
  say(text, delay = 0) { this.radioQ.push({ text, delay }); }
  once(key, text) { if (this.flags[key]) return; this.flags[key] = true; this.say(text); }

  // ---------- 상호작용 ----------
  buildInteractables() {
    const W = this.world;
    const list = [];
    list.push({ id: 'keycard', pos: W.keycardPos.clone(), r: 1.6, hold: 0.35, label: () => '카드키 줍기', ok: () => !this.keycard, done: () => {
      this.keycard = true; W.keycard.visible = false; sfx('catch', 0.6);
      this.say('카드키 챙겼으면 금고로 ㄱㄱ. 금고는 직원 구역 맨 안쪽!');
    } });
    list.push({ id: 'terminal', pos: W.terminalPos.clone(), r: 1.7, hold: 2.0, noise: 2, label: () => 'CCTV 끄기', ok: () => !this.camsOff && !this.alarm, done: () => {
      this.camsOff = true; this.cams.forEach((c) => c.turnOff()); sfx('uiSel', 0.6);
      this.say('오 CCTV 꺼졌다. 나 방금 편의점 다녀왔어.');
    } });
    list.push({ id: 'vault', pos: new THREE.Vector3(0, 1.2, -7.6), r: 1.9, hold: 4.0, noise: 3, tickSfx: true,
      label: () => (this.keycard ? '금고 열기' : '카드키가 필요하다'), ok: () => !this.vaultOpen, need: () => this.keycard, done: () => {
        this.vaultOpen = true; W.openVault(); this.nav.rebuild(); sfx('clack', 1); sfx('whoosh', 0.8);
        this.noise(new THREE.Vector3(0, 0, -8), 7, 1);
        this.say('열렸냐? 돈가방만 챙겨. 금괴는 무거워서 안 돼.');
      } });
    W.cashSpots.forEach(([x, z], i) => list.push({ id: 'bag' + i, pos: new THREE.Vector3(x, 0.4, z), r: 1.5, hold: 0.7, label: () => '돈가방 챙기기', ok: () => this.vaultOpen && W.cashMeshes[i].visible, done: () => {
      W.cashMeshes[i].visible = false; this.bags++; this.money += CASH_BAG; sfx('catch', 0.8);
      if (this.bags === 1) this.say('가방 하나에 5천이래. 다 챙겨!');
      if (this.bags === 4) this.say('다 챙겼으면 튀어! 정문이든 뒷문이든!');
    } }));
    W.drawerSpots.forEach(([x, z], i) => list.push({ id: 'drawer' + i, pos: new THREE.Vector3(x, 0.8, z), r: 1.4, hold: 1.2, noise: 2.5, label: () => '현금 서랍 털기', ok: () => !this.drawers.has(i), done: () => {
      this.drawers.add(i); this.money += DRAWER[i]; sfx('rub', 1); sfx('catch', 0.4);
      this.once('drawer', '서랍 털어 봐야 푼돈이야~ 금고 가!');
    } }));
    this.items = list;
  }

  findTarget() {
    const cam = this.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let best = null, bs = -Infinity;
    for (const it of this.items) {
      if (!it.ok()) continue;
      const d = Math.hypot(it.pos.x - this.player.pos.x, it.pos.z - this.player.pos.z);
      if (d > it.r) continue;
      const dir = it.pos.clone().sub(cam.position).normalize();
      const dot = dir.dot(fwd);
      if (dot < 0.6 && d > 1.0) continue;
      const s = dot - d * 0.3;
      if (s > bs) { bs = s; best = it; }
    }
    // 뒤에서 몰래 기절시키기
    for (const g of this.guards) {
      if (g.state === 'down' || !g.unaware()) continue;
      const d = g.pos.distanceTo(this.player.pos);
      if (d > 1.5) continue;
      const toMe = this.player.pos.clone().sub(g.pos).setY(0).normalize();
      const behind = toMe.dot(g.forward) < -0.2 || g.state === 'sleep';
      const dir = g.pos.clone().setY(1.2).sub(cam.position).normalize();
      if (behind && dir.dot(fwd) > 0.5) {
        return { id: 'takedown', guard: g, hold: 0, label: () => '기절시키기', ok: () => true, need: () => true, done: () => this.takedown(g) };
      }
    }
    return best;
  }

  takedown(g) {
    this.vm.knifeAction('slash');
    g.knockout();
    this.knocked++;
    sfx('pat', 1); sfx('clap', 0.4);
    this.noise(g.pos, 2.5, 0.8);
    if (this.knocked === 1) this.say('...살살 해. 우리 그런 사람 아니잖아.');
  }

  // ---------- 소리 ----------
  noise(pos, radius, loud = 1) {
    if (radius <= 0 || this.ended) return;
    for (const g of this.guards) g.hear(pos, radius, loud);
  }

  // ---------- 경보 ----------
  onSpotted(g) {
    this.spotted++;
    this.once('spotted', '야야 들킨 거 아니지?? 아니지??');
  }
  raiseAlarm(src) {
    if (this.alarm || this.ended) return;
    this.alarm = true;
    startSiren();
    this.say('경보 울렸다!! 경찰 1분 조금 넘으면 온대! 차 시동 건다!!');
    for (const g of this.guards) {
      if (g.state === 'down') continue;
      if (g.state === 'sleep') g.wake(this.player.pos);
      g.last.copy(this.player.pos);
      g.sus = 1.2;
      g.toAlert();
    }
  }

  // ---------- 플레이어 공격 / 피해 ----------
  playerAttack() {
    const P = this.player;
    const fwd = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    this.noise(P.pos, 3.5, 0.7);
    for (const g of this.guards) {
      if (g.state === 'down') continue;
      const to = g.pos.clone().sub(P.pos).setY(0);
      const d = to.length();
      if (d > 1.9) continue;
      if (to.normalize().dot(fwd) < 0.55) continue;
      const sneak = g.unaware();
      const ko = g.hit(sneak);
      sfx('pat', 1);
      if (ko) { this.knocked++; if (this.knocked === 1) this.say('...살살 해. 우리 그런 사람 아니잖아.'); }
      break;
    }
  }
  damagePlayer(n) {
    if (this.ended) return;
    this.hp -= n;
    this.hurtT = 0;
    sfx('pat', 1.2); sfx('clap', 0.5);
    this.hud.hurt();
    if (this.hp <= 0) this.end(false, '경비한테 제압당했다');
  }

  // ---------- 매 프레임 ----------
  update(dt, input, active, ctx) {
    if (this.ended) return;
    const P = this.player;
    this.time += dt;
    this.world.update(dt, this.alarm);
    this.world.animate(dt);

    // 노출도: 조명 + 손전등 + 자세/움직임
    const pp = new THREE.Vector3(P.pos.x, P.eye - 0.4, P.pos.z);
    let light = this.world.lightAt(pp);
    for (const g of this.guards) light += g.flashOn(pp);
    let e = THREE.MathUtils.clamp(light * 1.15, 0.12, 1.3);
    e *= 1 - P.crouch * 0.4;
    e *= 1 + Math.min(1, P.speed / 5) * 0.35;
    this.exposure = e;
    this.light = light;

    for (const g of this.guards) g.update(dt);
    for (const c of this.cams) c.update(dt);

    // 춤추면 소리가 큼
    if (ctx.dancing) { this.danceT = (this.danceT || 0) - dt; if (this.danceT <= 0) { this.danceT = 0.8; this.noise(P.pos, 14, 0.8); this.once('dance', '...너 지금 춤추냐? 은행에서??'); } }

    // 상호작용
    const t = active ? this.findTarget() : null;
    this.target = t;
    if ((this.holdTarget?.id) !== (t?.id)) { this.hold = 0; this.holdTarget = t; }
    if (t && active && input.isDown('KeyE') && (!t.need || t.need())) {
      if (t.hold === 0) { if (input.wasPressed('KeyE')) t.done(); }
      else {
        this.hold += dt / t.hold;
        if (t.tickSfx) { this.tick = (this.tick || 0) - dt; if (this.tick <= 0) { this.tick = 0.22; sfx('tick', 0.6); } }
        if (t.noise) { this.nT = (this.nT || 0) - dt; if (this.nT <= 0) { this.nT = 0.6; this.noise(P.pos, t.noise, 0.5); } }
        if (this.hold >= 1) { this.hold = 0; t.done(); }
      }
    } else this.hold = 0;

    // 지역 진입 대사
    if (P.pos.x < -6.5 && P.pos.z < -5.2) this.once('secroom', '경비실이다. 조는 사람 있으면 깨우지 마~');
    if (P.pos.x > 6.5 && P.pos.z < -5.2) this.once('office', '지점장실! 책상 위에 카드키 있을 거야.');

    // 체력 회복
    this.hurtT += dt;
    if (this.hurtT > 4 && this.hp < 100) this.hp = Math.min(100, this.hp + dt * 6);

    // 경찰
    if (this.alarm) {
      this.policeT -= dt;
      if (this.policeT < 20) this.once('police20', '빨리!!! 사이렌 들려! 나 먼저 갈까?');
      if (this.policeT <= 0) this.end(false, '경찰이 도착했다');
    }

    // 탈출
    for (const ex of this.world.exits) {
      if (P.pos.x > ex.minX && P.pos.x < ex.maxX && P.pos.z > ex.minZ && P.pos.z < ex.maxZ) {
        if (this.money <= 0) { if (!this.flags.empty || this.time - this.flags.empty > 4) { this.flags.empty = this.time; this.say('빈손으로 가게? 뭐라도 챙겨!'); } }
        else this.end(true, ex.name + '으로 탈출');
      }
    }

    // 무전 큐
    if (this.radioT > 0) this.radioT -= dt;
    else if (this.radioQ.length) {
      const m = this.radioQ[0];
      if (m.delay > 0) m.delay -= dt;
      else { this.radioQ.shift(); this.hud.radio(m.text); this.radioT = Math.max(2.6, m.text.length * 0.09); sfx('tick', 0.3); }
    }
  }

  end(success, reason) {
    if (this.ended) return;
    this.ended = true;
    stopSiren();
    const m = this.time;
    let grade;
    if (!success) grade = '뉴스 출연 예정';
    else if (!this.alarm && this.spotted === 0 && this.knocked === 0) grade = '유령';
    else if (!this.alarm && this.spotted === 0) grade = '프로';
    else if (!this.alarm) grade = '아슬아슬';
    else grade = '동네 좀도둑';
    this.result = { success, reason, money: this.money, time: m, spotted: this.spotted, knocked: this.knocked, alarm: this.alarm, grade, bags: this.bags };
    this.hud.result(this.result, won);
    sfx(success ? 'uiSel' : 'pat', 1);
  }

  // HUD 용 요약
  objectives() {
    return [
      [this.keycard, '카드키 찾기', '지점장실'],
      [this.camsOff, 'CCTV 끄기', '경비실 · 선택'],
      [this.vaultOpen, '금고 열기', this.keycard ? '' : '카드키 필요'],
      [this.bags >= 4, `돈가방 챙기기 ${this.bags}/4`, ''],
      [false, '탈출하기', '정문 · 뒷문'],
    ];
  }
  get moneyText() { return won(this.money); }
}
