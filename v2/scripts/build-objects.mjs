// 検索ワードを表すオブジェクト（Poly Haven, CC0）を取得し、Web 用に軽くして v2/public/objects に置く。
//   node v2/scripts/build-objects.mjs [id ...]
// - glTF 1k を blender/cache/polyhaven/<id>/gltf_1k に取得（取得済みなら使い回す）
// - 頂点の統合・ポリゴン削減（最大約 2 万三角形）・テクスチャを WebP 512px・Draco 圧縮
// - 出典の一覧を v2/public/objects/credits.json に書く
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OBJECTS } from '../objects/library.mjs';

const CACHE = 'blender/cache/polyhaven';
const OUT = 'v2/public/objects';
const MAX_TRIS = 20000;
mkdirSync(OUT, { recursive: true });

const ids = process.argv.slice(2).length ? process.argv.slice(2) : OBJECTS.map((o) => o.id);

async function getJson(url) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw new Error(`fetch failed ${url}`);
}
async function download(url, path) {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url);
    if (r.ok) { writeFileSync(path, Buffer.from(await r.arrayBuffer())); return; }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw new Error(`download failed ${url}`);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
await MeshoptSimplifier.ready;

function triCount(doc) {
  let n = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices();
    n += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
  }
  return n;
}

const creditsPath = join(OUT, 'credits.json');
const credits = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, 'utf8')) : {};

for (const id of ids) {
  try {
    const base = join(CACHE, id, 'gltf_1k');
    const info = await getJson(`https://api.polyhaven.com/info/${id}`);
    const files = await getJson(`https://api.polyhaven.com/files/${id}`);
    const g = files.gltf?.['1k']?.gltf;
    if (!g) throw new Error('gltf 1k なし');
    const main = join(base, g.url.split('/').pop());
    await download(g.url, main);
    for (const [rel, f] of Object.entries(g.include || {})) await download(f.url, join(base, rel));

    const doc = await io.read(main);
    const before = triCount(doc);
    const ratio = Math.min(1, MAX_TRIS / Math.max(1, before));
    await doc.transform(
      dedup(), weld(),
      ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 })] : []),
      prune(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 78 }),
      draco({ quantizePosition: 14, quantizeTexcoord: 12, quantizeNormal: 10 }),
    );
    const dst = join(OUT, `${id}.glb`);
    await io.write(dst, doc);
    credits[id] = { name: info.name, authors: Object.keys(info.authors || {}), license: 'CC0', url: `https://polyhaven.com/a/${id}` };
    console.log(id, Math.round(before), '->', Math.round(triCount(doc)), 'tris', (statSync(dst).size / 1e3).toFixed(0) + 'KB');
  } catch (e) {
    console.log(id, 'ERROR', e.message);
  }
}
writeFileSync(creditsPath, JSON.stringify(credits, null, 1));
