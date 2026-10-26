// v2 のクレジット（v2/public/CREDITS.md）を作る。
//   node v2/scripts/make-credits.mjs
// - Poly Haven の素材：部屋モジュール・空間6（blender/export/*.credits.json）と、検索ワードのオブジェクト（v2/public/objects/credits.json）
// - Wikipedia の引用：単語プールの全記事と「お前」
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const ROOMS = ['white', 'washitsu', 'door', 'kids', 'engawa', 'study', 'classroom', 'sky'].flatMap((r) => [1, 2, 3].map((s) => `${r}_s${s}`));
const assets = new Map();
const add = (id, kind, name, authors, url, where) => {
  const a = assets.get(id) || { kind, name, authors, url, where: new Set() };
  a.where.add(where);
  assets.set(id, a);
};
for (const r of ROOMS) {
  const p = `blender/export/room_${r}.credits.json`;
  if (!existsSync(p)) continue;
  for (const c of JSON.parse(readFileSync(p, 'utf8'))) add(c.id, c.kind, c.name, c.authors, c.url, '展示室');
}
for (const c of JSON.parse(readFileSync('blender/export/space06.credits.json', 'utf8'))) add(c.id, c.kind, c.name, c.authors, c.url, '空間6');
for (const [id, c] of Object.entries(JSON.parse(readFileSync('v2/public/objects/credits.json', 'utf8')))) add(id, 'model', c.name, c.authors, c.url, '検索ワードの物');

const KIND = { hdri: 'HDRI', model: '3Dモデル', texture: 'テクスチャ' };
const rows = [...assets.values()].sort((a, b) => (a.kind + a.name).localeCompare(b.kind + b.name))
  .map((a) => `| ${KIND[a.kind] || a.kind} | [${a.name}](${a.url}) | ${a.authors.join(', ')} | CC0 | ${[...a.where].join('・')} |`);

const pool = JSON.parse(readFileSync('v2/src/data/pool.json', 'utf8'));
const omae = JSON.parse(readFileSync('v2/src/data/omae.json', 'utf8'));
const wiki = [...pool.words.map((w) => w.wiki), omae]
  .map((w) => `| [${w.title}](${w.url}) | CC BY-SA 4.0 | ${w.retrieved} |`);

const md = `# クレジット（食べ食べ空間 v2）

このゲームで使っている外部の素材・引用と、そのライセンスの一覧です。
（このファイルは \`node v2/scripts/make-credits.mjs\` で自動生成しています）

## 3D素材（Poly Haven / CC0）

すべて [Poly Haven](https://polyhaven.com/) の CC0（パブリックドメイン相当）素材です。表示義務はありませんが、感謝を込めて記載します。
検索ワードの物は、元のモデルを軽量化（ポリゴン削減・テクスチャ縮小）して使っています。

| 種類 | 素材 | 作者 | ライセンス | 使った場所 |
|---|---|---|---|---|
${rows.join('\n')}

## 文章の引用（Wikipedia）

リザルト画面では、日本語版ウィキペディアの記事冒頭の文を引用しています。
引用文は REST API（\`https://ja.wikipedia.org/api/rest_v1/page/summary/<タイトル>\`）で取得したもので、
[クリエイティブ・コモンズ 表示-継承 4.0 国際（CC BY-SA 4.0）](https://creativecommons.org/licenses/by-sa/4.0/deed.ja) の条件で利用しています。
著作者はウィキペディアの各記事の執筆者です（各記事の履歴を参照）。

| 記事 | ライセンス | 取得日 |
|---|---|---|
${wiki.join('\n')}

## フォント

- 張り紙・新聞・記録の文字：[Noto Serif JP](https://github.com/notofonts/noto-cjk)（Google, SIL Open Font License 1.1）。
  使う文字だけを抜き出したサブセット（\`fonts/doc-serif.otf\`）を同梱しています。ライセンス本文は \`fonts/OFL.txt\`。
- 部屋の畳・壁紙・黒板・本の背表紙のテクスチャは \`blender/gen_room_textures.py\` で生成しました（文字は含みません）。
- 空間6の文字入りテクスチャ：[BIZ UD明朝](https://github.com/googlefonts/morisawa-biz-ud-gothic)（Morisawa）・[しっぽり明朝](https://github.com/fontdasu/ShipporiMincho)（FONTDASU）、いずれも SIL OFL 1.1。

## 音

環境音・効果音はすべて Web Audio API でその場で合成しており、外部の音源ファイルは使っていません。

## ソフトウェア

- [three.js](https://threejs.org/)（MIT License）
- [Draco](https://github.com/google/draco)（Apache License 2.0、three.js 同梱のデコーダー）
- [glTF Transform](https://gltf-transform.dev/)（MIT License、ビルド時の最適化）
- [meshoptimizer](https://github.com/zeux/meshoptimizer)（MIT License、ビルド時のポリゴン削減）
- [sharp](https://sharp.pixelplumbing.com/)（Apache License 2.0、ビルド時の画像変換）
- [opentype.js](https://opentype.js.org/)（MIT License、フォントのサブセット作成）
- [Vite](https://vite.dev/)（MIT License）
- [Blender](https://www.blender.org/)（GPL、部屋の生成とライトマップのベイク）
`;
writeFileSync('v2/public/CREDITS.md', md);
console.log(`CREDITS.md: 素材 ${rows.length} 件、記事 ${wiki.length} 件`);
