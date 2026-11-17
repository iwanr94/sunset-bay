// Sunset Bay itself: a deterministic 8x8-block coastal city built from a seed — roads,
// buildings with lit windows, palms, streetlights, a park, a beach, an ocean and a pier.
// The ground is one painted canvas texture; buildings, palms and lights are instanced
// meshes, so the whole city draws in a handful of calls.
import * as THREE from 'three';
import { CITY, PLACES } from './config.js';
import { createRandom } from './random.js';

const PALETTE = [0xe8b48a, 0xd99a6c, 0xc98a7a, 0xe0c090, 0xb98a9a, 0xf0d0a0, 0xa8b8c8, 0xd0b090, 0xcf9a6a, 0xe6c49a];
const PARK_BLOCK = { bx: 3, bz: 3 };
const PLAZA_BLOCK = { bx: 4, bz: 4 };

function groundTexture(rng) {
  const S = 1024;
  const half = CITY.half;
  const px = (v) => ((v + half) / (2 * half)) * S;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d');
  g.fillStyle = '#9a9a90';
  g.fillRect(0, 0, S, S);
  // City blocks: warm concrete, each a touch different.
  for (const bz of CITY.blocks) {
    for (const bx of CITY.blocks) {
      const shade = 178 + Math.floor(rng.range(-14, 14));
      g.fillStyle = `rgb(${shade},${shade - 12},${shade - 34})`;
      g.fillRect(px(bx - 20), px(bz - 20), px(40) - px(0), px(40) - px(0));
    }
  }
  // Park block: green with tree blobs. Plaza block: pale stone.
  const park = CITY.blocks[PARK_BLOCK.bx];
  const parkZ = CITY.blocks[PARK_BLOCK.bz];
  g.fillStyle = '#5d8a48';
  g.fillRect(px(park - 20), px(parkZ - 20), px(40) - px(0), px(40) - px(0));
  g.fillStyle = '#4a7439';
  for (let i = 0; i < 26; i += 1) {
    g.beginPath();
    g.arc(px(park - 18 + rng.range(0, 36)), px(parkZ - 18 + rng.range(0, 36)), rng.range(4, 9), 0, Math.PI * 2);
    g.fill();
  }
  const plaza = CITY.blocks[PLAZA_BLOCK.bx];
  const plazaZ = CITY.blocks[PLAZA_BLOCK.bz];
  g.fillStyle = '#cbbd9e';
  g.fillRect(px(plaza - 20), px(plazaZ - 20), px(40) - px(0), px(40) - px(0));
  // Roads: dark asphalt bands, then dashed centre lines.
  g.fillStyle = '#43434e';
  for (const r of CITY.roads) {
    g.fillRect(0, px(r - 6), S, px(12) - px(0));
    g.fillRect(px(r - 6), 0, px(12) - px(0), S);
  }
  g.strokeStyle = '#d8b25a';
  g.lineWidth = 1.6;
  g.setLineDash([10, 12]);
  for (const r of CITY.roads) {
    g.beginPath(); g.moveTo(0, px(r)); g.lineTo(S, px(r)); g.stroke();
    g.beginPath(); g.moveTo(px(r), 0); g.lineTo(px(r), S); g.stroke();
  }
  g.setLineDash([]);
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(235,235,225,0.85)';
  for (const rz of CITY.roads) {
    for (const rx of CITY.roads) {
      for (let i = -2; i <= 2; i += 1) {
        g.fillRect(px(rx - 5.4 + i * 2.2), px(rz - 7.6), 1.4, 3.4);
        g.fillRect(px(rx - 5.4 + i * 2.2), px(rz + 4.2), 1.4, 3.4);
        g.fillRect(px(rx - 7.6), px(rz - 5.4 + i * 2.2), 3.4, 1.4);
        g.fillRect(px(rx + 4.2), px(rz - 5.4 + i * 2.2), 3.4, 1.4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function facadeTextures(rng) {
  const W = 128;
  const H = 256;
  const map = document.createElement('canvas');
  map.width = W;
  map.height = H;
  const g = map.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  const glow = document.createElement('canvas');
  glow.width = W;
  glow.height = H;
  const e = glow.getContext('2d');
  e.fillStyle = '#000000';
  e.fillRect(0, 0, W, H);
  const cols = 6;
  const rows = 14;
  const cw = W / cols;
  const ch = H / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng.chance(0.42);
      const x = c * cw + 3;
      const y = r * ch + 3;
      const w = cw - 6;
      const h = ch - 6;
      g.fillStyle = lit ? '#ffd27a' : '#232833';
      g.fillRect(x, y, w, h);
      if (lit) {
        e.fillStyle = '#ffca66';
        e.fillRect(x, y, w, h);
      }
    }
  }
  const mapTex = new THREE.CanvasTexture(map);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  const glowTex = new THREE.CanvasTexture(glow);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return { mapTex, glowTex };
}

export function buildCity(scene, seed) {
  const rng = createRandom(seed);
  const park = CITY.blocks[PARK_BLOCK.bx];
  const parkZ = CITY.blocks[PARK_BLOCK.bz];
  const group = new THREE.Group();
  const colliders = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Ground: one painted plane for the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, CITY.half * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(rng), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Sand strip and ocean to the south.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, 42),
    new THREE.MeshStandardMaterial({ color: 0xe6cf9e, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.sandZ + 21);
  sand.receiveShadow = true;
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 340),
    new THREE.MeshStandardMaterial({ color: 0x2a7ab0, roughness: 0.25, metalness: 0.1, emissive: 0x11395a, emissiveIntensity: 0.5 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.05, CITY.oceanZ + 170);
  group.add(ocean);

  // Buildings: one instanced box per block, facade texture stretched over it.
  const spots = [];
  for (let bz = 0; bz < 8; bz += 1) {
    for (let bx = 0; bx < 8; bx += 1) {
      if (bx === PARK_BLOCK.bx && bz === PARK_BLOCK.bz) continue;
      if (bx === PLAZA_BLOCK.bx && bz === PLAZA_BLOCK.bz) continue;
      spots.push({ x: CITY.blocks[bx], z: CITY.blocks[bz] });
    }
  }
  const { mapTex, glowTex } = facadeTextures(rng);
  const facadeMat = new THREE.MeshStandardMaterial({
    map: mapTex, emissiveMap: glowTex, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.85,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 1 });
  const buildings = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    [facadeMat, facadeMat, roofMat, roofMat, facadeMat, facadeMat],
    spots.length,
  );
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  spots.forEach((spot, i) => {
    const w = rng.range(24, 32);
    const d = rng.range(24, 32);
    const stories = rng.int(3, 12);
    const h = stories * 3;
    const x = spot.x + rng.range(-2, 2);
    const z = spot.z + rng.range(-2, 2);
    dummy.position.set(x, h / 2, z);
    dummy.scale.set(w, h, d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    buildings.setMatrixAt(i, dummy.matrix);
    buildings.setColorAt(i, color.setHex(rng.pick(PALETTE)));
    colliders.push({ x, z, hx: w / 2, hz: d / 2 });
  });
  buildings.instanceMatrix.needsUpdate = true;
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  group.add(buildings);

  // Palms along the sidewalks.
  const palmSpots = [];
  for (let i = 0; i < 130; i += 1) {
    const road = rng.pick(CITY.roads);
    const along = rng.range(-208, 208);
    const side = rng.pick([-8.5, 8.5]);
    if (rng.chance(0.5)) palmSpots.push({ x: road + side, z: along });
    else palmSpots.push({ x: along, z: road + side });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 5, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  trunks.castShadow = true;
  const canopyGeo = new THREE.ConeGeometry(2.4, 2.6, 7);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x3f7a34, roughness: 1 });
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, palmSpots.length);
  canopies.castShadow = true;
  palmSpots.forEach((p, i) => {
    dummy.position.set(p.x, 2.5, p.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, 5.6, p.z);
    dummy.scale.set(1, 0.75, 1);
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  group.add(trunks, canopies);

  // Streetlights at the intersections.
  const lightSpots = [];
  for (const rz of CITY.roads) {
    for (const rx of CITY.roads) lightSpots.push({ x: rx + 7.5, z: rz + 7.5 });
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 6.5, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.6, metalness: 0.5 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightSpots.length);
  const headGeo = new THREE.SphereGeometry(0.3, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc860, emissiveIntensity: 1.4 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lightSpots.length);
  lightSpots.forEach((p, i) => {
    dummy.position.set(p.x, 3.25, p.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, 6.6, p.z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  group.add(poles, heads);

  // Pier: wooden deck out into the ocean, with posts and an end platform.
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 78), wood);
  deck.position.set(0, 0.8, 262);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 18), wood);
  platform.position.set(0, 0.8, 296);
  platform.castShadow = true;
  platform.receiveShadow = true;
  group.add(platform);
  const postGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6);
  const posts = new THREE.InstancedMesh(postGeo, wood, 22);
  let pi = 0;
  for (let z = 228; z <= 304; z += 8) {
    for (const x of [-4.6, 4.6]) {
      if (pi >= 22) break;
      dummy.position.set(x, 0.4, z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      posts.setMatrixAt(pi, dummy.matrix);
      pi += 1;
    }
  }
  posts.count = pi;
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);
  colliders.push({ x: 0, z: 296, hx: 9, hz: 9 });

  // Marina containers on the east edge.
  const containerColors = [0xb04030, 0x2a6a9a, 0x4a8a4a, 0xc09030, 0x7a4a8a];
  const containerGeo = new THREE.BoxGeometry(6, 2.6, 2.6);
  const containers = new THREE.InstancedMesh(containerGeo, new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.2 }), 8);
  containers.castShadow = true;
  const cSpots = [
    { x: 200, z: 38, ry: 0.2 }, { x: 206, z: 44, ry: 0.2 }, { x: 200, z: 50, ry: -0.1 },
    { x: 208, z: 66, ry: 1.4 }, { x: 214, z: 72, ry: 1.4 }, { x: 196, z: 70, ry: 0.5 },
    { x: 202, z: 30, ry: 0.9 }, { x: 216, z: 56, ry: 0.1 },
  ];
  cSpots.forEach((c, i) => {
    dummy.position.set(c.x, 1.3, c.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, c.ry, 0);
    dummy.updateMatrix();
    containers.setMatrixAt(i, dummy.matrix);
    containers.setColorAt(i, color.setHex(containerColors[i % containerColors.length]));
    colliders.push({ x: c.x, z: c.z, hx: 3.2, hz: 3.2 });
  });
  containers.instanceMatrix.needsUpdate = true;
  if (containers.instanceColor) containers.instanceColor.needsUpdate = true;
  group.add(containers);

  scene.add(group);
  return { group, colliders, roads: CITY.roads, locations: PLACES, park: { x: park, z: parkZ } };
}

// Push a circle (x, z, radius) out of every building collider it overlaps.
// Returns true when anything was hit, and writes the corrected position back.
export function resolveCollisions(city, pos, radius) {
  let hit = false;
  for (const c of city.colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const ox = c.hx + radius - Math.abs(dx);
    const oz = c.hz + radius - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      hit = true;
      if (ox < oz) pos.x = c.x + Math.sign(dx || 1) * (c.hx + radius);
      else pos.z = c.z + Math.sign(dz || 1) * (c.hz + radius);
    }
  }
  return hit;
}

export function nearestRoad(value) {
  let best = CITY.roads[0];
  for (const r of CITY.roads) if (Math.abs(r - value) < Math.abs(best - value)) best = r;
  return best;
}

export function clampToCity(value) {
  return Math.max(-CITY.half + 4, Math.min(CITY.half - 4, value));
}

// The player may walk further than a car: onto the sand to the water's edge, and
// up the pier corridor to its end platform. Cars stay inside clampToCity.
export function clampPosition(pos) {
  pos.x = Math.max(-CITY.half + 4, Math.min(CITY.half - 4, pos.x));
  const maxZ = Math.abs(pos.x) < 6 ? 300 : 260;
  pos.z = Math.max(-CITY.half + 4, Math.min(maxZ, pos.z));
  return pos;
}
