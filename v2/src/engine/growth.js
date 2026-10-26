// 「空間が単語を食べて、変わってしまった」跡。
// 単語を飲み込んだ場所の壁・床・台が膨らみ、食べた物の色が葉脈のように滲み出す。
// 文書の場合は、言葉のインクが壁に染み込んで流れ出す。区画が進むほど変化は大きい。
import * as THREE from 'three';

// ---------------------------------------------------------------- ノイズ
function hash(x, y, s) {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y, s) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s); const b = hash(xi + 1, yi, s); const c = hash(xi, yi + 1, s); const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 4) {
  let f = 0; let amp = 0.5; let fr = 1;
  for (let i = 0; i < oct; i++) { f += amp * vnoise(x * fr, y * fr, s + i * 13); fr *= 2.03; amp *= 0.5; }
  return f;
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- 膨らみと滲み
// radius: 変化の及ぶ半径、height: 膨らみの高さ、mix: 食べた物の色がどれだけ滲むか
// hole: 飲み込んだ物の半径（パッチの半径に対する割合）。その縁が盛り上がって物を抱え込む
function shape(x, y, seed) {
  const d = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  // 縁は丸くなく、ちぎれたような形
  const edge = 0.5 + 0.32 * fbm(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 + 3, seed, 3);
  // 外へ伸びる筋（葉脈・根のような）
  const n = fbm(x * 3.2 + 7, y * 3.2 + 7, seed + 5, 5);
  const vein = Math.pow(1 - Math.abs(n * 2 - 1), 9) * (1 - smooth(0.55, 1.0, d));
  return { d, edge, vein };
}

export function growthPatch({ radius, height, mix, color, albedo, map = null, hole = 0.4, seed = Math.random() * 100, flat = false }) {
  // 色の滲みはテクスチャに描く（頂点の色だと粗くなる）
  let tex = map;
  if (!tex) {
    const N = 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const g = cv.getContext('2d');
    const img = g.createImageData(N, N);
    const w = albedo.clone().convertLinearToSRGB(); const e = color.clone().convertLinearToSRGB();
    for (let py = 0; py < N; py++) {
      for (let px = 0; px < N; px++) {
        const x = (px / (N - 1)) * 2 - 1; const y = 1 - (py / (N - 1)) * 2;
        const { d, edge, vein } = shape(x, y, seed);
        const body = 1 - smooth(edge * 0.55, edge, d);
        const k = Math.min(1, body * mix + vein * mix * 0.9);
        const i = (py * N + px) * 4;
        img.data[i] = (w.r + (e.r - w.r) * k) * 255;
        img.data[i + 1] = (w.g + (e.g - w.g) * k) * 255;
        img.data[i + 2] = (w.b + (e.b - w.b) * k) * 255;
        img.data[i + 3] = (1 - smooth(0.8, 1.0, d)) * 255;
      }
    }
    g.putImageData(img, 0, 0);
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  const seg = 96;
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2, seg, seg);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / radius; const y = pos.getY(i) / radius;
    const { d, edge, vein } = shape(x, y, seed);
    // 物の縁で盛り上がり、外へなだらかに下がる。中心（物の正面）は覆わない
    let lip = 0;
    if (!flat) {
      const rise = smooth(hole * 0.55, hole, d);
      const fall = 1 - smooth(hole, edge * 1.15, d);
      lip = height * rise * fall * (0.8 + 0.4 * fbm(x * 2.5, y * 2.5, seed + 9, 3));
    }
    pos.setZ(i, 0.002 + lip + (flat ? 0 : vein * height * 0.1));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.75 });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------- 食べた物の色
export function dominantColor(root) {
  let img = null; let base = null;
  root.traverse((o) => {
    if (!o.isMesh || img) return;
    if (o.material.map?.image) img = o.material.map.image;
    else if (!base) base = o.material.color?.clone();
  });
  if (!img) return base || new THREE.Color(0.4, 0.35, 0.3);
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let r = 0; let gg = 0; let b = 0; let n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  const col = new THREE.Color(r / n / 255, gg / n / 255, b / n / 255);
  return col.convertSRGBToLinear();
}

// ---------------------------------------------------------------- 文書のインクの染み
export function inkSeepTexture(words, font, seed = Math.random() * 100) {
  const text = words.join('　');
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  // 背景は透明（岩肌や木の上でも白い円にならないように）。インクだけを描く
  // 言葉が何重にもにじんで広がる
  for (let i = 0; i < 14; i++) {
    const size = 40 + hash(i, 1, seed) * 130;
    g.font = `bold ${size}px ${font}`;
    const tw = g.measureText(text).width;
    const r = 120 + hash(i, 2, seed) * 300;
    const a = hash(i, 3, seed) * Math.PI * 2;
    g.save();
    g.translate(512 + Math.cos(a) * r * (i / 14), 512 + Math.sin(a) * r * (i / 14));
    g.rotate((hash(i, 4, seed) - 0.5) * 0.6);
    g.filter = `blur(${1 + hash(i, 5, seed) * 3}px)`;
    g.fillStyle = `rgba(30,24,20,${0.06 + (1 - i / 14) * 0.16})`;
    g.fillText(text, -tw / 2, size / 3);
    g.restore();
  }
  g.filter = 'none';
  // 下へ垂れる
  for (let i = 0; i < 16; i++) {
    const x = 300 + hash(i, 6, seed) * 424; const y0 = 420 + hash(i, 7, seed) * 160;
    const len = 80 + hash(i, 8, seed) * 380;
    const w = 1.5 + hash(i, 9, seed) * 3;
    const grd = g.createLinearGradient(0, y0, 0, y0 + len);
    grd.addColorStop(0, 'rgba(30,24,20,.28)'); grd.addColorStop(1, 'rgba(30,24,20,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(x, y0 + len / 2, w, len / 2, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x, y0 + len * 0.92, w * 1.4, 0, Math.PI * 2); g.fill();
  }
  // 外側ほど透明にして壁となじませる
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(512, 512, 300, 512, 512, 512);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
