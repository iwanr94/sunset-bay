// The Sunset Bay PD: a wanted level from 0 to 5 stars, cruisers that spawn on the
// nearest road and chase along the streets, busted when they corner a slow player,
// and a wanted level that cools off when the heat dies down or the player escapes.
import { WANTED, PLACES } from './config.js';
import { createCar, moveCar } from './vehicles.js';
import { nearestRoad } from './city.js';

export function createPolice() {
  return { cars: [], spawnTimer: 0, bustTimer: 0, decayTimer: 0, escapeTimer: 0 };
}

export function addWanted(state, amount) {
  state.wanted = Math.min(WANTED.max, state.wanted + amount);
  state.lastCrimeAt = state.time;
  state.police.decayTimer = 0;
  state.police.escapeTimer = 0;
}

export function spawnPoliceCar(state) {
  const p = state.player.car ? state.player.car : state.player;
  const angle = state.rng.range(0, Math.PI * 2);
  const sx = p.x + Math.cos(angle) * WANTED.spawnDistance;
  const sz = p.z + Math.sin(angle) * WANTED.spawnDistance;
  const car = createCar(state.view.scene, 'police', sx, sz, Math.atan2(p.z - sz, p.x - sx));
  car.speed = 14;
  state.police.cars.push(car);
  return car;
}

function chasePolice(state, car, dt) {
  const p = state.player.car ? state.player.car : state.player;
  const playerSpeed = state.player.car ? Math.abs(state.player.car.speed) : state.player.speed;
  const dx = p.x - car.x;
  const dz = p.z - car.z;
  const dist = Math.hypot(dx, dz);
  // Chase along the roads: head for the player's position, snapped to the nearest
  // road on the axis we are not travelling on, so cruisers turn at intersections
  // instead of cutting through buildings.
  let tx;
  let tz;
  if (Math.abs(dx) >= Math.abs(dz)) {
    tx = p.x;
    tz = nearestRoad(car.z);
  } else {
    tx = nearestRoad(car.x);
    tz = p.z;
  }
  const wantHeading = Math.atan2(tz - car.z, tx - car.x);
  let diff = wantHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-2.4, Math.min(2.4, diff * 2.5));
  car.heading += turn * dt;
  const targetSpeed = dist < 12 ? Math.min(20, playerSpeed + 3) : 17 + state.wanted * 1.4;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
  moveCar(state, car, dt);
  return dist;
}

export function updatePolice(state, dt) {
  const police = state.police;
  const p = state.player.car ? state.player.car : state.player;
  const playerSpeed = state.player.car ? Math.abs(state.player.car.speed) : state.player.speed;

  // Spawn cruisers up to the wanted level's share.
  const desired = Math.min(state.wanted, WANTED.maxPolice);
  police.spawnTimer -= dt;
  if (police.cars.length < desired && police.spawnTimer <= 0) {
    spawnPoliceCar(state);
    police.spawnTimer = WANTED.spawnEvery;
  }

  let nearest = Infinity;
  for (const car of police.cars) nearest = Math.min(nearest, chasePolice(state, car, dt));

  // Busted: slow and cornered by a cruiser for three seconds.
  if (police.cars.length > 0 && playerSpeed < WANTED.bustSpeed && nearest < WANTED.bustDistance) {
    police.bustTimer += dt;
    if (police.bustTimer >= WANTED.bustSeconds) {
      state.events.busted = true;
      police.bustTimer = 0;
    }
  } else {
    police.bustTimer = 0;
  }

  // Wanted cools off: no crime for a while drops a star, and getting clean away
  // from every cruiser clears it outright — unless a mission holds the heat.
  if (!state.missionLock) {
    if (state.wanted > 0 && state.time - state.lastCrimeAt > WANTED.decaySeconds) {
      police.decayTimer += dt;
      if (police.decayTimer >= WANTED.decaySeconds) {
        state.wanted = Math.max(0, state.wanted - 1);
        police.decayTimer = 0;
      }
    }
    if (state.wanted > 0 && police.cars.length > 0 && nearest > WANTED.escapeDistance) {
      police.escapeTimer += dt;
      if (police.escapeTimer >= WANTED.escapeSeconds) {
        state.wanted = 0;
        police.escapeTimer = 0;
      }
    } else {
      police.escapeTimer = 0;
    }
  }

  // No wanted level, no cruisers: send them off and remove them once they are far.
  if (state.wanted === 0) {
    for (let i = police.cars.length - 1; i >= 0; i -= 1) {
      const car = police.cars[i];
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d > 95) {
        state.view.scene.remove(car.group);
        police.cars.splice(i, 1);
      }
    }
  }
}

export function clearPolice(state) {
  for (const car of state.police.cars) state.view.scene.remove(car.group);
  state.police.cars = [];
  state.police.bustTimer = 0;
}

export function respawnAtStation(state) {
  const p = state.player;
  if (p.car) {
    state.view.scene.remove(p.car.group);
    p.car = null;
    p.onFoot = true;
    p.group.visible = true;
  }
  p.x = PLACES.policeStation.x;
  p.z = PLACES.policeStation.z;
  p.heading = 0;
  p.speed = 0;
  p.group.position.set(p.x, 0, p.z);
}
