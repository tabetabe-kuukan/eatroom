// 文字ではなく、空間そのものの変化として見せる検索ワード。
//   type   : v2/src/engine/specials.js の見せ方
//   kinds  : 置ける面（wall = 壁 / end = 突き当たりの壁 / floor = 床 / ceiling = 天井 / table = 台）
//   answer : その答えのときだけ（省略するとどの答えでも）
export const SPECIALS = {
  黄色: { type: 'paint', color: '#f2c218', kinds: ['wall', 'end'], answer: '琥珀' },
  銀板: { type: 'silver', kinds: ['wall', 'end', 'floor'] },
  北: { type: 'text', color: '#c8102e', style: 'vinyl', answer: '方位磁針' },
  日光: { type: 'sunbeam', kinds: ['floor'] },
  水: { type: 'water', kinds: ['floor'] },
  のぞく: { type: 'peephole', kinds: ['wall', 'end'] },
  覗く: { type: 'peephole', kinds: ['wall', 'end'] },
};

export function specialFor(word, answers = []) {
  const s = SPECIALS[word];
  if (!s) return null;
  if (s.answer && !answers.includes(s.answer)) return null;
  return s;
}
