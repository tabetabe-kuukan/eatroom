// サンプル：ホワイトキューブに見本の検索ワードを埋め込んで歩けるようにする
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildTrace, lightmapReader, loadDocFont } from './engine/embed.js';
import { createPlayer } from './engine/player.js';
import { createRenderer } from './engine/renderer.js';
import { loadSpace } from './engine/world.js';
import { loadRooms } from './engine/rooms.js';
import { OBJECTS } from '../objects/library.mjs';

const $ = (id) => document.getElementById(id);
const R = createRenderer($('view'));
const player = createPlayer(R.camera, $('view'), { stick: $('stick'), knob: $('knob') });

const def = {
  id: 'wc',
  look: {
    exposure: 0.48,
    fog: { color: 0xe9e8e4, density: 0.008 },
    background: 'fog', envIntensity: 0.35,
    lightmapBoost: 1.0, vlitBoost: 1.0,
    bloom: { strength: 0.15, radius: 0.4, threshold: 10.0 },
    flicker: null,
    grain: 0.03, vignette: 0.6, aberration: 0.0006,
  },
};

const obj = (id) => OBJECTS.find((o) => o.id === id);
// 見本：区画ごとに3つ（左の壁・中央の台・右の壁 / 第3区画は突き当たり）
const SAMPLE = [
  { giant: true, tokens: [{ word: '時刻', object: obj('wall_clock') }] },
  { tokens: [{ word: '理念' }] },
  { tokens: [{ word: '方角', object: obj('seadogs_compass') }] },
  { tokens: [{ word: '量子仮説' }] },
  { giant: true, tokens: [{ word: 'カメラ', object: obj('Camera_01') }] },
  { tokens: [{ word: '拡大', object: obj('magnifying_glass_01') }, { word: '倍率' }] },
  { tokens: [{ word: '雨具', object: obj('rubber_boots') }] },
  { tokens: [{ word: '山', object: obj('mountainside') }] },
  { tokens: [{ word: '機会費用' }, { word: '国際貿易論' }] },
];

// ?rooms=washitsu,cave,white で部屋モジュールを選ぶ。&night=1 で深夜の美術館
const qs = new URLSearchParams(location.search);
const NIGHT = qs.get('night') === '1';
const variants = (qs.get('rooms') || 'white,white,white').split(',');
if (NIGHT) {
  Object.assign(def.look, { exposure: 1.4, fog: { color: 0x05060a, density: 0.012 }, envIntensity: 0.02, bloom: { strength: 0.5, radius: 0.5, threshold: 0.8 }, grain: 0.05, vignette: 0.9 });
}
const world = qs.get('legacy') ? await loadSpace(def, R.renderer, () => {}) : await loadRooms(variants, def.look, R.renderer, { night: NIGHT });
R.scene.add(world.group);
window.__world = world; window.__R = R;
const pmrem = new THREE.PMREMGenerator(R.renderer);
R.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
R.scene.environmentIntensity = def.look.envIntensity;
R.scene.fog = new THREE.FogExp2(def.look.fog.color, def.look.fog.density);
R.scene.background = new THREE.Color(def.look.fog.color);
R.applyLook(def.look);
player.setColliders(world.colliders);
player.setFloors(world.meta.floors);
player.spawn(world.meta.spawn.pos, world.meta.spawn.yaw);

await loadDocFont();
const traces = [];
// 区画ごとに 左の壁・中央の台・右の壁 の順で見本を置く。光は区画の部屋モジュールから読む
const KEYS = ['left', 'table', 'right'];
const readers = (world.modules || [world]).map((m) => lightmapReader(m));
const slots = [...world.meta.slots].sort((a, b) => (a.zone - b.zone) || (KEYS.indexOf(a.key) - KEYS.indexOf(b.key)));
for (const [i, slot] of slots.entries()) {
  const entry = SAMPLE[i];
  const mod = world.modules ? world.modules[slot.room] : world;
  const g = await buildTrace(mod, slot, entry, readers[slot.room || 0]);
  world.group.add(g);
  traces.push({ slot, label: entry.tokens.map((t) => (t.object ? `${t.word}（オブジェクト）` : `${t.word}（文書）`)).join(' ＋ ') });
}

$('view').addEventListener('click', () => player.lock());
const clock = new THREE.Clock();
let shown = '';
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  player.setEnabled(true);
  if (!window.__frozen) player.update(dt);
  const p = player.pos;
  const near = traces.find((t) => (p.x - t.slot.pos[0]) ** 2 + (p.z - t.slot.pos[2]) ** 2 < t.slot.radius ** 2);
  const txt = near ? `痕跡：${near.label}` : '';
  if (txt !== shown) { shown = txt; $('hit').textContent = txt; $('hit').classList.toggle('show', !!txt); }
  R.render(clock.elapsedTime);
}
frame();

// 撮影用
window.__look = (x, z, tx, ty, tz) => {
  window.__frozen = true; $('info').style.display = 'none';
  player.spawn([x, 0, z], 0);
  R.camera.position.set(x, 1.6, z);
  R.camera.lookAt(tx, ty, tz);
  for (let i = 0; i < 2; i++) R.render(clock.elapsedTime);
  return 'ok';
};
// 撮影して開発サーバーに保存する（ウィンドウが隠れていても撮れる）
window.__shot = async (name, x, z, tx, ty, tz) => {
  window.__look(x, z, tx, ty, tz);
  R.render(clock.elapsedTime);
  const data = R.renderer.domElement.toDataURL('image/jpeg', 0.85);
  await fetch('/__shot', { method: 'POST', body: JSON.stringify({ name, data }) });
  return name;
};
