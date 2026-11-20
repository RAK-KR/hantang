// 1인칭 이동 – 걷기/달리기/앉기/점프, 상자 충돌
import * as THREE from 'three';

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3(0, 0, 7.0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;         // -Z 방향(카운터 쪽)을 보게
    this.pitch = 0;
    this.radius = 0.3;
    this.grounded = true;
    this.crouch = 0;
    this.eye = 1.62;
    this.speed = 0;
    this.running = false;
    this.stepT = 0;
    this.onStep = null;
  }
  look(dx, dy, sens) {
    const k = 0.0022 * sens;
    this.yaw -= dx * k;
    this.pitch -= dy * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.5, 1.5);
  }
  update(dt, input, locked) {
    const f = (locked && input.isDown('forward') ? 1 : 0) - (locked && input.isDown('back') ? 1 : 0);
    const s = (locked && input.isDown('right') ? 1 : 0) - (locked && input.isDown('left') ? 1 : 0);
    const crouching = locked && (input.isDown('crouch') || input.isDown('crouch2'));
    this.crouch += ((crouching ? 1 : 0) - this.crouch) * Math.min(1, dt * 10);
    this.running = locked && input.isDown('run') && f > 0 && !crouching;
    const max = crouching ? 1.6 : this.running ? 5.6 : 3.4;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(max);
    const acc = this.grounded ? 14 : 3;
    this.vel.x += (wish.x - this.vel.x) * Math.min(1, dt * acc);
    this.vel.z += (wish.z - this.vel.z) * Math.min(1, dt * acc);
    if (this.grounded && locked && input.wasPressed('jump') && !crouching) { this.vel.y = 4.4; this.grounded = false; }
    this.vel.y -= 13 * dt;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y <= 0) { if (!this.grounded && this.vel.y < -3 && this.onStep) this.onStep(1.4); this.pos.y = 0; this.vel.y = 0; this.grounded = true; }
    this.collide();
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && this.speed > 0.5) {
      this.stepT += dt * this.speed * (this.running ? 0.48 : 0.58);
      if (this.stepT > 1) { this.stepT -= 1; if (this.onStep) this.onStep(crouching ? 0.4 : this.running ? 1.1 : 0.8); }
    }
    this.eye = 1.62 - this.crouch * 0.55;
  }
  collide() {
    const p = this.pos, r = this.radius, b = this.world.bounds;
    p.x = THREE.MathUtils.clamp(p.x, b.minX + r, b.maxX - r);
    p.z = THREE.MathUtils.clamp(p.z, b.minZ + r, b.maxZ - r);
    for (const c of this.world.colliders) {
      if (p.y >= c.top - 0.05) continue;
      const cx = THREE.MathUtils.clamp(p.x, c.minX, c.maxX);
      const cz = THREE.MathUtils.clamp(p.z, c.minZ, c.maxZ);
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = (r - d) / d;
          p.x += dx * push; p.z += dz * push;
        } else {
          // 안쪽에 들어가 있으면 가장 가까운 면으로 밀기
          const ox = Math.min(p.x - c.minX, c.maxX - p.x), oz = Math.min(p.z - c.minZ, c.maxZ - p.z);
          if (ox < oz) p.x = p.x - c.minX < c.maxX - p.x ? c.minX - r : c.maxX + r;
          else p.z = p.z - c.minZ < c.maxZ - p.z ? c.minZ - r : c.maxZ + r;
        }
      }
    }
  }
  applyCamera(cam) {
    cam.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
