// 段階ごとの候補単語を Wikipedia で検証し、冒頭文と別表記（リダイレクト）を集める。
//   node v2/word-pool/verify.mjs
// 段階（知名度）の定義:
//   1 = 誰もが日常的に知っている一般名詞（洞窟・着物）
//   5 = 専門用語（アセンブリ言語・ペルチェ素子）
// 出力: v2/word-pool/verified.json
import { writeFileSync } from 'node:fs';

const TIERS = {
  1: ['洞窟', '着物', '傘', '鏡', '時計', '自転車', '雪だるま', '風鈴', '提灯', '金魚', 'サクラ', '炬燵', '団扇', '箸', '鍵', '枕',
    '階段', '井戸', '畳', '障子', '花火', 'タケ', 'ろうそく', '鉛筆', '地図', 'はしご', '虹', '鈴', '凧', '風呂', '図書館', '自動販売機',
    '冷蔵庫', '踏切', '眼鏡', '布団'],
  2: ['灯台', '万華鏡', '風見鶏', '水車', '砂時計', '羅針盤', '灯籠', '噴水', '観覧車', '吊り橋', '熱気球', '天文台', '地球儀', '蓄音機',
    'オルゴール', '盆栽', '招き猫', '達磨', '扇子', '鯉のぼり', '蚊帳', '風車', 'ランプ', '公衆電話', '鉄塔', '棚田', '竹とんぼ', 'けん玉',
    '水族館', '温泉', '屋台', 'ブランコ', '鳩時計', 'ろくろ', '囲炉裏', '蒸気機関車'],
  3: ['蜃気楼', '日時計', '化石', '鍾乳洞', '間欠泉', 'オーロラ', '年輪', '振り子', '天秤', 'プリズム', '顕微鏡', 'てこ', '滑車', '光合成',
    '渡り鳥', '冬眠', '琥珀', '隕石', '彗星', '日食', '潮汐', 'サンゴ礁', '氷河', '砂丘', 'ホタル', '擬態', '食物連鎖', '結晶', '静電気',
    '地層', '三角州', '偏西風', '月食', '磁石', '雷', 'ステンドグラス'],
  4: ['ジャイロスコープ', '活版印刷', '天球儀', 'アストロラーベ', 'テルミン', '真空管', 'ダゲレオタイプ', 'カメラ・オブスクラ', 'からくり人形',
    '風洞', '六分儀', '潜望鏡', 'フーコーの振り子', '気圧計', '地震計', '渾天儀', '計算尺', 'テスラコイル', 'ゾートロープ', '幻灯機', '金継ぎ',
    '寄木細工', '江戸切子', '枯山水', '根付', '水琴窟', '鹿威し', 'オートマタ', 'タイプライター', 'モールス符号', '鉱石ラジオ', 'ホログラフィー',
    '和時計', '実体鏡', '音叉', '活字'],
  5: ['アセンブリ言語', 'ペルチェ素子', 'トライボロジー', 'エアロゲル', 'スピントロニクス', '射出成形', 'ホール効果', 'ゼーベック効果', '超伝導',
    'ジョセフソン効果', '圧電効果', '量子ドット', 'カーボンナノチューブ', 'ゼオライト', '形状記憶合金', 'フォトリソグラフィ', 'ベンチュリ効果',
    'カルマン渦', 'レイノルズ数', 'マイスナー効果', 'ヒートパイプ', 'スターリングエンジン', '量子もつれ', '浮動小数点数', 'ハッシュ関数',
    '正規表現', 'ガベージコレクション', 'コンパイラ', '誘導加熱', 'レーザー冷却', '真空蒸着', 'ファラデーケージ', 'トンネル効果', '黒体放射',
    '有機エレクトロルミネッセンス', 'ジャイロトロン'],
};

// 人物・出来事・事件・作品などを除く（collect.mjs と同じ方針）
const EXCLUDE_P31 = new Set(['Q5', 'Q15632617', 'Q95074', 'Q1190554', 'Q1656682', 'Q3839081', 'Q83267', 'Q198', 'Q178561', 'Q171558',
  'Q8065', 'Q13406463', 'Q4167410', 'Q4830453', 'Q783794', 'Q43229', 'Q5398426', 'Q15416', 'Q7725634', 'Q11424', 'Q7889']);
const UA = { 'User-Agent': 'tabetabe-kukan/0.2 (word pool builder)' };
const API = 'https://ja.wikipedia.org/w/api.php';
const j = async (u) => {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(u, { headers: UA }); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
  }
  return {};
};

function firstSentences(text, max = 3) {
  const parts = (text || '').replace(/\s+/g, ' ').match(/[^。]+。/g) || [text];
  return parts.slice(0, max).join('').trim();
}

// --retry: 前回の結果を読み、取得に失敗したもの（記事なし）だけをゆっくり取り直す
const RETRY = process.argv.includes('--retry');
const prev = RETRY ? JSON.parse((await import('node:fs')).readFileSync('v2/word-pool/verified.json', 'utf8')) : [];
const out = RETRY ? prev.filter((r) => r.reason !== '記事なし') : [];
const todo = RETRY ? prev.filter((r) => r.reason === '記事なし').map((r) => [r.tier, r.query]) : Object.entries(TIERS).flatMap(([t, ws]) => ws.map((w) => [t, w]));
const TODO_BY_TIER = {};
for (const [t, w] of todo) (TODO_BY_TIER[t] ||= []).push(w);
for (const [tier, words] of Object.entries(TODO_BY_TIER)) {
  for (const w of words) {
    if (RETRY) await new Promise((res) => setTimeout(res, 1500));
    const d = await j(`${API}?action=query&format=json&redirects=1&titles=${encodeURIComponent(w)}&prop=pageprops|extracts|redirects&ppprop=wikibase_item|disambiguation&exintro=1&explaintext=1&rdlimit=60&rdnamespace=0`);
    const p = Object.values(d.query?.pages || {})[0];
    const rec = { tier: Number(tier), query: w, ok: false };
    if (!p || p.missing !== undefined) { rec.reason = '記事なし'; out.push(rec); continue; }
    if (p.pageprops?.disambiguation !== undefined) { rec.reason = '曖昧さ回避'; out.push(rec); continue; }
    rec.title = p.title;
    rec.qid = p.pageprops?.wikibase_item;
    rec.extract = firstSentences(p.extract, 4);
    rec.redirects = (p.redirects || []).map((r) => r.title).filter((t) => t.length <= 16 && !/[（(]/.test(t));
    const reading = (p.extract || '').match(/^[^（(]{0,30}[（(]([ぁ-んァ-ヶー・\s]+)[、,）)]/);
    rec.reading = reading ? reading[1].replace(/\s/g, '') : null;
    out.push(rec);
  }
}
// Wikidata の分類で除外
const qids = out.filter((r) => r.qid).map((r) => r.qid);
for (let i = 0; i < qids.length; i += 50) {
  const d = await j(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${qids.slice(i, i + 50).join('|')}`);
  for (const r of out) {
    const e = d.entities?.[r.qid];
    if (!e) continue;
    r.p31 = (e.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
  }
}
for (const r of out) {
  if (r.title && (!r.reason || r.reason === '分類で除外')) {
    delete r.reason;
    if ((r.p31 || []).some((q) => EXCLUDE_P31.has(q))) r.reason = '分類で除外';
    else r.ok = true;
  }
}
writeFileSync('v2/word-pool/verified.json', JSON.stringify(out, null, 1));
for (const t of [1, 2, 3, 4, 5]) {
  const ok = out.filter((r) => r.tier === t && r.ok);
  const ng = out.filter((r) => r.tier === t && !r.ok);
  console.log(`段階${t}: OK ${ok.length} / NG ${ng.map((r) => `${r.query}(${r.reason})`).join(' ')}`);
  console.log('   ', ok.map((r) => (r.title === r.query ? r.title : `${r.query}→${r.title}`)).join(' '));
}
