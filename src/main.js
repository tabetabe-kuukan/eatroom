import './style.css';
import * as THREE from 'three';
import wiki from './data/wiki.json';
import * as audio from './engine/audio.js';
import { createPlayer } from './engine/player.js';
import { createRenderer } from './engine/renderer.js';
import { loadSpace, updateFlicker } from './engine/world.js';
import { isCorrect } from './game/answer.js';
import { decorateFinal } from './game/finale.js';
import { allWords, SPACES } from './game/spaces.js';
import * as st from './game/state.js';

const $ = (id) => document.getElementById(id);
const R = createRenderer($('view'));
const player = createPlayer(R.camera, $('view'), { stick: $('stick'), knob: $('knob') });

let def = null;
let world = null;
let extras = null;
let mode = 'title'; // title | loading | ready | play | memo | pause | result | void | allclear
let zone = 1;
let elapsed = 0;
let roomRing = null;
const clock = new THREE.Clock();

// ---------------------------------------------------------------- 画面切り替え
const SCREENS = ['title', 'loading', 'pause', 'result', 'allclear'];
function showScreen(id) {
  for (const s of SCREENS) $(s).classList.toggle('show', s === id);
  $('hud').classList.toggle('show', id === null);
}

function setMode(m) {
  mode = m;
  player.setEnabled(m === 'play');
  $('memo').classList.toggle('show', m === 'memo');
  if (m === 'play' || m === 'memo') showScreen(null);
  if (m === 'pause') showScreen('pause');
}

// ---------------------------------------------------------------- タイトル
if (st.hasProgress() && !st.getState().finished) $('btn-continue').hidden = false;
$('btn-start').onclick = () => {
  audio.initAudio();
  st.reset();
  enterSpace(0);
};
$('btn-continue').onclick = () => {
  audio.initAudio();
  enterSpace(Math.min(st.getState().current, SPACES.length - 1));
};

// ---------------------------------------------------------------- 空間の読み込み
async function enterSpace(index) {
  setMode('loading');
  showScreen('loading');
  def = SPACES[index];
  const n = allWords(def).length;
  $('load-space').textContent = `空間 ${index + 1} / ${SPACES.length}`;
  $('load-msg').textContent = '検索ワードから空間を生成しています';
  $('load-words').innerHTML = allWords(def).map((w) => `<span style="width:${Math.max(2, [...w].length) * 12}px"></span>`).join('');
  $('btn-enter').hidden = true;
  $('load-bar').style.width = '0%';
  $('load-pct').textContent = '0%';

  if (world) {
    R.scene.remove(world.group);
    world.dispose();
    world = null;
  }
  if (extras) { extras.dispose?.(); extras = null; }
  audio.stopAmbience(0.8);
  stopRoomRing();

  try {
    world = await loadSpace(def, R.renderer, (p) => {
      $('load-bar').style.width = `${(p * 100).toFixed(0)}%`;
      $('load-pct').textContent = `${(p * 100).toFixed(0)}%`;
    });
  } catch (e) {
    console.error(e);
    $('load-msg').textContent = `読み込みに失敗しました（${e.message}）。再読み込みしてください。`;
    return;
  }
  const look = def.look;
  R.scene.add(world.group);
  R.scene.environment = world.env;
  R.scene.environmentIntensity = look.envIntensity ?? 0.3;
  R.scene.fog = new THREE.FogExp2(look.fog.color, look.fog.density);
  if (look.background === 'hdri' && world.hdrTex) {
    R.scene.background = world.hdrTex;
    R.scene.backgroundBlurriness = look.backgroundBlur ?? 0.2;
    R.scene.backgroundIntensity = look.backgroundIntensity ?? 1;
  } else {
    R.scene.background = new THREE.Color(look.fog.color);
  }
  R.applyLook(look);
  if (def.final) extras = decorateFinal(world, R.scene, st.getState(), SPACES);
  player.setColliders(world.colliders);
  player.setFloors(world.meta.floors);
  const sp = world.meta.spawn;
  player.spawn(sp.pos, sp.yaw);
  zone = computeZone();
  st.setZone(def.id, zone);
  renderMemo();
  updateHud();
  // 1フレーム描いてシェーダーをコンパイルしておく
  R.renderer.compile(R.scene, R.camera);
  R.render(0);
  $('load-msg').textContent = `空間 ${index + 1} の生成が完了しました`;
  $('btn-enter').hidden = false;
  setMode('ready');
}

$('btn-enter').onclick = () => {
  audio.initAudio();
  audio.startAmbience(def.audio.ambience, { reverb: def.audio.reverb, sounds: world.meta.sounds });
  audio.setAmbienceZone(zone);
  if (def.audio.ringOnZone && zone >= 3) startRoomRing();
  setMode('play');
  player.lock();
  showIntro();
};

function showIntro() {
  const idx = SPACES.indexOf(def);
  $('intro-space').textContent = `空間 ${idx + 1} / ${SPACES.length}`;
  $('intro-n').textContent = allWords(def).length;
  $('intro').classList.add('show');
  setTimeout(() => $('intro').classList.remove('show'), 4500);
}

// ---------------------------------------------------------------- 区画と痕跡
function computeZone() {
  const z = player.pos.z;
  let n = 0;
  for (const th of world.meta.zones) if (z <= th) n++;
  return Math.max(1, Math.min(3, n));
}

function updateHud() {
  const idx = SPACES.indexOf(def);
  $('hud-space').textContent = `空間 ${idx + 1}`;
  $('hud-zone').textContent = def.zones[zone - 1].name;
  const got = st.spaceState(def.id).words.length;
  $('memo-count').textContent = `${got}/${allWords(def).length}`;
}

let toastTimer = 0;
function toast(html) {
  $('toast').innerHTML = html;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
}

function checkTraces() {
  const p = player.pos;
  const found = [];
  for (const zdef of def.zones) {
    for (const tr of zdef.traces) {
      const m = world.meta.traces[tr.id];
      if (!m) continue;
      const dx = p.x - m.pos[0];
      const dz = p.z - m.pos[2];
      if (dx * dx + dz * dz < m.radius * m.radius) {
        let fresh = false;
        for (const w of tr.words) if (st.addWord(def.id, w)) { found.push(w); fresh = true; }
        // 空間5の最後：振り返った先（背後）で電話が鳴る
        if (fresh && tr.effect === 'ringBehind') {
          const y = player.yaw;
          setTimeout(() => audio.ringPhone({ pos: [p.x + Math.sin(y) * 1.4, 1.5, p.z + Math.cos(y) * 1.4], times: 1, gain: 0.4 }), 1200);
        }
      }
    }
  }
  if (found.length) {
    audio.uiTick();
    toast(`<small>痕跡を検索メモに記録した</small>${found.map((w) => `「${esc(w)}」`).join(' ')}`);
    renderMemo();
    updateHud();
  }
}

function onZoneChange(z, prev) {
  zone = z;
  st.setZone(def.id, z);
  audio.setAmbienceZone(z);
  updateHud();
  if (z > prev) toast(`<small>${def.zones[z - 1].name}</small>痕跡が、少しはっきりしてきた`);
  // 空間5：区画を越えるたびに電話が鳴る
  if (def.audio.ringOnZone && z > prev) {
    const s = world.meta.sounds[`ring${z}`] || null;
    audio.ringPhone({ pos: s, times: 2, gain: 0.2 });
    if (z >= 3) setTimeout(startRoomRing, 6500);
  }
}

// 空間5の第3区画：部屋の中で鳴り続ける電話
function startRoomRing() {
  if (roomRing) return;
  const pos = world.meta.sounds.room;
  const ring = () => { if (mode === 'play' || mode === 'memo') audio.ringPhone({ pos, times: 1, gain: 0.25 }); };
  ring();
  roomRing = setInterval(ring, 3000);
}
function stopRoomRing() { clearInterval(roomRing); roomRing = null; }

// ---------------------------------------------------------------- 検索メモ
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderMemo() {
  const got = new Set(st.spaceState(def.id).words);
  $('memo-list').innerHTML = def.zones.map((z) => {
    const items = z.traces.flatMap((t) => t.words).map((w) => {
      if (got.has(w)) {
        const url = `https://www.google.com/search?q=${encodeURIComponent(w)}`;
        return `<div class="word"><b dir="auto">${esc(w)}</b><a href="${url}" target="_blank" rel="noopener noreferrer">この単語で検索する ↗</a></div>`;
      }
      return `<div class="word locked"><b style="width:${Math.max(2, [...w].length) * 15}px"></b><span>未発見</span></div>`;
    }).join('');
    return `<div class="zone-block"><h3>${z.name}</h3>${items}</div>`;
  }).join('');
}

function openMemo() {
  if (mode !== 'play' && mode !== 'pause') return;
  setMode('memo');
  $('answer-msg').textContent = '';
  if (!player.isTouch) setTimeout(() => $('answer').focus(), 350);
}
function closeMemo() {
  if (mode !== 'memo') return;
  $('answer').blur();
  setMode('play');
  player.lock();
}
$('btn-memo').onclick = openMemo;
$('btn-memo-close').onclick = closeMemo;
$('btn-pause-memo').onclick = openMemo;
$('btn-resume').onclick = () => { setMode('play'); player.lock(); };
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    if (mode === 'play' || mode === 'pause') openMemo(); else if (mode === 'memo') closeMemo();
  } else if (e.code === 'Escape' && mode === 'memo') closeMemo();
});
player.onLockLost(() => {
  if (mode === 'play' && !player.isTouch) setMode('pause');
});
player.onStep((running) => audio.footstep(def?.audio.steps, running));

$('answer-form').onsubmit = (e) => {
  e.preventDefault();
  const v = $('answer').value;
  if (!v.trim()) return;
  const ok = isCorrect(def, v);
  st.recordAttempt(def.id, v, ok);
  if (ok) {
    $('answer').value = '';
    cleared();
  } else {
    audio.wrongBuzz();
    $('answer-msg').textContent = 'まだ違う。奥へ進むと痕跡ははっきりしてくる';
    $('answer').select();
  }
};

// ---------------------------------------------------------------- リザルト
function fillResult() {
  const w = wiki[def.wiki];
  const s = st.spaceState(def.id);
  $('res-name').textContent = def.answerName;
  $('res-quote').textContent = w ? w.extract : '';
  $('res-title').textContent = w ? w.title : def.wiki;
  $('res-link').href = w ? w.url : `https://ja.wikipedia.org/wiki/${encodeURIComponent(def.wiki)}`;
  $('res-date').textContent = w ? w.retrieved : '';
  $('res-zone').textContent = `${s.zoneMax} / 3`;
  $('res-tries').textContent = `${s.attempts}回`;
}

function cleared() {
  stopRoomRing();
  $('memo').classList.remove('show');
  player.setEnabled(false);
  fillResult();
  if (def.final) return finale();
  audio.stopAmbience(1.5);
  mode = 'result';
  $('btn-next').textContent = '次の空間へ';
  showScreen('result');
}

$('btn-next').onclick = () => {
  if (mode === 'final-result') return showAllClear();
  st.advance(SPACES.indexOf(def));
  enterSpace(st.getState().current);
};

// 最終空間：UI もカーソルも消して、画面全体を純粋な黒にする。
// 黒い画面に映り込んだプレイヤー自身の顔が「答え」。カメラは使わない。
async function finale() {
  mode = 'void';
  audio.stopAmbience(0.3);
  audio.setMasterMute(true);
  showScreen('none');
  $('hud').classList.remove('show');
  document.body.classList.add('void');
  try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* 使えなければそのまま全画面を黒く */ }
  setTimeout(() => {
    document.body.classList.remove('void');
    audio.setMasterMute(false);
    mode = 'final-result';
    $('btn-next').textContent = 'オールクリアへ';
    showScreen('result');
  }, 5000);
}

function showAllClear() {
  st.advance(SPACES.indexOf(def));
  mode = 'allclear';
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  $('summary').innerHTML = SPACES.map((s, i) => {
    const ss = st.spaceState(s.id);
    return `<tr><td>空間 ${i + 1}</td><td>${esc(s.answerName)}</td><td>区画 ${ss.zoneMax}/3</td><td>回答 ${ss.attempts}回</td></tr>`;
  }).join('');
  showScreen('allclear');
}
$('btn-restart').onclick = () => { st.reset(); enterSpace(0); };

// ---------------------------------------------------------------- ループ
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  if (!world || mode === 'void' || mode === 'result' || mode === 'final-result' || mode === 'allclear' || mode === 'title' || mode === 'loading') return;
  player.update(dt);
  if (mode === 'play') {
    const z = computeZone();
    if (z !== zone) onZoneChange(z, zone);
    checkTraces();
    st.recordPath(def.id, player.pos.x, player.pos.z);
  }
  updateFlicker(world, def.look.flicker, elapsed);
  extras?.update?.(elapsed, R.camera);
  audio.setListener(R.camera);
  R.render(elapsed);
  R.adapt(dt);
}
frame();

// 開発用：?space=3 で空間を直接開く
const q = new URLSearchParams(location.search).get('space');
if (import.meta.env.DEV) {
  window.__dbg = {
    R, player, get world() { return world; },
    tp(x, z, yawDeg = 0) { player.spawn([x, 0, z], (yawDeg * Math.PI) / 180); },
    async ready() {
      while (mode !== 'ready') await new Promise((r) => setTimeout(r, 200));
      $('btn-enter').click();
      $('intro').classList.remove('show');
    },
    // 位置と向きを決めて数フレーム描く（バックグラウンドでも撮影できるように）
    async shot(x, z, yawDeg = 0, pitch = 0) {
      this.tp(x, z, yawDeg);
      R.camera.rotation.x = pitch;
      for (let i = 0; i < 3; i++) { R.render(performance.now() / 1000); await new Promise((r) => setTimeout(r, 60)); }
      return 'ok';
    },
    fps() { return new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }); },
  };
}
if (q && import.meta.env.DEV) {
  const i = Math.max(0, Math.min(SPACES.length - 1, Number(q) - 1));
  enterSpace(i);
}
