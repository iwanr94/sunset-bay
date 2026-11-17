// Sunset Bay: every number the game balances on, in one place.
export const STEP = 1 / 60;

export const CITY = {
  roads: [-208, -156, -104, -52, 0, 52, 104, 156, 208],
  blocks: [-182, -130, -78, -26, 26, 78, 130, 182],
  pitch: 52,
  roadWidth: 12,
  half: 224,
  sandZ: 224,
  oceanZ: 264,
};

// Named places the missions and respawns use.
export const PLACES = {
  pier: { x: 0, z: 292 },
  marina: { x: 212, z: 52 },
  northDocks: { x: 52, z: -216 },
  policeStation: { x: -156, z: -156 },
  hospital: { x: 156, z: 156 },
  spawn: { x: 0, z: 190 },
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10.5,
  radius: 0.6,
  maxHealth: 100,
  regenPerSecond: 2,
  regenDelay: 5,
  punchRange: 2.6,
  punchArc: 1.1,
  punchCooldown: 0.4,
};

export const CAR_TYPES = {
  sedan: { maxSpeed: 24, accel: 11, brake: 22, steer: 1.9, length: 4.2, color: 0x5a7a9a },
  taxi: { maxSpeed: 24, accel: 11, brake: 22, steer: 1.9, length: 4.2, color: 0xf2c230 },
  truck: { maxSpeed: 17, accel: 8, brake: 18, steer: 1.4, length: 5.8, color: 0x7a6a55 },
  sports: { maxSpeed: 31, accel: 15, brake: 26, steer: 2.2, length: 4.0, color: 0xd23a2e },
  van: { maxSpeed: 20, accel: 9, brake: 20, steer: 1.6, length: 4.6, color: 0xd8d8d0 },
  police: { maxSpeed: 28, accel: 13, brake: 24, steer: 2.1, length: 4.2, color: 0xe8e8e8 },
};

export const WANTED = {
  max: 5,
  maxPolice: 4,
  spawnEvery: 1.5,
  spawnDistance: 48,
  decaySeconds: 20,
  escapeSeconds: 10,
  escapeDistance: 70,
  bustSeconds: 3,
  bustDistance: 7,
  bustSpeed: 2,
  stealHeat: 1,
  punchHeat: 1,
  hitPedHeat: 2,
};

export const FINES = { busted: 100, death: 50 };

export const TRAFFIC = { cars: 14, peds: 22, carSpeedMin: 8, carSpeedMax: 13, pedSpeedMin: 1.2, pedSpeedMax: 2.2 };

export const SAVE_KEY = 'sunset-bay-save-v1';
export const START_CASH = 150;
export const DEFAULT_SEED = 1;
