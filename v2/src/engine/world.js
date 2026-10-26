// 空間の読み込みと組み立て。
// - .glb / ライトマップ / AO / HDRI を進捗つきで読み込む（空間ごとに遅延読み込み）
// - ライトマップ付きのメッシュ: MeshStandardMaterial.lightMap（uv1）+ aoMap
// - 頂点ライティングのメッシュ（草など）: 頂点カラーに焼いた照明で描く
// - 動的ライト（揺らぎ）・当たり判定・痕跡の位置を meta（space??.json）から作る
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const BASE = import.meta.env.BASE_URL;
// デコーダーは three.js 同梱のもの（Vite がビルドに含める）を使う
const draco = new DRACOLoader();
const gltfLoader = new GLTFLoader().setDRACOLoader(draco);

async function fetchProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) {
    const b = await res.arrayBuffer();
    onProgress(1);
    return b;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  onProgress(1);
  return out.buffer;
}

async function textureFrom(buf, type, colorSpace) {
  const bmp = await createImageBitmap(new Blob([buf], { type }), { imageOrientation: 'none', colorSpaceConversion: 'none' });
  const t = new THREE.Texture(bmp);
  t.flipY = false; // glTF の UV に合わせる
  t.colorSpace = colorSpace;
  t.channel = 1;
  t.needsUpdate = true;
  return t;
}

function ancestorFlag(o, key) {
  for (let p = o; p; p = p.parent) if (p.userData && p.userData[key] !== undefined) return p.userData[key];
  return undefined;
}

export async function loadSpace(def, renderer, onProgress) {
  // def.tag で部屋モジュール（room_xxx）も読める。def.night なら夜のライトマップを使う
  const tag = def.tag || `space${def.id}`;
  let meta = await (await fetch(`${BASE}models/${tag}.json`)).json();
  if (def.night && meta.lightmap_night) meta = { ...meta, lightmap: meta.lightmap_night };
  // 進捗の重み
  const parts = { glb: 0, lm: 0, hdr: 0 };
  const w = { glb: 0.72, lm: 0.13, hdr: 0.15 };
  const report = () => onProgress(Object.entries(parts).reduce((a, [k, v]) => a + v * w[k], 0));

  const pGlb = fetchProgress(`${BASE}models/${tag}.glb`, (v) => { parts.glb = v; report(); });
  const pLm = meta.lightmap
    ? fetchProgress(`${BASE}models/${meta.lightmap.file}`, (v) => { parts.lm = v * 0.9; report(); })
    : Promise.resolve(null);
  const pHdr = meta.hdri
    ? fetchProgress(`${BASE}hdri/${meta.hdri}`, (v) => { parts.hdr = v; report(); })
    : Promise.resolve(null);

  const [glbBuf, lmBufs, hdrBuf] = await Promise.all([pGlb, pLm, pHdr]);
  const gltf = await gltfLoader.parseAsync(glbBuf, `${BASE}models/`);
  let lm = null;
  if (lmBufs) {
    lm = await textureFrom(lmBufs, 'image/webp', THREE.SRGBColorSpace);
    parts.lm = 1; report();
  }
  let env = null;
  let hdrTex = null;
  if (hdrBuf) {
    const data = new HDRLoader().parse(hdrBuf);
    hdrTex = new THREE.DataTexture(data.data, data.width, data.height, THREE.RGBAFormat, data.type);
    hdrTex.colorSpace = THREE.LinearSRGBColorSpace;
    hdrTex.mapping = THREE.EquirectangularReflectionMapping;
    hdrTex.minFilter = THREE.LinearFilter;
    hdrTex.magFilter = THREE.LinearFilter;
    hdrTex.generateMipmaps = false;
    hdrTex.flipY = true;
    hdrTex.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    env = pmrem.fromEquirectangular(hdrTex).texture;
    pmrem.dispose();
  }
  return buildWorld(def, meta, gltf.scene, { lm, env, hdrTex });
}

function buildWorld(def, meta, root, { lm, env, hdrTex }) {
  const look = def.look;
  const group = new THREE.Group();
  group.add(root);
  const lmScale = (meta.lightmap?.scale || 1) * (look.lightmapBoost ?? 1);
  const lmMaterials = [];
  const flickerMaterials = [];
  const vlitMaterials = [];
  const swapped = new Map();

  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = true;
    const isLm = ancestorFlag(o, 'lightmap');
    const vlit = ancestorFlag(o, 'vlit');
    const unlit = ancestorFlag(o, 'unlit');
    const src = o.material;
    const cut = /_cut$/.test(src.name) || src.alphaTest > 0 || src.transparent;
    if (vlit !== undefined) {
      const key = `v:${src.uuid}`;
      if (!swapped.has(key)) {
        const m = new THREE.MeshBasicMaterial({
          map: src.map, vertexColors: true, side: THREE.DoubleSide,
          alphaTest: cut ? 0.5 : 0, transparent: false,
        });
        m.userData.base = vlit * (look.vlitBoost ?? 1);
        m.color.setScalar(m.userData.base);
        vlitMaterials.push(m);
        swapped.set(key, m);
      }
      o.material = swapped.get(key);
      return;
    }
    if (unlit !== undefined) {
      const key = `u:${src.uuid}`;
      if (!swapped.has(key)) {
        const m = new THREE.MeshBasicMaterial({ map: src.map, side: THREE.DoubleSide, alphaTest: 0.5, color: 0x9aa59a });
        swapped.set(key, m);
      }
      o.material = swapped.get(key);
      return;
    }
    if (cut) {
      src.alphaTest = 0.5;
      src.transparent = false;
      src.side = THREE.DoubleSide;
    }
    if (isLm && lm) {
      // テクスチャのない色だけのマテリアルは、エクスポーターが LM の UV を TEXCOORD_0 として書き出す
      const g = o.geometry;
      const ownTex = src.map || src.normalMap || src.roughnessMap || src.metalnessMap || src.emissiveMap;
      if (!g.attributes.uv1 && g.attributes.uv && !ownTex) {
        g.setAttribute('uv1', g.attributes.uv);
        if (src.aoMap) src.aoMap.channel = 1;
      }
      if (!src.userData._lm) {
        // AO は glTF の occlusion（uv1）として読み込まれている
        src.lightMap = lm;
        src.lightMapIntensity = lmScale * Math.PI;
        if (src.aoMap) src.aoMapIntensity = 0.6;
        // 金属は拡散反射がないためライトマップが効かない。ステンレス等は少しだけ金属感を残す
        if (src.metalness > 0.3) { src.metalness = 0.25; src.roughness = Math.max(src.roughness, 0.3); }
        src.userData._lm = true;
        src.userData.baseLm = src.lightMapIntensity;
        lmMaterials.push(src);
      }
    }
    // 発光体（蛍光灯など）はブルームが乗る程度に強める
    if (src.emissive && src.emissive.getHex() !== 0 && !src.userData._em) {
      src.userData._em = true;
      // 管球は明るすぎるとブルームで画面が白むので上限を設ける（look.emissive で空間ごとに調整）
      src.emissiveIntensity = Math.min(look.emissiveMax ?? 3.0, Math.max(src.emissiveIntensity, src.emissiveMap ? 1.0 : 2.0));
      src.userData.baseEm = src.emissiveIntensity;
      if (/flicker/.test(src.name)) flickerMaterials.push(src);
    }
  });

  // 動的ライト（揺らぎつき）
  const lights = [];
  for (const L of meta.lights || []) {
    const light = new THREE.PointLight(new THREE.Color(...L.color), L.intensity, L.distance, 2);
    light.position.fromArray(L.pos);
    light.userData = { base: L.intensity, flicker: L.flicker, seed: Math.random() * 100 };
    group.add(light);
    lights.push(light);
  }

  return {
    group, meta, env, hdrTex, lmMaterials, vlitMaterials, flickerMaterials, lights, lmScale,
    colliders: meta.colliders || [],
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'lightMap']) o.material[k]?.dispose?.();
          o.material.dispose();
        }
      });
      lm?.dispose(); env?.dispose(); hdrTex?.dispose();
    },
  };
}

// 照明の揺らぎ（空間ごとの空気感）
export function updateFlicker(world, kind, t) {
  if (!world) return;
  let k = 1;
  if (kind === 'clouds') {
    // 雲が流れて木漏れ日が明るくなったり暗くなったりする
    k = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(t * 0.09) * Math.sin(t * 0.23 + 1.3));
  } else if (kind === 'fluorescent') {
    k = 1 - (Math.sin(t * 37.0) > 0.995 ? 0.12 : 0) - 0.015 * Math.sin(t * 6.3);
  } else if (kind === 'monitor') {
    k = 1 - 0.02 * Math.sin(t * 2.1) - (Math.sin(t * 13.0 + Math.sin(t)) > 0.996 ? 0.1 : 0);
  }
  for (const m of world.lmMaterials) m.lightMapIntensity = m.userData.baseLm * k;
  for (const m of world.vlitMaterials) m.color.setScalar(m.userData.base * k);
  // 切れかけの蛍光灯
  const bad = Math.sin(t * 31.0) * Math.sin(t * 4.7 + 1.0) > 0.55 || (Math.sin(t * 0.7) > 0.93 && Math.sin(t * 57.0) > 0);
  for (const m of world.flickerMaterials) m.emissiveIntensity = m.userData.baseEm * (bad ? 0.08 : 1);
  for (const l of world.lights) {
    const f = l.userData.flicker;
    if (!f) continue;
    const s = l.userData.seed;
    const off = (Math.sin(t * 23 + s) * Math.sin(t * 7.1 + s * 2) > 0.92) ? 0.15 : 1;
    l.intensity = l.userData.base * (1 - f + f * off) * (0.97 + 0.03 * Math.sin(t * 50 + s));
  }
}
