// 進行状況（localStorage）。1 回のプレイの組み立て（選ばれた 5 語・部屋・置く物）も保存して、
// 途中から同じ空間で再開できるようにする。
import pool from '../data/pool.json';
import { FINAL, makePlan } from './plan.js';

const KEY = 'tabetabe-kukan:v2';

function fresh(plan = makePlan()) {
  return {
    plan,
    current: 0,
    finished: false,
    spaces: Object.fromEntries(plan.map((s) => [s.id, { words: [], zoneMax: 1, attempts: 0, wrong: [], path: [], cleared: false }])),
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // 空間 6 は保存したものではなく、いまの定義を使う（作り直しても古い保存で遊べるように）
      // 単語プールから外した語が入った保存は捨てて、選び直す
      const inPool = (sp) => pool.words.some((w) => w.answerName === sp.answerName);
      if (Array.isArray(s.plan) && s.plan.length === 6 && s.plan.slice(0, 5).every(inPool)) { s.plan[5] = FINAL; return s; }
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
export const plan = () => state.plan;
export const spaceState = (id) => state.spaces[id];
export const hasProgress = () => state.current > 0 || Object.values(state.spaces).some((s) => s.words.length || s.attempts);

// はじめから：新しく 5 語を選び直す
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

// 自分で書き足したメモ（空間ごと）
export function notes(id) {
  const s = state.spaces[id];
  if (!s.notes) s.notes = [];
  return s.notes;
}
export function addNote(id, text) {
  const t = text.trim().slice(0, 80);
  if (!t) return false;
  notes(id).push(t);
  save(true);
  return true;
}
export function removeNote(id, index) {
  notes(id).splice(index, 1);
  save(true);
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

export function advance(fromIndex = state.current) {
  state.current = Math.min(fromIndex + 1, state.plan.length);
  if (state.current >= state.plan.length) state.finished = true;
  save(true);
}
