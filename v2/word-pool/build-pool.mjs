// verified.json（Wikipedia の検証結果）と search-words.mjs（検索ワード）から
// ゲームが読む単語プール v2/src/data/pool.json を作る。
//   node v2/word-pool/build-pool.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ANSWERS } from './answers.mjs';
import { SEARCH_WORDS, TIER_LABELS } from './search-words.mjs';

const verified = JSON.parse(readFileSync('v2/word-pool/verified.json', 'utf8'));
const byTitle = new Map(verified.filter((r) => r.ok).map((r) => [r.title, r]));
const today = new Date().toISOString().slice(0, 10);

// 回答の表記ゆれ（ゲーム側と同じ正規化）
const norm = (s) => (s || '').normalize('NFKC').toLowerCase()
  .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
  .replace(/[\s　・･「」『』（）()［］[\]【】、。，．,.!！?？"'“”‘’~〜～_\-－—―]/g, '');

const words = [];
const problems = [];
for (const [title, zones] of Object.entries(SEARCH_WORDS)) {
  const v = byTitle.get(title);
  if (!v) { problems.push(`${title}: 検証済みの記事にない`); continue; }
  const display = title.replace(/\s*\(.+\)$/, '');
  if (!(title in ANSWERS)) problems.push(`${title}: answers.mjs に正解の表記がない`);
  // リダイレクトは関連語も含むので使わず、answers.mjs で選んだ表記だけを認める
  const answers = [...new Set([display, v.query, v.reading, ...(ANSWERS[title] || [])].filter(Boolean))];
  const answerSet = new Set(answers.map(norm));
  for (const w of zones.flat()) {
    if (answerSet.has(norm(w))) problems.push(`${title}: 検索ワード「${w}」が答えと同じ`);
    // 答えを含む語（例: パラダイムシフト）も、読んだだけで答えが分かるので使わない
    else for (const a of answerSet) if (a.length >= 2 && norm(w).includes(a)) problems.push(`${title}: 検索ワード「${w}」が答え「${a}」を含む`);
  }
  if (zones.length !== 3 || zones.some((z) => z.length !== 3)) problems.push(`${title}: 検索ワードの数が 3×3 ではない`);
  words.push({
    tier: v.tier,
    answerName: display,
    answers,
    zones,
    wiki: {
      title: v.title,
      extract: (v.extract || '').match(/[^。]+。/g)?.slice(0, 3).join('') || v.extract,
      url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(v.title.replace(/ /g, '_'))}`,
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.ja',
      retrieved: today,
    },
  });
}
mkdirSync('v2/src/data', { recursive: true });
writeFileSync('v2/src/data/pool.json', JSON.stringify({ tiers: TIER_LABELS, words }, null, 1));
for (const t of [1, 2, 3, 4, 5]) console.log(`段階${t}: ${words.filter((w) => w.tier === t).length} 語`);
if (problems.length) { console.log('要確認:'); for (const p of problems) console.log(' -', p); }
