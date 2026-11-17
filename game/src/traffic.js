// Traffic and pedestrians: cars loop the road lanes and turn at intersections,
// people stroll the sidewalks — and run when a punch lands or a car bears down.
import * as THREE from 'three';
import { CITY, TRAFFIC } from './config.js';
import { createCar, moveCar, separateCars } from './vehicles.js';
import { clampToCity } from './city.js';

const CAR_COLORS = [0x5a7a9a, 0xf2c230, 0x7a6a55, 0xd23a2e, 0xd8d8d0, 0x4a6a8a, 0x9a4a6a, 0x3a5a3a];
const SHIRT_COLORS = [0xd25a4a, 0x4a7ad2, 0x5aa04a, 0xd2a04a, 0x8a5ad2, 0x4ad2c2, 0xe8e8e8, 0x2e3440];
const CAR_TYPES = ['sedan', 'sedan', 'taxi', 'truck', 'van', 'sports', 'sedan', 'taxi'];

function makePed(scene, rng, x, z) {
  const group = new THREE.Group();
  const shirt = rng.pick(SHIRT_COLORS);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
  torso.position.y = 1.0;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.28), new THREE.MeshStandardMaterial({ color: 0xd9a075, roughness: 0.9 }));
  head.position.y = 1.48;
  head.castShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.9 }));
  legL.position.set(-0.13, 0.3, 0);
  const legR = legL.clone();
  legR.position.x = 0.13;
  group.add(torso, head, legL, legR);
  group.position.set(x, 0, z);
  scene.add(group);
  return { group, legL, legR, x, z, heading: 0, speed: rng.range(TRAFFIC.pedSpeedMin, TRAFFIC.pedSpeedMax), state: 'walk', fleeUntil: 0, walkPhase: rng.range(0, 6) };
}

export function createTraffic(scene, rng) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.pick(CITY.roads);
    const s = rng.range(-200, 200);
    const dir = rng.chance(0.5) ? 1 : -1;
    const type = rng.pick(CAR_TYPES);
    const car = createCar(scene, type, axis === 'x' ? s : road, axis === 'x' ? road : s, axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
    car.speed = rng.range(TRAFFIC.carSpeedMin, TRAFFIC.carSpeedMax);
    car.parked = false;
    cars.push({ car, axis, road, s, dir, lane: rng.pick([-3, 3]) });
  }
  const peds = [];
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const road = rng.pick(CITY.roads);
    const along = rng.range(-200, 200);
    const side = rng.pick([-8.5, 8.5]);
    const ped = rng.chance(0.5)
      ? makePed(scene, rng, road + side, along)
      : makePed(scene, rng, along, road + side);
    ped.heading = rng.range(0, Math.PI * 2);
    peds.push(ped);
  }
  return { cars, peds };
}

function nearestRoadCoord(value) {
  let best = CITY.roads[0];
  for (const r of CITY.roads) if (Math.abs(r - value) < Math.abs(best - value)) best = r;
  return best;
}

function updateTrafficCar(state, t, dt) {
  const { car } = t;
  // Cruise along the current road; at an intersection sometimes turn.
  t.s += t.dir * car.speed * dt;
  const atJunction = CITY.roads.some((r) => Math.abs(t.s - r) < 1.2);
  if (atJunction && state.rng.chance(dt * 0.35)) {
    const cross = nearestRoadCoord(t.s);
    if (t.axis === 'x') {
      t.axis = 'z';
      t.road = cross;
      t.s = car.z;
      t.dir = state.rng.chance(0.5) ? 1 : -1;
    } else {
      t.axis = 'x';
      t.road = cross;
      t.s = car.x;
      t.dir = state.rng.chance(0.5) ? 1 : -1;
    }
    t.lane = state.rng.pick([-3, 3]);
  }
  if (t.s > 212 || t.s < -212) {
    // Loop back from the far edge on a fresh road.
    t.road = state.rng.pick(CITY.roads);
    t.s = -t.dir * 210;
    t.lane = state.rng.pick([-3, 3]);
  }
  if (t.axis === 'x') {
    car.x = t.s;
    car.z = t.road + t.lane;
    car.heading = t.dir > 0 ? 0 : Math.PI;
  } else {
    car.x = t.road + t.lane;
    car.z = t.s;
    car.heading = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = Math.PI / 2 - car.heading;
  const spin = car.speed * dt / 0.34;
  for (const wheel of car.wheels) wheel.rotation.x += spin;
  // Slow for a car directly ahead in the same lane.
  for (const other of state.traffic.cars) {
    if (other === t) continue;
    if (other.axis === t.axis && other.road === t.road && Math.abs(other.s - t.s) < 9 && Math.sign(other.s - t.s) === t.dir) {
      car.speed = Math.max(3, car.speed - 6 * dt);
    }
  }
}

function updatePed(state, ped, dt) {
  const now = state.time;
  if (ped.state === 'flee' && now < ped.fleeUntil) {
    ped.heading = Math.atan2(ped.z - ped.fleeZ, ped.x - ped.fleeX);
    ped.speed = 5.5;
  } else {
    ped.state = 'walk';
    ped.speed = Math.min(ped.speed, TRAFFIC.pedSpeedMax);
  }
  ped.x += Math.cos(ped.heading) * ped.speed * dt;
  ped.z += Math.sin(ped.heading) * ped.speed * dt;
  // Stay on a sidewalk: drift back to the nearest road offset.
  const road = nearestRoadCoord(ped.z);
  const roadX = nearestRoadCoord(ped.x);
  if (Math.abs(ped.z - road) < Math.abs(ped.x - roadX)) {
    const want = road + (ped.z >= road ? 8.5 : -8.5);
    ped.z += (want - ped.z) * Math.min(1, dt * 2);
  } else {
    const want = roadX + (ped.x >= roadX ? 8.5 : -8.5);
    ped.x += (want - ped.x) * Math.min(1, dt * 2);
  }
  // Turn at random when crossing an intersection.
  if (CITY.roads.some((r) => Math.abs(ped.x - r) < 1 && Math.abs(ped.z - r) < 1) && state.rng.chance(dt * 0.5)) {
    ped.heading += Math.PI / 2 * state.rng.pick([-1, 1]);
  }
  ped.x = clampToCity(ped.x);
  ped.z = clampToCity(ped.z);
  ped.walkPhase += dt * ped.speed * 2.2;
  const swing = Math.sin(ped.walkPhase) * 0.4;
  ped.legL.rotation.x = swing;
  ped.legR.rotation.x = -swing;
  ped.group.position.set(ped.x, 0, ped.z);
  ped.group.rotation.y = Math.PI / 2 - ped.heading;
}

// Make every pedestrian near (x, z) run away from it for a couple of seconds.
export function scarePeds(state, x, z, radius) {
  for (const ped of state.traffic.peds) {
    const d = Math.hypot(ped.x - x, ped.z - z);
    if (d < radius) {
      ped.state = 'flee';
      ped.fleeX = x;
      ped.fleeZ = z;
      ped.fleeUntil = state.time + 2.5;
    }
  }
}

export function updateTraffic(state, dt) {
  for (const t of state.traffic.cars) {
    if (t.car.isPlayer) continue;
    updateTrafficCar(state, t, dt);
  }
  for (const ped of state.traffic.peds) updatePed(state, ped, dt);
  // Keep cars from overlapping each other and the player's car.
  const all = state.traffic.cars.map((t) => t.car);
  if (state.player.car) all.push(state.player.car);
  for (const p of state.police.cars) all.push(p);
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) separateCars(all[i], all[j]);
  }
}
