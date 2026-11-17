// Cars, built from boxes: sedan, taxi, truck, sports car, van and police cruiser.
// Arcade handling: accelerate, brake and steer by speed, with building collision.
// Heading 0 faces east (+x); every car mesh is built facing +z.
import * as THREE from 'three';
import { CAR_TYPES } from './config.js';
import { resolveCollisions, clampToCity } from './city.js';

function box(w, h, d, color, x, y, z, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.45, metalness: opts.metalness ?? 0.35,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function createCar(scene, type, x, z, heading) {
  const spec = CAR_TYPES[type];
  const group = new THREE.Group();
  const L = spec.length;
  const body = box(1.9, 0.62, L, spec.color, 0, 0.58, 0);
  group.add(body);
  const cabin = box(1.66, 0.55, L * 0.48, type === 'truck' ? spec.color : 0x1c222c, 0, 1.14, -L * 0.06);
  cabin.material.roughness = 0.2;
  cabin.material.metalness = 0.1;
  group.add(cabin);
  if (type === 'truck') {
    group.add(box(2.0, 1.7, L * 0.52, 0x8a7a5a, 0, 1.35, -L * 0.2, { roughness: 0.8, metalness: 0.1 }));
  }
  if (type === 'sports') {
    group.add(box(1.7, 0.12, 0.9, 0x1a1a1a, 0, 1.02, -L / 2 + 0.1));
  }
  // Headlights and taillights.
  group.add(box(0.34, 0.16, 0.06, 0xfff2c0, -0.6, 0.62, L / 2 + 0.01, { emissive: 0xffedb0, emissiveIntensity: 1.6 }));
  group.add(box(0.34, 0.16, 0.06, 0xfff2c0, 0.6, 0.62, L / 2 + 0.01, { emissive: 0xffedb0, emissiveIntensity: 1.6 }));
  group.add(box(0.4, 0.14, 0.06, 0xd21f1f, -0.6, 0.62, -L / 2 - 0.01, { emissive: 0xaa1010, emissiveIntensity: 1.2 }));
  group.add(box(0.4, 0.14, 0.06, 0xd21f1f, 0.6, 0.62, -L / 2 - 0.01, { emissive: 0xaa1010, emissiveIntensity: 1.2 }));
  if (type === 'police') {
    group.add(box(0.5, 0.14, 0.3, 0xff2020, -0.35, 1.46, -L * 0.06, { emissive: 0xff2020, emissiveIntensity: 2 }));
    group.add(box(0.5, 0.14, 0.3, 0x2040ff, 0.35, 1.46, -L * 0.06, { emissive: 0x2040ff, emissiveIntensity: 2 }));
    group.add(box(1.92, 0.3, 0.7, 0x1a1a1a, 0, 0.9, 0));
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-0.88, L / 2 - 0.85], [0.88, L / 2 - 0.85], [-0.88, -L / 2 + 0.85], [0.88, -L / 2 + 0.85]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.34, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  group.position.set(x, 0, z);
  group.rotation.y = Math.PI / 2 - heading;
  scene.add(group);
  return {
    group, wheels, type, spec,
    x, z, heading, speed: 0, steer: 0,
    isPlayer: false, isPolice: type === 'police', parked: false,
  };
}

// Player driving: W/S accelerate and brake, A/D steer. Returns the speed reached.
export function driveCar(state, car, dt) {
  const input = state.input;
  const spec = car.spec;
  const fwd = input.isDown('KeyW') || input.isDown('ArrowUp');
  const back = input.isDown('KeyS') || input.isDown('ArrowDown');
  if (fwd) car.speed += spec.accel * dt;
  else if (back) car.speed -= (car.speed > 0.5 ? spec.brake : spec.accel * 0.7) * dt;
  else {
    // Engine drag and rolling resistance.
    car.speed -= car.speed * 0.9 * dt;
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
  }
  car.speed = Math.max(-spec.maxSpeed * 0.35, Math.min(spec.maxSpeed, car.speed));
  const steerInput = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0)
    - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
  const steerTarget = steerInput * spec.steer * Math.min(1, Math.abs(car.speed) / 8);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * dt * Math.sign(car.speed || 1);
  moveCar(state, car, dt);
  return car.speed;
}

// Integrate a car's position and keep it out of buildings.
export function moveCar(state, car, dt) {
  const nx = car.x + Math.cos(car.heading) * car.speed * dt;
  const nz = car.z + Math.sin(car.heading) * car.speed * dt;
  const pos = { x: nx, z: nz };
  const hit = resolveCollisions(state.city, pos, 1.9);
  if (hit) car.speed *= 0.55;
  car.x = clampToCity(pos.x);
  car.z = clampToCity(pos.z);
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = Math.PI / 2 - car.heading;
  const spin = car.speed * dt / 0.34;
  for (const wheel of car.wheels) wheel.rotation.x += spin;
  const front = car.steer * 0.35;
  car.wheels[0].rotation.y = front;
  car.wheels[1].rotation.y = front;
}

// Keep two cars from overlapping: push apart along the line between them.
export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = 3.6;
  if (d === 0 || d >= min) return false;
  const push = (min - d) / 2;
  const nx = dx / d;
  const nz = dz / d;
  a.x -= nx * push;
  a.z -= nz * push;
  b.x += nx * push;
  b.z += nz * push;
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.7;
  b.speed = avg * 0.7;
  return true;
}
