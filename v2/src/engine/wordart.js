// 抽象的な言葉（オブジェクトにならない検索ワード）の見せ方。展示室に「展示されていた言葉」が食べられかけている。
// - vinyl   : 壁に直接貼られた大きな切り文字。所々かじられ、欠けた文字が下に落ちている
// - neon    : ネオンサイン。一部の文字は切れていて、ときどき瞬く
// - led     : 電光掲示板。言葉が流れ続ける
// - frame   : 中身が食べられて空っぽの額縁と、作品名の札（キャプション）
// - floor   : 床に象嵌された巨大な文字。半分ほど床に沈んでいる
// - paper   : 張り紙・新聞・記録（台や床の上）
// どれも白い壁の上で読めるよう、濃い色か発光で描く。
import opentype from 'opentype.js';
import * as THREE from 'three';
import { DOC_LABELS } from '../game/doc-text.js';

export const SERIF = '"TabetabeDocSerif","Hiragino Mincho ProN","Yu Mincho",serif';
const SANS = '"Hiragino Sans","Yu Gothic","BIZ UDGothic",sans-serif';
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function canvasTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function fitFont(g, text, maxW, size, family, weight = 'bold') {
  g.font = `${weight} ${size}px ${family}`;
  while (g.measureText(text).width > maxW && size > 24) { size -= 4; g.font = `${weight} ${size}px ${family}`; }
  return size;
}

// ---------------------------------------------------------------- 切り文字（かじられている）
function vinylTexture(text, { color = '#151311', bites = true } = {}) {
  const chars = [...text];
  const size = 220;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `bold ${size}px ${SERIF}`;
  const tw = g.measureText(text).width;
  c.width = Math.min(4096, Math.ceil(tw + size * 0.8));
  c.height = Math.ceil(size * 2.3);
  g.font = `bold ${size}px ${SERIF}`;
  g.textBaseline = 'alphabetic';
  const base = size * 1.05;
  let x = size * 0.4;
  const fallen = [];
  for (const ch of chars) {
    const w = g.measureText(ch).width;
    // 1 文字だけ、ずり落ちて傾いている
    const slip = bites && chars.length > 1 && Math.random() < 0.22;
    g.save();
    g.translate(x + w / 2, base + (slip ? size * 0.25 : 0));
    g.rotate(slip ? (Math.random() - 0.5) * 0.5 : 0);
    g.fillStyle = color;
    g.fillText(ch, -w / 2, 0);
    g.restore();
    if (bites && Math.random() < 0.55) fallen.push([x + w * Math.random(), base - size * Math.random() * 0.8]);
    x += w;
  }
  if (bites) {
    // かじられた跡（丸い歯形で文字を削る）。削った欠片は下に落ちている
    g.globalCompositeOperation = 'destination-out';
    for (const [bx, by] of fallen) {
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(bx + (k - 1) * size * 0.07, by + Math.sin(k) * size * 0.04, size * (0.06 + Math.random() * 0.05), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = color;
    for (const [bx] of fallen) {
      for (let k = 0; k < 4; k++) {
        g.save();
        g.translate(bx + (Math.random() - 0.5) * size * 0.5, c.height - size * (0.12 + Math.random() * 0.25));
        g.rotate(Math.random() * Math.PI);
        const s = size * (0.03 + Math.random() * 0.05);
        g.fillRect(-s, -s * 0.5, s * 2, s);
        g.restore();
      }
    }
  }
  return { tex: canvasTex(c), aspect: c.width / c.height };
}

function planeMesh(tex, w, h, { emissive = false, opacity = 1 } = {}) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = emissive
    ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, opacity })
    : new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.02, depthWrite: false, roughness: 0.6, opacity });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  return new THREE.Mesh(geo, mat);
}

function vinyl(text, maxW = 2.6, color = undefined) {
  const { tex, aspect } = vinylTexture(text, color ? { color } : {});
  const h = Math.min(1.25, maxW / aspect);
  return { mesh: planeMesh(tex, h * aspect, h), lit: true, width: h * aspect, height: h };
}

// ---------------------------------------------------------------- 立体の文字（クソでかい。床に立つ・壁から突き出す）
// 張り紙用のフォント（doc-serif.otf）の字形を押し出して作る。フォントにない字があるときは使わない
let font3d = null;
let font3dLoading = null;
export function loadFont3D(url) {
  if (!font3dLoading) {
    font3dLoading = fetch(url).then((r) => r.arrayBuffer()).then((b) => { font3d = opentype.parse(b); }).catch(() => {});
  }
  return font3dLoading;
}
// 白い部屋で読めるよう、濃い色・鮮やかな色だけ
const SOLID = ['#18181a', '#b3121f', '#1d47c9', '#e8a800', '#23703a'];
function text3d(text, { height, maxW, depthRatio = 0.25 }) {
  if (!font3d) return null;
  const t = text.replace(/　/g, ' ');
  for (const ch of t) if (ch.trim() && font3d.charToGlyphIndex(ch) === 0) return null;
  const shapes = [];
  for (const p of font3d.getPaths(t, 0, 0, 1)) {
    const sp = new THREE.ShapePath();
    for (const c of p.commands) {
      if (c.type === 'M') sp.moveTo(c.x, -c.y);
      else if (c.type === 'L') sp.lineTo(c.x, -c.y);
      else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
      else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    }
    shapes.push(...sp.toShapes(true));
  }
  if (!shapes.length) return null;
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: depthRatio, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 1, curveSegments: 5 });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const bw = bb.max.x - bb.min.x; const bh = bb.max.y - bb.min.y;
  const k = Math.min(height / bh, maxW / bw);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, 0);
  geo.scale(k, k, k);
  geo.computeVertexNormals();
  const color = pick(SOLID);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.05 }));
  return { mesh, lit: true, width: bw * k, height: bh * k, depth: (depthRatio + 0.024) * k };
}

// ---------------------------------------------------------------- 床の象嵌文字（巨大・半分沈む）
function floorLetters(text) {
  const { tex, aspect } = vinylTexture(text, { color: '#2a2622' });
  const h = Math.min(2.4, 5.0 / aspect);
  const m = planeMesh(tex, h * aspect, h);
  // 奥側が床に沈んでいくように、手前から奥へ薄くする
  m.material.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.a *= 0.75 + 0.25 * smoothstep(1.0, 0.6, vMapUv.y);');
  };
  return { mesh: m, lit: true, width: h * aspect, height: h };
}

// ---------------------------------------------------------------- ネオンサイン
const NEON = ['#ff3d7f', '#36e6ff', '#ffb347', '#b6ff5c', '#f4f1ff'];
function neon(text) {
  const color = pick(NEON);
  const chars = [...text];
  const size = 170;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${size}px ${SANS}`;
  const tw = g.measureText(text).width;
  c.width = Math.min(4096, Math.ceil(tw + size * 1.2));
  c.height = Math.ceil(size * 1.9);
  const dead = chars.length > 1 ? Math.floor(Math.random() * chars.length) : -1;
  const draw = (alpha) => {
    g.clearRect(0, 0, c.width, c.height);
    g.font = `${size}px ${SANS}`;
    g.textBaseline = 'middle';
    let x = size * 0.6;
    chars.forEach((ch, i) => {
      const off = i === dead;
      const a = off ? 1 : alpha;
      g.lineJoin = 'round';
      // 管の外側の光
      g.shadowColor = off ? 'transparent' : color;
      g.shadowBlur = off ? 0 : 36;
      g.strokeStyle = off ? 'rgba(70,70,74,0.9)' : color;
      g.globalAlpha = a;
      g.lineWidth = 16;
      g.strokeText(ch, x, c.height / 2);
      g.shadowBlur = 0;
      g.strokeStyle = off ? 'rgba(120,120,126,0.9)' : '#fff';
      g.lineWidth = 5;
      g.strokeText(ch, x, c.height / 2);
      g.globalAlpha = 1;
      x += g.measureText(ch).width;
    });
  };
  draw(1);
  const tex = canvasTex(c);
  const aspect = c.width / c.height;
  const h = Math.min(0.9, 2.4 / aspect);
  const group = new THREE.Group();
  // 背板（透明アクリルに見える薄い暗い板）と、ネオン管
  const back = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect * 0.96, h * 0.9),
    new THREE.MeshStandardMaterial({ color: 0x15171a, transparent: true, opacity: 0.55, roughness: 0.2 }));
  back.position.z = 0.01;
  const tube = planeMesh(tex, h * aspect, h, { emissive: true });
  tube.position.z = 0.05;
  group.add(back, tube);
  const light = new THREE.PointLight(new THREE.Color(color), 0.6, 3.5, 2);
  light.position.z = 0.4;
  group.add(light);
  let next = 0;
  const update = (t) => {
    // ときどき全体が瞬く
    if (t > next) {
      const flick = Math.random() < 0.25;
      tube.material.opacity = flick ? 0.35 : 1;
      light.intensity = flick ? 0.15 : 0.6;
      next = t + (flick ? 0.08 + Math.random() * 0.1 : 1.5 + Math.random() * 4);
    }
  };
  return { mesh: group, lit: false, width: h * aspect, height: h, update };
}

// ---------------------------------------------------------------- 電光掲示板（流れる文字）
function led(text) {
  const H = 96;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `bold ${H * 0.72}px ${SANS}`;
  const tw = g.measureText(text).width;
  c.width = Math.max(512, Math.ceil(tw + H * 3));
  c.height = H;
  g.fillStyle = '#060504';
  g.fillRect(0, 0, c.width, H);
  g.font = `bold ${H * 0.72}px ${SANS}`;
  g.textBaseline = 'middle';
  g.fillStyle = '#ff9a1f';
  g.fillText(text, H, H / 2 + 2);
  // ドットに見えるように格子を重ねる
  g.fillStyle = 'rgba(0,0,0,0.55)';
  for (let x = 0; x < c.width; x += 6) g.fillRect(x, 0, 2, H);
  for (let y = 0; y < H; y += 6) g.fillRect(0, y, c.width, 2);
  const tex = canvasTex(c);
  tex.wrapS = THREE.RepeatWrapping;
  const W = 1.9; const Hm = 0.26;
  tex.repeat.set((W / Hm) * (H / c.width), 1);
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, Hm + 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5 }));
  box.position.z = 0.05;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, Hm), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.position.z = 0.101;
  group.add(box, face);
  const update = (t) => { tex.offset.x = (t * 0.35 * Hm / W) % 1; };
  return { mesh: group, lit: false, width: W, height: Hm, update, litParts: [box] };
}

// ---------------------------------------------------------------- 空っぽの額縁と作品名の札
function captionTexture(text) {
  const c = document.createElement('canvas');
  c.width = 720; c.height = 440;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#2b2824'; g.lineWidth = 6; g.strokeRect(10, 10, c.width - 20, c.height - 20);
  g.fillStyle = '#1a1714';
  fitFont(g, `「${text}」`, c.width - 90, 110, SERIF);
  g.fillText(`「${text}」`, 40, 170);
  g.font = `40px ${SERIF}`;
  g.fillText(pick(DOC_LABELS.caption), 44, 270);
  g.fillStyle = 'rgba(40,36,32,0.35)';
  g.fillRect(44, 320, 420, 14); g.fillRect(44, 352, 300, 14);
  return canvasTex(c);
}

function frame(text) {
  const group = new THREE.Group();
  const W = 1.1 + Math.random() * 0.5; const H = W * (0.75 + Math.random() * 0.4); const t = 0.09;
  const gold = new THREE.MeshStandardMaterial({ color: 0xa7802f, roughness: 0.35, metalness: 0.55 });
  for (const [w, h, x, y] of [[W + 2 * t, t, 0, H / 2 + t / 2], [W + 2 * t, t, 0, -H / 2 - t / 2], [t, H, -W / 2 - t / 2, 0], [t, H, W / 2 + t / 2, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), gold);
    b.position.set(x, y, 0.035);
    group.add(b);
  }
  // 中身は食べられて、破れたカンバスの端だけが残る
  const shreds = new THREE.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 0.9, side: THREE.DoubleSide });
  for (let k = 0; k < 9; k++) {
    const edge = k % 4;
    const len = 0.08 + Math.random() * 0.18;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(edge < 2 ? 0.12 + Math.random() * 0.2 : len, edge < 2 ? len : 0.12 + Math.random() * 0.2), shreds);
    const u = (Math.random() - 0.5) * 0.8;
    if (edge === 0) s.position.set(u * W, H / 2 - len / 2, 0.02);
    if (edge === 1) s.position.set(u * W, -H / 2 + len / 2, 0.02);
    if (edge === 2) s.position.set(-W / 2 + len / 2, u * H, 0.02);
    if (edge === 3) s.position.set(W / 2 - len / 2, u * H, 0.02);
    s.rotation.z = (Math.random() - 0.5) * 0.4;
    group.add(s);
  }
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.01), [
    ...Array(4).fill(new THREE.MeshStandardMaterial({ color: 0xe8e5dd })),
    new THREE.MeshStandardMaterial({ map: captionTexture(text), roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0xe8e5dd }),
  ]);
  card.position.set(W / 2 + t + 0.36, -H / 2 + 0.2, 0.006);
  group.add(card);
  return { mesh: group, lit: true, width: W + 0.9, height: H };
}

// ---------------------------------------------------------------- 張り紙・新聞・記録
export function paperTexture(kind, text, INK = '#17140f') {
  const c = document.createElement('canvas');
  const news = kind === 'newspaper';
  c.width = news ? 1024 : 640;
  c.height = news ? 720 : 880;
  const g = c.getContext('2d');
  g.fillStyle = news ? '#ddd6c4' : kind === 'record' ? '#ece8dc' : '#efe9da';
  g.fillRect(0, 0, c.width, c.height);
  const bars = (x, y, w, rows, h = 11, gap = 24) => {
    for (let r = 0; r < rows; r++) {
      let cx = x;
      const end = x + w * (0.55 + Math.random() * 0.45);
      while (cx < end) {
        const seg = 20 + Math.random() * 90;
        g.fillStyle = `rgba(50,45,40,${0.12 + Math.random() * 0.2})`;
        g.fillRect(cx, y + r * gap, Math.min(seg, end - cx), h);
        cx += seg + 6 + Math.random() * 14;
      }
    }
  };
  g.fillStyle = '#1b1814';
  if (news) {
    g.font = `bold 66px ${SERIF}`; g.fillText(pick(DOC_LABELS.newspaper), 44, 86);
    g.fillRect(34, 108, c.width - 68, 5);
    fitFont(g, text, c.width - 120, 130, SERIF); g.fillStyle = INK; g.fillText(text, 60, 260);
    for (let col = 0; col < 4; col++) bars(44 + col * 242, 320, 214, 15);
  } else {
    g.font = `bold 46px ${SERIF}`; g.fillText(pick(DOC_LABELS.record), 48, 84);
    g.fillRect(48, 104, c.width - 96, 2);
    bars(48, 140, c.width - 96, 4);
    const s = fitFont(g, text, c.width - 120, 120, SERIF);
    const tw = g.measureText(text).width;
    g.fillStyle = INK; g.fillText(text, (c.width - tw) / 2, 400);
    g.strokeStyle = 'rgba(150,30,25,.8)'; g.lineWidth = 5;
    g.beginPath(); g.ellipse(c.width / 2, 400 - s * 0.35, tw / 2 + 34, s * 0.78, -0.04, 0, Math.PI * 2); g.stroke();
    bars(48, 520, c.width - 96, 12);
  }
  return canvasTex(c);
}

function paper(kind, text) {
  const tex = paperTexture(kind, text);
  const w = kind === 'newspaper' ? 1.2 : 0.55;
  const h = w * tex.image.height / tex.image.width;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide }));
  return { mesh: m, lit: true, width: w, height: h };
}

// ---------------------------------------------------------------- 面の種類から見せ方を選ぶ
const STYLES = {
  wall: [['vinyl', 3], ['neon', 2], ['led', 2], ['frame', 2], ['3d', 1.5]],
  ceiling: [['vinyl', 2], ['neon', 1]],
  floor: [['3d', 3.5], ['floor', 2.5], ['paper:newspaper', 1]],
  table: [['paper:record', 1]],
};
function weighted(list) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list[0][0];
}

// opts.color / opts.style: 決まった色・見せ方（例: 方位磁針の「北」は赤い切り文字）。opts.roomW: 部屋の幅
export function wordArt(kind, words, night = false, opts = {}) {
  const text = words.join('　');
  let style = opts.style || weighted(STYLES[kind] || STYLES.wall);
  // 夜はネオンと電光掲示板が映える
  if (!opts.style && night && kind === 'wall' && Math.random() < 0.4) style = pick(['neon', 'led']);
  if (style === '3d') {
    const roomW = opts.roomW || 7;
    // opts.giant: 壁いっぱいの巨大な立体文字
    // opts.giant === false: 床でもふつうの大きさにする
    const a = kind === 'floor' && opts.giant === false
      ? text3d(text, { height: 0.6 + Math.random() * 0.3, maxW: 3.0 })
      : kind === 'floor'
      ? text3d(text, { height: opts.giant ? 2.2 : 1.4 + Math.random() * 0.9, maxW: roomW * 0.8 })
      : opts.giant
        ? text3d(text, { height: 1.5, maxW: 10, depthRatio: 0.3 })
        : text3d(text, { height: 0.7 + Math.random() * 0.4, maxW: 3.0, depthRatio: 0.35 });
    if (a) return { style, ...a };
    style = kind === 'floor' ? 'floor' : 'vinyl';
  }
  if (style === 'vinyl') return { style, ...vinyl(text, kind === 'ceiling' ? 3.2 : 2.6, opts.color) };
  if (style === 'neon') return { style, ...neon(text) };
  if (style === 'led') return { style, ...led(text) };
  if (style === 'frame') return { style, ...frame(text) };
  if (style === 'floor') return { style, ...floorLetters(text) };
  const [, sub] = style.split(':');
  return { style, ...paper(sub, text) };
}
