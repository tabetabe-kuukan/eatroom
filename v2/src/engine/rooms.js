// 部屋モジュール（Blender で焼いた room_xxx）を 3 つ並べて 1 つの空間にする。
// 区画 i の部屋は z = -15·i の位置に置く。meta（当たり判定・検索ワードの場所など）も同じだけずらす。
// 夜（検索ワードに「夜」がある）のときは夜のライトマップを読み、天井の照明パネルを消す。
import * as THREE from 'three';
import { applyBakedLight, lightmapReader } from './embed.js';
import { loadSpace } from './world.js';

// 部屋の長さは部屋ごとに違う（第3区画は短い）。meta.module.length を使う
const lengthOf = (m) => m.meta.module?.length ?? 15;

// 空：昼は青空と雲、夜は紺の空と星。霧はかけない（部屋の上だけに見える）
function skyDome(night) {
  // 真上を見ても継ぎ目が出ないよう、高い所に大きな平面を 1 枚置く（中心ほど濃い空）
  const N = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N * 0.7);
  if (night) { grd.addColorStop(0, '#02040c'); grd.addColorStop(1, '#16203a'); }
  else { grd.addColorStop(0, '#2f6fca'); grd.addColorStop(0.6, '#8bbcec'); grd.addColorStop(1, '#d6e8f7'); }
  g.fillStyle = grd; g.fillRect(0, 0, N, N);
  if (night) {
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
      g.beginPath(); g.arc(Math.random() * N, Math.random() * N, Math.random() < 0.05 ? 1.8 : 0.9, 0, Math.PI * 2); g.fill();
    }
  } else {
    // 雲（やわらかい白いかたまり）
    for (let k = 0; k < 34; k++) {
      const cx = Math.random() * N; const cy = Math.random() * N; const a = Math.random() * Math.PI;
      for (let j = 0; j < 9; j++) {
        const x = cx + Math.cos(a) * j * 18; const y = cy + Math.sin(a) * j * 18 + Math.sin(j) * 8;
        const r = 20 + Math.random() * 42;
        const gg = g.createRadialGradient(x, y, 0, x, y, r);
        gg.addColorStop(0, 'rgba(255,255,255,0.85)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(160, 160).rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false, toneMapped: false, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 30;
  m.renderOrder = -1;
  const holder = new THREE.Group();
  holder.add(m);
  return holder;
}

export async function loadRooms(variants, look, renderer, { night = false, onProgress = () => {} } = {}) {
  const prog = variants.map(() => 0);
  // 区画が進むほど狭い部屋（room_xxx_s1 〜 s3）
  const mods = await Promise.all(variants.map((v, i) => loadSpace({ tag: `room_${v}_s${Math.min(i + 1, 3)}`, look, night }, renderer, (p) => {
    prog[i] = p; onProgress(prog.reduce((a, b) => a + b, 0) / prog.length);
  })));

  const group = new THREE.Group();
  const meta = { slots: [], colliders: [], floors: [], lights: [], zones: [100], spawn: null };
  const world = {
    group, meta, modules: mods, night, variants,
    lmMaterials: [], vlitMaterials: [], flickerMaterials: [], lights: [],
    colliders: meta.colliders,
    dispose() { for (const m of mods) m.dispose(); },
  };
  // 各部屋の始まりの位置（奥へ -z）
  const starts = [];
  let acc = 0;
  for (const m of mods) { starts.push(acc); acc += lengthOf(m); }
  world.starts = starts;
  world.totalLength = acc;
  mods.forEach((m, i) => {
    const dz = -starts[i];
    m.group.position.z = dz;
    group.add(m.group);
    const mm = m.meta;
    for (const s of mm.slots || []) meta.slots.push({ ...s, zone: i + 1, room: i, pos: [s.pos[0], s.pos[1], s.pos[2] + dz] });
    for (const c of mm.colliders || []) meta.colliders.push({ ...c, z: c.z + dz });
    for (const f of mm.floors || []) meta.floors.push({ ...f, z0: f.z0 + dz, z1: f.z1 + dz });
    for (const l of mm.lights || []) meta.lights.push({ ...l, pos: [l.pos[0], l.pos[1], l.pos[2] + dz] });
    if (i > 0) meta.zones.push(-(starts[i] - 0.5));
    world.lmMaterials.push(...m.lmMaterials);
    world.vlitMaterials.push(...m.vlitMaterials);
    world.flickerMaterials.push(...m.flickerMaterials);
    world.lights.push(...m.lights);
    if (night) {
      // 天井の照明パネルは夜は消えている
      m.group.traverse((o) => {
        if (o.isMesh && /light_panel/.test(o.material?.name || '')) { o.material.emissiveIntensity = 0; o.material.userData.baseEm = 0; }
      });
    }
  });
  // 天井のない部屋（空）には、上に空を描く
  variants.forEach((v, i) => {
    if (v !== 'sky') return;
    const dims = mods[i].meta.module || { width: 9, height: 4.6 };
    const sky = skyDome(night);
    sky.position.set(0, dims.height, -starts[i] - lengthOf(mods[i]) / 2);
    group.add(sky);
  });
  meta.spawn = mods[0].meta.spawn;
  group.updateMatrixWorld(true);

  // 最初と最後の部屋の外側の開口をふさぐ
  const capMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.88, 0.88, 0.87), roughness: 0.85 });
  for (const [i, z, nz] of [[0, -0.075, -1], [mods.length - 1, -acc + 0.075, 1]]) {
    const mod = mods[i].meta.module || { door: 2.6, doorH: 3.7 };
    const cap = new THREE.Mesh(new THREE.BoxGeometry(mod.door, mod.doorH, 0.15), capMat);
    cap.position.set(0, mod.doorH / 2, z);
    const read = lightmapReader(mods[i]);
    const n = new THREE.Vector3(0, 0, nz);
    const irr = read ? read(new THREE.Vector3(mod.door / 2 + 0.5, 1.6, z + nz * 0.075), n) : new THREE.Color(0.5, 0.5, 0.5);
    applyBakedLight(cap, mods[i], irr, new THREE.Vector3(0, 1, 0).addScaledVector(n, 0.9).normalize());
    world.lmMaterials.push(cap.material);
    group.add(cap);
    meta.colliders.push({ x: 0, z, hx: mod.door / 2, hz: 0.1, rot: 0 });
  }
  return world;
}
