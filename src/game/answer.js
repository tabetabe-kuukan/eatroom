// 回答の表記ゆれを吸収する。
// - 全角/半角（NFKC）
// - ひらがな/カタカナ（カタカナに寄せる）
// - 空白・記号（・「」など）
// - 英字の大文字/小文字
export function normalize(s) {
  return (s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s　・･「」『』（）()［］\[\]【】、。，．,.!！?？"'“”‘’~〜～_\-－—―]/g, '');
}

export function isCorrect(space, input) {
  const n = normalize(input);
  if (!n) return false;
  return space.answers.some((a) => normalize(a) === n);
}
