// Thin localStorage layer. This is the stopgap persistence until a real
// backend is chosen (see roadmap.md, Backend persistence) — the keys are
// versioned so a future schema change can invalidate stale state cleanly.

import { COLUMN_TITLES } from './board.js';

export const BOARD_STORAGE_KEY = 'vectis:board:v1';
export const IDENTITY_STORAGE_KEY = 'vectis:identity:v1';
export const CHAT_STORAGE_KEY = 'vectis:chat:v1';

const BOARD_COLUMN_KEYS = Object.keys(COLUMN_TITLES);

function storageAvailable() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function loadJSON(key) {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveJSON(key, value) {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — the app keeps working in-memory.
  }
}

export function isValidBoard(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return false;
  }
  return BOARD_COLUMN_KEYS.every((column) => {
    const cards = candidate[column];
    return (
      Array.isArray(cards) &&
      cards.every(
        (card) =>
          card &&
          typeof card === 'object' &&
          typeof card.id === 'string' &&
          typeof card.title === 'string',
      )
    );
  });
}

export function loadBoard() {
  const stored = loadJSON(BOARD_STORAGE_KEY);
  return isValidBoard(stored) ? stored : null;
}

export function saveBoard(items) {
  saveJSON(BOARD_STORAGE_KEY, items);
}
