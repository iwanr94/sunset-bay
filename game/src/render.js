// The Three.js scene: a warm sunset sky, low sun with shadows, haze, and the
// third-person follow camera (mouse drag orbits it around the player or the car).
import * as THREE from 'three';

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#241a4e');
  grad.addColorStop(0.42, '#7a3a6a');
  grad.addColorStop(0.68, '#e86a4a');
  grad.addColorStop(0.82, '#ffb347');
  grad.addColorStop(1, '#ffd9a0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xe88a55, 180, 680);

  const sun = new THREE.DirectionalLight(0xffb070, 2.6);
  sun.position.set(-190, 110, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8a6aa0, 0x3a2a20, 1.1));

  // The sun itself, low over the western sea.
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(20, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }),
  );
  sunDisc.position.set(-620, 55, 40);
  scene.add(sunDisc);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(0, 8, -12);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, sun };
}

// Follow the player (on foot or in a car). orbitYaw is the mouse-drag offset around
// the heading; it eases back to zero when the player drives straight for a while.
export function updateCamera(state, dt) {
  const { camera } = state.view;
  const target = state.player.car ? state.player.car : state.player;
  const heading = target.heading;
  const driving = Boolean(state.player.car);
  const dist = driving ? 13.5 : 9.5;
  const height = driving ? 6.2 : 6.5;
  const yaw = heading + state.orbitYaw;
  const tx = target.x;
  const tz = target.z;
  const cx = tx - Math.cos(yaw) * dist;
  const cz = tz - Math.sin(yaw) * dist;
  const k = 1 - Math.exp(-7 * dt);
  camera.position.x += (cx - camera.position.x) * k;
  camera.position.y += (height - camera.position.y) * k;
  camera.position.z += (cz - camera.position.z) * k;
  camera.lookAt(tx + Math.cos(heading) * 4, 1.8, tz + Math.sin(heading) * 4);
  const fx = tx - camera.position.x;
  const fz = tz - camera.position.z;
  state.cameraYaw = Math.atan2(fz, fx);
}
