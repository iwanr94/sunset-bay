// The HUD: health bar, cash, wanted stars, mission objective, speed, toasts, the
// 2D minimap (roads, player arrow, police dots, mission blip), and the menu screens.
import { CITY, PLACES } from './config.js';

const MAP_SIZE = 180;
const MAP_SCALE = MAP_SIZE / (CITY.half * 2 + 40);

function toMap(x, z) {
  return [MAP_SIZE / 2 + x * MAP_SCALE, MAP_SIZE / 2 + z * MAP_SCALE];
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  return {
    root: el('hud'),
    healthFill: el('health-fill'),
    cash: el('cash'),
    stars: el('stars'),
    objectiveText: el('objective-text'),
    objectiveSub: el('objective-sub'),
    toastEl: el('toast'),
    speed: el('speed'),
    minimap: el('minimap'),
    screens: {
      title: el('screen-title'),
      pause: el('screen-pause'),
      busted: el('screen-busted'),
      over: el('screen-over'),
    },
    toastUntil: 0,
    lastCash: -1,
    lastStars: -1,
    lastObjective: '',
    lastObjectiveSub: '',
  };
}

export function showScreen(hud, name) {
  for (const [key, node] of Object.entries(hud.screens)) {
    node.classList.toggle('hidden', key !== name);
  }
  hud.root.classList.toggle('on', name === null);
}

export function toast(state, message, seconds = 2.6) {
  const hud = state.hud;
  hud.toastEl.textContent = message;
  hud.toastEl.style.opacity = '1';
  hud.toastUntil = state.time + seconds;
}

function drawMinimap(state) {
  const hud = state.hud;
  const ctx = hud.minimap.getContext('2d');
  const W = MAP_SIZE;
  ctx.fillStyle = '#20242e';
  ctx.fillRect(0, 0, W, W);
  // Ocean and sand along the south edge.
  const [, oceanY] = toMap(0, CITY.oceanZ);
  ctx.fillStyle = '#14608f';
  ctx.fillRect(0, oceanY, W, W - oceanY);
  const [, sandY] = toMap(0, CITY.sandZ);
  ctx.fillStyle = '#e6cf9e';
  ctx.fillRect(0, sandY, W, oceanY - sandY);
  // Park block.
  const [parkX, parkY] = toMap(state.city.park.x - 20, state.city.park.z - 20);
  ctx.fillStyle = '#5d8a48';
  ctx.fillRect(parkX, parkY, 40 * MAP_SCALE, 40 * MAP_SCALE);
  // Roads.
  ctx.strokeStyle = '#55555e';
  ctx.lineWidth = Math.max(2, 12 * MAP_SCALE);
  for (const r of CITY.roads) {
    const [x1] = toMap(-CITY.half, r);
    const [x2] = toMap(CITY.half, r);
    const [, y] = toMap(0, r);
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    const [x] = toMap(r, 0);
    const [, y1] = toMap(r, -CITY.half);
    const [, y2] = toMap(r, CITY.half);
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
  }
  // Mission blip, clamped to the map edge so a beacon beyond the city (the pier)
  // still shows where it is.
  for (const b of state.missions.beacons) {
    const [bx0, by0] = toMap(b.x, b.z);
    const bx = Math.max(6, Math.min(MAP_SIZE - 6, bx0));
    const by = Math.max(6, Math.min(MAP_SIZE - 6, by0));
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1024';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Traffic cars as grey dots.
  ctx.fillStyle = 'rgba(200,200,200,0.7)';
  for (const t of state.traffic.cars) {
    if (t.car.isPlayer) continue;
    const [cx, cy] = toMap(t.car.x, t.car.z);
    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  }
  // Police as red dots.
  ctx.fillStyle = '#ff4040';
  for (const car of state.police.cars) {
    const [cx, cy] = toMap(car.x, car.z);
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = state.player.car ? state.player.car : state.player;
  const [px, py] = toMap(p.x, p.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 5);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function updateHud(state) {
  const hud = state.hud;
  const p = state.player;
  hud.healthFill.style.width = `${Math.max(0, p.health)}%`;
  if (state.cash !== hud.lastCash) {
    hud.cash.textContent = `$${Math.floor(state.cash)}`;
    hud.lastCash = state.cash;
  }
  if (state.wanted !== hud.lastStars) {
    let html = '';
    for (let i = 0; i < 5; i += 1) html += `<span class="${i < state.wanted ? '' : 'off'}">★</span>`;
    hud.stars.innerHTML = html;
    hud.lastStars = state.wanted;
  }
  if (state.objective !== hud.lastObjective) {
    hud.objectiveText.textContent = state.objective;
    hud.lastObjective = state.objective;
  }
  if (state.objectiveSub !== hud.lastObjectiveSub) {
    hud.objectiveSub.textContent = state.objectiveSub;
    hud.lastObjectiveSub = state.objectiveSub;
  }
  const speed = state.player.car ? Math.abs(state.player.car.speed) : p.speed;
  hud.speed.innerHTML = `${Math.round(speed * 2.237)} <small>mph</small>`;
  if (state.time > hud.toastUntil) hud.toastEl.style.opacity = '0';
  drawMinimap(state);
}
