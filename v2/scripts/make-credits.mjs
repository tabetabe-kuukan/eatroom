// v2 のクレジットを作る（サイトで読む v2/public/credits.html と、リポジトリで読む v2/public/CREDITS.md）。
//   node v2/scripts/make-credits.mjs
// - Poly Haven の素材：部屋モジュール（blender/export/room_*.credits.json）と、検索ワードのオブジェクト（v2/public/objects/credits.json）
// - Wikipedia の引用：単語プールの全記事と「あなた（お前）」
// - フォント・ソフトウェアのライセンス（バージョンは node_modules から読む）
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
for (const [id, c] of Object.entries(JSON.parse(readFileSync('v2/public/objects/credits.json', 'utf8')))) add(id, 'model', c.name, c.authors, c.url, '検索ワードの物');

const KIND = { hdri: 'HDRI', model: '3Dモデル', texture: 'テクスチャ' };
const assetRows = [...assets.values()].sort((a, b) => (a.kind + a.name).localeCompare(b.kind + b.name))
  .map((a) => [KIND[a.kind] || a.kind, { text: a.name, url: a.url }, a.authors.join(', '), 'CC0', [...a.where].join('・')]);

const pool = JSON.parse(readFileSync('v2/src/data/pool.json', 'utf8'));
const omae = JSON.parse(readFileSync('v2/src/data/omae.json', 'utf8'));
const wikiRows = [...pool.words.map((w) => w.wiki), omae]
  .map((w) => [{ text: w.title, url: w.url }, 'CC BY-SA 4.0', w.retrieved]);

const ver = (p) => { try { return JSON.parse(readFileSync(`node_modules/${p}/package.json`, 'utf8')).version; } catch { return ''; } };
const SOFTWARE = [
  ['three.js', 'https://threejs.org/', ver('three'), 'MIT License', '3D の描画'],
  ['Draco', 'https://github.com/google/draco', '', 'Apache License 2.0', '3D モデルの圧縮の展開（three.js 同梱）'],
  ['opentype.js', 'https://opentype.js.org/', ver('opentype.js'), 'MIT License', '立体の文字・フォントのサブセット作成'],
  ['Vite', 'https://vite.dev/', ver('vite'), 'MIT License', '開発・ビルド'],
  ['glTF Transform', 'https://gltf-transform.dev/', ver('@gltf-transform/core'), 'MIT License', '3D モデルの軽量化（ビルド時）'],
  ['meshoptimizer', 'https://github.com/zeux/meshoptimizer', ver('meshoptimizer'), 'MIT License', 'ポリゴン削減（ビルド時）'],
  ['sharp', 'https://sharp.pixelplumbing.com/', ver('sharp'), 'Apache License 2.0', '画像の変換（ビルド時）'],
  ['Blender', 'https://www.blender.org/', '', 'GNU GPL', '部屋の生成とライトマップのベイク（制作に使ったツール。ゲームには含まれません）'],
];

// ---- 本文（Markdown と HTML の両方に書き出す）
// 段落の中のリンクは [文字](URL)、コードは `…` で書く
const SECTIONS = [
  {
    h: '3D素材（Poly Haven / CC0）',
    p: [
      'すべて [Poly Haven](https://polyhaven.com/) の CC0（パブリックドメイン相当）素材です。表示義務はありませんが、感謝を込めて記載します。',
      '検索ワードの物は、元のモデルを軽量化（ポリゴン削減・テクスチャ縮小）して使っています。',
    ],
    table: { head: ['種類', '素材', '作者', 'ライセンス', '使った場所'], rows: assetRows },
  },
  {
    h: '手続き生成したもの',
    p: [
      '次のものは外部の素材を使わず、プログラムでその場で作っています。',
    ],
    list: [
      '空間4の椅子・白衣・名札・扉・壁の印字',
      'みかん・磁石・竹・冷蔵庫・能面などの一部の物、張り紙・新聞・記録・ネオン・電光掲示板などの文字の見せ方',
      '最終空間の足跡・影・鏡',
      '部屋の畳・壁紙・黒板・本の背表紙のテクスチャ（`blender/gen_room_textures.py`。文字は含みません）',
    ],
  },
  {
    h: '文章の引用（Wikipedia）',
    p: [
      'リザルト画面では、日本語版ウィキペディアの記事冒頭の文を引用しています。',
      '引用文は REST API（`https://ja.wikipedia.org/api/rest_v1/page/summary/<タイトル>`）で取得したもので、[クリエイティブ・コモンズ 表示-継承 4.0 国際（CC BY-SA 4.0）](https://creativecommons.org/licenses/by-sa/4.0/deed.ja) の条件で利用しています。',
      '著作者はウィキペディアの各記事の執筆者です（各記事の履歴を参照）。',
    ],
    table: { head: ['記事', 'ライセンス', '取得日'], rows: wikiRows },
  },
  {
    h: 'フォント',
    list: [
      '張り紙・新聞・記録・立体の文字：[Noto Serif JP](https://github.com/notofonts/noto-cjk)（Google、[SIL Open Font License 1.1](fonts/OFL.txt)）。使う文字だけを抜き出したサブセット（`fonts/doc-serif.otf`）を同梱しています。',
      '画面の文字（メニュー・検索メモなど）は、お使いの端末に入っているフォントで表示しています。',
    ],
  },
  {
    h: '音',
    p: ['環境音・効果音はすべて Web Audio API でその場で合成しており、外部の音源ファイルは使っていません。'],
  },
  {
    h: 'ソフトウェア',
    table: {
      head: ['名前', 'バージョン', 'ライセンス', '使いみち'],
      rows: SOFTWARE.map(([n, url, v, lic, use]) => [{ text: n, url }, v || '—', lic, use]),
    },
  },
  {
    h: '制作に使ったサービス・ツール',
    list: [
      'ホスティング：[GitHub Pages](https://pages.github.com/)',
      '開発支援：[Claude Code](https://www.anthropic.com/claude-code)（Anthropic）— プログラムの作成・修正の補助',
    ],
  },
];

// ---- Markdown
const mdCell = (c) => (typeof c === 'object' ? `[${c.text}](${c.url})` : String(c)).replace(/\|/g, '\\|');
const md = [
  '# クレジット（食べ食べ空間 v2）',
  '',
  'このゲームで使っている外部の素材・引用・ソフトウェアと、そのライセンスの一覧です。',
  '（このファイルは `node v2/scripts/make-credits.mjs` で自動生成しています。サイト上では `credits.html` として表示します）',
  ...SECTIONS.flatMap((s) => [
    '', `## ${s.h}`, '',
    ...(s.p || []),
    ...(s.list ? [...(s.p ? [''] : []), ...s.list.map((l) => `- ${l}`)] : []),
    ...(s.table ? ['', `| ${s.table.head.join(' | ')} |`, `|${s.table.head.map(() => '---').join('|')}|`, ...s.table.rows.map((r) => `| ${r.map(mdCell).join(' | ')} |`)] : []),
  ]),
  '',
].join('\n');
writeFileSync('v2/public/CREDITS.md', md);

// ---- HTML（ゲームと同じ黒い画面に合わせる）
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
const htmlCell = (c) => (typeof c === 'object' ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.text)}</a>` : esc(c));
const body = SECTIONS.map((s) => `
  <section>
    <h2>${esc(s.h)}</h2>
    ${(s.p || []).map((p) => `<p>${inline(p)}</p>`).join('\n    ')}
    ${s.list ? `<ul>${s.list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>` : ''}
    ${s.table ? `<div class="scroll"><table><thead><tr>${s.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
${s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${htmlCell(c)}</td>`).join('')}</tr>`).join('\n')}
    </tbody></table></div>` : ''}
  </section>`).join('\n');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#050506" />
  <title>クレジット｜食べ食べ空間</title>
  <style>
    :root { --bg: #050506; --fg: #e9e6df; --dim: #9c988f; --line: rgba(233, 230, 223, 0.18); }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif; line-height: 1.75; font-size: 15px; }
    main { max-width: 920px; margin: 0 auto; padding: 48px 16px 80px; }
    .eyebrow { letter-spacing: 0.35em; font-size: 12px; color: var(--dim); margin: 0 0 8px; }
    h1 { font-family: "Hiragino Mincho ProN", "Yu Mincho", serif; font-weight: 500; font-size: 30px; margin: 0 0 12px; letter-spacing: 0.08em; }
    h2 { font-size: 13px; letter-spacing: 0.25em; color: var(--dim); font-weight: 500; margin: 48px 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
    p, li { color: var(--fg); }
    .lead { color: var(--dim); }
    a { color: var(--fg); text-underline-offset: 3px; text-decoration-color: rgba(233, 230, 223, 0.4); }
    a:hover { text-decoration-color: var(--fg); }
    code { font-size: 0.9em; background: rgba(233, 230, 223, 0.08); padding: 1px 5px; border-radius: 3px; word-break: break-all; }
    ul { padding-left: 1.3em; }
    .scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--dim); font-weight: 500; white-space: nowrap; }
    .back { display: inline-block; margin-top: 56px; color: var(--dim); }
  </style>
</head>
<body>
<main>
  <p class="eyebrow">CREDITS</p>
  <h1>食べ食べ空間</h1>
  <p class="lead">このゲームで使っている外部の素材・引用・ソフトウェアと、そのライセンスの一覧です。</p>
${body}
  <a class="back" href="./">← ゲームに戻る</a>
</main>
</body>
</html>
`;
writeFileSync('v2/public/credits.html', html);
console.log(`credits.html / CREDITS.md: 素材 ${assetRows.length} 件、記事 ${wikiRows.length} 件、ソフトウェア ${SOFTWARE.length} 件`);
