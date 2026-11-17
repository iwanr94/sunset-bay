// Boot and the one loop: the world advances in fixed 1/60 s steps, the renderer paints
// what is there. Screens: title, play, paused, busted, over.
//
// ?seed=N fixes the city. ?shot=cover|foot|drive|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP, PLACES, START_CASH, DEFAULT_SEED, FINES, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createRenderer, updateCamera } from './render.js';
import { buildCity } from './city.js';
import { createInput, ACTION_PUNCH, ACTION_ENTER, ACTION_PAUSE, ACTION_MUTE, ACTION_CONFIRM } from './input.js';
import { createPlayer, updatePlayer } from './player.js';
import { createCar, driveCar } from './vehicles.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPolice, updatePolice, addWanted, clearPolice, respawnAtStation } from './police.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { createCombat, tryPunch, updateCombat } from './combat.js';
import { createHud, showScreen, updateHud, toast } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const view = createRenderer(canvas);
const city = buildCity(view.scene, seed);
const rng = createRandom(seed);
const input = createInput(canvas);
const hud = createHud();
const audio = createAudio();

const state = {
  time: 0,
  screen: 'title',
  seed,
  rng,
  view,
  city,
  input,
  hud,
  audio,
  player: createPlayer(view.scene),
  traffic: createTraffic(view.scene, rng),
  police: createPolice(),
  missions: createMissions(view.scene),
  combat: createCombat(),
  parked: [],
  cash: START_CASH,
  wanted: 0,
  lastCrimeAt: -999,
  missionLock: false,
  objective: '',
  objectiveSub: '',
  cameraYaw: 0,
  orbitYaw: 0,
  script: null,
  events: { busted: false, died: false },
  toast(message, seconds) { toast(state, message, seconds); },
};
state.player.x = PLACES.spawn.x;
state.player.z = PLACES.spawn.z;
state.player.heading = Math.PI / 2;
state.player.group.position.set(state.player.x, 0, state.player.z);

const status = document.getElementById('status');
function announce(message) { status.textContent = message; }

function startGame(fromSave) {
  const save = fromSave ? loadSave() : null;
  const p = state.player;
  if (p.car) {
    p.car.isPlayer = false;
    p.car.parked = true;
    p.car.speed = 0;
    state.parked.push(p.car);
    p.car = null;
  }
  p.x = PLACES.spawn.x;
  p.z = PLACES.spawn.z;
  p.heading = Math.PI / 2;
  p.speed = 0;
  p.health = 100;
  p.onFoot = true;
  p.group.visible = true;
  p.group.position.set(p.x, 0, p.z);
  state.cash = save ? save.cash : START_CASH;
  state.wanted = 0;
  state.lastCrimeAt = -999;
  state.missionLock = false;
  state.orbitYaw = 0;
  clearPolice(state);
  for (const b of state.missions.beacons) view.scene.remove(b.group);
  state.missions = createMissions(view.scene);
  if (save && save.storyComplete) {
    state.missions.done = true;
    state.objective = 'Story complete — Sunset Bay is yours';
    state.objectiveSub = 'Free roam: steal cars, chase cash, stay out of trouble';
  } else {
    startMission(state, save ? Math.min(save.missionIndex, 4) : 0);
  }
  state.screen = 'play';
  showScreen(hud, null);
  audio.ensure();
  updateHud(state);
  announce('Playing Sunset Bay.');
}

function tryEnterExitCar() {
  const p = state.player;
  if (p.onFoot) {
    let best = null;
    let bestD = 4.5;
    const candidates = [];
    for (const t of state.traffic.cars) candidates.push(t.car);
    for (const car of state.parked) candidates.push(car);
    for (const car of candidates) {
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return;
    const ti = state.traffic.cars.findIndex((t) => t.car === best);
    if (ti >= 0) state.traffic.cars.splice(ti, 1);
    const pi = state.parked.indexOf(best);
    if (pi >= 0) state.parked.splice(pi, 1);
    best.isPlayer = true;
    best.parked = false;
    p.car = best;
    p.onFoot = false;
    p.group.visible = false;
    addWanted(state, WANTED.stealHeat);
    state.toast('Car stolen! The cops noticed.');
    audio.blip(440, 0.1, 'square', 0.2);
  } else {
    const car = p.car;
    car.isPlayer = false;
    car.speed = 0;
    car.parked = true;
    state.parked.push(car);
    p.x = car.x + Math.cos(car.heading + Math.PI / 2) * 2.5;
    p.z = car.z + Math.sin(car.heading + Math.PI / 2) * 2.5;
    p.heading = car.heading;
    p.onFoot = true;
    p.car = null;
    p.group.visible = true;
    p.group.position.set(p.x, 0, p.z);
  }
}

function onBusted() {
  state.cash = Math.max(0, state.cash - FINES.busted);
  state.wanted = 0;
  clearPolice(state);
  respawnAtStation(state);
  state.screen = 'busted';
  showScreen(hud, 'busted');
  saveGame(state);
  announce('Busted. Fine paid, back at the police station.');
}

function onDied() {
  const p = state.player;
  state.cash = Math.max(0, state.cash - FINES.death);
  if (p.car) {
    p.car.isPlayer = false;
    p.car.parked = true;
    p.car.speed = 0;
    state.parked.push(p.car);
    p.car = null;
  }
  p.health = 100;
  p.onFoot = true;
  p.group.visible = true;
  p.x = PLACES.hospital.x;
  p.z = PLACES.hospital.z;
  p.heading = 0;
  p.group.position.set(p.x, 0, p.z);
  state.screen = 'over';
  showScreen(hud, 'over');
  saveGame(state);
  announce('You flatlined. Woke up at the hospital.');
}

function stepGame(dt) {
  state.time += dt;
  state.events.busted = false;
  state.events.died = false;
  if (state.player.onFoot) updatePlayer(state, dt);
  else driveCar(state, state.player.car, dt);
  updateTraffic(state, dt);
  updatePolice(state, dt);
  updateMissions(state, dt);
  updateCombat(state, dt);
  if (state.events.busted) onBusted();
  else if (state.events.died) onDied();
  audio.setEngine(state.player.car ? state.player.car.speed : 0, Boolean(state.player.car));
  audio.setSiren(state.wanted, state.time);
}

// The title screen keeps the city alive behind the menu: traffic rolls on.
function stepTitle(dt) {
  state.time += dt;
  state.orbitYaw += dt * 0.07;
  updateTraffic(state, dt);
}

function handleActions(actions) {
  if (state.screen === 'play') {
    if (actions & ACTION_PAUSE) {
      state.screen = 'pause';
      showScreen(hud, 'pause');
      saveGame(state);
      announce('Paused.');
    }
    if (actions & ACTION_PUNCH) tryPunch(state);
    if (actions & ACTION_ENTER) tryEnterExitCar();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      state.toast(muted ? 'Muted' : 'Sound on');
    }
  } else if (state.screen === 'pause') {
    if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
      state.screen = 'play';
      showScreen(hud, null);
      announce('Playing.');
    }
  } else if (state.screen === 'title') {
    if (actions & ACTION_CONFIRM) startGame(false);
  }
}

function runGame() {
  const save = loadSave();
  const btnContinue = document.getElementById('btn-continue');
  if (!save) btnContinue.style.display = 'none';
  document.getElementById('btn-start').addEventListener('click', () => startGame(false));
  btnContinue.addEventListener('click', () => startGame(true));
  document.getElementById('btn-resume').addEventListener('click', () => {
    state.screen = 'play';
    showScreen(hud, null);
  });
  document.getElementById('btn-quit').addEventListener('click', () => {
    saveGame(state);
    state.screen = 'title';
    showScreen(hud, 'title');
  });
  document.getElementById('btn-busted').addEventListener('click', () => {
    state.screen = 'play';
    showScreen(hud, null);
  });
  document.getElementById('btn-respawn').addEventListener('click', () => {
    state.screen = 'play';
    showScreen(hud, null);
  });

  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const delta = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const drag = input.takeDrag();
    state.orbitYaw -= drag.dx * 0.005;
    handleActions(input.takeActions());
    if (state.screen === 'play') {
      accumulator += delta;
      while (accumulator >= STEP) {
        stepGame(STEP);
        accumulator -= STEP;
        if (state.screen !== 'play') { accumulator = 0; break; }
      }
    } else if (state.screen === 'title') {
      accumulator += delta;
      while (accumulator >= STEP) {
        stepTitle(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    updateCamera(state, delta);
    view.renderer.render(view.scene, view.camera);
    if (state.screen === 'play') updateHud(state);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') {
      state.screen = 'pause';
      showScreen(hud, 'pause');
      saveGame(state);
    }
  });
  announce('Sunset Bay. Press Enter or click Start to play.');
  requestAnimationFrame(frame);
}

// ---- Screenshot staging -------------------------------------------------
// A scripted stand-in for the keyboard: drives or walks toward a fixed target.
function makeScriptInput() {
  return {
    isDown(code) {
      const s = state.script;
      if (!s || s.mode !== 'drive' || !state.player.car) return false;
      const car = state.player.car;
      if (code === 'KeyW' || code === 'ArrowUp') return true;
      if (code === 'KeyA' || code === 'ArrowLeft' || code === 'KeyD' || code === 'ArrowRight') {
        const want = Math.atan2(s.tz - car.z, s.tx - car.x);
        let diff = want - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (code === 'KeyD' || code === 'ArrowRight') return diff > 0.04;
        return diff < -0.04;
      }
      return false;
    },
    moveAxes() {
      const s = state.script;
      const p = state.player;
      const dx = s.tx - p.x;
      const dz = s.tz - p.z;
      const d = Math.hypot(dx, dz) || 1;
      return { x: dx / d, z: dz / d, mag: 1 };
    },
    takeActions() { return 0; },
    takeDrag() { return { dx: 0, dy: 0 }; },
  };
}

function stagePoliceCar(x, z, heading) {
  const car = createCar(view.scene, 'police', x, z, heading);
  car.speed = 16;
  state.police.cars.push(car);
  return car;
}

function runShot(name) {
  showScreen(hud, null);
  startGame(false);
  const p = state.player;
  if (name === 'cover') {
    // Police chase: the player in a sports car, two cruisers closing in behind,
    // three stars, mission objective and minimap on the HUD.
    const car = createCar(view.scene, 'sports', -120, 156, 0);
    car.isPlayer = true;
    car.speed = 18;
    p.car = car;
    p.onFoot = false;
    p.group.visible = false;
    state.wanted = 3;
    state.lastCrimeAt = state.time;
    stagePoliceCar(-142, 150, 0);
    stagePoliceCar(-152, 162, 0);
    // Front camera: the car faces us, the cruisers close in behind it.
    state.orbitYaw = Math.PI;
    state.script = { mode: 'drive', tx: 200, tz: 156, seconds: 6 };
  } else if (name === 'foot') {
    p.x = 8.5;
    p.z = 60;
    p.heading = -Math.PI / 2;
    p.group.position.set(p.x, 0, p.z);
    state.script = { mode: 'walk', tx: 8.5, tz: -140, seconds: 7 };
  } else if (name === 'drive') {
    // Sunset coast road: west along the beach road, straight into the low sun.
    const car = createCar(view.scene, 'sports', 150, 208, Math.PI);
    car.isPlayer = true;
    car.speed = 20;
    p.car = car;
    p.onFoot = false;
    p.group.visible = false;
    state.script = { mode: 'drive', tx: -200, tz: 208, seconds: 8 };
  } else if (name === 'mission') {
    // On the pier, closing on the beacon: ring, beam and ocean ahead.
    p.x = 0;
    p.z = 268;
    p.heading = Math.PI / 2;
    p.group.position.set(p.x, 1.1, p.z);
    state.script = { mode: 'walk', tx: 0, tz: 284, seconds: 2.5 };
  } else {
    state.script = { mode: 'walk', tx: 0, tz: 150, seconds: 3 };
  }
  state.input = makeScriptInput();
  const steps = Math.round(state.script.seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepGame(STEP);
  if (name === 'cover' && state.player.car) {
    // Freeze the chase in frame: the cruisers flank the player's car just behind
    // it, so the front camera sees the pursuit, not empty road.
    const car = state.player.car;
    const fx = Math.cos(car.heading);
    const fz = Math.sin(car.heading);
    state.police.cars.forEach((pc, i) => {
      const side = i === 0 ? -7.5 : 7.5;
      pc.x = car.x - fx * 13 - fz * side;
      pc.z = car.z - fz * 13 + fx * side;
      pc.heading = car.heading;
      pc.speed = car.speed;
      pc.group.position.set(pc.x, 0, pc.z);
      pc.group.rotation.y = Math.PI / 2 - pc.heading;
    });
  }
  updateCamera(state, 5);
  updateHud(state);
  let painted = 0;
  function paint() {
    view.renderer.render(view.scene, view.camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();

// Debug handle for play-testing (read-only from the outside in practice): the
// live game state, so a test can check the player moved or a mission advanced.
window.__sunsetBay = state;
