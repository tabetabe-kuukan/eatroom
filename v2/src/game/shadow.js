// 空間6 第2区画：右の壁に、プレイヤーの動きについてくる人影が映る。
// プレイヤーには体がないのに、影だけがある。どこにでもいそうな、短い髪の人の立ち姿。
// 歩くと揺れ、壁から離れるほど大きく、ぼやけ、薄くなる。
import * as THREE from 'three';

// 人影の形（短い髪の、ただ立っている人）。blur でぼかし具合を変えた 2 枚を作る
function figureCanvas(blur) {
  const W = 512; const H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.filter = `blur(${blur}px)`;
  // 普通の人の立ち姿（短い髪）。上半身は濃く、足元に向かって少し薄くなる
  const body = g.createLinearGradient(0, 120, 0, H);
  body.addColorStop(0, 'rgba(0,0,0,0.9)');
  body.addColorStop(1, 'rgba(0,0,0,0.62)');
  g.fillStyle = body;
  // 体は横に広げて、肩幅を実際の人に近づける（頭はそのまま）
  g.save();
  g.translate(256, 0); g.scale(1.6, 1); g.translate(-256, 0);
  // 首
  g.fillRect(232, 205, 48, 60);
  // 胴（肩から腰へ少しすぼまる）
  g.beginPath();
  g.moveTo(186, 262);
  g.bezierCurveTo(214, 248, 298, 248, 326, 262);   // 肩の線
  g.bezierCurveTo(340, 300, 336, 420, 322, 560);   // 右の脇腹
  g.lineTo(190, 560);
  g.bezierCurveTo(176, 420, 172, 300, 186, 262);   // 左の脇腹
  g.closePath();
  g.fill();
  // 腕（体の横に下ろしている。左腕は少し前に出ている）
  g.beginPath();
  g.moveTo(186, 266); g.bezierCurveTo(160, 300, 156, 420, 160, 560);
  g.lineTo(184, 568); g.bezierCurveTo(186, 440, 194, 330, 206, 290); g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(326, 266); g.bezierCurveTo(352, 300, 360, 420, 356, 556);
  g.lineTo(332, 562); g.bezierCurveTo(330, 440, 322, 330, 306, 290); g.closePath(); g.fill();
  // 手
  g.beginPath(); g.ellipse(170, 586, 16, 26, 0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(346, 580, 16, 26, -0.1, 0, Math.PI * 2); g.fill();
  // 脚（ズボン。左右の間にすき間がある）と足
  g.beginPath();
  g.moveTo(190, 550); g.lineTo(254, 550); g.lineTo(250, 980); g.lineTo(206, 980);
  g.bezierCurveTo(200, 800, 192, 680, 190, 550); g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(262, 550); g.lineTo(322, 550);
  g.bezierCurveTo(320, 680, 312, 800, 306, 980); g.lineTo(264, 980); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(222, 990, 34, 14, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(290, 990, 34, 14, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  // 頭（短い髪で、輪郭は少しでこぼこ）
  g.fillStyle = 'rgba(0,0,0,0.95)';
  g.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const hair = Math.sin(a) < -0.2 ? 1 + 0.04 * Math.sin(a * 9) : 1;   // 上半分は髪で少しふくらむ
    const x = 256 + Math.cos(a) * 62 * hair;
    const y = 146 + Math.sin(a) * 74 * hair;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  g.filter = 'none';
  // 細かい粒（写真のようなざらつき）。影のあるところだけに乗せる
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (Math.random() - 0.5) * 60;
    d[i + 3] = Math.max(0, Math.min(255, d[i + 3] + n));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// wallX: 影が映る壁の x（部屋側の面）、z0〜z1: 影が出る範囲（第2区画）
export function playerShadow(wallX, z0, z1) {
  const group = new THREE.Group();
  const mk = (tex) => new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.7), new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0x0a0d12,
    polygonOffset: true, polygonOffsetFactor: -3,
  }));
  const sharp = mk(figureCanvas(5));   // 壁の近く
  const soft = mk(figureCanvas(18));   // 壁から遠く
  group.add(sharp, soft);
  group.rotation.y = -Math.PI / 2;     // -x 側（部屋の中）を向く
  let phase = 0; let last = null; let alpha = 0; let flip = 1;
  const update = (p, dt) => {
    const inside = p.z < z0 && p.z > z1;
    const dist = Math.max(0.2, wallX - p.x);
    alpha += ((inside ? Math.max(0.6, 1.0 - dist * 0.06) : 0) - alpha) * Math.min(1, dt * 3);
    // 壁から離れるほどぼやける（2 枚を混ぜる）
    const blurMix = Math.min(1, Math.max(0, (dist - 0.8) / 4));
    sharp.material.opacity = alpha * (1 - blurMix);
    soft.material.opacity = alpha * (0.75 + 0.25 * blurMix);
    // 歩いた分だけ揺れる。進む向きに顔を向ける
    const moved = last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
    phase += moved * 5.5;
    if (last && Math.abs(p.z - last.z) > 1e-4) flip = p.z < last.z ? 1 : -1;
    last = { x: p.x, z: p.z };
    // 壁から離れるほど大きい（光は部屋の左側から当たっている）
    const k = 1 + dist * 0.09;
    group.scale.set(flip * k, k, 1);
    group.position.set(wallX - 0.01, 0.85 * k + Math.abs(Math.sin(phase)) * 0.025, p.z - dist * 0.25);
    group.rotation.z = Math.sin(phase) * 0.015;
  };
  return { mesh: group, update };
}
