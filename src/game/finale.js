// 空間6「お前」：痕跡はプレイヤー自身のプレイ記録から作る。
// - 第1区画: 空間1〜5で歩いた経路を、プールサイドの濡れた足跡として再現する
// - 第2区画: 入力した不正解の答えを、壁に書かれた文字として残す
// - 第3区画: 画面の方を向いた椅子と、何も映らない鏡（プレイヤーには体がないので、映るのは空っぽの部屋だけ）
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

function footprintTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(32, 52, 24, 46, 0, 0, Math.PI * 2); g.fill();      // つま先側
  g.beginPath(); g.ellipse(32, 126, 18, 28, 0, 0, Math.PI * 2); g.fill();     // かかと
  // 足指
  for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(14 + i * 9, 10 + Math.abs(i - 1.5) * 3, 5 - i * 0.5, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 経路を間引いて、足跡の位置と向きの列に変える
function stepsFromPath(path, mapX, mapZ, stride = 0.6) {
  const out = [];
  if (path.length < 2) return out;
  let acc = 0;
  let side = 1;
  for (let i = 1; i < path.length; i++) {
    const ax = mapX(path[i - 1][0]); const az = mapZ(path[i - 1][1]);
    const bx = mapX(path[i][0]); const bz = mapZ(path[i][1]);
    const dx = bx - ax; const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    let t = (stride - acc) / len;
    while (t <= 1) {
      const x = ax + dx * t; const z = az + dz * t;
      const ang = Math.atan2(dx, dz);
      const nx = Math.cos(ang) * 0.08 * side; const nz = -Math.sin(ang) * 0.08 * side;
      out.push({ x: x + nx, z: z + nz, ang, side });
      side *= -1;
      t += stride / len;
    }
    acc = (acc + len) % stride;
  }
  return out;
}

function writingTexture(lines) {
  const W = 2048; const H = 320;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const fonts = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","BIZ UDMincho",serif';
  const words = lines.length ? lines : ['（まちがいは、ひとつもなかった）'];
  let x = 40;
  let row = 0;
  for (const w of words) {
    const size = lines.length ? 46 + Math.random() * 40 : 40;
    g.font = `${size}px ${fonts}`;
    const wd = g.measureText(w).width;
    if (x + wd > W - 40) { x = 40 + Math.random() * 80; row++; }
    if (row > 2) break;
    const y = 80 + row * 100 + Math.random() * 20;
    g.save();
    g.translate(x, y);
    g.rotate((Math.random() - 0.5) * 0.12);
    g.fillStyle = lines.length ? 'rgba(40,20,20,0.85)' : 'rgba(40,40,40,0.5)';
    g.fillText(w, 0, 0);
    // 書いてから線で消したあと
    if (lines.length) {
      g.strokeStyle = 'rgba(40,20,20,0.7)';
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(-6, -size * 0.35); g.lineTo(wd + 6, -size * 0.3); g.stroke();
    }
    g.restore();
    x += wd + 60 + Math.random() * 80;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function waterMaterial() {
  // 揺らぎの法線（キャンバスの雑音から作る）
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const v = Math.sin(x * 0.11 + Math.sin(y * 0.07) * 2) * 0.5 + Math.sin(y * 0.13 + Math.cos(x * 0.05) * 2) * 0.5;
      const nx = Math.cos(x * 0.11) * 0.3; const ny = Math.cos(y * 0.13) * 0.3;
      const i = (y * 256 + x) * 4;
      img.data[i] = 128 + nx * 127; img.data[i + 1] = 128 + ny * 127; img.data[i + 2] = 230 + v * 20; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const n = new THREE.CanvasTexture(c);
  n.wrapS = n.wrapT = THREE.RepeatWrapping;
  n.repeat.set(4, 12);
  return new THREE.MeshStandardMaterial({
    color: 0x1f6e6a, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.82,
    normalMap: n, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.2,
  });
}

export function decorateFinal(world, scene, state, spaces) {
  const meta = world.meta;
  const group = new THREE.Group();
  world.group.add(group);
  const disposables = [];

  // ---- 水面
  let water = null;
  world.group.traverse((o) => {
    let p = o; let isWater = false;
    for (; p; p = p.parent) if (p.userData?.water) { isWater = true; break; }
    if (o.isMesh && isWater) { o.material = waterMaterial(); water = o; disposables.push(o.material); }
  });

  // ---- 第1区画：足跡（空間1〜5で歩いた経路）
  const a = meta.markers.footprints.pos;
  const b = meta.markers.footprints_end.pos;
  const laneW = 2.2;
  const steps = [];
  spaces.filter((s) => !s.final).forEach((s, i) => {
    let path = state.spaces[s.id]?.path || [];
    if (path.length < 4) {
      // 記録がない場合（直接開いたときなど）は、ゆらぐ一本道を代わりに使う
      path = Array.from({ length: 40 }, (_, k) => [Math.sin(k * 0.4 + i) * 0.8, -k * 1.5]);
    }
    const xs = path.map((p) => p[0]); const zs = path.map((p) => p[1]);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
    // 横幅はプールサイドに収め、奥行き（歩いた向き）は第1区画の長さに合わせる
    const sx = laneW / Math.max(4, maxX - minX);
    const off = (i - 2) * 0.18;
    const mapX = (x) => a[0] - laneW / 2 + (x - minX) * sx + off;
    const mapZ = (z) => a[2] + ((maxZ - z) / Math.max(1, maxZ - minZ)) * (b[2] - a[2]);
    steps.push(...stepsFromPath(path, mapX, mapZ, 0.62));
  });
  const tex = footprintTexture();
  disposables.push(tex);
  const fpMat = new THREE.MeshBasicMaterial({ map: tex, color: 0x31403f, transparent: true, opacity: 0.55, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, alphaTest: 0.1 });
  const fpGeo = new THREE.PlaneGeometry(0.11, 0.27).rotateX(-Math.PI / 2);
  disposables.push(fpMat, fpGeo);
  const count = Math.min(steps.length, 1500);
  const inst = new THREE.InstancedMesh(fpGeo, fpMat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const s = steps[i];
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.ang + Math.PI);
    sc.set(s.side > 0 ? -1 : 1, 1, 1);
    m.compose(new THREE.Vector3(s.x, 0.012, s.z), q, sc);
    inst.setMatrixAt(i, m);
  }
  group.add(inst);

  // ---- 第2区画：壁に書かれた、不正解の答え
  const wrong = spaces.flatMap((s) => state.spaces[s.id]?.wrong || []).slice(-40);
  const wt = writingTexture(wrong);
  disposables.push(wt);
  const wm = new THREE.MeshBasicMaterial({ map: wt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const wg = new THREE.PlaneGeometry(13, 2.0);
  disposables.push(wm, wg);
  const wall = new THREE.Mesh(wg, wm);
  const wp = meta.markers.writing.pos;
  wall.position.set(wp[0] + 0.01, wp[1], wp[2]);
  wall.rotation.y = Math.PI / 2;
  group.add(wall);

  // ---- 第3区画：何も映らない鏡
  const mp = meta.markers.mirror.pos;
  const mirror = new Reflector(new THREE.PlaneGeometry(1.4, 2.0), {
    textureWidth: Math.round(innerWidth * 0.5), textureHeight: Math.round(innerHeight * 0.5), color: 0x8a9493, clipBias: 0.003,
  });
  mirror.position.set(mp[0], mp[1], mp[2]);
  // 鏡は手前（+z 方向 = Blender の -y）を向く
  mirror.rotation.y = 0;
  group.add(mirror);
  disposables.push(mirror.getRenderTarget(), mirror.material, mirror.geometry);

  return {
    update(t) {
      if (water) {
        const n = water.material.normalMap;
        n.offset.set(Math.sin(t * 0.05) * 0.2, t * 0.01);
      }
    },
    dispose() {
      world.group.remove(group);
      for (const d of disposables) d.dispose?.();
    },
  };
}
