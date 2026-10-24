// 単語プールの候補を集める（人が最終確認する前の下ごしらえ）。
//   node scripts/word-pool/collect.mjs
// - 「すべての言語版にあるべき項目の一覧」のリンク先（よく知られた単語）
// - ランダムな記事（あまり知られていない単語）
// を集め、Wikidata の分類で人物・出来事・事件などを除き、月間閲覧数（知名度）を測って
// scripts/word-pool/candidates.json に書き出す。
import { mkdirSync, writeFileSync } from 'node:fs';

const UA = { 'User-Agent': 'tabetabe-kukan/0.2 (word pool builder)' };
const API = 'https://ja.wikipedia.org/w/api.php';
const j = async (u) => {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(u, { headers: UA }); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return {};
};

// Wikidata の P31（何であるか）でこれらを含むものは除く
export const EXCLUDE_P31 = new Set([
  'Q5', 'Q15632617', 'Q95074', 'Q4271324',                 // 人物・架空の人物・神話上の人物
  'Q1190554', 'Q1656682', 'Q3839081', 'Q83267', 'Q198', 'Q178561', 'Q171558', 'Q8065', 'Q2223653', 'Q1361229', // 出来事・事件・災害・戦争・事故
  'Q13406463', 'Q4167410', 'Q11753321',                    // 一覧・曖昧さ回避・ナビゲーション
  'Q577', 'Q3186692', 'Q47150325', 'Q27020041', 'Q18536594', // 年・暦・競技会
  'Q4830453', 'Q783794', 'Q43229', 'Q163740', 'Q891723',    // 企業・会社・組織（実在の団体）
  'Q5398426', 'Q15416', 'Q21191270', 'Q1259759',           // テレビ番組・ドラマ
  'Q7725634', 'Q47461344', 'Q482994', 'Q134556', 'Q105543609', 'Q7366', // 作品（小説・アルバム・曲）
  'Q2188189', 'Q11424', 'Q24862', 'Q506240', 'Q1107', 'Q7889', // 映画・アニメ・ゲーム
  'Q55488', 'Q4663385', 'Q928830', 'Q3917681', 'Q35054', 'Q3914', 'Q9842', 'Q9826', 'Q5358913', // 駅・学校・郵便局など特定の施設
  'Q476028', 'Q847017', 'Q13393265', 'Q12973014',          // スポーツクラブ・チーム
  'Q17537576', 'Q1002954', 'Q5', 'Q3305213', 'Q838948',      // 特定の作品・絵画
]);
export const BAD_TITLE = /殺|死|事件|事故|災害|戦争|虐|自殺|遺体|テロ|爆撃|性的|性行為|処刑|拷問|病|症|疾患|障害|薬物|麻薬|一覧|年$|月\d+日|の戦い|^\d|選挙|内閣|政権|宗教|教団|派$|党$|^第\d|（|\(|・.+・/;

async function vitalLinks() {
  const out = [];
  let cont = '';
  for (let i = 0; i < 10; i++) {
    const d = await j(`${API}?action=query&format=json&titles=${encodeURIComponent('Wikipedia:すべての言語版にあるべき項目の一覧')}&prop=links&plnamespace=0&pllimit=500${cont}`);
    for (const p of Object.values(d.query?.pages || {})) for (const l of p.links || []) out.push(l.title);
    if (!d.continue) break;
    cont = `&plcontinue=${encodeURIComponent(d.continue.plcontinue)}`;
  }
  return out;
}

// よく知られた記事からリンクされている記事（知名度が中〜低めの、具体的な単語が多い）
async function linkedFrom(titles, perPage = 120) {
  const out = [];
  for (const t of titles) {
    const d = await j(`${API}?action=query&format=json&titles=${encodeURIComponent(t)}&prop=links&plnamespace=0&pllimit=${perPage}`);
    for (const p of Object.values(d.query?.pages || {})) for (const l of p.links || []) out.push(l.title);
  }
  return out;
}

async function randomTitles(n) {
  const out = [];
  while (out.length < n) {
    const d = await j(`${API}?action=query&format=json&generator=random&grnnamespace=0&grnlimit=50&prop=info`);
    for (const p of Object.values(d.query?.pages || {})) if (p.length > 6000) out.push(p.title);
  }
  return out;
}

async function details(titles) {
  // ページ情報・Wikidata の ID・リダイレクトの解決を 50 件ずつ
  const out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const d = await j(`${API}?action=query&format=json&redirects=1&prop=pageprops|info&ppprop=wikibase_item|disambiguation&titles=${encodeURIComponent(chunk.join('|'))}`);
    for (const p of Object.values(d.query?.pages || {})) {
      if (p.missing !== undefined || p.pageprops?.disambiguation !== undefined || !p.pageprops?.wikibase_item) continue;
      out.push({ title: p.title, qid: p.pageprops.wikibase_item, length: p.length });
    }
  }
  return out;
}

async function p31(qids) {
  const out = {};
  for (let i = 0; i < qids.length; i += 50) {
    const d = await j(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${qids.slice(i, i + 50).join('|')}`);
    for (const [q, e] of Object.entries(d.entities || {})) out[q] = (e.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
  }
  return out;
}

async function monthlyViews(title) {
  const u = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ja.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/monthly/2026070100/2026093000`;
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(u, { headers: UA });
      if (r.status === 429) { await new Promise((res) => setTimeout(res, 2000 * (i + 1))); continue; }
      if (r.status === 404) return 0;
      const d = await r.json();
      const items = d.items || [];
      return items.length ? Math.round(items.reduce((a, b) => a + b.views, 0) / items.length) : 0;
    } catch { await new Promise((res) => setTimeout(res, 1500)); }
  }
  return null; // 取得失敗
}

const vital = await vitalLinks();
console.log('vital links', vital.length);
// 具体的な物が多い記事から、リンク先を集める（乱数で 150 記事）
const seeds = vital.filter((t) => !BAD_TITLE.test(t)).sort(() => Math.random() - 0.5).slice(0, 150);
const linked = await linkedFrom(seeds);
console.log('linked', linked.length);
const all = [...new Set([...vital, ...linked])].filter((t) => !BAD_TITLE.test(t));
const det = await details(all);
const cls = await p31(det.map((d) => d.qid));
const kept = det.filter((d) => (cls[d.qid] || []).length && !(cls[d.qid] || []).some((q) => EXCLUDE_P31.has(q)) && !BAD_TITLE.test(d.title));
console.log('kept', kept.length);
for (let i = 0; i < kept.length; i += 6) {
  await Promise.all(kept.slice(i, i + 6).map(async (k) => { k.monthly = await monthlyViews(k.title); }));
  if (i % 300 === 0) console.log('views', i, '/', kept.length);
}
const failed = kept.filter((k) => k.monthly === null).length;
console.log('views failed', failed);
for (const k of kept) { k.p31 = cls[k.qid]; k.source = vital.includes(k.title) ? 'vital' : 'linked'; }
kept.sort((a, b) => a.monthly - b.monthly);
mkdirSync('scripts/word-pool', { recursive: true });
writeFileSync('scripts/word-pool/candidates.json', JSON.stringify(kept, null, 1));
console.log('wrote', kept.length);
