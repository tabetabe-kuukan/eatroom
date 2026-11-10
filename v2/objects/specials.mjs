// 文字ではなく、空間そのものの変化として見せる検索ワード。
//   type   : v2/src/engine/specials.js の見せ方
//   kinds  : 置ける面（wall = 壁 / end = 突き当たりの壁 / floor = 床 / ceiling = 天井 / table = 台）
//   gated  : 特定の答えのときだけ使う（どの答えかは v2/word-pool/secret-rules.mjs。ゲームには入れない）
export const SPECIALS = {
  黄色: { type: 'paint', color: '#f2c218', kinds: ['wall'], gated: true },
  銀板: { type: 'silver', kinds: ['wall', 'end', 'floor'] },
  北: { type: 'text', color: '#c8102e', style: 'vinyl', gated: true },
  日光: { type: 'sunbeam', kinds: ['floor'] },
  水: { type: 'water', kinds: ['floor'] },
  雨上がり: { type: 'puddle', kinds: ['floor'] },
  のぞく: { type: 'peephole', kinds: ['wall', 'end'] },
  覗く: { type: 'peephole', kinds: ['wall', 'end'] },
  幾何学模様: { type: 'wallpaper', kinds: ['wall'], gated: true },
  樹脂: { type: 'treehollow', kinds: ['floor'], gated: true },
};

// enabled: この答えで使える gated の言葉（単語プールの specials）
export function specialFor(word, enabled = []) {
  const s = SPECIALS[word];
  if (!s) return null;
  if (s.gated && !enabled.includes(word)) return null;
  return s;
}
