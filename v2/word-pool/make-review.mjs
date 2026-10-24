// 単語プールの確認用ページを作る: node v2/word-pool/make-review.mjs <出力パス>
import { readFileSync, writeFileSync } from 'node:fs';
const pool = JSON.parse(readFileSync('v2/src/data/pool.json', 'utf8'));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ex = { 1: '洞窟・着物', 2: '灯台・万華鏡', 3: '蜃気楼・日時計', 4: 'ジャイロスコープ・活版印刷', 5: 'アセンブリ言語・掛詞' };
let sections = '';
for (const t of [1, 2, 3, 4, 5]) {
  const ws = pool.words.filter((w) => w.tier === t);
  const rows = ws.map((w) => {
    const alt = w.answers.filter((a) => a !== w.answerName);
    return `<tr><th scope="row"><a href="${esc(w.wiki.url)}" target="_blank" rel="noopener">${esc(w.answerName)}</a>${alt.length ? `<span class="alt" title="${esc(alt.join('、'))}">別表記 ${alt.length}</span>` : ''}</th>`
      + w.zones.map((z) => `<td>${z.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</td>`).join('') + '</tr>';
  }).join('');
  sections += `<section id="tier${t}" class="tier"><header class="tier-head"><p class="tier-no">空間 ${t}</p><h2>${esc(pool.tiers[t])}</h2><p class="tier-meta">${ws.length} 語 ・ 例：${ex[t]}</p></header>`
    + `<div class="scroll"><table><thead><tr><th scope="col">お題の単語</th><th scope="col">第1区画<small>雰囲気</small></th><th scope="col">第2区画<small>関連する物</small></th><th scope="col">第3区画<small>決定的な痕跡</small></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
const nav = [1, 2, 3, 4, 5].map((t) => `<a href="#tier${t}"><b>${t}</b><span>${esc(pool.tiers[t])}</span></a>`).join('');
const html = readFileSync('v2/word-pool/review-template.html', 'utf8').replace('<!--NAV-->', nav).replace('<!--SECTIONS-->', sections).replace('<!--COUNT-->', String(pool.words.length));
writeFileSync(process.argv[2], html);
console.log('ok', html.length);
