// 空間を表す言葉 → 部屋モジュール（blender/rooms/room_xxx.py）。
// 検索ワードにこれらの言葉があると、その区画のホワイトキューブの一部がそれに置き換わる
// （その言葉はオブジェクトや文書としては出さず、部屋そのものが手がかりになる）。
// 100 語の検索ワードに実際に出てくる言葉の部屋だけを作る（無理に増やさない）。
// depicts: 部屋そのものが何に見えるか。答えと同じなら使わない（例: 答えが「畳」のときに和室にしない）。
// 洞窟（room_cave）・渓谷（room_canyon）の部屋は、使う単語がプールにないので外してある（Blender のスクリプトは残してある）。
// 「夜」を含む言葉があると、その空間全体が深夜の美術館になる（NIGHT）。
export const ROOMS = [
  { id: 'washitsu', label: '和室', depicts: ['和室', '畳', '障子'], words: ['和室', '畳', '旅館', '座敷', '帖'] },
  { id: 'door', label: '扉', depicts: ['扉', '鍵'], words: ['扉', '戸締まり'] },
  { id: 'kids', label: '子ども部屋', depicts: ['子ども部屋'], words: ['子ども部屋', '子供部屋'] },
  { id: 'engawa', label: '縁側', depicts: ['縁側', '枯山水', '庭'], words: ['縁側', '軒下', '軒先', '庭先', '庭', '日本庭園', '庭園'] },
  { id: 'study', label: '書斎', depicts: ['書斎', '図書館', '本棚'], words: ['書斎', '本棚', '閲覧室', '古書', '蔵書'] },
  { id: 'classroom', label: '教室', depicts: ['教室', '黒板'], words: ['教室', '理科室', '実験室', '研究所', '理科'] },
  // 「空」：天井が食べられてなくなり、空が見える
  { id: 'sky', label: '空', depicts: ['空'], words: ['空'] },
];

// 答えごとに決めた部屋（検索ワードに空間の言葉がなくても、その区画の部屋を置き換える）
// { 答え: { 区画番号: 部屋の id } }
export const ANSWER_ROOMS = {
  けん玉: { 1: 'kids' },
};

export const NIGHT = (word) => word.includes('夜');

// 検索ワード（「和室　床材」のように全角スペースで並ぶこともある）から部屋を選ぶ。answer は答えの表記の一覧
export function roomFor(searchWord, answers = []) {
  for (const w of searchWord.split(/[\s　]+/)) {
    const r = ROOMS.find((x) => x.words.includes(w) && !x.depicts.some((d) => answers.includes(d)));
    if (r) return { room: r, word: w };
  }
  return null;
}
