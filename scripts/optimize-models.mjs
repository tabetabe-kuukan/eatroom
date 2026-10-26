// Blender の書き出し（blender/export）を Web 用に最適化して public/ に置く。
//   node scripts/optimize-models.mjs [01 02 ...]
// - メッシュ: Draco 圧縮
// - テクスチャ: WebP（最大 1024px）
// - ライトマップ / AO: WebP
// - HDRI: Poly Haven のキャッシュから public/hdri へコピー
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EXP = 'blender/export';
// --out=v2/public で v2 用に書き出す（その下に models/ と hdri/ を作る）
const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUTROOT = outArg ? outArg.slice(6) : 'public';
const OUT = join(OUTROOT, 'models');
const HDRI = join(OUTROOT, 'hdri');
const CACHE = 'blender/cache/polyhaven';
mkdirSync(OUT, { recursive: true });
mkdirSync(HDRI, { recursive: true });

const argIds = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ids = argIds.length
  ? argIds
  : readdirSync(EXP).filter((f) => /^space\d\d\.glb$/.test(f)).map((f) => f.slice(5, 7));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const mb = (p) => (statSync(p).size / 1e6).toFixed(2) + 'MB';

function findHdri(file) {
  for (const d of readdirSync(CACHE)) {
    const p = join(CACHE, d, file);
    if (existsSync(p)) return p;
  }
  return null;
}

for (const id of ids) {
  const tag = id.startsWith('room_') ? id : `space${id}`;
  const src = join(EXP, `${tag}.glb`);
  const meta = JSON.parse(readFileSync(join(EXP, `${tag}.json`), 'utf8'));
  const doc = await io.read(src);
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 80 }),
    draco({ quantizePosition: 14, quantizeTexcoord: 14, quantizeNormal: 10, quantizeColor: 8 }),
  );
  const dst = join(OUT, `${tag}.glb`);
  await io.write(dst, doc);
  let total = statSync(dst).size;
  const files = [`${tag}.glb ${mb(dst)}`];

  // AO は glb の occlusion スロットに入っている。ライトマップ（昼・夜）だけ別ファイル
  for (const lmKey of ['lightmap', 'lightmap_night']) {
    if (!meta[lmKey]) continue;
    for (const [key, q] of [['file', 88]]) {
      const name = meta[lmKey][key];
      const png = join(EXP, name.replace('.webp', '.png'));
      const out = join(OUT, name);
      await sharp(png).webp({ quality: q, effort: 6 }).toFile(out);
      total += statSync(out).size;
      files.push(`${name} ${mb(out)}`);
    }
  }
  if (meta.hdri) {
    const h = findHdri(meta.hdri);
    if (h) {
      copyFileSync(h, join(HDRI, meta.hdri));
      total += statSync(h).size;
      files.push(`${meta.hdri} ${mb(h)}`);
    }
  }
  writeFileSync(join(OUT, `${tag}.json`), JSON.stringify(meta));
  console.log(`${tag}: ${files.join(', ')}  合計 ${(total / 1e6).toFixed(2)}MB`);
  if (total > 15e6) console.warn(`  ⚠ ${tag} が 15MB を超えています`);
}
