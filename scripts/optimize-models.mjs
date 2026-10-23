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
const OUT = 'public/models';
const HDRI = 'public/hdri';
const CACHE = 'blender/cache/polyhaven';
mkdirSync(OUT, { recursive: true });
mkdirSync(HDRI, { recursive: true });

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
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
  const tag = `space${id}`;
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

  if (meta.lightmap) {
    for (const [key, q] of [['file', 88], ['ao', 80]]) {
      const name = meta.lightmap[key];
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
