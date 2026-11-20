// 한탕 – 메인 루프
import * as THREE from 'three';
import { PS1Post, shared, sharedVM } from './ps1.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Viewmodel } from './viewmodel.js';
import { Character, BODY_IDLE, BODY_WALK } from './character.js';
import { Hud } from './hud.js';
import { EmoteWheel } from './emoteWheel.js';
import { EMOTES } from './emotes.js';
import { Npc } from './npc.js';
import { TRICK_ORDER, TRICK_KEYS, KNIFE } from './knifeClips.js';
import { initAudio, sfx, setVolume } from './audio.js';
import { clipFromPoses } from './anim.js';
import { Settings } from './settings.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.autoClear = false;
renderer.setClearColor(shared.uFogColor.value);
const post = new PS1Post(renderer);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 60);
const world = new World(scene);
const player = new Player(world);
const input = new Input(canvas);
const vm = new Viewmodel();
const hud = new Hud();
const body = new Character();
body.root.visible = false;
scene.add(body.root);
const npc = new Npc(scene, hud, camera);

const settings = new Settings({
  apply: (s) => {
    input.sens = s.sens;
    post.height = s.res === 0 ? Math.max(240, innerHeight) : s.res;
    post.mat.uniforms.uDither.value = s.dither ? 1 : 0;
    shared.uSnapScale.value = s.jitter ? 1 : 8;
    sharedVM.uSnapScale.value = s.jitter ? 2 : 8;
    shared.uAffine.value = s.jitter ? 0.65 : 0.0;
    setVolume(s.volume);
    resize();
  },
});

// ---------- 카메라 모드 ----------
const cam = {
  tp: 0,               // 0 = 1인칭, 1 = 3인칭
  toggle: false,       // V 로 켠 3인칭
  emote: null,         // 진행 중인 전신 감정표현
  orbitYaw: 0, orbitPitch: -0.12, dist: 2.5,
};

// ---------- 감정표현 ----------
let bodyEmote = null;
let emoteTime = 0;
function playEmote(e) {
  emoteTime = 0;
  if (e.tp) {
    cam.emote = e;
    cam.orbitYaw = Math.PI;    // 앞에서 보이게
    cam.orbitPitch = -0.08;
    vm.stopLeft();
  } else {
    vm.playLeft(e.fp);
    if (e.fpR) vm.playRight(e.fpR);
  }
  bodyEmote = e;
  body.anim.play(e.body, {
    blend: 0.15,
    onEnd: () => { bodyEmote = null; if (cam.emote === e) cam.emote = null; },
  });
  npc.react(e);
  hud.showToast(e.name);
}
function stopBodyEmote() {
  if (!bodyEmote) return;
  bodyEmote = null;
  cam.emote = null;
  body.anim.play(BODY_IDLE, { blend: 0.2 });
}
body.anim.onEvent = (type, arg) => {
  // 전신 감정표현 소리는 3인칭에서만 (1인칭은 손 애니메이션 쪽에서 남)
  if (type === 'sfx' && (cam.tp > 0.5 || bodyEmote?.tp)) sfx(arg.name || arg, arg.v ?? 1, 0);
};
const wheel = new EmoteWheel(EMOTES, playEmote);

vm.onTrick = (name) => hud.showToast(name);
player.onStep = (v) => sfx('step', v * 0.6);

// ---------- 시작/일시정지 ----------
const startEl = document.getElementById('start');
let started = DEBUG;
if (DEBUG) startEl.style.display = 'none';
startEl.addEventListener('click', () => { initAudio(); input.lock(); });
canvas.addEventListener('click', () => { if (started && !settings.open) input.lock(); });
input.onLockChange = (locked) => {
  if (locked) { started = true; startEl.style.display = 'none'; settings.hide(); }
  else if (started && !DEBUG) { wheel.cancel(); settings.show(); }
};
settings.onResume = () => { initAudio(); input.lock(); };

// ---------- 크기 ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  camera.aspect = w / h; camera.updateProjectionMatrix();
  vm.setAspect(w / h);
  post.setSize(w, h);
}
addEventListener('resize', resize);
resize();

// ---------- 루프 ----------
let last = performance.now();
let trickIdx = 0;
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _eye = new THREE.Vector3(), _tp = new THREE.Vector3(), _head = new THREE.Vector3();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  render();
  requestAnimationFrame(frame);
}

function step(dt) {
  const active = (input.locked || DEBUG) && !settings.open;
  const [mdx, mdy] = input.consumeMouse();

  // 감정표현 휠
  let clickUsed = false;
  if (active && input.wasPressed('emote')) wheel.show();
  if (wheel.open) {
    wheel.move(mdx, mdy);
    if (input.wasReleased('emote') || input.mousePressed[0]) { clickUsed = input.mousePressed[0]; wheel.commit(); }
    else if (input.mousePressed[2] || !active) wheel.cancel();
  }

  const looking = active && !wheel.open;
  if (looking) {
    if (cam.emote) {
      cam.orbitYaw -= mdx * 0.0022 * input.sens;
      cam.orbitPitch = THREE.MathUtils.clamp(cam.orbitPitch - mdy * 0.0022 * input.sens, -0.9, 0.5);
    } else player.look(mdx, mdy, input.sens);
  }

  // 반복 감정표현(춤)은 최대 시간이 지나면 끝
  if (bodyEmote) { emoteTime += dt; if (bodyEmote.maxTime && emoteTime > bodyEmote.maxTime) stopBodyEmote(); }

  // 이동 – 전신 감정표현 중 움직이면 취소
  const moving = active && ['forward', 'back', 'left', 'right', 'jump'].some((k) => input.isDown(k));
  if (cam.emote && moving && cam.emote.cancelOnMove !== false) stopBodyEmote();
  player.update(dt, input, active && !cam.emote && !wheel.open);

  // 칼 조작 (휠/전신 감정표현 중에는 막음)
  if (active && !wheel.open && !cam.emote) {
    if (input.wasPressed('flip')) vm.toggleKnife();
    if (input.wasPressed('trick')) { vm.knifeAction(TRICK_ORDER[trickIdx % TRICK_ORDER.length]); trickIdx++; }
    if (input.wasPressed('inspect')) vm.knifeAction('inspect');
    for (let i = 0; i < TRICK_KEYS.length; i++) if (input.wasPressed('Digit' + (i + 1))) vm.knifeAction(TRICK_KEYS[i]);
    if (input.mousePressed[0] && !clickUsed) vm.knifeAction(vm.open ? 'slash' : 'open');
    if (input.wasPressed('view')) { cam.toggle = !cam.toggle; cam.orbitYaw = 0; cam.orbitPitch = -0.12; }
  }

  // 카메라 블렌드
  const wantTP = cam.toggle || !!cam.emote;
  cam.tp += ((wantTP ? 1 : 0) - cam.tp) * Math.min(1, dt * 7);
  if (Math.abs(cam.tp - (wantTP ? 1 : 0)) < 0.002) cam.tp = wantTP ? 1 : 0;

  // 몸(3인칭용) 동작
  if (!bodyEmote) {
    const want = player.speed > 0.4 && player.grounded ? BODY_WALK : BODY_IDLE;
    if (body.anim.clip !== want) body.anim.play(want, { blend: 0.2 });
    if (want === BODY_WALK) body.anim.speed = THREE.MathUtils.clamp(player.speed / 3.2, 0.6, 1.8);
    else body.anim.speed = 1;
  } else body.anim.speed = 1;
  body.update(dt);
  body.root.position.copy(player.pos);
  body.root.rotation.y = player.yaw + Math.PI;
  body.knife.set(vm.knife.a, vm.knife.b);
  body.hips.position.y -= player.crouch * 0.35;

  vm.crouch = player.crouch;
  vm.update(dt, { speed: player.speed, running: player.running, grounded: player.grounded, lookDX: looking && !cam.emote ? mdx : 0, lookDY: looking && !cam.emote ? mdy : 0 });

  npc.update(dt, player);

  // 카메라 위치
  player.applyCamera(camera);
  _eye.copy(camera.position);
  _q1.copy(camera.quaternion);
  if (cam.tp > 0) {
    const yaw = player.yaw + cam.orbitYaw;
    const pitch = cam.emote ? cam.orbitPitch : player.pitch * 0.6 + cam.orbitPitch;
    _head.set(player.pos.x, player.pos.y + 1.45 - player.crouch * 0.4, player.pos.z);
    const back = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const side = cam.emote ? 0 : 0.45;
    _tp.copy(_head).addScaledVector(back, cam.dist).add(new THREE.Vector3(Math.cos(yaw) * side, 0.1, -Math.sin(yaw) * side));
    // 벽 밖으로 나가지 않게
    const b = world.bounds;
    _tp.x = THREE.MathUtils.clamp(_tp.x, b.minX + 0.2, b.maxX - 0.2);
    _tp.z = THREE.MathUtils.clamp(_tp.z, b.minZ + 0.2, b.maxZ - 0.2);
    _tp.y = THREE.MathUtils.clamp(_tp.y, 0.3, 3.4);
    const lookAt = _head.clone().add(new THREE.Vector3(Math.cos(yaw) * side * 0.6, -0.15, -Math.sin(yaw) * side * 0.6));
    _m.lookAt(_tp, lookAt, new THREE.Vector3(0, 1, 0));
    _q2.setFromRotationMatrix(_m);
    const w = cam.tp * cam.tp * (3 - 2 * cam.tp);
    camera.position.lerpVectors(_eye, _tp, w);
    camera.quaternion.slerpQuaternions(_q1, _q2, w);
  }
  body.root.visible = cam.tp > 0.35;
  hud.setCrosshair(cam.tp < 0.5 && !wheel.open);
  input.endFrame();
}

function render() {
  post.begin();
  renderer.render(scene, camera);
  if (cam.tp < 0.35) {
    renderer.clearDepth();
    vm.camera.position.copy(camera.position);
    vm.camera.quaternion.copy(camera.quaternion);
    vm.camera.updateMatrixWorld(true);
    renderer.render(vm.scene, vm.camera);
  }
  post.end();
}

requestAnimationFrame(frame);

// 검수/디버그용
window.HT = { wheel, input, clipFromPoses, vmClips: KNIFE, emoteFP: Object.fromEntries(EMOTES.filter(e => e.fp).map(e => [e.id, e.fp])), emoteBD: Object.fromEntries(EMOTES.map(e => [e.id, e.body])), vm, body, npc, player, camera, cam, scene, post, playEmote, EMOTES, step, render, renderer };
window.ready = true;
