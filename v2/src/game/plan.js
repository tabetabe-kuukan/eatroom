// 1 回のプレイの組み立て。単語プールから段階1〜5の答えを 1 語ずつ選び、空間 1〜5 にする。
// 空間 6 は v1 と同じ「お前」。
//
// 空間 1〜5 の作り方（区画 1〜3 = 検索ワードの 3 つの組）
// - 区画の検索ワードに空間を表す言葉（和室・縁側など）があれば、その区画の部屋をそれに置き換える。
//   その言葉はオブジェクトや文書にはせず、部屋そのものが手がかりになる（区画に入るとメモに記録）
// - 残りの言葉は、名詞でライブラリに物があればオブジェクト、それ以外は張り紙・新聞・記録の中の言葉にする
// - オブジェクトのうち 1〜2 個を巨大化させる
// - 検索ワードに「夜」を含む言葉があれば、空間全体が深夜の美術館になる
import pool from '../data/pool.json';
import omae from '../data/omae.json';
import { OBJECTS, objectsFor } from '../../objects/library.mjs';
import { specialFor } from '../../objects/specials.mjs';
import { ANSWER_ROOMS, NIGHT, roomFor } from '../../objects/spaces.mjs';

const KEYS = ['left', 'table', 'right'];
const ZONE_NAMES = ['第1区画', '第2区画', '第3区画'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const split = (s) => s.split(/[\s　]+/).filter(Boolean);

// 痕跡を置ける面（物の place と、特別な見せ方の kinds から決める）。null はどこでもよい
const OBJ_BY_ID = new Map(OBJECTS.map((o) => [o.id, o]));
const PLACE_KINDS = { floor: ['floor', 'table'], wall: ['wall', 'end'] };
export function kindsFor(tokens) {
  let kinds = null;
  for (const t of tokens) {
    let k = null;
    if (t.special) k = { paint: ['wall'], wallpaper: ['wall'], silver: ['wall', 'end', 'floor'], sunbeam: ['floor'], water: ['floor'], puddle: ['floor'], peephole: ['wall', 'end'], treehollow: ['floor'] }[t.special];
    else if (t.object) {
      const o = OBJ_BY_ID.get(t.object);
      k = o.fill === 'ceiling' || o.giant === 'always' ? ['floor'] : PLACE_KINDS[o.place] || null;
    }
    if (k) kinds = kinds ? kinds.filter((x) => k.includes(x)) : k;
  }
  return kinds && kinds.length ? kinds : null;
}

function planSpace(w, index) {
  const answers = w.answers;
  const used = new Set();
  const night = w.zones.flat().some(NIGHT);
  const rooms = [];
  const zones = w.zones.map((words, zi) => {
    let room = 'white';
    let roomWord = null;
    for (const s of words) {
      const r = roomFor(s, answers);
      if (r) { room = r.room.id; roomWord = { search: s, word: r.word }; break; }
    }
    // 答えごとに決めた部屋（けん玉 → 子ども部屋 など）は、検索ワードを使わずに置き換える
    const fixedRoom = ANSWER_ROOMS[w.answerName]?.[zi + 1];
    if (fixedRoom && room === 'white') room = fixedRoom;
    rooms.push(room);
    const items = words.map((s, k) => {
      const tokens = split(s)
        .filter((t) => !(roomWord && roomWord.search === s && t === roomWord.word))
        .map((t) => {
          // 文字ではなく空間の変化で見せる言葉（黄色い壁・日光・水たまりなど）
          const sp = specialFor(t, answers);
          if (sp && sp.type !== 'text') return { word: t, special: sp.type };
          // 答えそのものに見える物、この空間ですでに使った物は使わない（「缶」と「飲料」が同じ缶にならないように）
          const objs = objectsFor(t).filter((o) => !o.depicts.some((d) => answers.includes(d)) && !used.has(o.id));
          if (objs.length && !sp) {
            const o = pick(objs);
            used.add(o.id);
            return { word: t, object: o.id, ...(o.giant === 'always' ? { giant: true } : {}) };
          }
          return sp ? { word: t, color: sp.color, style: sp.style } : { word: t };
        });
      return { text: s, key: KEYS[k], tokens, kinds: kindsFor(tokens), byRoom: tokens.length === 0 };
    });
    return { name: ZONE_NAMES[zi], room, roomWord: roomWord?.word || null, items };
  });
  // 巨大化：オブジェクトの中から 1〜2 個
  const objTokens = zones.flatMap((z) => z.items.flatMap((it) => it.tokens.filter((t) => t.object && !OBJ_BY_ID.get(t.object).fill)));
  const nGiant = Math.min(objTokens.length, Math.random() < 0.5 ? 1 : 2);
  for (let i = 0; i < nGiant; i++) {
    const cand = objTokens.filter((t) => !t.giant);
    if (cand.length) pick(cand).giant = true;
  }
  return {
    id: `s${index + 1}`,
    kind: 'rooms',
    tier: w.tier,
    answerName: w.answerName,
    answers,
    wiki: w.wiki,
    night,
    rooms,
    zones,
  };
}

// 空間 6「お前」。v1 と同じ答え・痕跡だが、空間は白い展示室にする。
// 痕跡は各国語の「お前」と、プレイヤー自身の記録（足跡・不正解の答え・何も映らない鏡）
const finalItem = (w) => ({ text: w, tokens: [{ word: w }], byRoom: false });
export const FINAL = {
  id: '06',
  kind: 'rooms',
  final: true,
  answerName: 'あなた',
  answers: ['あなた', '貴方', 'お前', 'おまえ', 'オマエ', '自分', 'わたし', '私', '俺', '僕'],
  wiki: omae,
  night: false,
  rooms: ['white', 'white', 'white'],
  zones: [
    { name: '第1区画', room: 'white', items: ['ty', 'vi', 'أنتَ／أنتِ'].map(finalItem) },
    { name: '第2区画', room: 'white', items: ['ci', 'wewe', '너'].map(finalItem) },
    // 第3区画の「You」は、出口の鏡の隣に作品名の札（キャプション）として掛かっている
    { name: '第3区画', room: 'white', items: [{ text: 'You', tokens: [{ word: 'YOU', special: 'caption' }], byRoom: false, fixed: 'mirror' }] },
  ],
};

// 段階ごとに「山札」を作って順に引く。山札が尽きるまで同じ単語は出ないので、すべての単語がまんべんなく出る。
// 山札はブラウザに保存する（はじめからを繰り返しても続きから引く）。単語プールが変わった分は入れ直す
const BAG_KEY = 'tabetabe-kukan:v2:bag';
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function loadBags() {
  try { return JSON.parse(localStorage.getItem(BAG_KEY)) || {}; } catch { return {}; }
}
function saveBags(bags) {
  try { localStorage.setItem(BAG_KEY, JSON.stringify(bags)); } catch { /* 保存できなくても遊べる */ }
}
function draw(bags, tier) {
  const names = pool.words.filter((w) => w.tier === tier).map((w) => w.answerName);
  const bag = (bags[tier] || { deck: [], last: null });
  bag.deck = bag.deck.filter((n) => names.includes(n));   // プールから外した単語は捨てる
  if (!bag.deck.length) {
    bag.deck = shuffle([...names]);
    // 山札の切れ目で、直前と同じ単語が続かないようにする
    if (bag.deck.length > 1 && bag.deck[0] === bag.last) bag.deck.push(bag.deck.shift());
  }
  const name = bag.deck.shift();
  bag.last = name;
  bags[tier] = bag;
  return pool.words.find((w) => w.answerName === name);
}

export function makePlan() {
  const bags = loadBags();
  const spaces = [1, 2, 3, 4, 5].map((t, i) => planSpace(draw(bags, t), i));
  saveBags(bags);
  return [...spaces, FINAL];
}

// 空間ごとの検索ワード（メモに並ぶ単位）
export function memoWords(space) {
  return space.zones.flatMap((z) => z.items.map((it) => it.text ?? it.words.join('・')));
}

// 白い展示室の見た目（昼 / 深夜の美術館）
export const LOOK_DAY = {
  exposure: 0.48,
  fog: { color: 0xe9e8e4, density: 0.008 },
  background: 'fog', envIntensity: 0.35,
  lightmapBoost: 1.0, vlitBoost: 1.0,
  bloom: { strength: 0.15, radius: 0.4, threshold: 10.0 },
  flicker: null,
  grain: 0.03, vignette: 0.6, aberration: 0.0006,
};
export const LOOK_NIGHT = {
  ...LOOK_DAY,
  exposure: 1.4,
  fog: { color: 0x05060a, density: 0.012 },
  envIntensity: 0.02,
  bloom: { strength: 0.5, radius: 0.5, threshold: 0.8 },
  grain: 0.05, vignette: 0.9,
};
