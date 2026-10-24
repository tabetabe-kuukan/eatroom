// 検索ワードが本当に答えへたどり着けるかを調べる。
//   node v2/word-pool/check-search.mjs
// 1. 根拠: 各検索ワードが答えの Wikipedia 記事の本文に出てくるか
// 2. 検索: 日本語版 Wikipedia の検索で、検索ワードから答えの記事が何位に出るか
//    - 第3区画の3語だけ / 9語すべて
// 出力: v2/word-pool/search-check.json
import { readFileSync, writeFileSync } from 'node:fs';

const pool = JSON.parse(readFileSync('v2/src/data/pool.json', 'utf8'));
const UA = { 'User-Agent': 'tabetabe-kukan/0.2 (search word check)' };
const API = 'https://ja.wikipedia.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(u) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(u, { headers: UA });
      if (r.status === 429) { await sleep(3000 * (i + 1)); continue; }
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}

const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/\s/g, '');
// 「」や説明的な語は、中身の語で本文を探す（例:「鍋が煮える」→ 鍋が煮える）
const core = (w) => w.replace(/[「」]/g, '');

async function fullText(title) {
  const d = await j(`${API}?action=query&format=json&prop=extracts&explaintext=1&titles=${encodeURIComponent(title)}`);
  if (!d) return null;
  const p = Object.values(d?.query?.pages || {})[0];
  return p?.extract || null;
}

async function rank(query, title) {
  const d = await j(`${API}?action=query&format=json&list=search&srlimit=50&srnamespace=0&srsearch=${encodeURIComponent(query)}`);
  if (!d || !d.query) return { rank: null, total: null, failed: true };
  const hits = d.query?.search || [];
  const i = hits.findIndex((h) => h.title === title);
  return { rank: i >= 0 ? i + 1 : null, total: d.query?.searchinfo?.totalhits ?? 0 };
}

const RECHECK = process.argv.includes('--recheck');
const prev = RECHECK ? JSON.parse(readFileSync('v2/word-pool/search-check.json', 'utf8')) : [];
const prevBy = new Map(prev.map((r) => [r.title, r]));
const suspicious = (r) => !r || r.found === 0 || r.zone3.total == null || r.all.total == null || r.zone3.failed || r.all.failed || r.zero.length > 0 || r.textFailed;
const GAP = RECHECK ? 1200 : 300;
const out = [];
for (const w of pool.words) {
  const title = w.wiki.title;
  if (RECHECK && !suspicious(prevBy.get(title))) { out.push(prevBy.get(title)); continue; }
  const raw = await fullText(title);
  const text = norm(raw || '');
  await sleep(GAP);
  const words = w.zones.flat();
  const inArticle = words.map((x) => ({ word: x, found: text.includes(norm(core(x))) }));
  const z3 = await rank(w.zones[2].map(core).join(' '), title);
  await sleep(GAP);
  const all = await rank(words.map(core).join(' '), title);
  await sleep(GAP);
  // 1語ずつの検索で、そもそも結果が出るか（0件の語がないか）
  const zero = [];
  const unknown = [];
  for (const x of words) {
    const d = await j(`${API}?action=query&format=json&list=search&srlimit=1&srnamespace=0&srinfo=totalhits&srsearch=${encodeURIComponent(core(x))}`);
    if (!d || !d.query) unknown.push(x);
    else if ((d.query.searchinfo?.totalhits ?? 0) === 0) zero.push(x);
    await sleep(RECHECK ? 500 : 150);
  }
  const rec = { tier: w.tier, answer: w.answerName, title, inArticle, found: inArticle.filter((x) => x.found).length, zone3: z3, all, zero, unknown, textFailed: raw == null };
  out.push(rec);
  console.log(`${w.tier} ${w.answerName.padEnd(12, '　')} 本文 ${rec.found}/9  第3区画→${z3.rank ?? '圏外'}位  9語→${all.rank ?? '圏外'}位 ${zero.length ? '0件:' + zero.join(',') : ''}`);
}
writeFileSync('v2/word-pool/search-check.json', JSON.stringify(out, null, 1));
