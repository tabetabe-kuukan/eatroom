// 進行状況（localStorage）。途中から再開できる。
import { SPACES } from './spaces.js';

const KEY = 'tabetabe-kukan:v1';

function fresh() {
  return {
    current: 0,
    finished: false,
    spaces: Object.fromEntries(SPACES.map((s) => [s.id, { words: [], zoneMax: 1, attempts: 0, wrong: [], path: [], cleared: false }])),
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const f = fresh();
      for (const id of Object.keys(f.spaces)) s.spaces[id] = { ...f.spaces[id], ...(s.spaces?.[id] || {}) };
      return { ...f, ...s };
    }
  } catch { /* 保存できない環境でも遊べるようにする */ }
  return fresh();
}

let saveTimer = 0;
export function save(now = false) {
  clearTimeout(saveTimer);
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* noop */ } };
  if (now) write(); else saveTimer = setTimeout(write, 400);
}

export const getState = () => state;
export const spaceState = (id) => state.spaces[id];
export const hasProgress = () => state.current > 0 || Object.values(state.spaces).some((s) => s.words.length || s.attempts);

export function reset() {
  state = fresh();
  save(true);
}

export function addWord(id, word) {
  const s = state.spaces[id];
  if (s.words.includes(word)) return false;
  s.words.push(word);
  save();
  return true;
}

export function setZone(id, z) {
  const s = state.spaces[id];
  if (z > s.zoneMax) { s.zoneMax = z; save(); return true; }
  return false;
}

export function recordAttempt(id, input, ok) {
  const s = state.spaces[id];
  s.attempts += 1;
  if (!ok && input.trim()) s.wrong.push(input.trim().slice(0, 24));
  if (ok) s.cleared = true;
  save(true);
}

// 歩いた経路（最終空間の足跡に使う）。0.6m ごとに記録、最大 500 点
export function recordPath(id, x, z) {
  const p = state.spaces[id].path;
  const last = p[p.length - 1];
  if (last && (last[0] - x) ** 2 + (last[1] - z) ** 2 < 0.36) return;
  p.push([Math.round(x * 100) / 100, Math.round(z * 100) / 100]);
  if (p.length > 500) p.splice(0, p.length - 500);
  save();
}

export function advance() {
  state.current = Math.min(state.current + 1, SPACES.length);
  if (state.current >= SPACES.length) state.finished = true;
  save(true);
}
