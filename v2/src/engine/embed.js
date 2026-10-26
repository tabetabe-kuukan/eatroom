// 検索ワードを空間に埋め込む。
// - 名詞でオブジェクトがあるもの: Poly Haven のモデルを壁・床・台に半分ほど埋め込む
// - それ以外（抽象的な言葉・動詞など）: 張り紙・新聞・書類の中の言葉として置く。本文は「食べられて」読めない
// 動的に置く物にはベイクした光が当たらないので、置く場所のライトマップの明るさを読み取り、
// 同じ明るさのライトマップ（1x1）を持たせて周りの空間となじませる。
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dominantColor, growthPatch, inkSeepTexture } from './growth.js';
import { procObject } from './proc.js';
import { buildSpecial } from './specials.js';
import { loadFont3D, SERIF, wordArt } from './wordart.js';

const BASE = import.meta.env.BASE_URL;
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader());
// 区画ごとの変化の大きさ（第1区画はかすか、第3区画は大きく変わる）
const GROWTH = [0.35, 0.7, 1.0];

let fontReady = null;
export function loadDocFont() {
  if (!fontReady) {
    const f = new FontFace('TabetabeDocSerif', `url(${BASE}fonts/doc-serif.otf)`);
    fontReady = Promise.all([
      f.load().then((ff) => { document.fonts.add(ff); }).catch(() => {}),
      loadFont3D(`${BASE}fonts/doc-serif.otf`), // 立体の文字は同じフォントの字形から作る
    ]);
  }
  return fontReady;
}

// ---------------------------------------------------------------- ライトマップの明るさを読む
// 面の色（テクスチャがあればその平均の色）。膨らみ・滲みの下地の色に使う
const surfaceColors = new WeakMap();
function surfaceColor(mat) {
  if (surfaceColors.has(mat)) return surfaceColors.get(mat).clone();
  let col = mat.color.clone();
  const img = mat.map?.image;
  if (img) {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data;
    let r = 0; let gg = 0; let b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    col = new THREE.Color(r / n / 255, gg / n / 255, b / n / 255).convertSRGBToLinear().multiply(mat.color);
  }
  surfaceColors.set(mat, col);
  return col.clone();
}

function lightmapReader(world) {
  const tex = world.lmMaterials[0]?.lightMap;
  const img = tex?.image;
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const targets = [];
  world.group.traverse((o) => { if (o.isMesh && o.material?.lightMap === tex) targets.push(o); });
  const ray = new THREE.Raycaster();
  return (point, normal) => {
    // 面の少し手前から面に向かって光線を飛ばし、当たった場所のライトマップの色を読む
    const acc = new THREE.Color(0, 0, 0);
    let n = 0;
    let albedo = null;
    const t1 = new THREE.Vector3().crossVectors(normal, Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    const t2 = new THREE.Vector3().crossVectors(normal, t1);
    for (const [a, b] of [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) {
      const p = point.clone().addScaledVector(t1, a).addScaledVector(t2, b);
      ray.set(p.clone().addScaledVector(normal, 0.3), normal.clone().negate());
      ray.far = 0.6;
      const hit = ray.intersectObjects(targets, false)[0];
      const uv = hit?.uv1 || hit?.uv;
      if (!uv) continue;
      if (!albedo && hit.object.material?.color) albedo = surfaceColor(hit.object.material);
      const x = Math.min(c.width - 1, Math.max(0, Math.floor(uv.x * c.width)));
      const y = Math.min(c.height - 1, Math.max(0, Math.floor(uv.y * c.height)));
      const i = (y * c.width + x) * 4;
      acc.r += toLin(data[i]); acc.g += toLin(data[i + 1]); acc.b += toLin(data[i + 2]);
      n++;
    }
    const out = n ? acc.multiplyScalar(1 / n) : new THREE.Color(0.3, 0.3, 0.3);
    out.albedo = albedo || new THREE.Color(0.8, 0.8, 0.8);
    return out;
  };
}

function lightTexture(color) {
  const d = new Uint8Array([
    Math.round(Math.min(1, color.r) * 255), Math.round(Math.min(1, color.g) * 255), Math.round(Math.min(1, color.b) * 255), 255]);
  const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
  t.colorSpace = THREE.LinearSRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// 一様な明るさだけだと立体感がなくなるので、上と手前から光が来ているように面の向きで少し変える
function shadeByNormal(mat, keyDir) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uKey = { value: keyDir };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uKey;')
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
      #if defined( RE_IndirectDiffuse ) && defined( USE_LIGHTMAP )
        vec3 wN = inverseTransformDirection( normal, viewMatrix );
        irradiance *= 0.45 + 0.75 * max( dot( wN, uKey ), 0.0 ) + 0.12 * wN.y;
      #endif`);
  };
  mat.customProgramCacheKey = () => 'shadeByNormal';
}

function applyBakedLight(root, world, irr, keyDir) {
  const lt = lightTexture(irr);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    if (!g.attributes.uv1) {
      if (g.attributes.uv) g.setAttribute('uv1', g.attributes.uv);
      else g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    // 面ごとにマテリアルが違うもの（作品名の札など）は配列になっている
    const lit = (src) => {
      const m = src.clone();
      m.lightMap = lt;
      m.lightMap.channel = 1;
      m.lightMapIntensity = world.lmScale * Math.PI;
      m.userData.baseLm = m.lightMapIntensity;
      m.envMapIntensity = 0.6;
      if (m.metalness > 0.5) m.metalness = 0.5;
      shadeByNormal(m, keyDir);
      world.lmMaterials.push(m); // 照明の揺らぎにも合わせる
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(lit) : lit(o.material);
  });
}

// 物体の +Z を normal に、+Y を up に向ける
function orient(o, pos, normal, up, roll = 0) {
  const z = normal.clone().normalize();
  const x = new THREE.Vector3().crossVectors(up, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  if (roll) o.rotateZ(roll);
  o.position.copy(pos);
}

// ---------------------------------------------------------------- オブジェクト
function coreBox(root) {
  root.updateWorldMatrix(true, true);
  const xs = []; const ys = []; const zs = [];
  const v = new THREE.Vector3();
  root.traverse((m) => {
    if (!m.isMesh) return;
    const pa = m.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pa.count / 4000));
    for (let i = 0; i < pa.count; i += step) {
      v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
      xs.push(v.x); ys.push(v.y); zs.push(v.z);
    }
  });
  const q = (arr, t) => { arr.sort((x, y) => x - y); return arr[Math.floor((arr.length - 1) * t)]; };
  return new THREE.Box3(new THREE.Vector3(q(xs, 0.04), q(ys, 0.04), q(zs, 0.04)), new THREE.Vector3(q(xs, 0.96), q(ys, 0.96), q(zs, 0.96)));
}

async function objectMesh(id, size, keep = null, faceOut = false, face = null, proc = null) {
  // proc: three.js で作る物（みかん・磁石・竹）
  const o = proc ? procObject(proc) : (await loader.loadAsync(`${BASE}objects/${id}.glb`)).scene;
  // 色違いや別個体が並んだモデルは、使う物だけ残す
  if (keep) {
    const re = new RegExp(keep);
    const drop = [];
    o.traverse((m) => {
      if (!m.isMesh) return;
      let ok = false;
      for (let a = m; a && a !== o; a = a.parent) if (re.test(a.name)) ok = true;
      if (!ok) drop.push(m);
    });
    for (const m of drop) m.removeFromParent();
  }
  // 壁に埋めるときは、いちばん薄い向きを壁の外に向ける（物の広い面が見えるように）
  if (faceOut) {
    const d0 = coreBox(o).getSize(new THREE.Vector3());
    const pivot = new THREE.Group();
    // face でモデルの正面の軸を指定できる（自動だと蓋が開いた物などで誤るため）
    const ax = face || (d0.y < d0.z * 0.8 && d0.y <= d0.x ? 'y' : d0.x < d0.z * 0.8 && d0.x < d0.y ? 'x' : 'z');
    if (ax === 'y') pivot.rotation.x = Math.PI / 2;
    else if (ax === 'x') pivot.rotation.y = -Math.PI / 2;
    pivot.add(o);
    const wrap = new THREE.Group(); wrap.add(pivot);
    return place(wrap, size);
  }
  return place(o, size);
}

function place(o, size) {
  // 大きさは物の「本体」で測る。紐や細い突起（カメラのストラップなど）で外枠が膨らむと
  // 本体が小さくなって判別できないため、頂点の 4〜96% の範囲を本体とみなす
  const core = coreBox(o);
  const dim = core.getSize(new THREE.Vector3());
  const k = size / Math.max(dim.x, dim.y, dim.z);
  o.scale.setScalar(k);
  o.position.copy(core.getCenter(new THREE.Vector3()).multiplyScalar(-k));
  const holder = new THREE.Group();
  holder.add(o);
  return { holder, depth: dim.multiplyScalar(k) };
}

// ---------------------------------------------------------------- 1つの痕跡を組み立てる
const freeRay = new THREE.Raycaster();

// 面に重ねて貼る半透明の層は、描く順番を固定する（カメラが動くたびに順番が入れ替わると、ちらつく）
// 1: 光だまり 2: 膨らみ・滲み 3: インクの染み 4: 文字・特別な見せ方
function layer(obj, order) {
  obj.traverse((o) => { o.renderOrder = order; });
  return obj;
}

// スポットライトの光だまり（面に貼る、外へぼける明るい楕円）
let poolTex = null;
function lightPool(pos, normal, strength) {
  if (!poolTex) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,236,205,1)');
    grd.addColorStop(0.55, 'rgba(255,230,195,0.55)');
    grd.addColorStop(1, 'rgba(255,225,190,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    poolTex = new THREE.CanvasTexture(c);
    poolTex.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.4), new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, opacity: 0.22 * strength, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1,
  }));
  const n = normal.clone();
  const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  orient(m, pos.clone().addScaledVector(n, 0.002), n, up);
  return m;
}

// slot: { pos, normal, up, kind: wall | floor | ceiling | table, w, h, zone }、entry: { tokens: [{ word, object, giant }] }
// opts.night: 深夜の美術館（ネオン・電光掲示板が出やすい）
export async function buildTrace(world, slot, entry, read = null, opts = {}) {
  const reader = read || lightmapReader(world);
  const group = new THREE.Group();
  const updaters = [];
  const pos = new THREE.Vector3().fromArray(slot.pos);
  const normal = new THREE.Vector3().fromArray(slot.normal).normalize();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const flat = Math.abs(normal.y) > 0.9;
  // 文字や物の「上」の向き。壁は鉛直上向き、床・天井・台は slot.up（なければ奥向き）
  const up = flat ? new THREE.Vector3().fromArray(slot.up || [0, 0, -1]).normalize() : WORLD_UP.clone();
  const side = new THREE.Vector3().crossVectors(up, normal).normalize();
  const irr = reader ? reader(pos, normal) : new THREE.Color(0.4, 0.4, 0.4);
  // 痕跡にはスポットライトが当たっている（夜は痕跡だけが浮かび上がる）
  const SPOT = opts.night ? new THREE.Color(0.55, 0.46, 0.34) : new THREE.Color(0.95, 0.9, 0.82);
  const base = irr.albedo;
  irr.r = Math.max(irr.r, SPOT.r * (opts.night ? 1 : 0.9));
  irr.g = Math.max(irr.g, SPOT.g * (opts.night ? 1 : 0.9));
  irr.b = Math.max(irr.b, SPOT.b * (opts.night ? 1 : 0.9));
  irr.albedo = base;
  const keyDir = new THREE.Vector3(0, 1, 0).addScaledVector(normal, 0.9).normalize();
  const s = GROWTH[(slot.zone || 1) - 1];
  group.add(layer(lightPool(pos, normal, opts.night ? 1.0 : 0.35), 1));

  const objs = entry.tokens.filter((t) => t.object);
  const specials = entry.tokens.filter((t) => t.special);
  const wordTokens = entry.tokens.filter((t) => !t.object && !t.special);
  const words = wordTokens.map((t) => t.word);
  const tinted = wordTokens.find((t) => t.color || t.style);

  // ---- 部品を作り、横に並べる幅を決める
  const parts = [];
  for (const t of objs) {
    // fill: 'ceiling' の物（竹）は床から天井まで立ち上がる
    const fill = t.object.fill === 'ceiling';
    const giant = !fill && !!(entry.giant || t.giant);
    // 床では 4 割ほど横倒しにして、面を上に向けて沈める
    const along = !fill && (slot.kind === 'wall' || slot.kind === 'ceiling' || (slot.kind === 'floor' && Math.random() < 0.4));
    const size = fill ? (slot.ceil || 4.6) - 0.05
      : giant ? Math.min(Math.max(t.object.size * 7, 2.2), 3.2)
        : Math.min(Math.max(t.object.size * 2, 0.75), slot.kind === 'table' ? 0.75 : t.object.ground ? 1.8 : 1.4);
    const { holder, depth: dim } = await objectMesh(t.object.id, size, t.object.keep, along, t.object.face, t.object.proc);
    // 並べる幅は物の実際の幅（巨大な物を細く見積もると、隣の文字が物に埋もれる）
    parts.push({ type: 'obj', holder, dim, size, giant, along, fill, ground: !!t.object.ground, width: dim.x });
  }
  for (const t of specials) {
    const sp = buildSpecial(t.special, { kind: slot.kind, pos: slot.pos, ceil: slot.ceil || 4.6, night: opts.night, words: [t.word], color: '#f2c218' });
    parts.push({ type: 'special', sp, width: sp.place === 'world' ? 0 : sp.width });
  }
  if (words.length) {
    const art = wordArt(slot.kind, words, opts.night, { color: tinted?.color, style: tinted?.style, roomW: slot.roomW });
    parts.push({ type: 'words', art, width: art.width });
  }
  // ---- 面の上で横に使える幅を測る（壁の端・本棚・家具まで）。はみ出す文字は縮めて、全体を空いている側へずらす
  const gap = 0.3;
  const spanOf = () => parts.reduce((a, p) => a + p.width, 0) + gap * (parts.length - 1);
  const meshes = [];
  world.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const probe = pos.clone().addScaledVector(normal, 0.12);
  if (slot.kind === 'floor') probe.y = 0.4;
  const freeAlong = (dir) => {
    freeRay.set(probe, dir);
    freeRay.far = 8;
    const h = freeRay.intersectObjects(meshes, false)[0];
    return h ? Math.max(0, h.distance - 0.15) : 8;
  };
  const freeR = freeAlong(side.clone());
  const freeL = freeAlong(side.clone().negate());
  let span = spanOf();
  const wordParts = parts.filter((p) => p.type === 'words');
  if (span > freeL + freeR && wordParts.length) {
    const fixedW = span - wordParts.reduce((a, p) => a + p.width, 0);
    const k = Math.max(0.35, Math.min(1, (freeL + freeR - fixedW) / (span - fixedW)));
    for (const p of wordParts) {
      p.art.mesh.scale.multiplyScalar(k);
      p.art.width *= k; p.art.height *= k;
      if (p.art.depth) p.art.depth *= k;
      p.width *= k;
    }
    span = spanOf();
  }
  const lo = -freeL + span / 2; const hi = freeR - span / 2;
  const center = lo <= hi ? Math.min(Math.max(0, lo), hi) : (freeR - freeL) / 2;
  let cursor = center - span / 2;

  for (const part of parts) {
    const offset = cursor + part.width / 2;
    cursor += part.width + gap;
    const at = pos.clone().addScaledVector(side, offset);
    if (part.type === 'obj') {
      const { holder, dim, size, giant, along } = part;
      let exposed = 0; let footprint = 0;
      if (along) {
        // 正面を外に向け、厚みの 2.5〜3.5 割を面に沈める（何の物か分かるように大部分は見せる）
        if (giant && slot.kind === 'wall') at.y = Math.max(at.y, dim.y / 2 + 0.05);
        // 床に立つ物（冷蔵庫など）は、壁に食い込んでも足は床に着いている
        if (part.ground && slot.kind === 'wall') at.y = dim.y / 2 + 0.01;
        const half = dim.z / 2;
        const sink = 0.25 + Math.random() * 0.1;
        exposed = 2 * half * (1 - sink);
        footprint = Math.max(dim.x, dim.y) / 2;
        orient(holder, at.clone().addScaledVector(normal, half - sink * 2 * half), normal, flat ? up : WORLD_UP, (Math.random() - 0.5) * (flat ? 6 : 0.6));
        holder.rotateY((Math.random() - 0.5) * 0.5);
        holder.rotateX((Math.random() - 0.5) * 0.3);
      } else {
        // 床・台では立てたまま、高さの 2〜3 割を沈める。台の上の巨大な物は台ごと床から生やす
        if ((giant || part.fill) && slot.kind === 'table') at.y = 0;
        const half = dim.y / 2;
        const sink = part.fill ? 0.01 : 0.2 + Math.random() * 0.1;
        exposed = 2 * half * (1 - sink);
        footprint = Math.max(dim.x, dim.z) / 2;
        holder.position.copy(at).addScaledVector(WORLD_UP, half - sink * 2 * half);
        holder.rotation.set(part.fill ? 0 : (Math.random() - 0.5) * 0.35, Math.random() * Math.PI * 2, part.fill ? 0 : (Math.random() - 0.5) * 0.35);
      }
      applyBakedLight(holder, world, irr, keyDir);
      group.add(holder);
      // 飲み込んだ場所が膨らみ、食べた物の色が滲み出す（奥の区画ほど大きく変わる）
      let radius = Math.max(size * (0.8 + 0.7 * s), footprint * 1.7);
      if (slot.kind === 'table' && !giant) radius = Math.min(radius, 0.33);
      const height = Math.min(size * 0.18 * s, exposed * 0.3);
      const hole = Math.min(0.9, (footprint * 1.05) / radius);
      const patch = growthPatch({ radius, height, mix: 0.25 + 0.6 * s, color: dominantColor(holder), albedo: irr.albedo, hole });
      const pAt = giant && slot.kind === 'table' ? at : at.clone();
      orient(patch, pAt, giant && slot.kind === 'table' ? WORLD_UP : normal, flat || (giant && slot.kind === 'table') ? up : WORLD_UP, Math.random() * Math.PI * 2);
      applyBakedLight(patch, world, irr, keyDir);
      group.add(layer(patch, 2));
    } else if (part.type === 'special') {
      const { sp } = part;
      if (sp.place === 'surface') {
        const p = at.clone().addScaledVector(normal, 0.006);
        if (sp.yCenter !== undefined && !flat) p.y = sp.yCenter;
        orient(sp.mesh, p, normal, up, 0);
      }
      if (sp.lit) applyBakedLight(sp.mesh, world, irr, keyDir);
      else for (const lp of sp.litParts || []) applyBakedLight(lp, world, irr, keyDir);
      group.add(layer(sp.mesh, 4));
      if (sp.update) updaters.push(sp.update);
    } else if (part.art.style === '3d') {
      // 立体の文字：床では立てて少し沈める（奥へ進む人の方を向く）。壁・天井からは突き出す
      const { art } = part;
      const m = art.mesh;
      if (slot.kind === 'floor' || slot.kind === 'table') {
        m.position.set(at.x, slot.kind === 'table' ? 0 : at.y, at.z);
        m.position.y -= art.height * (0.08 + Math.random() * 0.2);
        m.rotation.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.15);
        m.translateZ(-art.depth / 2);
      } else {
        const p = at.clone();
        if (slot.kind === 'wall') p.y = Math.min(Math.max(p.y, 0.3), (slot.ceil || 4.6) - 0.3 - art.height);
        orient(m, p.addScaledVector(normal, -art.depth * 0.35), normal, slot.kind === 'wall' ? WORLD_UP : up, (Math.random() - 0.5) * 0.15);
        if (slot.kind !== 'wall') m.translateY(-art.height / 2);
      }
      applyBakedLight(m, world, irr, keyDir);
      group.add(layer(m, 4));
    } else {
      const { art } = part;
      const m = art.mesh;
      const roll = art.style === 'vinyl' ? (Math.random() - 0.5) * 0.1 : art.style === 'paper:record' || art.style === 'paper:newspaper' ? (Math.random() - 0.5) * 0.6 : 0;
      // 壁の文字は目の高さあたりに。天井・床はその面に
      const p = at.clone().addScaledVector(normal, 0.008);
      if (slot.kind === 'wall' && art.style !== 'frame') p.y = Math.min(Math.max(p.y, art.height / 2 + 0.25), (slot.ceil || 4.6) - 0.3 - art.height / 2);
      orient(m, p, normal, up, roll);
      // 発光する物（ネオン・電光掲示板）は焼いた光を当てない。枠や箱だけ当てる
      if (art.lit) applyBakedLight(m, world, irr, keyDir);
      else for (const lp of art.litParts || []) applyBakedLight(lp, world, irr, keyDir);
      group.add(layer(m, 4));
      if (art.update) updaters.push(art.update);
      // 切り文字・張り紙は、言葉のインクが壁・床に染み出して流れる
      if (art.style === 'vinyl' || art.style.startsWith('paper')) {
        let radius = art.width * (0.45 + 0.4 * s);
        if (slot.kind === 'table') radius = Math.min(radius, 0.33);
        const ink = growthPatch({ radius, height: 0, mix: 0, color: irr.albedo, albedo: irr.albedo, flat: true, map: inkSeepTexture(words, SERIF) });
        ink.material.opacity = 0.3 + 0.5 * s;
        orient(ink, at.clone().addScaledVector(normal, 0.003), normal, up, 0);
        applyBakedLight(ink, world, irr, keyDir);
        group.add(layer(ink, 3));
      }
    }
  }
  group.userData.update = (t) => { for (const u of updaters) u(t); };
  return group;
}

export { lightmapReader, applyBakedLight };
