// 文書・新聞・張り紙に書く検索ワードのために、使う文字だけのフォントを作る。
// どの端末でも同じ書体で表示するため（スマホには明朝体がないことが多い）。
//   node v2/scripts/make-font.mjs
// 入力: blender/cache/fonts/NotoSerifJP.ttf（SIL Open Font License 1.1）
// 出力: v2/public/fonts/doc-serif.otf と OFL.txt
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';
import { DOC_TEXT } from '../src/game/doc-text.js';
import { SEARCH_WORDS } from '../word-pool/search-words.mjs';

const SRC = 'blender/cache/fonts/NotoSerifJP.ttf';
const OUT = 'v2/public/fonts';

const buf = readFileSync(SRC);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const chars = new Set();
const add = (s) => { for (const c of s) if (!/\s/.test(c)) chars.add(c); };
for (const zones of Object.values(SEARCH_WORDS)) for (const w of zones.flat()) add(w);
add(DOC_TEXT);
add('0123456789０１２３４５６７８９ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:;!?-+()/%#&*・、。「」『』（）！？ー―…');

const glyphs = [font.glyphs.get(0)];
const missing = [];
for (const c of chars) {
  const g = font.charToGlyph(c);
  if (!g || g.index === 0) { missing.push(c); continue; }
  const path = g.getPath(0, 0, font.unitsPerEm);
  // getPath は y が下向きなので、フォントの座標（上向き）に戻す
  for (const k of path.commands) for (const key of ['y', 'y1', 'y2']) if (k[key] !== undefined) k[key] = -k[key];
  glyphs.push(new opentype.Glyph({ name: `u${c.codePointAt(0).toString(16)}`, unicode: c.codePointAt(0), advanceWidth: g.advanceWidth, path }));
}
glyphs.push(new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: font.unitsPerEm / 4, path: new opentype.Path() }));
glyphs.push(new opentype.Glyph({ name: 'ideographicspace', unicode: 0x3000, advanceWidth: font.unitsPerEm, path: new opentype.Path() }));

const sub = new opentype.Font({
  familyName: 'TabetabeDocSerif', styleName: 'Regular', unitsPerEm: font.unitsPerEm,
  ascender: font.ascender, descender: font.descender, glyphs,
  copyright: font.names.copyright?.en, license: 'SIL Open Font License 1.1', licenseURL: 'https://openfontlicense.org',
});
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/doc-serif.otf`, Buffer.from(sub.toArrayBuffer()));
copyFileSync('blender/cache/fonts/OFL.txt', `${OUT}/OFL.txt`);
console.log('glyphs', glyphs.length, 'missing', missing.join(''), (statSync(`${OUT}/doc-serif.otf`).size / 1e3).toFixed(0) + 'KB');
