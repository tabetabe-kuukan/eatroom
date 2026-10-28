// 空間 4「研究室」。白い展示室 3 部屋に、決まった物を決まった場所に置く（ランダムな配置はしない）
// - 第1区画: 「言語系観測研究室」の切り文字、「Z-TBKQ-001」の記録
// - 第2区画: 長い壁いっぱいの印字（元素の列）、「須戸幕大学大学院」の額
// - 第3区画: 部屋の中央の椅子と、背に掛けた白衣（名札は「主任」だけで、名前は空白）。天井の照明が 1 つ切れかけている
// - 隠し扉: 検索メモに「出口」と書くと、椅子の背後の壁に扉が現れる（メモを消すと扉も消える）
import * as THREE from 'three';
import { applyBakedLight, buildTrace } from '../engine/embed.js';
import { SERIF, wordArt } from '../engine/wordart.js';
import { normalize } from './answer.js';
import { LAB_ELEMENTS } from './plan.js';

// 検索メモに書くと扉が開く言葉
export function isExitNote(text) {
  const n = normalize(text);
  return n === normalize('出口') || n === normalize('デグチ');
}

const tex = (c) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
};
// 決まった乱数（毎回同じ形・同じ汚れになる）
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------------------------------------------------------------- 第2区画の壁の印字
function elementsWall(wallLen, wallH) {
  const lines = [LAB_ELEMENTS.split('　').slice(0, 4).join('　'), LAB_ELEMENTS.split('　').slice(4).join('　')];
  const PX = 200; // 1m あたりの画素
  const charM = 0.56; // 文字の高さ（m）
  const W = Math.round(wallLen * PX); const H = Math.round(charM * 2.9 * PX);
  const [c, g] = canvas(W, H);
  g.fillStyle = '#26262a';
  g.textBaseline = 'alphabetic';
  const size = charM * PX * 1.14;
  g.font = `600 ${size}px ${SERIF}`;
  const rand = rng(7);
  lines.forEach((ln, i) => {
    const y = (i + 1) * charM * 1.32 * PX;
    g.fillText(ln, 0.25 * PX, y);
  });
  // 印刷のかすれ（マットな黒の中に、わずかなむら）
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 2600; k++) {
    g.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.25})`;
    g.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 2);
  }
  g.globalCompositeOperation = 'source-over';
  const t = tex(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W / PX, H / PX), new THREE.MeshStandardMaterial({
    map: t, transparent: true, roughness: 1, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  m.renderOrder = 4;
  return { mesh: m, width: W / PX, height: H / PX, top: Math.min(wallH - 0.35, 3.2) };
}

// ---------------------------------------------------------------- 椅子
function chair() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x8d9094, roughness: 0.35, metalness: 0.6 });
  const shell = new THREE.MeshStandardMaterial({ color: 0x4b5157, roughness: 0.6 });
  const tube = (a, b, r = 0.011) => {
    const va = new THREE.Vector3(...a); const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), steel);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    g.add(m);
  };
  // 脚（少し外に開く）と横の補強
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) tube([sx * 0.2, 0.445, sz * 0.18], [sx * 0.225, 0.0, sz * 0.205]);
    tube([sx * 0.214, 0.16, -0.195], [sx * 0.214, 0.16, 0.195]);
    // 背もたれの支柱（後ろの脚から続いて、少し後ろへ倒れる）
    tube([sx * 0.19, 0.445, -0.2], [sx * 0.19, 0.86, -0.25]);
  }
  // 座面
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.035, 0.43), shell);
  seat.position.set(0, 0.462, 0);
  g.add(seat);
  // 背もたれ
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.22, 0.025), shell);
  back.position.set(0, 0.76, -0.236);
  back.rotation.x = -0.12;
  g.add(back);
  return g;
}

// ---------------------------------------------------------------- 白衣
// 生地のテクスチャ：わずかな織りむら・しわの影・袖口と裾の汚れ・インクの染み
function clothTexture(kind) {
  const [c, g] = canvas(512, 512);
  const rand = rng(kind === 'sleeve' ? 11 : 23);
  g.fillStyle = '#f1f0ea';
  g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 9000; k++) {
    const v = 225 + rand() * 30;
    g.fillStyle = `rgba(${v},${v},${v - 4},0.25)`;
    g.fillRect(rand() * 512, rand() * 512, 2, 1);
  }
  // しわの陰影（縦の筋）
  for (let k = 0; k < 26; k++) {
    const x = rand() * 512; const w = 6 + rand() * 18;
    const grd = g.createLinearGradient(x - w, 0, x + w, 0);
    grd.addColorStop(0, 'rgba(120,118,110,0)');
    grd.addColorStop(0.5, `rgba(120,118,110,${0.05 + rand() * 0.08})`);
    grd.addColorStop(1, 'rgba(120,118,110,0)');
    g.fillStyle = grd;
    g.fillRect(x - w, rand() * 200, w * 2, 200 + rand() * 312);
  }
  const smudge = (x, y, rx, ry, a, col = '96,84,64') => {
    const grd = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    grd.addColorStop(0, `rgba(${col},${a})`);
    grd.addColorStop(1, `rgba(${col},0)`);
    g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y);
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2); g.fill(); g.restore();
  };
  if (kind === 'sleeve') {
    // 袖口（u = 1 側）の黒ずみ：机にこすれた跡
    const grd = g.createLinearGradient(380, 0, 512, 0);
    grd.addColorStop(0, 'rgba(92,84,70,0)');
    grd.addColorStop(0.6, 'rgba(92,84,70,0.38)');
    grd.addColorStop(1, 'rgba(62,54,44,0.7)');
    g.fillStyle = grd; g.fillRect(380, 0, 132, 512);
    for (let k = 0; k < 14; k++) smudge(430 + rand() * 80, rand() * 512, 10 + rand() * 30, 6 + rand() * 20, 0.15 + rand() * 0.2);
    // ボールペンの線
    g.strokeStyle = 'rgba(40,52,120,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(455, 120); g.quadraticCurveTo(470, 150, 462, 190); g.stroke();
  } else {
    // 裾（v = 1 側）のくすみ
    const grd = g.createLinearGradient(0, 400, 0, 512);
    grd.addColorStop(0, 'rgba(110,100,84,0)');
    grd.addColorStop(1, 'rgba(110,100,84,0.28)');
    g.fillStyle = grd; g.fillRect(0, 400, 512, 112);
    // コーヒーの滴・薬品のしみ
    smudge(300, 330, 9, 7, 0.45, '120,80,40');
    smudge(318, 352, 5, 4, 0.4, '120,80,40');
    smudge(150, 260, 22, 14, 0.18, '150,140,70');
    for (let k = 0; k < 8; k++) smudge(rand() * 512, 300 + rand() * 200, 8 + rand() * 20, 6 + rand() * 12, 0.1 + rand() * 0.12);
  }
  return tex(c);
}

// 白衣の色は真っ白より少し落とす（白い部屋で、しわと汚れが見えるように）
const COAT = 0xd6d4ce;

// 布の面：u（横 -1〜1）・v（上 0〜下 1）から位置を返す関数で作る
function clothSurface(fn, nu, nv, map) {
  const geo = new THREE.PlaneGeometry(1, 1, nu, nv);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i) * 2 - 1; const v = 1 - uv.getY(i);
    fn(u, v, p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, color: COAT, roughness: 0.92, side: THREE.DoubleSide }));
}

function nameTag() {
  const [c, g] = canvas(512, 330);
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 512, 330);
  g.strokeStyle = '#1d3f7a'; g.lineWidth = 10; g.strokeRect(14, 14, 484, 302);
  g.fillStyle = '#1d3f7a'; g.fillRect(14, 14, 484, 22);
  g.fillStyle = '#18181a';
  g.font = `700 150px ${SERIF}`;
  g.fillText('主任', 40, 196);
  // 名前の欄は空白
  g.strokeStyle = 'rgba(30,30,34,0.5)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(40, 280); g.lineTo(470, 280); g.stroke();
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.068), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.35 }));
  const grp = new THREE.Group();
  grp.add(card);
  // 透明なケースとクリップ
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.111, 0.074, 0.004), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, transparent: true, opacity: 0.18 }));
  sleeve.position.z = 0.001;
  grp.add(sleeve);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.016, 0.006), new THREE.MeshStandardMaterial({ color: 0x9a9da2, metalness: 0.7, roughness: 0.3 }));
  clip.position.set(0, 0.04, 0.002);
  grp.add(clip);
  return grp;
}

function labCoat() {
  const g = new THREE.Group();
  const body = clothTexture('body');
  const sleeveTex = clothTexture('sleeve');
  const r = rng(5);
  const crumple = Array.from({ length: 8 }, () => [r() * 6, r() * 6, r() * 6]);
  const noise = (u, v) => crumple.reduce((a, [p, q, s], k) => a + Math.sin(u * (3 + k) + p) * Math.sin(v * (4 + k * 1.3) + q) * (0.5 + s * 0.1), 0) / crumple.length;

  // 後ろ身頃：背もたれの上を越えて、椅子の後ろに垂れる（裾は少し広がる）
  const back = clothSurface((u, v, p) => {
    const w = 0.24 + 0.07 * v;
    p.x = u * w + Math.sin(v * 5 + u) * 0.01;
    if (v < 0.1) {
      // 肩：背もたれの上を前から後ろへ回り込む
      const a = (v / 0.1) * Math.PI * 0.5;
      p.y = 0.885 + Math.sin(Math.PI * 0.5 - a) * 0.02;
      p.z = -0.24 - Math.sin(a) * 0.035;
    } else {
      const t = (v - 0.1) / 0.9;
      p.y = 0.885 - t * 0.78;
      p.z = -0.275 - t * 0.06 - t * t * 0.03;
    }
    // 縦のひだと、くしゃっとしたしわ
    p.z -= v * (0.018 * Math.sin(u * 9.5 + 1.2) + 0.012 * Math.sin(u * 17 + v * 3)) + noise(u, v) * 0.02 * v;
  }, 28, 40, body);
  g.add(back);

  // 前身頃（左右）：背もたれの前に垂れ、座面に折れて溜まる。前は開いている
  for (const side of [-1, 1]) {
    const front = clothSurface((u, v, p) => {
      const s = (u + 1) / 2; // 0 = 打ち合わせ側、1 = 脇
      p.x = side * (0.035 + s * 0.215) + (side * Math.sin(v * 4) * 0.012);
      const drop = 0.4; // 背もたれの上から座面まで
      if (v < 0.62) {
        const t = v / 0.62;
        p.y = 0.885 - t * drop;
        p.z = -0.205 + t * 0.02 + Math.sin(t * Math.PI) * 0.025;
      } else {
        // 座面の上に寝る（裾が前へ伸びて、少しめくれる）
        const t = (v - 0.62) / 0.38;
        const bend = Math.min(1, t * 2.4);
        p.y = 0.485 + 0.012 + (1 - bend) * 0.02 + Math.max(0, t - 0.8) * 0.12 * (1 - s * 0.4);
        p.z = -0.185 + t * 0.29;
      }
      p.z += 0.01 * Math.sin(u * 8 + side) * v;
      p.y += noise(u + side, v) * 0.012 * (v > 0.62 ? 1 : 0.3);
      if (v < 0.62) p.z += noise(u * side, v) * 0.012;
    }, 16, 34, body);
    g.add(front);
  }

  // 袖：片方は脇に垂れ、もう片方は座面に投げ出されている
  const sleeves = [
    [[-0.25, 0.86, -0.23], [-0.31, 0.72, -0.22], [-0.33, 0.52, -0.18], [-0.31, 0.33, -0.12], [-0.29, 0.2, -0.08]],
    [[0.25, 0.86, -0.23], [0.27, 0.68, -0.16], [0.2, 0.53, -0.05], [0.12, 0.53, 0.08], [0.08, 0.52, 0.16], [0.07, 0.42, 0.235], [0.075, 0.3, 0.245]],
  ];
  for (const pts of sleeves) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const geo = new THREE.TubeGeometry(curve, 48, 0.05, 12, false);
    // 先へ行くほど細く、少しつぶれる
    const pos = geo.attributes.position; const uv = geo.attributes.uv;
    const c = new THREE.Vector3(); const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const t = uv.getX(i);
      curve.getPointAt(Math.min(1, t), c);
      p.fromBufferAttribute(pos, i).sub(c);
      const k = 1 - t * 0.25 + Math.sin(t * 40) * 0.04;
      p.multiplyScalar(k);
      p.y *= 0.85;
      pos.setXYZ(i, c.x + p.x, c.y + p.y, c.z + p.z);
    }
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: sleeveTex, color: COAT, roughness: 0.92, side: THREE.DoubleSide })));
  }

  // 胸ポケットのペン（使っていた跡）
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x1d2b5c, roughness: 0.4 }));
  pen.position.set(-0.15, 0.78, -0.165);
  pen.rotation.z = 0.12;
  g.add(pen);
  const pocket = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.11), new THREE.MeshStandardMaterial({ map: body, color: 0xcfcdc6, roughness: 0.92 }));
  pocket.position.set(-0.145, 0.71, -0.162);
  pocket.rotation.x = 0.06;
  g.add(pocket);

  // 名札（胸）：「主任」だけ
  const tag = nameTag();
  tag.position.set(0.15, 0.76, -0.158);
  tag.rotation.set(0.05, 0.04, -0.07);
  g.add(tag);
  return g;
}

// ---------------------------------------------------------------- 扉のまわりの細かい文字の模様
function edgePattern(W, H, doorW, doorH) {
  const PX = 420;
  const [c, g] = canvas(Math.round(W * PX), Math.round(H * PX));
  const rand = rng(31);
  const CH = '出口出口出口言語観測研究室字白衣主任炭素酸素水素窒素扉口出入透';
  const cx = c.width / 2; const dw = doorW * PX; const dh = doorH * PX;
  const x0 = cx - dw / 2; const x1 = cx + dw / 2; const y1 = c.height; const y0 = y1 - dh;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  for (let y = 7; y < c.height; y += 14) {
    for (let x = 7; x < c.width; x += 14) {
      // 扉の縁からの距離（縁に近いほど濃く、離れると薄れて消える）
      const dx = Math.max(x0 - x, 0, x - x1);
      const dy = Math.max(y0 - y, 0);
      const inside = x > x0 && x < x1 && y > y0;
      if (inside) continue;
      const d = Math.hypot(dx, dy) / PX;
      const a = Math.min(1, Math.max(0, 1 - d / 0.55) ** 1.1 * (0.7 + rand() * 0.3) * 1.15);
      if (a < 0.03) continue;
      g.font = `${11 + rand() * 4}px ${SERIF}`;
      g.fillStyle = `rgba(16,15,15,${a})`;
      g.fillText(CH[Math.floor(rand() * CH.length)], x, y);
    }
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({
    map: tex(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
  }));
  m.renderOrder = 5;
  return m;
}

// ---------------------------------------------------------------- 組み立て
// world: loadRooms の結果、readers: 部屋ごとのライトマップ読み取り、traces: 痕跡の一覧（ここに足す）
export async function buildLab(world, readers, traces) {
  const group = new THREE.Group();
  world.group.add(group);
  const disposables = [];
  const updaters = [];
  const dims = world.modules.map((m) => m.meta.module || { width: 9, height: 4.6, length: 15, door: 2.6, doorH: 3.7 });
  const zStart = (i) => -world.starts[i];
  const lit = (obj, zi, pos, normal) => {
    const irr = readers[zi] ? readers[zi](pos, normal) : new THREE.Color(0.5, 0.5, 0.5);
    applyBakedLight(obj, world.modules[zi], irr, new THREE.Vector3(0, 1, 0).addScaledVector(normal, 0.9).normalize());
    // 区画の照明の揺らぎにも合わせる
    obj.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) world.lmMaterials.push(m); });
  };

  // ---- 第1区画・第2区画の検索ワード（ほかの空間と同じ痕跡の作り方で、場所と見せ方だけ決めておく）
  // 第1区画の 2 つの立体の文字は、置く面を毎回選ぶ（左の壁・右の壁・床・天井から別々の面）
  const d0 = dims[0];
  const SURFACES = {
    left: (z) => ({ kind: 'wall', pos: [-d0.width / 2, 1.9, z], normal: [1, 0, 0] }),
    right: (z) => ({ kind: 'wall', pos: [d0.width / 2, 1.9, z], normal: [-1, 0, 0] }),
    floor: (z) => ({ kind: 'floor', pos: [0, 0, z], normal: [0, 1, 0], up: [0, 0, -1] }),
    ceiling: (z) => ({ kind: 'ceiling', pos: [0, d0.height, z], normal: [0, -1, 0], up: [0, 0, -1] }),
  };
  const faces = Object.keys(SURFACES).sort(() => Math.random() - 0.5);
  const signs = [
    // 研究室の名前・存在の番号：立体の文字
    { zi: 0, text: '言語系観測研究室', style: '3d', ...SURFACES[faces[0]](zStart(0) - 6.5) },
    { zi: 0, text: 'Z-TBKQ-001', style: '3d', ...SURFACES[faces[1]](zStart(0) - 11) },
    // 大学院の額：右の壁（向かいの壁は元素の印字）
    { zi: 1, text: '須戸幕大学大学院', style: 'frame', kind: 'wall', pos: [dims[1].width / 2, 1.75, zStart(1) - 9.5], normal: [-1, 0, 0] },
  ];
  // 第1区画の 2 つのうち、どちらか 1 つは必ず巨大な文字にする（毎回どちらかを選ぶ。もう片方はふつうの大きさ）
  const big = Math.random() < 0.5 ? 0 : 1;
  signs[0].giant = big === 0;
  signs[1].giant = big === 1;
  for (const s of signs) {
    const d = dims[s.zi];
    const slot = { pos: s.pos, normal: s.normal, up: s.up, kind: s.kind, zone: s.zi + 1, room: s.zi, ceil: d.height, roomW: d.width, radius: 2.6 };
    const g = await buildTrace(world.modules[s.zi], slot, { tokens: [{ word: s.text, style: s.style, color: '#151311', ...(s.giant !== undefined ? { giant: s.giant } : {}) }] }, readers[s.zi], { night: false });
    group.add(g);
    if (g.userData.update) updaters.push(g.userData.update);
    traces.push({ zone: s.zi + 1, words: [s.text], pos: s.pos, radius: 2.6 });
  }

  // ---- 第2区画：左の長い壁いっぱいの印字（入るとすぐ目に入る大きさ）
  {
    const d = dims[1];
    const wl = elementsWall(Math.min(d.length ?? 15, 15) - 1.6, d.height);
    const x = -d.width / 2 + 0.006;
    const zc = zStart(1) - (d.length ?? 15) / 2;
    wl.mesh.position.set(x, wl.top - wl.height / 2, zc);
    wl.mesh.rotation.y = Math.PI / 2;
    lit(wl.mesh, 1, new THREE.Vector3(x + 0.05, 2.2, zc), new THREE.Vector3(1, 0, 0));
    group.add(wl.mesh);
    disposables.push(wl.mesh.geometry);
    traces.push({ zone: 2, words: [LAB_ELEMENTS], pos: [x, 1.6, zc], radius: d.width / 2 + 1.2 });
  }

  // ---- 第3区画：中央の椅子と白衣
  const d3 = dims[2];
  const endZ = -world.totalLength;
  // 部屋の中央の台は片付けて、そこに椅子を置く（台の影がそのまま椅子の影になる）
  let chairZ = zStart(2) - (d3.length ?? 9) / 2;
  world.modules[2].group.traverse((o) => {
    if (!o.isMesh || !/plinth/.test(o.material?.name || '')) return;
    o.visible = false;
    o.geometry.computeBoundingBox();
    chairZ = zStart(2) + (o.geometry.boundingBox.min.z + o.geometry.boundingBox.max.z) / 2;
  });
  for (let k = world.colliders.length - 1; k >= 0; k--) {
    const c = world.colliders[k];
    if (c.x === 0 && Math.abs(c.z - chairZ) < 0.2 && c.hx < 0.5) world.colliders.splice(k, 1);
  }
  const seat = new THREE.Group();
  seat.add(chair());
  seat.add(labCoat());
  seat.position.set(0, 0, chairZ);
  seat.rotation.y = 0.22;
  lit(seat, 2, new THREE.Vector3(0, 0.9, chairZ + 0.4), new THREE.Vector3(0, 0.3, 1).normalize());
  group.add(seat);
  world.colliders.push({ x: 0, z: chairZ - 0.05, hx: 0.36, hz: 0.38, rot: 0.22 });
  traces.push({ zone: 3, words: ['白衣'], pos: [0, 0.8, chairZ], radius: 2.2 });
  traces.push({ zone: 3, words: ['主任'], pos: [0, 0.8, chairZ], radius: 1.35 });

  // ---- 第3区画：天井の照明の 1 つが不規則に明滅する
  const panelMesh = (() => {
    let found = null;
    world.modules[2].group.traverse((o) => { if (o.isMesh && /light_panel/.test(o.material?.name || '')) found = o; });
    return found;
  })();
  let flick = null;
  if (panelMesh) {
    // 照明パネルは 1 つのメッシュにまとまっているので、手前右のパネルの形を読み取り、消えたときに上から灰色の板をかぶせる
    panelMesh.updateWorldMatrix(true, false);
    const pa = panelMesh.geometry.attributes.position;
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    const all = new THREE.Box3();
    for (let i = 0; i < pa.count; i++) all.expandByPoint(v.fromBufferAttribute(pa, i).applyMatrix4(panelMesh.matrixWorld));
    const midZ = (all.min.z + all.max.z) / 2;
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(panelMesh.matrixWorld);
      if (v.x > 0 && v.z < midZ) box.expandByPoint(v);
    }
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      const c = box.getCenter(new THREE.Vector3());
      const off = new THREE.Mesh(new THREE.BoxGeometry(size.x + 0.01, 0.006, size.z + 0.01), new THREE.MeshBasicMaterial({ color: 0x8a8a88 }));
      off.position.set(c.x, box.min.y - 0.004, c.z);
      off.visible = false;
      group.add(off);
      disposables.push(off.geometry, off.material);
      flick = { off, mats: world.modules[2].lmMaterials.slice() };
    }
  }
  // 不規則な明滅：ふだんは点いていて、ときどき数回またたいて消えかける
  let nextBurst = 2 + Math.random() * 3;
  let burst = [];
  const flickerAt = (t) => {
    if (t > nextBurst && !burst.length) {
      let at = t;
      const n = 2 + Math.floor(Math.random() * 5);
      for (let k = 0; k < n; k++) {
        const len = 0.04 + Math.random() * (k === n - 1 && Math.random() < 0.3 ? 0.9 : 0.14);
        burst.push([at, at + len]);
        at += len + 0.03 + Math.random() * 0.18;
      }
      nextBurst = at + 1.5 + Math.random() * 6;
    }
    burst = burst.filter(([, b]) => b > t);
    return burst.some(([a, b]) => t >= a && t < b);
  };

  // ---- 隠し扉（椅子の背後、奥の壁の中央）
  const DOOR_W = 0.92; const DOOR_H = 2.06;
  const capFront = endZ + 0.15;
  let cap = null;
  world.group.traverse((o) => {
    if (o.isMesh && o.geometry?.type === 'BoxGeometry' && Math.abs(o.position.z - (endZ + 0.075)) < 0.01) cap = o;
  });
  const capCollider = world.colliders.find((c) => Math.abs(c.z - (endZ + 0.075)) < 0.01 && c.x === 0);
  // 扉の部分を切り抜いた壁
  const capW = d3.door ?? 2.6; const capH = d3.doorH ?? 2.8;
  const holed = (() => {
    const s = new THREE.Shape();
    s.moveTo(-capW / 2, -capH / 2); s.lineTo(-DOOR_W / 2, -capH / 2); s.lineTo(-DOOR_W / 2, -capH / 2 + DOOR_H);
    s.lineTo(DOOR_W / 2, -capH / 2 + DOOR_H); s.lineTo(DOOR_W / 2, -capH / 2); s.lineTo(capW / 2, -capH / 2);
    s.lineTo(capW / 2, capH / 2); s.lineTo(-capW / 2, capH / 2); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: false });
    geo.translate(0, 0, -0.075);
    geo.setAttribute('uv1', geo.attributes.uv);
    return geo;
  })();
  disposables.push(holed);
  const solidGeo = cap?.geometry;

  const door = new THREE.Group();
  door.visible = false;
  group.add(door);
  {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c5d60, roughness: 0.5, metalness: 0.3 });
    const T = 0.05;
    for (const [w, h, x, y] of [[DOOR_W + 2 * T, T, 0, DOOR_H + T / 2], [T, DOOR_H, -DOOR_W / 2 - T / 2, DOOR_H / 2], [T, DOOR_H, DOOR_W / 2 + T / 2, DOOR_H / 2]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), frameMat);
      b.position.set(x, y, capFront - 0.07);
      door.add(b);
    }
    // 扉の向こうは真っ白な光
    // 露出を下げた部屋の中でも白く飛ぶよう、色を 1 より明るくする
    const glow = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4), side: THREE.BackSide, fog: false }));
    glow.position.set(0, DOOR_H / 2, capFront - 0.8 - 0.15);
    door.add(glow);
    // 外へ開いた扉の板
    const leafPivot = new THREE.Group();
    leafPivot.position.set(-DOOR_W / 2, 0, capFront - 0.15);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.02, DOOR_H - 0.02, 0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.88, 1.82), fog: false }));
    leaf.position.set((DOOR_W - 0.02) / 2, DOOR_H / 2, -0.02);
    leafPivot.add(leaf);
    leafPivot.rotation.y = 1.25;
    door.add(leafPivot);
    // 床にこぼれる光
    const [c, g] = canvas(256, 256);
    const grd = g.createRadialGradient(128, 0, 4, 128, 0, 250);
    grd.addColorStop(0, 'rgba(255,255,255,0.85)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    spill.position.set(0, 0.006, capFront + 1.0);
    spill.renderOrder = 3;
    door.add(spill);
    // 扉の縁の細かい文字
    const pat = edgePattern(capW - 0.1, capH - 0.05, DOOR_W + 2 * T, DOOR_H + T);
    pat.position.set(0, (capH - 0.05) / 2, capFront + 0.004);
    door.add(pat);
    door.userData.pattern = pat;
    door.traverse((o) => { if (o.isMesh) { disposables.push(o.geometry); disposables.push(o.material); } });
  }
  let open = false;
  let fadeT = 1;
  function setDoor(on, animate = false) {
    if (on === open) return;
    open = on;
    door.visible = on;
    if (cap && solidGeo) cap.geometry = on ? holed : solidGeo;
    // 当たり判定：扉の部分だけ通れるようにする
    if (capCollider) {
      const i = world.colliders.indexOf(capCollider);
      if (on && i >= 0) {
        world.colliders.splice(i, 1);
        const hw = (capW / 2 - DOOR_W / 2) / 2;
        for (const sx of [-1, 1]) world.colliders.push({ x: sx * (DOOR_W / 2 + hw), z: capCollider.z, hx: hw, hz: capCollider.hz, rot: 0, labDoor: true });
      } else if (!on && i < 0) {
        for (let k = world.colliders.length - 1; k >= 0; k--) if (world.colliders[k].labDoor) world.colliders.splice(k, 1);
        world.colliders.push(capCollider);
      }
    }
    fadeT = animate ? 0 : 1;
  }

  // 「出口」の立体文字が 1 秒だけ壁に浮かぶ
  let sign = null;
  function flashExitWord() {
    const art = wordArt('wall', ['出口'], false, { style: '3d' });
    if (art.style !== '3d') return;
    const m = art.mesh;
    for (const mm of [].concat(m.material)) mm.color?.set(0x18181a);
    const k = 0.9 / art.height;
    m.scale.multiplyScalar(k);
    m.position.set(0, 1.25, capFront - art.depth * k * 0.3);
    lit(m, 2, new THREE.Vector3(0, 1.6, capFront + 0.05), new THREE.Vector3(0, 0, 1));
    group.add(m);
    sign = m;
    setTimeout(() => {
      group.remove(m);
      m.geometry.dispose();
      if (sign === m) sign = null;
    }, 1000);
  }

  return {
    isOpen: () => open,
    setDoor,
    flashExitWord,
    // プレイヤーが扉をくぐったか
    passed: (p) => open && p.z < capFront - 0.05 && Math.abs(p.x) < DOOR_W / 2 + 0.05,
    update(t) {
      for (const u of updaters) u(t);
      if (flick) {
        const off = flickerAt(t);
        flick.off.visible = off;
        if (off) for (const m of flick.mats) m.lightMapIntensity = (m.userData.baseLm ?? m.lightMapIntensity) * 0.9;
      }
      if (open && fadeT < 1) {
        fadeT = Math.min(1, fadeT + 1 / 60 / 0.6);
        door.userData.pattern.material.opacity = fadeT;
      }
    },
    dispose() {
      if (cap && solidGeo) cap.geometry = solidGeo;
      world.group.remove(group);
      for (const d of disposables) d.dispose?.();
    },
  };
}
