// Keyboard and mouse: WASD + Shift + E + F + Esc + M, mouse drag to look around.
// Edge-triggered actions are consumed once, so a key press never fires twice.
export const ACTION_PUNCH = 1;
export const ACTION_ENTER = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;
export const ACTION_CONFIRM = 16;

const BLOCKED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let dragDX = 0;
  let dragDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (BLOCKED.has(event.code)) event.preventDefault();
    if (!event.repeat) {
      keys.add(event.code);
      pressed.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    pressed.add('MouseLeft');
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    dragDX += event.clientX - lastX;
    dragDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  function isDown(code) { return keys.has(code); }

  // Movement axes: forward/back and strafe, in camera space (-1..1 each).
  function moveAxes(cameraYaw) {
    let f = 0;
    let s = 0;
    if (isDown('KeyW') || isDown('ArrowUp')) f += 1;
    if (isDown('KeyS') || isDown('ArrowDown')) f -= 1;
    if (isDown('KeyD') || isDown('ArrowRight')) s += 1;
    if (isDown('KeyA') || isDown('ArrowLeft')) s -= 1;
    const len = Math.hypot(f, s) || 1;
    return { x: (Math.cos(cameraYaw) * f - Math.sin(cameraYaw) * s) / len, z: (Math.sin(cameraYaw) * f + Math.cos(cameraYaw) * s) / len, mag: Math.min(1, Math.hypot(f, s)) };
  }

  function takeActions() {
    let actions = 0;
    if (pressed.has('KeyF') || pressed.has('MouseLeft')) actions |= ACTION_PUNCH;
    if (pressed.has('KeyE')) actions |= ACTION_ENTER;
    if (pressed.has('Escape') || pressed.has('KeyP')) actions |= ACTION_PAUSE;
    if (pressed.has('KeyM')) actions |= ACTION_MUTE;
    if (pressed.has('Enter') || pressed.has('Space')) actions |= ACTION_CONFIRM;
    pressed.clear();
    return actions;
  }

  function takeDrag() {
    const out = { dx: dragDX, dy: dragDY };
    dragDX = 0;
    dragDY = 0;
    return out;
  }

  return { isDown, moveAxes, takeActions, takeDrag };
}
