// 一人称の移動と当たり判定。
// PC: WASD / 矢印キーで移動、マウスで視点（クリックでポインターロック）、Shift で走る
// スマホ: 画面左のバーチャルジョイスティックで移動、右側ドラッグで視点
import * as THREE from 'three';

const EYE = 1.6;
const RADIUS = 0.3;
const WALK = 1.9;
const RUN = 3.6;

export function createPlayer(camera, canvas, ui) {
  const pos = new THREE.Vector3();
  const vel = new THREE.Vector2();
  let yaw = 0;
  let pitch = 0;
  let enabled = false;
  let colliders = [];
  const keys = new Set();
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const look = { id: null, lx: 0, ly: 0 };
  let bob = 0;
  let stepDist = 0;
  let onStep = () => {};
  let lockLost = () => {};

  // ポインターロックが使えない環境（埋め込み表示など）でもエラーにしない
  function requestLock() {
    try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* noop */ }
  }

  // ---- キーボード / マウス
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('click', () => {
    if (enabled && !isTouch && document.pointerLockElement !== canvas) requestLock();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) lockLost();
  });
  document.addEventListener('mousemove', (e) => {
    if (!enabled || document.pointerLockElement !== canvas) return;
    yaw -= e.movementX * 0.0022;
    pitch -= e.movementY * 0.0022;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
  });

  // ---- タッチ
  let isTouch = false;
  const stick = ui.stick;
  const knob = ui.knob;
  canvas.addEventListener('touchstart', (e) => {
    isTouch = true;
    if (!enabled) return;
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && joy.id === null) {
        joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = 0; joy.y = 0;
        stick.style.left = `${t.clientX}px`; stick.style.top = `${t.clientY}px`;
        stick.classList.add('on');
      } else if (look.id === null) {
        look.id = t.identifier; look.lx = t.clientX; look.ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        const dx = t.clientX - joy.ox;
        const dy = t.clientY - joy.oy;
        const len = Math.hypot(dx, dy);
        const max = 55;
        const k = len > max ? max / len : 1;
        joy.x = (dx * k) / max; joy.y = (dy * k) / max;
        knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      } else if (t.identifier === look.id) {
        yaw -= (t.clientX - look.lx) * 0.005;
        pitch -= (t.clientY - look.ly) * 0.005;
        pitch = Math.max(-1.4, Math.min(1.4, pitch));
        look.lx = t.clientX; look.ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        joy.id = null; joy.x = 0; joy.y = 0;
        knob.style.transform = '';
        stick.classList.remove('on');
      } else if (t.identifier === look.id) look.id = null;
    }
  };
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  // ---- 当たり判定（円と、回転した箱／円）
  function resolve(p) {
    for (let iter = 0; iter < 3; iter++) {
      for (const c of colliders) {
        if (c.r !== undefined) {
          const dx = p.x - c.x;
          const dz = p.z - c.z;
          const d = Math.hypot(dx, dz);
          const min = c.r + RADIUS;
          if (d < min && d > 1e-6) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
          continue;
        }
        const cs = Math.cos(c.rot);
        const sn = Math.sin(c.rot);
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        // ローカル座標へ（rotation.y = rot の逆回転）
        const lx = dx * cs - dz * sn;
        const lz = dx * sn + dz * cs;
        const qx = Math.max(-c.hx, Math.min(c.hx, lx));
        const qz = Math.max(-c.hz, Math.min(c.hz, lz));
        let ex = lx - qx;
        let ez = lz - qz;
        let d = Math.hypot(ex, ez);
        let nlx;
        let nlz;
        if (d < 1e-6) {
          // 中心が箱の中: 一番近い面から押し出す
          const px = c.hx - Math.abs(lx);
          const pz = c.hz - Math.abs(lz);
          if (px < pz) { nlx = Math.sign(lx) * (c.hx + RADIUS); nlz = lz; } else { nlx = lx; nlz = Math.sign(lz) * (c.hz + RADIUS); }
        } else if (d < RADIUS) {
          nlx = qx + (ex / d) * RADIUS;
          nlz = qz + (ez / d) * RADIUS;
        } else continue;
        p.x = c.x + nlx * cs + nlz * sn;
        p.z = c.z - nlx * sn + nlz * cs;
      }
    }
  }

  function update(dt) {
    if (!enabled) { vel.set(0, 0); return; }
    let f = 0;
    let s = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
    if (joy.id !== null) { f -= joy.y; s += joy.x; }
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || (joy.id !== null && Math.hypot(joy.x, joy.y) > 0.95);
    const speed = running ? RUN : WALK;
    // 前方 = -Z を yaw だけ回す
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const tx = (fx * f + rx * s) * speed;
    const tz = (fz * f + rz * s) * speed;
    const a = 1 - Math.exp(-dt * 10);
    vel.x += (tx - vel.x) * a;
    vel.y += (tz - vel.y) * a;
    const before = pos.clone();
    pos.x += vel.x * dt;
    pos.z += vel.y * dt;
    resolve(pos);
    const moved = Math.hypot(pos.x - before.x, pos.z - before.z);
    stepDist += moved;
    if (stepDist > (running ? 0.95 : 0.72)) { stepDist = 0; onStep(running); }
    bob += moved * (running ? 7.5 : 8.5);
    const bobAmt = Math.min(1, Math.hypot(vel.x, vel.y) / WALK);
    camera.position.set(pos.x, EYE + Math.sin(bob) * 0.025 * bobAmt, pos.z);
    camera.rotation.set(pitch, yaw, Math.sin(bob * 0.5) * 0.004 * bobAmt, 'YXZ');
  }

  return {
    pos,
    update,
    get yaw() { return yaw; },
    setEnabled(v) {
      enabled = v;
      if (!v) { keys.clear(); if (document.pointerLockElement) document.exitPointerLock(); }
    },
    get enabled() { return enabled; },
    lock() { if (!isTouch) requestLock(); },
    get isTouch() { return isTouch; },
    spawn(p, y) {
      pos.set(p[0], 0, p[2]);
      yaw = y; pitch = 0; vel.set(0, 0);
      camera.position.set(pos.x, EYE, pos.z);
      camera.rotation.set(0, yaw, 0, 'YXZ');
    },
    setColliders(c) { colliders = c; },
    onStep(fn) { onStep = fn; },
    onLockLost(fn) { lockLost = fn; },
  };
}
