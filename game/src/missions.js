// Five chained story missions with glowing 3D beacons, HUD objectives, minimap blips
// and cash rewards. Finish the fifth and the story is complete — free roam continues.
import * as THREE from 'three';
import { PLACES } from './config.js';
import { addWanted, clearPolice } from './police.js';

export const MISSION_DEFS = [
  { name: 'Meet Rico at the pier', sub: 'Follow the yellow beacon to the end of the pier', reward: 200 },
  { name: 'Collect 3 packages at the marina', sub: 'Grab every package crate on the east docks', reward: 300 },
  { name: 'Lose the police tail', sub: 'Get your wanted level back to zero', reward: 400 },
  { name: 'Timed delivery to the north docks', sub: 'Reach the north docks before the clock runs out', reward: 500, timeLimit: 90 },
  { name: 'Final getaway', sub: 'Survive 60 seconds at 4 stars', reward: 1000, timeLimit: 60 },
];

function makeBeacon(scene, x, z, color = 0xffd23a, y = 0) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 0.25, 24),
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, emissive: color, emissiveIntensity: 0.8 }),
  );
  ring.position.y = 0.15;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.9, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 17;
  group.add(ring, beam);
  group.position.set(x, y, z);
  scene.add(group);
  return { group, ring, beam, x, z, phase: 0 };
}

export function createMissions(scene) {
  return { index: 0, beacons: [], timer: 0, collected: 0, done: false, scene };
}

function clearBeacons(missions) {
  for (const b of missions.beacons) missions.scene.remove(b.group);
  missions.beacons = [];
}

function beaconSpotsFor(index) {
  if (index === 0) return [{ x: PLACES.pier.x, z: PLACES.pier.z, y: 1.1 }];
  if (index === 1) {
    return [
      { x: 204, z: 40 }, { x: 214, z: 60 }, { x: 200, z: 74 },
    ];
  }
  if (index === 3) return [{ x: PLACES.northDocks.x, z: PLACES.northDocks.z }];
  return [];
}

export function startMission(state, index) {
  const m = state.missions;
  m.index = index;
  m.timer = 0;
  m.collected = 0;
  m.done = false;
  clearBeacons(m);
  for (const spot of beaconSpotsFor(index)) m.beacons.push(makeBeacon(state.view.scene, spot.x, spot.z, 0xffd23a, spot.y ?? 0));
  if (index === 2) {
    addWanted(state, 2);
    state.missionLock = false;
    state.toast('The cops are onto you — lose them!');
  }
  if (index === 4) {
    state.wanted = 4;
    state.lastCrimeAt = state.time;
    state.missionLock = true;
    state.toast('Four stars! Survive the getaway!');
  }
  const def = MISSION_DEFS[index];
  state.objective = def.name;
  state.objectiveSub = def.sub;
}

function finishMission(state) {
  const m = state.missions;
  const def = MISSION_DEFS[m.index];
  state.cash += def.reward;
  state.audio.jingle();
  state.toast(`Job done! +$${def.reward}`);
  clearBeacons(m);
  if (m.index === 4) {
    state.wanted = 0;
    state.missionLock = false;
    clearPolice(state);
    m.done = true;
    state.objective = 'Story complete — Sunset Bay is yours';
    state.objectiveSub = 'Free roam: steal cars, chase cash, stay out of trouble';
    state.toast('STORY COMPLETE — free roam!');
    return;
  }
  startMission(state, m.index + 1);
}

function playerPos(state) {
  return state.player.car ? state.player.car : state.player;
}

export function updateMissions(state, dt) {
  const m = state.missions;
  if (m.done) return;
  const def = MISSION_DEFS[m.index];
  const p = playerPos(state);

  // Beacon pulse.
  for (const b of m.beacons) {
    b.phase += dt * 3;
    const s = 1 + Math.sin(b.phase) * 0.12;
    b.ring.scale.set(s, 1, s);
  }

  if (m.index === 0 || m.index === 3) {
    const b = m.beacons[0];
    if (b && Math.hypot(p.x - b.x, p.z - b.z) < 6) {
      if (m.index === 3) state.toast('Delivery made!');
      finishMission(state);
      return;
    }
  } else if (m.index === 1) {
    for (let i = m.beacons.length - 1; i >= 0; i -= 1) {
      const b = m.beacons[i];
      if (Math.hypot(p.x - b.x, p.z - b.z) < 5) {
        state.view.scene.remove(b.group);
        m.beacons.splice(i, 1);
        m.collected += 1;
        state.audio.blip(880, 0.12, 'sine', 0.25);
        state.toast(`Package ${m.collected} of 3 collected`);
      }
    }
    if (m.collected >= 3) finishMission(state);
    return;
  } else if (m.index === 2) {
    if (state.wanted === 0) {
      state.toast('Clean getaway!');
      finishMission(state);
    }
    return;
  } else if (m.index === 4) {
    m.timer += dt;
    state.objectiveSub = `Survive at 4 stars — ${Math.max(0, Math.ceil(def.timeLimit - m.timer))}s left`;
    if (m.timer >= def.timeLimit) {
      finishMission(state);
    }
    return;
  }

  // Timed delivery: the clock runs out, the job restarts.
  if (def.timeLimit && m.index === 3) {
    m.timer += dt;
    state.objectiveSub = `Reach the north docks — ${Math.max(0, Math.ceil(def.timeLimit - m.timer))}s left`;
    if (m.timer >= def.timeLimit) {
      state.toast('Too slow — the delivery is still waiting');
      m.timer = 0;
      state.audio.blip(220, 0.3, 'sawtooth', 0.2);
    }
  }
}
