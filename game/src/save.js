// Save and continue: cash, mission progress and best story result in localStorage.
import { SAVE_KEY, START_CASH } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.floor(state.cash),
      missionIndex: state.missions.done ? 99 : state.missions.index,
      storyComplete: state.missions.done,
      savedAt: Date.now(),
    }));
  } catch {
    // Storage can be off: the game still plays, it just does not remember.
  }
}
