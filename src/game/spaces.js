// 各空間の設計データ（人が設計する部分）。
// お題・検索ワード・正解の表記・Wikipedia の記事タイトルはここだけで管理する。
// 空間の形（3D モデル）は blender/spaces/ のスクリプトが生成し、
// 痕跡の位置は書き出された space??.json の traces に入っている（id で対応）。

export const SPACES = [
  {
    id: '01',
    answerName: 'ツチノコ',
    wiki: 'ツチノコ',
    answers: ['ツチノコ', '槌の子', '槌ノ子', 'ノヅチ', '野槌'],
    zones: [
      { name: '第1区画', traces: [{ id: 'rindo', words: ['林道'] }, { id: 'yamaoku', words: ['山奥'] }, { id: 'kusamura', words: ['草むら'] }] },
      { name: '第2区画', traces: [{ id: 'kenshokin', words: ['懸賞金'] }, { id: 'wana', words: ['捕獲', '罠'] }] },
      { name: '第3区画', traces: [{ id: 'hebi', words: ['蛇'] }, { id: 'chizu', words: ['跳ねる', 'UMA'] }] },
    ],
    look: {
      exposure: 1.2,
      fog: { color: 0x58634f, density: 0.04 },
      background: 'hdri', backgroundBlur: 0.3, backgroundIntensity: 0.55,
      envIntensity: 0.3,
      lightmapBoost: 1.0, vlitBoost: 1.6,
      bloom: { strength: 0.35, radius: 0.6, threshold: 0.85 },
      flicker: 'clouds',
      grain: 0.05, vignette: 0.9, aberration: 0.0012,
    },
    audio: { ambience: 'summer_forest', steps: 'dirt', reverb: 0.05 },
  },
  {
    id: '02',
    answerName: 'きさらぎ駅',
    wiki: 'きさらぎ駅',
    answers: ['きさらぎ駅', 'きさらぎえき', '如月駅', 'きさらぎ', 'キサラギ駅'],
    zones: [
      { name: '第1区画', traces: [{ id: 'shinya', words: ['深夜'] }, { id: 'shuden', words: ['終電'] }, { id: 'densha', words: ['電車'] }] },
      { name: '第2区画', traces: [{ id: 'mujineki', words: ['無人駅'] }, { id: 'taiko', words: ['太鼓の音'] }, { id: 'kengai', words: ['圏外', '携帯電話'] }] },
      { name: '第3区画', traces: [{ id: 'ekimei', words: ['駅', '存在しない'] }, { id: 'bbs', words: ['2ちゃんねる'] }, { id: 'tunnel', words: ['トンネル', '異界'] }] },
    ],
    look: {
      exposure: 1.0,
      fog: { color: 0x05070a, density: 0.035 },
      background: 'fog', envIntensity: 0.05,
      lightmapBoost: 0.55, vlitBoost: 1.0,
      bloom: { strength: 0.3, radius: 0.4, threshold: 10.0 },
      flicker: 'fluorescent',
      grain: 0.08, vignette: 1.1, aberration: 0.0018,
    },
    audio: { ambience: 'night_train', steps: 'hard', reverb: 0.25 },
  },
  {
    id: '03',
    answerName: '鮫島事件',
    wiki: '鮫島事件',
    answers: ['鮫島事件', 'さめじまじけん', '鮫島', 'サメジマ事件'],
    zones: [
      { name: '第1区画', traces: [{ id: 'keijiban', words: ['掲示板'] }, { id: 'shinya', words: ['深夜'] }, { id: 'kakikomi', words: ['書き込み'] }] },
      { name: '第2区画', traces: [{ id: 'sakujo', words: ['削除済み'] }, { id: 'kuronuri', words: ['黒塗り'] }, { id: 'massho', words: ['抹消'] }] },
      { name: '第3区画', traces: [{ id: 'ni_channel', words: ['2ちゃんねる'] }, { id: 'inpei', words: ['隠蔽'] }, { id: 'fureru', words: ['触れてはいけない'] }] },
    ],
    look: {
      exposure: 2.0, emissiveMax: 0.55,
      fog: { color: 0x06070a, density: 0.04 },
      background: 'fog', envIntensity: 0.1,
      lightmapBoost: 1.0, vlitBoost: 1.0,
      bloom: { strength: 0.35, radius: 0.5, threshold: 6.0 },
      flicker: 'monitor',
      grain: 0.09, vignette: 1.15, aberration: 0.002,
    },
    audio: { ambience: 'netcafe', steps: 'carpet', reverb: 0.2 },
  },
  {
    id: '04',
    answerName: 'サンチアゴ航空513便事件',
    wiki: 'サンチアゴ航空513便事件',
    answers: ['サンチアゴ航空513便事件', 'サンチアゴ航空513便', 'サンチアゴ航空', 'サンティアゴ航空513便事件',
      'サンティアゴ航空513便', 'サンチャゴ航空513便事件', 'サンチアゴ513便', '513便事件', '513便'],
    zones: [
      { name: '第1区画', traces: [{ id: 'kuko', words: ['空港'] }, { id: 'kassoro', words: ['滑走路'] }, { id: 'koku', words: ['航空'] }, { id: 'propeller', words: ['プロペラ機'] }] },
      { name: '第2区画', traces: [{ id: 'y1954', words: ['1954年'] }, { id: 'aachen', words: ['アーヘン'] }, { id: 'fumei', words: ['消息不明'] }] },
      { name: '第3区画', traces: [{ id: 'y1989', words: ['1989年'] }, { id: 'porto', words: ['ポルトアレグレ'] }, { id: 'hakkotsu', words: ['白骨'] }, { id: 'jokyaku', words: ['乗客'] }] },
    ],
    look: {
      exposure: 1.0,
      fog: { color: 0x0b0d10, density: 0.035 },
      background: 'fog', envIntensity: 0.15,
      lightmapBoost: 1.0, vlitBoost: 1.0,
      bloom: { strength: 0.3, radius: 0.5, threshold: 8.0 },
      flicker: 'fluorescent',
      grain: 0.07, vignette: 1.0, aberration: 0.0015,
    },
    audio: { ambience: 'airport', steps: 'hard', reverb: 0.35 },
  },
  {
    id: '05',
    answerName: 'メリーさんの電話',
    wiki: 'メリーさんの電話',
    answers: ['メリーさんの電話', 'メリーさん', 'メリー', 'メリーさん電話', 'メリーさんからの電話'],
    zones: [
      { name: '第1区画', traces: [{ id: 'gomi', words: ['ゴミ'] }, { id: 'hikkoshi', words: ['引っ越し'] }, { id: 'ningyo', words: ['人形'] }] },
      { name: '第2区画', traces: [{ id: 'koshu', words: ['公衆電話', '電話'] }, { id: 'seiyo', words: ['西洋人形'] }] },
      { name: '第3区画', traces: [{ id: 'imadoko', words: ['今どこにいるの'] }, { id: 'chikazuku', words: ['だんだん近づく'] }, { id: 'ushiro', words: ['あなたの後ろ'] }] },
    ],
    look: {
      exposure: 1.0,
      fog: { color: 0x07080b, density: 0.05 },
      background: 'fog', envIntensity: 0.1,
      lightmapBoost: 1.0, vlitBoost: 1.0,
      bloom: { strength: 0.35, radius: 0.5, threshold: 6.0 },
      flicker: 'fluorescent',
      grain: 0.09, vignette: 1.15, aberration: 0.0018,
    },
    audio: { ambience: 'night_town', steps: 'hard', reverb: 0.2, ringOnZone: true },
  },
  {
    id: '06',
    answerName: 'お前',
    wiki: 'お前',
    final: true,
    answers: ['お前', 'おまえ', 'オマエ', 'あなた', '自分', 'わたし', '私', '俺', '僕'],
    zones: [
      { name: '第1区画', traces: [{ id: 'ty', words: ['ty'] }, { id: 'vi', words: ['vi'] }, { id: 'anta', words: ['أنتَ／أنتِ'] }] },
      { name: '第2区画', traces: [{ id: 'ci', words: ['ci'] }, { id: 'wewe', words: ['wewe'] }, { id: 'neo', words: ['너'] }] },
      { name: '第3区画', traces: [{ id: 'you', words: ['You'] }] },
    ],
    look: {
      exposure: 1.0,
      fog: { color: 0x0d1a1a, density: 0.03 },
      background: 'fog', envIntensity: 0.25,
      lightmapBoost: 1.0, vlitBoost: 1.0,
      bloom: { strength: 0.3, radius: 0.5, threshold: 8.0 },
      flicker: 'fluorescent',
      grain: 0.06, vignette: 1.0, aberration: 0.0012,
    },
    audio: { ambience: 'pool', steps: 'tile', reverb: 0.5 },
  },
];

export const allWords = (space) => space.zones.flatMap((z) => z.traces.flatMap((t) => t.words));
