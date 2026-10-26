// サンプル：three.js だけで組み立てる空間。テクスチャもキャンバスで作る。
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a1712, 0.045);
scene.background = new THREE.Color(0x1a1712);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 100);
camera.position.set(0, 1.6, 1);
const controls = new PointerLockControls(camera, document.body);
addEventListener('click', () => controls.lock());

// ---------------------------------------------------------------- キャンバスのテクスチャ
function noiseCanvas(w, h, base, spread, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * spread;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  draw?.(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const plasterTex = noiseCanvas(512, 512, '#cfc6b8', 26, (g, w, h) => {
  for (let i = 0; i < 260; i++) { // しみ
    g.fillStyle = `rgba(90,70,50,${Math.random() * 0.06})`;
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 60, 0, 7); g.fill();
  }
});
plasterTex.repeat.set(10, 1.5);
const tileTex = noiseCanvas(512, 512, '#6b5a4a', 30, (g, w, h) => {
  g.strokeStyle = 'rgba(20,14,10,.8)'; g.lineWidth = 6;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
});
tileTex.repeat.set(2, 20);

// ---------------------------------------------------------------- 部屋
const L = 40; const W = 4; const H = 3.2;
const mWall = new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.9 });
const mFloor = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.6 });
const mCeil = new THREE.MeshStandardMaterial({ color: 0x9a9286, roughness: 1 });
function slab(w, h, d, x, y, z, m) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.receiveShadow = true; scene.add(o); return o;
}
slab(W, 0.2, L, 0, -0.1, -L / 2 + 2, mFloor);
slab(W, 0.2, L, 0, H + 0.1, -L / 2 + 2, mCeil);
slab(0.2, H, L, -W / 2 - 0.1, H / 2, -L / 2 + 2, mWall);
slab(0.2, H, L, W / 2 + 0.1, H / 2, -L / 2 + 2, mWall);
slab(W, H, 0.2, 0, H / 2, -L + 2, mWall);
// 柱（区画ごとに一定間隔）
const mPillar = new THREE.MeshStandardMaterial({ color: 0x7d7568, roughness: 0.8 });
for (let z = 0; z > -L + 2; z -= 4) for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) slab(0.3, H, 0.3, x, H / 2, z, mPillar).castShadow = true;

// 照明：裸電球が点々と下がる。区画ごとに色が変わる
const zoneColors = [0xffd9a8, 0xffc28a, 0xffe7cf];
for (let i = 0; i < 5; i++) {
  const z = -2 - i * 8;
  const col = zoneColors[Math.min(2, Math.floor(i / 2))];
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: col }));
  bulb.position.set(0, H - 0.5, z); scene.add(bulb);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.45), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  cord.position.set(0, H - 0.25, z); scene.add(cord);
  const p = new THREE.PointLight(col, 9, 11, 2);
  p.position.copy(bulb.position);
  p.castShadow = i < 4;
  p.shadow.mapSize.set(512, 512);
  p.shadow.bias = -0.002;
  scene.add(p);
}
scene.add(new THREE.HemisphereLight(0x8a8070, 0x241c14, 0.25));

// ---------------------------------------------------------------- 埋め込みの「えぐれ」
// 物が壁に食い込んだように、周りにひび割れと影を描く
function crackTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  grd.addColorStop(0, 'rgba(15,10,6,.85)'); grd.addColorStop(0.45, 'rgba(30,20,12,.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(20,12,8,.8)'; g.lineWidth = 1.6;
  for (let i = 0; i < 14; i++) {
    let x = 128; let y = 128; let a = Math.random() * Math.PI * 2;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { a += (Math.random() - 0.5) * 0.9; x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const crackTex = crackTexture();
function crack(size, pos, normal) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: crackTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.copy(pos).addScaledVector(normal, 0.005);
  m.lookAt(m.position.clone().add(normal));
  scene.add(m);
}

// ---------------------------------------------------------------- 文書（張り紙・新聞）
function paperTexture(kind, word) {
  const c = document.createElement('canvas');
  const isNews = kind === 'newspaper';
  c.width = isNews ? 900 : 600; c.height = isNews ? 640 : 820;
  const g = c.getContext('2d');
  g.fillStyle = isNews ? '#d9d2c0' : '#e8e2d2'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(120,100,70,${Math.random() * 0.05})`; g.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 3); }
  const serif = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
  // 読めない（空間に食べられた）本文
  const bars = (x, y, w, rows, h = 10, gap = 22) => { for (let r = 0; r < rows; r++) { g.fillStyle = `rgba(60,55,50,${0.18 + Math.random() * 0.15})`; g.fillRect(x, y + r * gap, w * (0.6 + Math.random() * 0.4), h); } };
  g.fillStyle = '#1d1a16';
  if (isNews) {
    g.font = `bold 64px ${serif}`; g.fillText('日報', 40, 80);
    g.fillRect(30, 100, c.width - 60, 4);
    g.font = `bold 92px ${serif}`; g.fillText(word, 60, 230);
    for (let col = 0; col < 4; col++) bars(40 + col * 215, 280, 190, 14);
  } else {
    g.font = `bold 46px ${serif}`; g.fillText('お知らせ', 40, 80);
    bars(40, 120, 500, 4);
    g.font = `bold 120px ${serif}`;
    const tw = g.measureText(word).width;
    g.fillText(word, (c.width - tw) / 2, 380);
    bars(40, 460, 500, 12);
    // テープ
    g.fillStyle = 'rgba(230,220,180,.75)'; g.fillRect(20, 0, 110, 36); g.fillRect(c.width - 130, 0, 110, 36);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function paper(kind, word, w, pos, rot) {
  const t = paperTexture(kind, word);
  const h = w * t.image.height / t.image.width;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 8, 8), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide }));
  // 紙のたわみ
  const p = m.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3) * 0.008 + Math.random() * 0.004);
  m.geometry.computeVertexNormals();
  m.position.copy(pos); m.rotation.set(...rot);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// ---------------------------------------------------------------- オブジェクトの埋め込み
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/'));
async function embed(id, size, pos, normal, depth, tilt = 0) {
  const g = await loader.loadAsync(`/v2/public/objects/${id}.glb`);
  const o = g.scene;
  const box = new THREE.Box3().setFromObject(o);
  const s = size / Math.max(...box.getSize(new THREE.Vector3()).toArray());
  o.scale.setScalar(s);
  box.setFromObject(o);
  o.position.sub(box.getCenter(new THREE.Vector3()));
  const holder = new THREE.Group();
  holder.add(o);
  holder.position.copy(pos).addScaledVector(normal, size * (0.5 - depth));
  holder.lookAt(holder.position.clone().add(normal));
  holder.rotateZ(tilt);
  holder.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(holder);
  crack(size * 1.6, pos, normal);
}

const LEFT = new THREE.Vector3(1, 0, 0); const RIGHT = new THREE.Vector3(-1, 0, 0); const UP = new THREE.Vector3(0, 1, 0);
const traces = [];
// 第1区画
embed('wall_clock', 0.55, new THREE.Vector3(-W / 2, 1.7, -6), LEFT, 0.45, 0.25);
traces.push({ z: -6, word: '時刻（オブジェクト：掛け時計）' });
paper('poster', '理念', 0.7, new THREE.Vector3(W / 2 - 0.01, 1.55, -10), [0, -Math.PI / 2, 0.04]);
traces.push({ z: -10, word: '理念（張り紙）' });
// 第2区画
embed('lightbulb_01', 0.5, new THREE.Vector3(0.6, 0, -14), UP, 0.55, 0.4);
traces.push({ z: -14, word: '光（オブジェクト：電球）' });
paper('newspaper', '量子仮説', 1.0, new THREE.Vector3(-0.7, 0.012, -18.5), [-Math.PI / 2, 0, 0.3]);
traces.push({ z: -18.5, word: '量子仮説（新聞）' });
embed('seadogs_compass', 0.45, new THREE.Vector3(W / 2, 1.4, -22), RIGHT, 0.5, -0.3);
traces.push({ z: -22, word: '方角（オブジェクト：羅針盤）' });
// 第3区画
embed('Camera_01', 0.6, new THREE.Vector3(-W / 2, 1.5, -26), LEFT, 0.4, 0.15);
traces.push({ z: -26, word: 'カメラ（オブジェクト）' });
embed('mountainside', 1.4, new THREE.Vector3(0, 0, -33), UP, 0.5);
traces.push({ z: -33, word: '山（オブジェクト：山の模型）' });
paper('poster', '機会費用', 0.8, new THREE.Vector3(0, 1.6, -L + 2.11), [0, 0, -0.03]);
traces.push({ z: -37.5, word: '機会費用（張り紙）' });

// ---------------------------------------------------------------- 移動
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
const hit = document.getElementById('hit');
let shown = '';
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const sp = (keys.ShiftLeft ? 3.2 : 1.8) * dt;
  if (controls.isLocked) {
    if (keys.KeyW || keys.ArrowUp) controls.moveForward(sp);
    if (keys.KeyS || keys.ArrowDown) controls.moveForward(-sp);
    if (keys.KeyA || keys.ArrowLeft) controls.moveRight(-sp);
    if (keys.KeyD || keys.ArrowRight) controls.moveRight(sp);
  }
  camera.position.x = Math.max(-W / 2 + 0.35, Math.min(W / 2 - 0.35, camera.position.x));
  camera.position.z = Math.max(-L + 2.5, Math.min(1.5, camera.position.z));
  const near = traces.find((t) => Math.abs(camera.position.z - t.z) < 1.8);
  const txt = near ? `痕跡：${near.word}` : '';
  if (txt !== shown) { shown = txt; hit.textContent = txt; hit.classList.toggle('show', !!txt); }
  renderer.render(scene, camera);
}
frame();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
// 撮影用
window.__look = (px, pz, tx, ty, tz) => { camera.position.set(px, 1.6, pz); camera.lookAt(tx, ty, tz); document.getElementById('info').style.display = 'none'; renderer.render(scene, camera); };
