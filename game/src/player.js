// The player on foot: a simple box-built figure (jacket, head, legs, arms) that walks,
// runs, and bobs as it moves. Heading 0 faces east (+x); the mesh is built facing +z.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCollisions, clampPosition } from './city.js';

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function createPlayer(scene) {
  const group = new THREE.Group();
  const torso = box(0.62, 0.72, 0.34, 0x2a8a7a, 0, 1.08, 0);
  const head = box(0.34, 0.34, 0.32, 0xd9a075, 0, 1.62, 0);
  const cap = box(0.38, 0.12, 0.36, 0xff9a3c, 0, 1.82, 0);
  const legL = box(0.24, 0.72, 0.26, 0x2e3440, -0.16, 0.36, 0);
  const legR = box(0.24, 0.72, 0.26, 0x2e3440, 0.16, 0.36, 0);
  const armL = box(0.18, 0.62, 0.2, 0x2a8a7a, -0.42, 1.08, 0);
  const armR = box(0.18, 0.62, 0.2, 0x2a8a7a, 0.42, 1.08, 0);
  group.add(torso, head, cap, legL, legR, armL, armR);
  scene.add(group);
  return {
    group, legL, legR, armL, armR,
    x: 0, z: 0, heading: 0, speed: 0, walkPhase: 0,
    onFoot: true, car: null, health: PLAYER.maxHealth, lastDamageAt: -99,
  };
}

// Move on foot. `axes` is camera-relative input from input.moveAxes; returns the
// speed actually reached (0 when blocked by a building).
export function updatePlayer(state, dt) {
  const p = state.player;
  const input = state.input;
  const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const top = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const axes = input.moveAxes(state.cameraYaw);
  const want = axes.mag;
  const vx = axes.x * top * want;
  const vz = axes.z * top * want;
  p.speed = Math.hypot(vx, vz);
  if (p.speed > 0.1) {
    p.heading = Math.atan2(vz, vx);
    p.walkPhase += dt * p.speed * 1.6;
  }
  const nx = p.x + vx * dt;
  const nz = p.z + vz * dt;
  const pos = { x: nx, z: nz };
  resolveCollisions(state.city, pos, PLAYER.radius);
  clampPosition(pos);
  p.x = pos.x;
  p.z = pos.z;
  // Walk swing + bob.
  const swing = p.speed > 0.1 ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 0.8;
  p.armR.rotation.x = swing * 0.8;
  // Step up onto the pier deck (its top is 1.1 above the sand).
  const onPier = Math.abs(p.x) < 5.5 && p.z > 223 && p.z < 302;
  const baseY = onPier ? 1.1 : 0;
  p.group.position.set(p.x, baseY + Math.abs(Math.sin(p.walkPhase)) * 0.06, p.z);
  p.group.rotation.y = Math.PI / 2 - p.heading;
  // Slow health regen out of combat.
  if (state.time - p.lastDamageAt > PLAYER.regenDelay && p.health < PLAYER.maxHealth) {
    p.health = Math.min(PLAYER.maxHealth, p.health + PLAYER.regenPerSecond * dt);
  }
}

export function damagePlayer(state, amount) {
  const p = state.player;
  p.health -= amount;
  p.lastDamageAt = state.time;
  if (p.health <= 0) {
    p.health = 0;
    state.events.died = true;
  }
}
