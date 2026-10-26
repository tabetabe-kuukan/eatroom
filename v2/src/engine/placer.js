// 痕跡を置く場所を決める。毎回ちがう場所になるよう、部屋の中から光線を飛ばして
// 当たった面（壁の高い所・低い所・突き当たりの壁・床・天井）や台をランダムに選ぶ。
// 部屋の形（和室の障子、書斎の本棚、縁側の開口など）に合わせて面が見つかる。
import * as THREE from 'three';

const L = 15;
const ray = new THREE.Raycaster();
const rnd = (a, b) => a + Math.random() * (b - a);

function weighted(list) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list[0][0];
}

// room: 区画の番号（0〜2）、mod: その部屋のモジュール（world.modules[room]）、table: その部屋の台の slot
// wants: 痕跡ごとに置ける面の一覧（null はどこでもよい）。返り値は wants と同じ順の slot（見つからなければ null）
export function placeInRoom(room, mod, wants, { table = null, avoid = [], spawnZ = null } = {}) {
  const meshes = [];
  mod.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const z0 = -L * room; const zc = z0 - L / 2;
  // 部屋の大きさ（区画が進むほど狭く低い）
  const dims = mod.meta.module || { width: 9, height: 4.6 };
  const half = dims.width / 2; const H = dims.height;
  const out = [];
  let usedTable = false;
  const far = (p, minD) => [...out.filter(Boolean).map((o) => o.pos), ...avoid].every((q) => (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2 + (q[2] - p.z) ** 2 > minD * minD);

  const cast = (origin, dir, maxD) => {
    ray.set(origin, dir);
    ray.far = maxD;
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit || !hit.face) return null;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (n.dot(dir) > 0) n.negate();
    return { p: hit.point, n, d: hit.distance };
  };

  const WEIGHTS = [['wall', 5], ['end', 1], ['floor', 2.2], ['ceiling', 1.2], ['table', 1.6]];
  for (const want of wants) {
    let found = null;
    for (let tries = 0; !found && tries < 120; tries++) {
    const list = WEIGHTS.filter(([k]) => (!want || want.includes(k)) && (k !== 'table' || (table && !usedTable)));
    if (!list.length) break;
    const kind = weighted(list);
    let slot = null;
    if (kind === 'table') {
      usedTable = true;
      slot = { ...table, kind: 'table', up: [0, 0, -1] };
    } else if (kind === 'wall') {
      const sideSign = Math.random() < 0.5 ? -1 : 1;
      const r = Math.random();
      const y = r < 0.6 ? rnd(1.0, Math.min(2.2, H - 1.0)) : r < 0.85 ? rnd(Math.min(2.5, H - 1.2), H - 0.9) : rnd(0.35, 0.8);
      const z = zc + rnd(-6.0, 6.0);
      const ox = sideSign * Math.max(0.3, half - 2.0);
      const h = cast(new THREE.Vector3(ox, y, z), new THREE.Vector3(sideSign, 0, 0), 2.4);
      if (h && h.d > 0.6 && Math.abs(h.n.x) > 0.7) slot = { pos: h.p.toArray(), normal: h.n.toArray(), kind: 'wall' };
    } else if (kind === 'end') {
      // 突き当たりの壁（出入り口の脇）
      const front = Math.random() < 0.5;
      const zEnd = front ? z0 : z0 - L;
      if (half - 0.5 < 1.9) continue;
      const x = (Math.random() < 0.5 ? -1 : 1) * rnd(1.9, half - 0.5);
      const y = rnd(0.9, Math.min(2.8, H - 0.9));
      const dir = new THREE.Vector3(0, 0, front ? 1 : -1);
      const h = cast(new THREE.Vector3(x, y, zEnd - dir.z * 2.5), dir, 3.0);
      if (h && Math.abs(h.n.z) > 0.7) slot = { pos: h.p.toArray(), normal: h.n.toArray(), kind: 'wall' };
    } else if (kind === 'floor') {
      const x = rnd(-(half - 0.9), half - 0.9); const z = zc + rnd(-6.0, 6.0);
      const h = cast(new THREE.Vector3(x, 2.0, z), new THREE.Vector3(0, -1, 0), 2.6);
      // 家具の上や穴（谷）は避ける。出入り口の通り道もふさがない
      const doorway = Math.abs(x) < 1.8 && (z > z0 - 1.6 || z < z0 - L + 1.6);
      if (h && h.p.y > -0.05 && h.p.y < 0.12 && h.n.y > 0.8 && !doorway) {
        slot = { pos: h.p.toArray(), normal: [0, 1, 0], kind: 'floor', up: [0, 0, -1] };
      }
    } else if (kind === 'ceiling') {
      const x = rnd(-(half - 1.1), half - 1.1); const z = zc + rnd(-5.5, 5.5);
      const h = cast(new THREE.Vector3(x, 2.0, z), new THREE.Vector3(0, 1, 0), 3.0);
      if (h && h.p.y > H - 0.8 && h.n.y < -0.8) slot = { pos: h.p.toArray(), normal: [0, -1, 0], kind: 'ceiling', up: [0, 0, 1] };
    }
    if (!slot) continue;
    const p = new THREE.Vector3().fromArray(slot.pos);
    if (spawnZ !== null && room === 0 && p.z > spawnZ - 2.5 && slot.kind !== 'ceiling') continue;
    if (!far(p, slot.kind === 'table' ? 1.0 : 2.6)) continue;
    // 台のすぐそばの床は避ける
    if (slot.kind === 'floor' && table && (table.pos[0] - p.x) ** 2 + (table.pos[2] - p.z) ** 2 < 1.4) continue;
    found = { ...slot, zone: room + 1, room, w: 1.8, h: 1.4, ceil: H, roomW: dims.width, radius: slot.kind === 'ceiling' ? 2.4 : 2.6 };
    }
    out.push(found);
  }
  return out;
}
