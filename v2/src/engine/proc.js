// three.js で作る物（ライブラリの proc: の物）。大きさは embed.js の place() で合わせる。
// - mikan : みかん（皮のつぶつぶ・ヘタ・葉）
// - magnet: U 字の磁石（赤と、先が銀）
// - bamboo: 竹の株（節のある稈が数本、上に葉）。床から天井まで届く
import * as THREE from 'three';

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function mikan() {
  const g = new THREE.Group();
  // 皮：橙色に細かいつぶつぶ（油胞）
  const peel = canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#f08a12'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = Math.random() < 0.5 ? 'rgba(255,190,60,0.5)' : 'rgba(190,80,0,0.35)';
      c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.2, 0, Math.PI * 2); c.fill();
    }
  });
  const bump = canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) {
      c.fillStyle = `rgba(30,30,30,${0.3 + Math.random() * 0.4})`;
      c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, Math.PI * 2); c.fill();
    }
  }, false);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40),
    new THREE.MeshStandardMaterial({ map: peel, bumpMap: bump, bumpScale: 2.5, roughness: 0.55 }));
  body.scale.set(1, 0.8, 1);
  g.add(body);
  // ヘタ（緑の星形）と軸、葉
  const green = new THREE.MeshStandardMaterial({ color: 0x3d6b1f, roughness: 0.6 });
  const calyx = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.04, 5), green);
  calyx.position.y = 0.8;
  g.add(calyx);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0x5b4a22, roughness: 0.8 }));
  stem.position.y = 0.88;
  g.add(stem);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.22, 0.12, 0.55, 0);
  leafShape.quadraticCurveTo(0.22, -0.12, 0, 0);
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape, 12), new THREE.MeshStandardMaterial({ color: 0x2f6a1c, roughness: 0.45, side: THREE.DoubleSide }));
  leaf.position.set(0.02, 0.94, 0);
  leaf.rotation.set(-Math.PI / 2 + 0.35, 0, 0.5);
  g.add(leaf);
  return g;
}

function magnet() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.35, metalness: 0.2 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.25, metalness: 0.9 });
  const R = 0.5; const r = 0.17; const arm = 0.55;
  const bend = new THREE.Mesh(new THREE.TorusGeometry(R, r, 20, 40, Math.PI), red);
  g.add(bend);
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(r, r, arm, 20), red);
    a.position.set(s * R, -arm / 2, 0);
    g.add(a);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.22, 20), steel);
    tip.position.set(s * R, -arm - 0.11, 0);
    g.add(tip);
  }
  return g;
}

function bamboo() {
  const g = new THREE.Group();
  const H = 4.0;
  const skin = canvasTex(64, 512, (c, w, h) => {
    const grd = c.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#4d7a2a'); grd.addColorStop(0.5, '#7aa63f'); grd.addColorStop(1, '#3f6a22');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(230,240,190,${Math.random() * 0.12})`; c.fillRect(Math.random() * w, 0, 1.5, h); }
  });
  const culmMat = new THREE.MeshStandardMaterial({ map: skin, roughness: 0.4 });
  const nodeMat = new THREE.MeshStandardMaterial({ color: 0x6e8f3a, roughness: 0.5 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f8a2a, roughness: 0.5, side: THREE.DoubleSide });
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.05, 0.03, 0.32, 0);
  leafShape.quadraticCurveTo(0.05, -0.03, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
  const n = 7;
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * Math.PI * 2 + Math.random();
    const rr = k === 0 ? 0 : 0.25 + Math.random() * 0.35;
    const h = H * (0.82 + Math.random() * 0.18);
    const rad = 0.045 + Math.random() * 0.02;
    const culm = new THREE.Group();
    culm.position.set(Math.cos(ang) * rr, 0, Math.sin(ang) * rr);
    culm.rotation.set((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.8, rad, h, 14), culmMat);
    stalk.position.y = h / 2;
    culm.add(stalk);
    for (let y = 0.3; y < h; y += 0.32 + Math.random() * 0.06) {
      const node = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.12, rad * 1.12, 0.025, 14), nodeMat);
      node.position.y = y;
      culm.add(node);
    }
    // 上のほうの節から葉
    for (let j = 0; j < 22; j++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(0, h * (0.62 + Math.random() * 0.38), 0);
      leaf.rotation.set((Math.random() - 0.5) * 0.8, Math.random() * Math.PI * 2, -0.3 - Math.random() * 0.6);
      culm.add(leaf);
    }
    g.add(culm);
  }
  return g;
}

// 冷蔵庫：下の扉が半開きで、中の明かりがもれている（正面 = +Z）
function fridge() {
  const g = new THREE.Group();
  const W = 0.68; const Hh = 1.75; const D = 0.65;
  // 白い壁に溶けないよう、昔の冷蔵庫のような淡いミント色
  const cream = new THREE.MeshStandardMaterial({ color: 0xa9d3c1, roughness: 0.35 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.2, metalness: 0.9 });
  const inner = new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.6 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false });
  // 外箱（前面だけ開いた箱）
  const t = 0.04;
  for (const [w, h, d, x, y, z] of [[W, Hh, t, 0, Hh / 2, -D], [t, Hh, D, -W / 2, Hh / 2, -D / 2], [t, Hh, D, W / 2, Hh / 2, -D / 2], [W, t, D, 0, Hh, -D / 2], [W, t, D, 0, 0, -D / 2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cream);
    b.position.set(x, y, z);
    g.add(b);
  }
  // 中：明かり・棚・仕切り
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 1.1), glow);
  back.position.set(0, 0.62, -D + 0.03);
  g.add(back);
  for (const y of [0.35, 0.7, 1.0]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(W - 0.09, 0.012, D - 0.1), new THREE.MeshStandardMaterial({ color: 0xdfe8ea, transparent: true, opacity: 0.7 }));
    sh.position.set(0, y, -D / 2 - 0.02);
    g.add(sh);
  }
  const div = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.05, D - 0.04), inner);
  div.position.set(0, 1.24, -D / 2);
  g.add(div);
  // 上の冷凍庫の扉（閉じている）
  const fz = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, 0.06), cream);
  fz.position.set(0, 1.5, 0.03);
  g.add(fz);
  const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.04), chrome);
  h1.position.set(-W / 2 + 0.07, 1.42, 0.08);
  g.add(h1);
  // 下の扉（右の蝶番で 40 度ほど開いている）
  const hinge = new THREE.Group();
  hinge.position.set(W / 2, 0, 0.03);
  hinge.rotation.y = 0.85;   // 手前（+Z）へ開く
  const door = new THREE.Mesh(new THREE.BoxGeometry(W, 1.2, 0.06), cream);
  door.position.set(-W / 2, 0.62, 0);
  hinge.add(door);
  const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, 0.04), chrome);
  h2.position.set(-W + 0.07, 0.85, 0.05);
  hinge.add(h2);
  g.add(hinge);
  return g;
}

// 能面（小面のような白い女面。正面 = +Z）
function nohMask() {
  const g = new THREE.Group();
  const face = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const x = c.getContext('2d');
    x.fillStyle = '#f3ede0'; x.fillRect(0, 0, 1024, 1024);
    // 髪：額の上を黒く覆い、中央で分けて左右のこめかみへ流す
    x.fillStyle = '#141210';
    x.beginPath();
    x.moveTo(0, 0); x.lineTo(1024, 0); x.lineTo(1024, 380);
    x.quadraticCurveTo(700, 360, 640, 250);
    x.quadraticCurveTo(560, 200, 512, 220);
    x.quadraticCurveTo(464, 200, 384, 250);
    x.quadraticCurveTo(324, 360, 0, 380);
    x.closePath(); x.fill();
    x.strokeStyle = '#f3ede0'; x.lineWidth = 6;      // 分け目
    x.beginPath(); x.moveTo(512, 60); x.lineTo(512, 215); x.stroke();
    x.strokeStyle = 'rgba(243,237,224,0.25)'; x.lineWidth = 2;   // 髪の筋
    for (let i = 0; i < 18; i++) {
      for (const sgn of [-1, 1]) {
        x.beginPath(); x.moveTo(512, 80 + i * 6); x.quadraticCurveTo(512 + sgn * 110, 160 + i * 6, 512 + sgn * (180 + i * 12), 330 + i * 2); x.stroke();
      }
    }
    // 眉（生え際の近く、額の高い位置にぼかした楕円）
    x.fillStyle = 'rgba(40,36,34,0.5)';
    for (const sgn of [-1, 1]) { x.beginPath(); x.ellipse(512 + sgn * 100, 330, 40, 17, 0, 0, Math.PI * 2); x.fill(); }
    // 目（細い切れ込み）
    x.fillStyle = '#100c0a';
    for (const sgn of [-1, 1]) { x.beginPath(); x.ellipse(512 + sgn * 95, 470, 50, 10, sgn * 0.08, 0, Math.PI * 2); x.fill(); }
    // 唇とお歯黒
    x.fillStyle = '#b8202a';
    x.beginPath(); x.ellipse(512, 700, 64, 24, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#1a1412';
    x.beginPath(); x.ellipse(512, 700, 38, 7, 0, 0, Math.PI * 2); x.fill();
    return c;
  })());
  face.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(1, 64, 48, 0, Math.PI);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: face, roughness: 0.4, side: THREE.DoubleSide }));
  m.scale.set(0.62, 0.86, 0.42);
  g.add(m);
  return g;
}

const BUILDERS = { mikan, magnet, bamboo, fridge, noh: nohMask };
export function procObject(name) {
  return (BUILDERS[name] || mikan)();
}
