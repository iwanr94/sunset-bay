// Combat: the punch. Short range, a swing in front of the player; pedestrians flee
// and the law notices, and a speeding car that clips the player hurts.
import { PLAYER, WANTED } from './config.js';
import { scarePeds } from './traffic.js';
import { addWanted } from './police.js';
import { damagePlayer } from './player.js';

export function createCombat() {
  return { cooldown: 0 };
}

export function tryPunch(state) {
  const c = state.combat;
  if (c.cooldown > 0 || !state.player.onFoot) return;
  c.cooldown = PLAYER.punchCooldown;
  state.audio.thud();
  const p = state.player;
  let hitAny = false;
  for (const ped of state.traffic.peds) {
    const dx = ped.x - p.x;
    const dz = ped.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > PLAYER.punchRange) continue;
    const ang = Math.atan2(dz, dx);
    let diff = ang - p.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > PLAYER.punchArc) continue;
    hitAny = true;
    // Knock the pedestrian back and send them running.
    ped.x += Math.cos(ang) * 1.6;
    ped.z += Math.sin(ang) * 1.6;
    ped.state = 'flee';
    ped.fleeX = p.x;
    ped.fleeZ = p.z;
    ped.fleeUntil = state.time + 3;
  }
  if (hitAny) {
    addWanted(state, WANTED.punchHeat);
    state.toast('Hey! The cops saw that!');
  }
  scarePeds(state, p.x, p.z, 8);
}

export function updateCombat(state, dt) {
  const c = state.combat;
  if (c.cooldown > 0) c.cooldown -= dt;
  if (!state.player.onFoot) return;
  const p = state.player;
  // A traffic car that clips the player at speed hurts.
  for (const t of state.traffic.cars) {
    const car = t.car;
    if (car.isPlayer) continue;
    const d = Math.hypot(car.x - p.x, car.z - p.z);
    if (d < 2.2 && Math.abs(car.speed) > 6) {
      damagePlayer(state, Math.min(34, (Math.abs(car.speed) - 6) * 3));
      state.audio.thud();
      scarePeds(state, p.x, p.z, 10);
      // Shove the player clear of the road.
      const ang = Math.atan2(p.z - car.z, p.x - car.x);
      p.x += Math.cos(ang) * 2;
      p.z += Math.sin(ang) * 2;
      break;
    }
  }
}
