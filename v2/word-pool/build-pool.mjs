// verified.json（Wikipedia の検証結果）と search-words.mjs（検索ワード）から単語プールを作る。
//   node v2/word-pool/build-pool.mjs
// 書き出すもの
// - v2/src/data/pool.json  : ゲームが読む単語プール。答え・引用は平文で持たない（判定はハッシュ、引用は暗号化。src/game/secret.js）
// - v2/src/data/fixed.json : 空間 4「研究室」・空間 5「あなた」の答え（同じ形）
// - v2/word-pool/pool-plain.json : 平文の単語プール（確認用スクリプト・クレジット用。ゲームには入らない）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAnswer, seal } from '../src/game/secret.js';
import { SPECIALS } from '../objects/specials.mjs';
import { ANSWERS } from './answers.mjs';
import { ANSWER_ROOMS, FINAL_ANSWERS, LAB_SECRET, SPECIAL_ANSWERS } from './secret-rules.mjs';
import { SEARCH_WORDS, TIER_LABELS } from './search-words.mjs';
import { SELECTED } from './selection.mjs';

const verified = JSON.parse(readFileSync('v2/word-pool/verified.json', 'utf8'));
const byTitle = new Map(verified.filter((r) => r.ok).map((r) => [r.title, r]));
const today = new Date().toISOString().slice(0, 10);
// 引用を取得した日は、前に作ったプールの日付を引き継ぐ（作り直しただけで日付が変わらないように）
const prevPath = existsSync('v2/word-pool/pool-plain.json') ? 'v2/word-pool/pool-plain.json' : 'v2/src/data/pool.json';
const prevDates = new Map();
try { for (const w of JSON.parse(readFileSync(prevPath, 'utf8')).words) if (w.wiki?.retrieved) prevDates.set(w.wiki.title, w.wiki.retrieved); } catch { /* はじめて */ }

// 回答の表記ゆれ（ゲーム側と同じ正規化）
const norm = (s) => (s || '').normalize('NFKC').toLowerCase()
  .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
  .replace(/[\s　・･「」『』（）()［］[\]【】、。，．,.!！?？"'“”‘’~〜～_\-－—―]/g, '');

const words = [];
const problems = [];
for (const [title, zones] of Object.entries(SEARCH_WORDS)) {
  const v = byTitle.get(title);
  if (!v) { problems.push(`${title}: 検証済みの記事にない`); continue; }
  // 「天球儀 (恒星)」の後ろの括弧や「(90) アンティオペ」の頭の番号は表示しない
  const display = title.replace(/\s*\(.+\)$/, '').replace(/^\(\d+\)\s*/, '');
  // ゲームで使うのは selection.mjs で選んだ 100 語だけ
  if (!SELECTED[v.tier]?.includes(display)) continue;
  if (!(title in ANSWERS)) problems.push(`${title}: answers.mjs に正解の表記がない`);
  // リダイレクトは関連語も含むので使わず、answers.mjs で選んだ表記だけを認める
  const answers = [...new Set([display, v.query, v.reading, ...(ANSWERS[title] || [])].filter(Boolean))];
  const answerSet = new Set(answers.map(norm));
  // 「竹　羽　手」のように全角スペースで並べた語は、1語ずつ確かめる
  for (const w of zones.flat().flatMap((s) => s.split(/[\s　]+/).filter(Boolean))) {
    // 長音の有無だけ違う語（例: インターテクスチュアリティ）も答えと同じとみなす
    const noBar = (s) => s.replace(/ー/g, '');
    if (answerSet.has(norm(w)) || [...answerSet].some((a) => noBar(a) === noBar(norm(w)))) problems.push(`${title}: 検索ワード「${w}」が答えと同じ`);
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
      retrieved: prevDates.get(v.title) || today,
    },
  });
}
for (const [t, list] of Object.entries(SELECTED)) {
  for (const n of list) if (!words.some((w) => w.answerName === n && w.tier === +t)) problems.push(`selection.mjs: 段階${t}の「${n}」が見つからない`);
}
mkdirSync('v2/src/data', { recursive: true });
writeFileSync('v2/word-pool/pool-plain.json', JSON.stringify({ tiers: TIER_LABELS, words }, null, 1));

// ---- ゲームが読む形（答えを平文で持たない）
const pad = (n) => String(n).padStart(2, '0');
const sealed = [];
for (const [i, w] of words.entries()) {
  const entry = await seal(w.answers, { name: w.answerName, wiki: w.wiki });
  const tokens = w.zones.flat().flatMap((s) => s.split(/[\s　]+/).filter(Boolean));
  // この答えのときだけ使う特別な見せ方
  const specials = [...new Set(tokens.filter((t) => SPECIALS[t]?.gated && SPECIAL_ANSWERS[t] && isAnswer(entry, SPECIAL_ANSWERS[t])))];
  const rooms = Object.entries(ANSWER_ROOMS).find(([a]) => isAnswer(entry, a))?.[1];
  sealed.push({ id: `w${w.tier}${pad(i)}`, tier: w.tier, zones: w.zones, ...(specials.length ? { specials } : {}), ...(rooms ? { rooms } : {}), ...entry });
}
writeFileSync('v2/src/data/pool.json', JSON.stringify({ tiers: TIER_LABELS, words: sealed }));
const omae = JSON.parse(readFileSync('v2/src/data/omae.json', 'utf8'));
writeFileSync('v2/src/data/fixed.json', JSON.stringify({
  lab: await seal(LAB_SECRET.answers, LAB_SECRET.payload),
  final: await seal(FINAL_ANSWERS, { name: 'あなた', wiki: omae }),
}));
for (const t of [1, 2, 3, 4, 5]) console.log(`段階${t}: ${words.filter((w) => w.tier === t).length} 語`);
if (problems.length) { console.log('要確認:'); for (const p of problems) console.log(' -', p); }
