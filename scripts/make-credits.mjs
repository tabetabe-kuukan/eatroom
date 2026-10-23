// CREDITS.md を生成する（ルートと public/ の両方に書き出す）。
//   node scripts/make-credits.mjs
// - Blender ビルドで使った Poly Haven 素材: blender/export/space??.credits.json
// - Wikipedia の引用: src/data/wiki.json
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EXP = 'blender/export';
const assets = new Map();
const usedIn = new Map();
for (const f of existsSync(EXP) ? readdirSync(EXP).filter((f) => f.endsWith('.credits.json')).sort() : []) {
  const space = f.slice(5, 7);
  for (const a of JSON.parse(readFileSync(join(EXP, f), 'utf8'))) {
    assets.set(a.id, a);
    if (!usedIn.has(a.id)) usedIn.set(a.id, new Set());
    usedIn.get(a.id).add(Number(space));
  }
}
const wiki = JSON.parse(readFileSync('src/data/wiki.json', 'utf8'));

const kindName = { texture: 'テクスチャ', model: '3Dモデル', hdri: 'HDRI' };
const rows = [...assets.values()]
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
  .map((a) => `| ${kindName[a.kind] || a.kind} | [${a.name}](${a.url}) | ${a.authors.join(', ') || '—'} | CC0 | ${[...usedIn.get(a.id)].sort().join(', ')} |`);

const wikiRows = Object.values(wiki).map((w) =>
  `| [${w.title}](${w.url}) | ${w.requested !== w.title ? `「${w.requested}」から転送` : ''} | ${w.license} | ${w.retrieved} |`);

const md = `# クレジット

このゲームで使っている外部の素材・引用と、そのライセンスの一覧です。
（このファイルは \`node scripts/make-credits.mjs\` で自動生成しています）

## 3D素材（Poly Haven / CC0）

すべて [Poly Haven](https://polyhaven.com/) の CC0（パブリックドメイン相当）素材です。表示義務はありませんが、感謝を込めて記載します。

| 種類 | 素材 | 作者 | ライセンス | 使用した空間 |
|---|---|---|---|---|
${rows.join('\n')}

## 文章の引用（Wikipedia）

リザルト画面では、日本語版ウィキペディアの記事冒頭の文を引用しています。
引用文はビルド時に REST API（\`https://ja.wikipedia.org/api/rest_v1/page/summary/<タイトル>\`）で取得したもので、
[クリエイティブ・コモンズ 表示-継承 4.0 国際（CC BY-SA 4.0）](https://creativecommons.org/licenses/by-sa/4.0/deed.ja) の条件で利用しています。
著作者はウィキペディアの各記事の執筆者です（各記事の履歴を参照）。

| 記事 | 備考 | ライセンス | 取得日 |
|---|---|---|---|
${wikiRows.join('\n')}

## 文字入りテクスチャ・フォント

看板・地図・ラベルなどの文字入りテクスチャは \`blender/gen_textures.py\` で生成しました。使ったフォントはいずれも SIL Open Font License 1.1 です。

- [BIZ UDゴシック / BIZ UD明朝](https://github.com/googlefonts/morisawa-biz-ud-gothic)（Morisawa, SIL OFL 1.1）
- [しっぽり明朝](https://github.com/fontdasu/ShipporiMincho)（FONTDASU, SIL OFL 1.1）
- Bahnschrift / Consolas（Windows 同梱、数字・英字の一部。画像として焼き込み）

## 音

環境音・効果音（蝉時雨、電車の走行音、太鼓と鈴、電話のベル、足音など）はすべて Web Audio API でその場で合成しており、外部の音源ファイルは使っていません。

## UIのフォント

画面の文字は閲覧環境のシステムフォント（ヒラギノ／游明朝／BIZ UD など）で表示し、Webフォントは読み込んでいません。

## ソフトウェア

- [three.js](https://threejs.org/)（MIT License）
- [Draco](https://github.com/google/draco)（Apache License 2.0、three.js 同梱のデコーダー）
- [glTF Transform](https://gltf-transform.dev/)（MIT License、ビルド時の最適化）
- [sharp](https://sharp.pixelplumbing.com/)（Apache License 2.0、ビルド時の画像変換）
- [Vite](https://vite.dev/)（MIT License）
- [Blender](https://www.blender.org/)（GPL、モデル生成とライトマップのベイク）
`;
writeFileSync('CREDITS.md', md);
writeFileSync('public/CREDITS.md', md);
console.log(`CREDITS.md: 素材 ${assets.size} 件、引用 ${wikiRows.length} 件`);
