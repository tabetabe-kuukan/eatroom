// ビルド時に日本語版 Wikipedia の記事冒頭を取得して src/data/wiki.json に保存する。
// 実行時には取得しない。オフラインで失敗した場合は既存の wiki.json をそのまま使う。
//   node scripts/fetch-wiki.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SPACES } from '../src/game/spaces.js';

const OUT = 'src/data/wiki.json';
const UA = 'tabetabe-kukan/0.1 (student project; build-time fetch)';
const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const out = {};
const today = new Date().toISOString().slice(0, 10);

// 冒頭の 1〜3 文（長すぎる場合は 2 文まで）
function firstSentences(text) {
  const parts = text.replace(/\s+/g, ' ').match(/[^。]+。/g) || [text];
  let res = '';
  for (const p of parts.slice(0, 3)) {
    if (res && (res + p).length > 220) break;
    res += p;
  }
  return res.trim();
}

let failed = false;
for (const s of SPACES) {
  const url = `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(s.wiki)}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (d.type !== 'standard') throw new Error(`type=${d.type}`);
    out[s.wiki] = {
      title: d.title,
      requested: s.wiki,
      extract: firstSentences(d.extract),
      url: d.content_urls?.desktop?.page || `https://ja.wikipedia.org/wiki/${encodeURIComponent(d.title)}`,
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.ja',
      retrieved: today,
    };
    console.log(`✓ ${s.wiki} → ${d.title}`);
  } catch (e) {
    failed = true;
    if (old[s.wiki]) {
      out[s.wiki] = old[s.wiki];
      console.warn(`! ${s.wiki}: ${e.message}（前回取得分 ${old[s.wiki].retrieved} を使用）`);
    } else {
      console.error(`✗ ${s.wiki}: ${e.message}`);
    }
  }
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
if (failed && Object.keys(out).length < SPACES.length) process.exit(1);
