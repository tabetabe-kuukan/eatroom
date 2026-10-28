import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OBJECTS } from '../objects/library.mjs';
import * as audio from './engine/audio.js';
import { buildTrace, lightmapReader, loadDocFont } from './engine/embed.js';
import { createPlayer } from './engine/player.js';
import { createRenderer } from './engine/renderer.js';
import { loadRooms } from './engine/rooms.js';
import { placeInRoom } from './engine/placer.js';
import { specialFor } from '../objects/specials.mjs';
import { updateFlicker } from './engine/world.js';
import { isCorrect } from './game/answer.js';
import { decorateFinal } from './game/finale.js';
import { buildLab, isExitNote } from './game/lab.js';
import { playerShadow } from './game/shadow.js';
import { ARCHIVE_URL, kindsFor, LAB_RESULT, LOOK_DAY, LOOK_NIGHT, memoWords } from './game/plan.js';
import * as st from './game/state.js';

const $ = (id) => document.getElementById(id);
const R = createRenderer($('view'));
const player = createPlayer(R.camera, $('view'), { stick: $('stick'), knob: $('knob') });
const TIER_NAMES = { 1: '段階1', 2: '段階2', 3: '段階3', 4: '段階4', 5: '段階5' };

let def = null;
let look = null;
let world = null;
let extras = null;
let traces = [];      // { zone, words, pos?, radius? }（pos がないものは区画に入ると記録）
let mode = 'title';   // title | loading | ready | play | memo | pause | result | void | final-result | allclear
let zone = 1;
let elapsed = 0;
let roomEnv = null;
let updaters = [];   // ネオン・電光掲示板など動くもの
let shadowUpdate = null; // 最終空間：プレイヤーの影
let labCtl = null;       // 空間 4「研究室」：隠し扉
let shakeUntil = 0;      // 扉が現れるときの短い揺れ
const clock = new THREE.Clock();
const objById = new Map(OBJECTS.map((o) => [o.id, o]));
const spaces = () => st.plan();

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
  enterSpace(Math.min(st.getState().current, spaces().length - 1));
};

// ---------------------------------------------------------------- 空間の読み込み
function disposeWorld() {
  if (world) {
    R.scene.remove(world.group);
    world.dispose();
    world = null;
  }
  if (extras) { extras.dispose?.(); extras = null; }
}

async function enterSpace(index) {
  setMode('loading');
  showScreen('loading');
  def = spaces()[index];
  const words = memoWords(def);
  $('load-space').textContent = `空間 ${index + 1} / ${spaces().length}`;
  $('load-msg').textContent = '食べられた単語の痕跡を集めています';
  $('load-words').innerHTML = words.map((w) => `<span style="width:${Math.max(2, [...w].length) * 12}px"></span>`).join('');
  $('btn-enter').hidden = true;
  $('load-bar').style.width = '0%';
  $('load-pct').textContent = '0%';
  disposeWorld();
  audio.stopAmbience(0.8);
  const progress = (p) => {
    $('load-bar').style.width = `${(p * 100).toFixed(0)}%`;
    $('load-pct').textContent = `${(p * 100).toFixed(0)}%`;
  };

  try {
    await buildRooms(progress);
  } catch (e) {
    console.error(e);
    $('load-msg').textContent = `読み込みに失敗しました（${e.message}）。再読み込みしてください。`;
    return;
  }
  player.setColliders(world.colliders);
  player.setFloors(world.meta.floors || []);
  const sp = world.meta.spawn;
  player.spawn(sp.pos, sp.yaw);
  zone = computeZone();
  st.setZone(def.id, zone);
  recordRoomTraces();
  renderMemo();
  updateHud();
  R.renderer.compile(R.scene, R.camera);
  R.render(0);
  $('load-msg').textContent = `空間 ${index + 1} の準備ができました`;
  $('btn-enter').hidden = false;
  setMode('ready');
}

// 空間 1〜3：白い展示室を 3 つ並べ、検索ワードを物・張り紙・部屋として置く
// 空間 4（研究室）は決まった物を決まった場所に、空間 5（あなた）はプレイヤー自身の記録を置く
async function buildRooms(progress) {
  look = def.night ? LOOK_NIGHT : LOOK_DAY;
  world = await loadRooms(def.rooms, look, R.renderer, { night: def.night, onProgress: (p) => progress(p * 0.8) });
  R.scene.add(world.group);
  if (!roomEnv) {
    const pmrem = new THREE.PMREMGenerator(R.renderer);
    roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  R.scene.environment = roomEnv;
  R.scene.environmentIntensity = look.envIntensity;
  R.scene.fog = new THREE.FogExp2(look.fog.color, look.fog.density);
  R.scene.background = new THREE.Color(look.fog.color);
  R.applyLook(look);

  await loadDocFont();
  const readers = world.modules.map((m) => lightmapReader(m));
  traces = [];
  updaters = [];
  let done = 0;
  const placed = [];
  labCtl = null;
  for (const [zi, z] of (def.lab ? [] : def.zones).entries()) {
    // 特別な見せ方（黄色い壁・壁紙・木のうろなど）は、いまの定義から決め直す（保存したプレイにも効くように）
    for (const it of z.items) {
      it.tokens = it.tokens.map((t) => {
        if (t.object || t.special) return t;
        const sp = specialFor(t.word, def.answers || []);
        if (!sp) return t;
        return sp.type === 'text' ? { ...t, color: sp.color, style: sp.style } : { word: t.word, special: sp.type };
      });
    }
    const shown = z.items.filter((it) => !it.byRoom && !it.fixed);
    for (const it of z.items) if (it.byRoom) traces.push({ zone: zi + 1, words: [it.text], room: z.room });
    // 置き場所は毎回ランダム（壁の高い所・低い所・床・天井・台）
    const table = world.meta.slots.find((sl) => sl.zone === zi + 1 && sl.key === 'table') || null;
    // 痕跡ごとに置ける面が決まっている（黄色い壁は壁、日光や水は床など）
    // 置ける面はいまのライブラリから決める（保存したプレイでも、物の置き場所の変更が効くように）
    const slots = placeInRoom(zi, world.modules[zi], shown.map((it) => kindsFor(it.tokens)), { table, avoid: placed, spawnZ: world.meta.spawn.pos[2] });
    // 見つからなかった分は、部屋の決まった場所に置く
    const fixed = world.meta.slots.filter((sl) => sl.zone === zi + 1);
    // 置ける面に合う予備の場所を選ぶ（壁しか置けない物を台に置かない）
    const wants = shown.map((it) => kindsFor(it.tokens));
    for (const [k, sl] of slots.entries()) {
      if (sl) continue;
      const ok = fixed.filter((f) => !wants[k] || wants[k].includes(f.kind === 'wall' ? 'wall' : f.kind));
      slots[k] = ok[k % (ok.length || 1)] || fixed[k % fixed.length] || null;
    }
    for (const [k, it] of shown.entries()) {
      const slot = slots[k];
      if (!slot) continue;
      placed.push(slot.pos);
      const entry = { tokens: it.tokens.map((t) => ({ ...t, object: t.object ? objById.get(t.object) : null })) };
      const g = await buildTrace(world.modules[zi], slot, entry, readers[zi], { night: def.night });
      world.group.add(g);
      if (g.userData.update) updaters.push(g.userData.update);
      traces.push({ zone: zi + 1, words: [it.text], pos: slot.pos, radius: slot.radius });
      progress(0.8 + 0.2 * (++done / 9));
    }
  }
  // 空間 4：研究室。検索メモに「出口」があれば、はじめから扉が開いている
  if (def.lab) {
    labCtl = await buildLab(world, readers, traces);
    extras = labCtl;
    if (st.notes(def.id).some(isExitNote)) labCtl.setDoor(true);
    progress(1);
  }
  // 空間 5：空間 1〜4 の足跡・不正解の答え・何も映らない鏡（白い展示室に置く）
  shadowUpdate = null;
  if (def.final) {
    // 鏡の隣の作品名の札「YOU」
    const last = world.modules[2];
    const dm = last.meta.module || { door: 2.6, height: 3.5, width: 5.4 };
    for (const [zi, z] of def.zones.entries()) {
      for (const it of z.items.filter((x) => x.fixed === 'mirror')) {
        const slot = { pos: [0.98, 1.4, -world.totalLength + 0.152], normal: [0, 0, 1], kind: 'wall', zone: zi + 1, room: 2, ceil: dm.height, roomW: dm.width, radius: 2.4 };
        const g = await buildTrace(last, slot, { tokens: it.tokens }, readers[2], { night: false });
        world.group.add(g);
        traces.push({ zone: zi + 1, words: [it.text], pos: slot.pos, radius: slot.radius });
      }
    }
    // 第2区画の右の壁に、プレイヤーの動きについてくる影
    const sh = playerShadow((world.modules[1].meta.module?.width ?? 7) / 2, -15.3, -29.7);
    world.group.add(sh.mesh);
    shadowUpdate = sh.update;
    world.meta.markers = {
      footprints: { pos: [-1.7, 0, -1.5] },
      footprints_end: { pos: [-1.7, 0, -14] },
      writing: { pos: [-(world.modules[1].meta.module?.width ?? 9) / 2, 1.7, -22.5] },
      // 最後の部屋の出口は、ふさがれて鏡になっている
      mirror: { pos: [0, 1.35, -world.totalLength + 0.18] },
    };
    extras = decorateFinal(world, R.scene, st.getState(), spaces());
  }
}

$('btn-enter').onclick = () => {
  audio.initAudio();
  audio.startAmbience('gallery', { reverb: 0.35 });
  audio.setAmbienceZone(zone);
  setMode('play');
  player.lock();
  showIntro();
};

function showIntro() {
  const idx = spaces().indexOf(def);
  $('intro-space').textContent = `空間 ${idx + 1} / ${spaces().length}`;
  $('intro-tier').textContent = def.tier ? `${TIER_NAMES[def.tier]}${def.night ? ' ・ 夜' : ''}` : '';
  $('intro-n').textContent = memoWords(def).length;
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
  const idx = spaces().indexOf(def);
  $('hud-space').textContent = `空間 ${idx + 1}`;
  $('hud-zone').textContent = def.zones[zone - 1].name;
  const got = st.spaceState(def.id).words.length;
  $('memo-count').textContent = `${got}/${memoWords(def).length}`;
}

let toastTimer = 0;
function toast(html) {
  $('toast').innerHTML = html;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
}

function foundWords(found, note = '痕跡を検索メモに記録した') {
  if (!found.length) return;
  audio.uiTick();
  toast(`<small>${note}</small>${found.map((w) => `「${esc(w)}」`).join(' ')}`);
  renderMemo();
  updateHud();
}

// 部屋そのものが痕跡になっている検索ワードは、その区画に入ると記録する
function recordRoomTraces() {
  const found = [];
  for (const t of traces) {
    if (t.pos || t.zone > zone) continue;
    for (const w of t.words) if (st.addWord(def.id, w)) found.push(w);
  }
  if (found.length && mode === 'play') foundWords(found, 'この部屋そのものが痕跡だ');
}

function checkTraces() {
  const p = player.pos;
  const found = [];
  for (const t of traces) {
    if (!t.pos) continue;
    const dx = p.x - t.pos[0];
    const dz = p.z - t.pos[2];
    if (dx * dx + dz * dz < t.radius * t.radius) {
      for (const w of t.words) if (st.addWord(def.id, w)) found.push(w);
    }
  }
  foundWords(found);
}

function onZoneChange(z, prev) {
  zone = z;
  st.setZone(def.id, z);
  audio.setAmbienceZone(z);
  updateHud();
  if (z > prev) toast(`<small>${def.zones[z - 1].name}</small>痕跡が、少しはっきりしてきた`);
  setTimeout(recordRoomTraces, 1200);
}

// ---------------------------------------------------------------- 検索メモ（検索ボタンはない。自分で調べる）
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderMemo() {
  const got = new Set(st.spaceState(def.id).words);
  $('memo-list').innerHTML = def.zones.map((z) => {
    const items = z.items.map((it) => it.text ?? it.words.join('・')).map((w) => {
      if (got.has(w)) return `<div class="word"><b dir="auto">${esc(w)}</b></div>`;
      return `<div class="word locked"><b style="width:${Math.max(2, [...w].length) * 15}px"></b><span>未発見</span></div>`;
    }).join('');
    return `<div class="zone-block"><h3>${z.name}</h3>${items}</div>`;
  }).join('') + renderNotes();
}

// 自分のメモ（調べたこと・思いついた答えの候補などを書き足せる）
function renderNotes() {
  const list = st.notes(def.id).map((n, i) => `<div class="word note"><span dir="auto">${esc(n)}</span><button class="note-del" data-i="${i}" aria-label="このメモを消す">×</button></div>`).join('');
  // ふだんは「検索メモを追加」ボタンだけ。押すと書く欄が開く
  const form = noteOpen
    ? `<form id="note-form" class="note-row" autocomplete="off">
      <input id="note-input" type="text" maxlength="80" placeholder="調べたこと・気づいたことを書く" enterkeyhint="done" />
      <button type="submit" class="primary">追加</button>
      <button type="button" id="note-cancel">やめる</button>
    </form>`
    : '<button type="button" id="note-open" class="note-open">＋ 検索メモを追加</button>';
  return `<div class="zone-block notes"><h3>自分のメモ</h3>${list}${form}</div>`;
}
let noteOpen = false;
function setNoteOpen(open) {
  noteOpen = open;
  renderMemo();
  if (open) { $('note-input').focus(); $('memo-list').scrollTop = $('memo-list').scrollHeight; }
}
$('memo-list').addEventListener('submit', (e) => {
  if (e.target.id !== 'note-form') return;
  e.preventDefault();
  // 書いたら欄を閉じて、ボタンに戻す（空のときは閉じない）
  const text = $('note-input').value;
  if (!st.addNote(def.id, text)) return;
  setNoteOpen(false);
  if (labCtl && isExitNote(text) && !labCtl.isOpen()) exitEffect();
});
$('memo-list').addEventListener('click', (e) => {
  if (e.target.closest('#note-open')) return setNoteOpen(true);
  if (e.target.closest('#note-cancel')) return setNoteOpen(false);
  const b = e.target.closest('.note-del');
  if (!b) return;
  st.removeNote(def.id, Number(b.dataset.i));
  renderMemo();
  // 研究室：「出口」のメモを消すと、扉も消える
  if (labCtl?.isOpen() && !st.notes(def.id).some(isExitNote)) labCtl.setDoor(false);
});

// 研究室の隠し扉：メモが記録され、椅子の背後の壁に「出口」の文字が 1 秒浮かび、扉が現れて、メモが閉じる（約 4 秒）
function exitEffect() {
  const ctl = labCtl;
  setTimeout(() => { if (labCtl === ctl) ctl.flashExitWord(); }, 500);
  setTimeout(() => {
    if (labCtl !== ctl) return;
    ctl.setDoor(true, true);
    shakeUntil = elapsed + 0.45;
  }, 1600);
  setTimeout(() => { if (labCtl === ctl) closeMemo(); }, 3900);
}

function openMemo() {
  if (mode !== 'play' && mode !== 'pause') return;
  setMode('memo');
  $('answer-msg').textContent = '';
  if (!player.isTouch) setTimeout(() => $('answer').focus(), 350);
}
function closeMemo() {
  if (mode !== 'memo') return;
  // 書きかけの欄は閉じて、次に開いたときはボタンに戻っている
  if (noteOpen) { noteOpen = false; renderMemo(); }
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
player.onStep((running) => audio.footstep('hard', running));

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
  const w = def.wiki;
  const s = st.spaceState(def.id);
  // 研究室の答えはウィキペディアではなく、研究所の報告書から引く
  $('res-cap-wiki').hidden = !!def.lab;
  $('res-cap-lab').hidden = !def.lab;
  if (def.lab) {
    $('res-name').textContent = def.answerName;
    $('res-quote').textContent = LAB_RESULT.quote;
    $('res-lab-src').innerHTML = ARCHIVE_URL ? `<a href="${esc(ARCHIVE_URL)}" target="_blank" rel="noopener">${esc(LAB_RESULT.source)}</a>` : esc(LAB_RESULT.source);
    $('res-zone').textContent = `${s.zoneMax} / 3`;
    $('res-tries').textContent = `${s.attempts}回`;
    return;
  }
  $('res-name').textContent = def.answerName;
  $('res-quote').textContent = w?.extract || '';
  $('res-title').textContent = w?.title || def.answerName;
  $('res-link').href = w?.url || `https://ja.wikipedia.org/wiki/${encodeURIComponent(def.answerName)}`;
  $('res-date').textContent = w?.retrieved || '';
  $('res-zone').textContent = `${s.zoneMax} / 3`;
  $('res-tries').textContent = `${s.attempts}回`;
}

function cleared() {
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
  st.advance(spaces().indexOf(def));
  enterSpace(st.getState().current);
};

// 最終空間：UI もカーソルも消して、画面全体を純粋な黒にする（黒い画面に映るプレイヤー自身が答え）
async function finale() {
  mode = 'void';
  audio.stopAmbience(0.3);
  audio.setMasterMute(true);
  showScreen('none');
  $('hud').classList.remove('show');
  document.body.classList.add('void');
  try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* そのまま */ }
  setTimeout(() => {
    document.body.classList.remove('void');
    audio.setMasterMute(false);
    mode = 'final-result';
    $('btn-next').textContent = '確認';
    showScreen('result');
  }, 5000);
}

// 研究室の扉をくぐった：白く溶けて、最終空間には行かずに終わる
function escapeEnding() {
  mode = 'void';
  player.setEnabled(false);
  document.exitPointerLock?.();
  audio.stopAmbience(1.5);
  st.escape(def.id);
  $('hud').classList.remove('show');
  $('memo').classList.remove('show');
  $('whiteout').classList.add('show');          // 1.5 秒で白くなる
  setTimeout(() => $('whiteout-text').classList.add('show'), 1500 + 3000); // 白のまま 3 秒
  setTimeout(() => {
    showAllClear();
    $('whiteout').classList.remove('show');
    $('whiteout-text').classList.remove('show');
  }, 1500 + 3000 + 4500);
}

function showAllClear() {
  const escaped = !!st.getState().escaped;
  if (!escaped) st.advance(spaces().indexOf(def));
  mode = 'allclear';
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  $('summary').innerHTML = spaces().map((s, i) => {
    const ss = st.spaceState(s.id);
    if (escaped && s.final) return `<tr><td>空間 ${i + 1}</td><td>—（未到達）</td><td></td><td></td></tr>`;
    const name = escaped && s.lab ? '脱出' : s.answerName;
    return `<tr><td>空間 ${i + 1}</td><td>${esc(name)}</td><td>区画 ${ss.zoneMax}/3</td><td>回答 ${ss.attempts}回</td></tr>`;
  }).join('');
  // 最終空間まで進んだら「ごちそうさま！」、研究室の扉から脱出したときは「オールクリア！」
  $('allclear-title').textContent = escaped ? 'オールクリア！' : 'ごちそうさま！';
  showScreen('allclear');
}
$('btn-restart').onclick = () => { st.reset(); enterSpace(0); };

// ---------------------------------------------------------------- ループ
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  if (!world || ['void', 'result', 'final-result', 'allclear', 'title', 'loading'].includes(mode)) return;
  player.update(dt);
  if (mode === 'play') {
    const z = computeZone();
    if (z !== zone) onZoneChange(z, zone);
    checkTraces();
    st.recordPath(def.id, player.pos.x, player.pos.z);
    if (labCtl?.passed(player.pos)) { escapeEnding(); return; }
  }
  updateFlicker(world, look.flicker, elapsed);
  extras?.update?.(elapsed, R.camera);
  for (const u of updaters) u(elapsed);
  if (shadowUpdate) shadowUpdate(player.pos, dt);
  audio.setListener(R.camera);
  // 扉が現れるときの短い揺れ（描くときだけずらす）
  const shake = shakeUntil > elapsed ? (shakeUntil - elapsed) * 0.03 : 0;
  if (shake) R.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
  R.render(elapsed);
  R.adapt(dt);
}
frame();

// 開発用：?space=3 で空間を直接開く
if (import.meta.env.DEV) {
  window.__dbg = {
    R, player, st, get world() { return world; }, get def() { return def; }, get mode() { return mode; }, get traces() { return traces; },
    // 検索ワードの痕跡を、少し離れた正面から撮る
    async shotWord(name, word, dist = 3.2) {
      const t = traces.find((x) => x.pos && x.words[0] === word);
      if (!t) return `no trace: ${word}`;
      const [x, y, z] = t.pos;
      const m = world.modules[t.zone - 1];
      const cz = m.group.position.z - (m.meta.module?.length ?? 15) / 2;
      // 部屋の中央寄り・手前（奥へ進む人の目線）から見る
      const cx = x * 0.25; const czz = Math.min(z + dist, cz + 7.2);
      return this.shot(name, cx, czz, x, Math.max(y, 0.6), z);
    },
    tp(x, z, yawDeg = 0) { player.spawn([x, 0, z], (yawDeg * Math.PI) / 180); },
    async ready() {
      while (mode !== 'ready') await new Promise((r) => setTimeout(r, 200));
      $('btn-enter').click();
      $('intro').classList.remove('show');
    },
    // 位置と向きを決めて描き、開発サーバーに画像を保存する
    async shot(name, x, z, tx, ty, tz) {
      player.spawn([x, 0, z], 0);
      R.camera.position.set(x, 1.6, z);
      R.camera.lookAt(tx, ty, tz);
      // 画面が隠れていると毎フレームの更新が止まるので、影はここで進める
      if (shadowUpdate) for (let i = 0; i < 30; i++) shadowUpdate({ x, z: z - i * 0.02 }, 0.1);
      this.frozen = true;
      for (let i = 0; i < 2; i++) R.render(performance.now() / 1000);
      const data = R.renderer.domElement.toDataURL('image/jpeg', 0.85);
      await fetch('/__shot', { method: 'POST', body: JSON.stringify({ name, data }) });
      return name;
    },
  };
  const q = new URLSearchParams(location.search).get('space');
  if (q) enterSpace(Math.max(0, Math.min(spaces().length - 1, Number(q) - 1)));
}
