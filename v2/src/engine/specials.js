// 文字ではなく、空間そのものの変化として見せる検索ワード（v2/objects/specials.mjs）。
// どれも { mesh, width, height, lit, update?, place } を返す。
//   place = 'surface' : 面に貼る（mesh の +Z が面の外向き、+Y が上）
//   place = 'world'   : すでにワールド座標で組み立ててある（日光・水）
import * as THREE from 'three';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ちぎれたような縁の形（塗り・銀の板・水たまり）
function blob(g, w, h, rough = 0.18, seed = Math.random() * 10) {
  g.beginPath();
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - rough * (0.5 + 0.5 * Math.sin(a * 5 + seed) * Math.sin(a * 3.1 + seed * 2)) - Math.random() * rough * 0.4;
    const x = w / 2 + Math.cos(a) * (w / 2) * k; const y = h / 2 + Math.sin(a) * (h / 2) * k;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}

// ---------------------------------------------------------------- 黄色い壁（壁の一部が床から天井まで塗られている）
function paint({ color, ceil }) {
  const H = ceil - 0.06;
  const W = 3.4;
  const tex = canvasTex(512, 512 * (H / W), (g, w, h) => {
    g.fillStyle = color;
    // 左右の端は刷毛でかすれ、下には垂れ
    g.fillRect(w * 0.08, 0, w * 0.84, h);
    for (let i = 0; i < 70; i++) {
      const side = Math.random() < 0.5 ? 0 : 1;
      const x = side ? w * (0.9 + Math.random() * 0.09) : w * Math.random() * 0.1;
      g.globalAlpha = 0.3 + Math.random() * 0.6;
      g.fillRect(x, Math.random() * h, 2 + Math.random() * 10, 20 + Math.random() * 160);
    }
    g.globalAlpha = 1;
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({
    map: tex, transparent: true, alphaTest: 0.05, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  return { mesh: m, width: W, height: H, lit: true, yCenter: H / 2 + 0.03, place: 'surface' };
}

// ---------------------------------------------------------------- 銀色の板（壁や床が銀になる）
function silver({ kind }) {
  const W = kind === 'floor' ? 2.6 : 2.0; const H = kind === 'floor' ? 2.2 : 1.5;
  const alpha = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#fff'; blob(g, w, h, 0.12); g.fill(); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({
    color: 0xdfe3e8, metalness: 1.0, roughness: 0.12, envMapIntensity: 1.6, alphaMap: alpha, transparent: true,
    alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  return { mesh: m, width: W, height: H, lit: false, place: 'surface' };
}

// ---------------------------------------------------------------- 天井の四角い穴から差し込む日光
function sunbeam({ pos, ceil, night }) {
  const g = new THREE.Group();
  const S = 1.3;
  const off = new THREE.Vector3(0.45, 0, 0.25).multiplyScalar(ceil);   // 光は斜めに差す
  const top = new THREE.Vector3(pos[0] - off.x / 2, ceil - 0.01, pos[2] - off.z / 2);
  const bottom = new THREE.Vector3(top.x + off.x, 0.004, top.z + off.z);
  const sun = night ? new THREE.Color(0.55, 0.65, 0.9) : new THREE.Color(1.0, 0.95, 0.8);
  // 天井の穴（まぶしい四角）と縁
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: sun.clone().multiplyScalar(night ? 0.6 : 2.2), toneMapped: false }));
  hole.position.copy(top);
  g.add(hole);
  const rim = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  for (const [w, d, x, z] of [[S + 0.08, 0.04, 0, S / 2], [S + 0.08, 0.04, 0, -S / 2], [0.04, S, S / 2, 0], [0.04, S, -S / 2, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), rim);
    b.position.set(top.x + x, top.y - 0.005, top.z + z);
    g.add(b);
  }
  // 光の柱（上ほど明るく、下で消える）
  const grad = canvasTex(4, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0.15)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const geo = new THREE.BufferGeometry();
  const h = S / 2;
  const c4 = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const pts = []; const uvs = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = c4[i]; const [bx, bz] = c4[(i + 1) % 4];
    const quad = [[ax, az, 0], [bx, bz, 0], [bx, bz, 1], [ax, az, 0], [bx, bz, 1], [ax, az, 1]];
    for (const [x, z, t] of quad) {
      pts.push(top.x + x + off.x * t, top.y + (bottom.y - top.y) * t, top.z + z + off.z * t);
      uvs.push(0.5, t);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: grad, color: sun, transparent: true, opacity: night ? 0.12 : 0.2, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }));
  g.add(beam);
  // 床に落ちた光
  const spot = canvasTex(128, 128, (c, w) => {
    const gr = c.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w * 0.55);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, w);
  });
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(S * 1.25, S * 1.25).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    map: spot, color: sun, transparent: true, opacity: night ? 0.3 : 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  }));
  patch.position.copy(bottom);
  g.add(patch);
  // 光の中を漂うほこり
  const N = 70;
  const dust = new Float32Array(N * 3);
  const seeds = Array.from({ length: N }, () => [Math.random(), Math.random() - 0.5, Math.random() - 0.5]);
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dots = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: sun, size: 0.012, transparent: true, opacity: 0.8, depthWrite: false }));
  g.add(dots);
  const update = (t) => {
    for (let i = 0; i < N; i++) {
      const [s0, sx, sz] = seeds[i];
      const k = (s0 + t * 0.01) % 1;
      dust[i * 3] = top.x + sx * S * 0.9 + off.x * k + Math.sin(t * 0.3 + i) * 0.03;
      dust[i * 3 + 1] = top.y + (bottom.y - top.y) * k;
      dust[i * 3 + 2] = top.z + sz * S * 0.9 + off.z * k + Math.cos(t * 0.27 + i) * 0.03;
    }
    dGeo.attributes.position.needsUpdate = true;
  };
  update(0);
  return { mesh: g, width: S, height: S, lit: false, update, place: 'world' };
}

// ---------------------------------------------------------------- 水（天井から流れ落ちる、または滴って水たまりになる）
function water({ pos, ceil }) {
  const g = new THREE.Group();
  const [x, , z] = pos;
  const stream = Math.random() < 0.6;
  // 水たまり
  const R = stream ? 1.1 : 0.85;
  const shape = new THREE.Shape();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const k = 1 - 0.18 * (0.5 + 0.5 * Math.sin(a * 4 + x) * Math.sin(a * 2.3 + z));
    const px = Math.cos(a) * R * k; const pz = Math.sin(a) * R * k * 0.8;
    if (i === 0) shape.moveTo(px, pz); else shape.lineTo(px, pz);
  }
  const puddle = new THREE.Mesh(new THREE.ShapeGeometry(shape, 2).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({
    color: 0x24323b, roughness: 0.03, metalness: 0.3, transparent: true, opacity: 0.6, envMapIntensity: 1.8,
    polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide,
  }));
  puddle.position.set(x, 0.004, z);
  g.add(puddle);
  // 天井の濡れたしみ
  const wet = new THREE.Mesh(new THREE.CircleGeometry(0.35, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8c9399, transparent: true, opacity: 0.5 }));
  wet.position.set(x, ceil - 0.005, z);
  g.add(wet);
  // 波紋
  const rings = [];
  const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40).rotateX(-Math.PI / 2), ringMat());
    r.position.set(x, 0.008, z);
    r.userData.t0 = -10;
    g.add(r);
    rings.push(r);
  }
  let nextRing = 0; let ri = 0;
  // 流れ落ちる水（縦の筋が流れるテクスチャを十字に 2 枚）
  let streamTex = null;
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: 0xdfe8ef, roughness: 0.05, metalness: 0.2 }));
  if (stream) {
    streamTex = canvasTex(64, 256, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        c.fillStyle = `rgba(225,238,248,${0.25 + Math.random() * 0.6})`;
        c.fillRect(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 3, 30 + Math.random() * 120);
      }
    });
    streamTex.wrapT = THREE.RepeatWrapping;
    streamTex.repeat.set(1, ceil / 1.2);
    for (const rot of [0, Math.PI / 2]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.12, ceil), new THREE.MeshBasicMaterial({ map: streamTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      p.position.set(x, ceil / 2, z);
      p.rotation.y = rot;
      g.add(p);
    }
  } else {
    drop.position.set(x, ceil - 0.05, z);
    g.add(drop);
  }
  let dropT = 0; let last = null;
  const update = (t) => {
    const dt = last === null ? 0 : Math.min(0.05, t - last);
    last = t;
    if (streamTex) {
      streamTex.offset.y = (streamTex.offset.y + dt * 1.8) % 1;
      if (t > nextRing) { const r = rings[ri++ % rings.length]; r.userData.t0 = t; r.position.x = x + (Math.random() - 0.5) * 0.1; nextRing = t + 0.22; }
    } else {
      // 1 滴ずつ落ちて、水たまりに波紋が広がる
      dropT += dt;
      const fall = Math.min(1, (dropT * dropT * 4.9) / (ceil - 0.05));
      drop.position.y = (ceil - 0.05) * (1 - fall);
      if (fall >= 1) {
        const r = rings[ri++ % rings.length]; r.userData.t0 = t;
        dropT = -0.8 - Math.random() * 1.2;
      }
      drop.visible = dropT >= 0;
    }
    for (const r of rings) {
      const a = t - r.userData.t0;
      const k = Math.min(1, a / 1.6);
      r.scale.setScalar(0.05 + k * (streamTex ? 0.5 : 0.7));
      r.material.opacity = a < 1.6 ? 0.45 * (1 - k) : 0;
    }
  };
  return { mesh: g, width: R * 2, height: R * 2, lit: false, update, place: 'world' };
}

// ---------------------------------------------------------------- のぞき穴（覗くと奥に言葉が見える）
function peephole({ words }) {
  const g = new THREE.Group();
  const r = 0.12; const depth = 0.7;
  const text = words.join('　');
  const back = canvasTex(512, 512, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gr.addColorStop(0, '#f4e6c8'); gr.addColorStop(1, '#7a6040');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1a120a';
    let size = 150;
    c.font = `bold ${size}px "TabetabeDocSerif","Hiragino Mincho ProN","Yu Mincho",serif`;
    while (c.measureText(text).width > w * 0.8 && size > 40) { size -= 6; c.font = `bold ${size}px "TabetabeDocSerif","Hiragino Mincho ProN","Yu Mincho",serif`; }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, w / 2, h / 2);
  });
  // 穴の中は筒状の奥行きがあるように見せる（視線から奥の面のどこが見えるかを計算する）
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: back }, uCam: { value: new THREE.Vector3(0, 0, 1) }, depth: { value: depth }, radius: { value: r } },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 uCam; uniform float depth; uniform float radius; varying vec3 vPos;
      void main(){
        vec3 dir = normalize(vPos - uCam);
        if (dir.z > -0.0001) { gl_FragColor = vec4(0.02,0.015,0.01,1.0); return; }
        float t = (-depth - vPos.z) / dir.z;
        vec2 hit = vPos.xy + dir.xy * t;
        vec3 col;
        if (length(hit) < radius) {
          col = texture2D(map, hit / (radius * 2.0) + 0.5).rgb;
        } else {
          // 筒の内側（暗い木の色）
          col = vec3(0.05, 0.035, 0.02) * (1.6 - smoothstep(radius, radius * 4.0, length(hit)));
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const disk = new THREE.Mesh(new THREE.CircleGeometry(r, 40), mat);
  disk.onBeforeRender = (renderer, scene, camera) => { mat.uniforms.uCam.value.copy(disk.worldToLocal(camera.position.clone())); };
  disk.position.z = 0.003;
  g.add(disk);
  // 真鍮の縁
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.012, 0.014, 10, 40), new THREE.MeshStandardMaterial({ color: 0xa8833a, metalness: 0.8, roughness: 0.35 }));
  ring.position.z = 0.005;
  g.add(ring);
  return { mesh: g, width: 0.3, height: 0.3, lit: false, yCenter: 1.5, place: 'surface' };
}

// ---------------------------------------------------------------- 作品名の札（キャプション）
function caption({ words }) {
  const text = words.join(' ');
  const tex = canvasTex(900, 560, (g, w, h) => {
    g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2b2824'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#161310';
    g.font = 'bold 190px "TabetabeDocSerif","Hiragino Mincho ProN","Yu Mincho",serif';
    g.fillText(text, 60, 250);
    g.fillStyle = 'rgba(40,36,32,0.35)';
    g.fillRect(64, 340, 520, 18); g.fillRect(64, 384, 380, 18); g.fillRect(64, 428, 450, 18);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.31), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  return { mesh: m, width: 0.5, height: 0.31, lit: true, place: 'surface' };
}

// ---------------------------------------------------------------- 万華鏡の壁紙（幾何学模様が壁一面に貼られている）
function wallpaper({ ceil }) {
  const H = ceil - 0.06;
  const W = 3.6;
  // 1 枚の柄：12 回対称の万華鏡の模様
  const tile = document.createElement('canvas');
  tile.width = tile.height = 256;
  const t = tile.getContext('2d');
  const PAL = ['#e2394f', '#f7b32b', '#2e86de', '#2bb673', '#8e44ad', '#f0e6d2'];
  t.fillStyle = '#1b1430'; t.fillRect(0, 0, 256, 256);
  t.translate(128, 128);
  for (let k = 0; k < 12; k++) {
    t.save();
    t.rotate((k / 12) * Math.PI * 2);
    if (k % 2) t.scale(1, -1);   // 鏡に映したように左右を反転
    t.fillStyle = PAL[0]; t.beginPath(); t.moveTo(0, 0); t.lineTo(30, 100); t.lineTo(-6, 118); t.closePath(); t.fill();
    t.fillStyle = PAL[1]; t.beginPath(); t.ellipse(18, 60, 9, 22, 0.3, 0, Math.PI * 2); t.fill();
    t.fillStyle = PAL[2]; t.beginPath(); t.moveTo(10, 20); t.lineTo(26, 34); t.lineTo(8, 44); t.closePath(); t.fill();
    t.fillStyle = PAL[3]; t.beginPath(); t.arc(22, 100, 7, 0, Math.PI * 2); t.fill();
    t.fillStyle = PAL[4]; t.fillRect(4, 76, 10, 10);
    t.fillStyle = PAL[5]; t.beginPath(); t.arc(6, 12, 4, 0, Math.PI * 2); t.fill();
    t.restore();
  }
  const tex = canvasTex(1024, Math.round(1024 * (H / W)), (g, w, h) => {
    g.fillStyle = g.createPattern(tile, 'repeat');
    g.fillRect(0, 0, w, h);
    // 左右の端は破れてめくれている
    g.globalCompositeOperation = 'destination-out';
    for (const side of [0, 1]) {
      g.beginPath();
      g.moveTo(side ? w : 0, 0);
      for (let y = 0; y <= h; y += 24) g.lineTo(side ? w - (10 + Math.random() * 60) : 10 + Math.random() * 60, y);
      g.lineTo(side ? w : 0, h);
      g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({
    map: tex, transparent: true, alphaTest: 0.05, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  return { mesh: m, width: W, height: H, lit: true, yCenter: H / 2 + 0.03, place: 'surface' };
}

// ---------------------------------------------------------------- 大きな木の幹のうろ（中に言葉が琥珀色に光っている）
function treehollow({ pos, ceil, words }) {
  const g = new THREE.Group();
  const R = 0.85;
  // 樹皮：茶色の地に、縦に走る深い溝と明るい稜線（色は茶色だけ）
  const bark = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#5b4030'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w;
      const dark = Math.random() < 0.6;
      c.strokeStyle = dark ? `rgba(30,20,12,${0.5 + Math.random() * 0.4})` : `rgba(140,108,80,${0.3 + Math.random() * 0.3})`;
      c.lineWidth = dark ? 3 + Math.random() * 6 : 1 + Math.random() * 2;
      c.beginPath(); c.moveTo(x, 0);
      for (let y = 0; y <= h; y += 16) c.lineTo(x + Math.sin(y * 0.02 + i * 1.7) * 4 + (Math.random() - 0.5) * 2, y);
      c.stroke();
    }
  });
  bark.wrapS = bark.wrapT = THREE.RepeatWrapping;
  bark.repeat.set(2, 1.5);
  const barkMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 });
  const y0 = 1.0; const y1 = 1.95;       // うろの高さ
  const open = (80 * Math.PI) / 180;      // うろの開き（正面 +Z）
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.18, y0, 40), barkMat);
  lower.position.y = y0 / 2;
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(R, R, y1 - y0, 40, 1, true, open / 2, Math.PI * 2 - open), barkMat);
  mid.position.y = (y0 + y1) / 2;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, R, ceil - y1, 40), barkMat);
  upper.position.y = y1 + (ceil - y1) / 2;
  g.add(lower, mid, upper);
  // 根元は床に向かって大きく広がる
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.18, R * 1.55, 0.35, 40), barkMat);
  flare.position.y = 0.175;
  g.add(flare);
  // うろの中（暗い空洞）
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c120a, roughness: 1, side: THREE.BackSide });
  const cavity = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.82, R * 0.82, y1 - y0 - 0.04, 32), dark);
  cavity.position.y = (y0 + y1) / 2;
  g.add(cavity);
  // 奥に、琥珀色に光る言葉（樹脂が垂れている）
  const text = words.join('　');
  const amber = canvasTex(512, 360, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#ffb43a';
    c.shadowColor = '#ff9a1a'; c.shadowBlur = 24;
    let size = 170;
    c.font = `bold ${size}px "TabetabeDocSerif","Hiragino Mincho ProN","Yu Mincho",serif`;
    while (c.measureText(text).width > w * 0.9 && size > 50) { size -= 8; c.font = `bold ${size}px "TabetabeDocSerif","Hiragino Mincho ProN","Yu Mincho",serif`; }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, w / 2, h * 0.42);
    // 垂れる樹脂
    c.shadowBlur = 10;
    for (let i = 0; i < 9; i++) {
      const x = w * 0.2 + Math.random() * w * 0.6; const len = 30 + Math.random() * 110;
      c.fillRect(x, h * 0.55, 5 + Math.random() * 5, len);
      c.beginPath(); c.arc(x + 4, h * 0.55 + len, 8, 0, Math.PI * 2); c.fill();
    }
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ map: amber, transparent: true, toneMapped: false, depthWrite: false }));
  glow.position.set(0, (y0 + y1) / 2 + 0.05, -R * 0.55);
  g.add(glow);
  // うろの口を、奥へ進んでくる人の方へ少し向ける
  g.position.set(pos[0], 0, pos[2]);
  g.rotation.y = Math.atan2(-pos[0], 3.5);
  return { mesh: g, width: 2 * R, height: ceil, lit: false, litParts: [lower, mid, upper, cavity, flare], place: 'world' };
}

const BUILDERS = { paint, silver, sunbeam, water, peephole, caption, wallpaper, treehollow };
export function buildSpecial(type, ctx) {
  return (BUILDERS[type] || paint)(ctx);
}
