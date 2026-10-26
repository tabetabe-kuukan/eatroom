"""部屋モジュール：洞窟（洞窟・岩肌・横穴…）

展示室の左側が岩に食われている。床から左の壁、天井にかけて岩肌がせり出し、鍾乳石が垂れる。
岩は部屋の両端に向かって薄くなり、白い壁に溶けこむ。
"""
import math
import random

from mathutils import noise, Vector

import kit
from kit import mat_pbr
from room import H, X0, Room, smooth, surface

rnd = random.Random(4)
r = Room("room_cave")
YA, YB = 1.0, 14.0
r.shell(panel_skip=lambda x, y: x < 0)
M_rock = mat_pbr("cave_rock", "moon_rock_03", tile=2.4)

# 断面：床（x=-0.6）→ 左の壁の下 → 壁の上 → 天井（x=-0.2）
SECTION = [(-0.6, 0.0), (X0, 0.0), (X0, H), (-0.2, H)]
NORMALS = [(0, 1), (1, 1), (1, -1), (0, -1)]          # 各辺の内向き（x, z）
SEG = [math.dist(SECTION[i], SECTION[i + 1]) for i in range(3)]
TOT = sum(SEG)


EDGE_N = [(0, 1), (1, 0), (0, -1)]


def _seg_dist(px, pz, i):
    (x0, z0), (x1, z1) = SECTION[i], SECTION[i + 1]
    dx, dz = x1 - x0, z1 - z0
    t = max(0.0, min(1.0, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz)))
    return math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t))


def section(u):
    """断面上の点と、角で丸めた内向きの法線"""
    s = u * TOT
    for i in range(3):
        if s <= SEG[i] or i == 2:
            t = min(1.0, s / SEG[i])
            (x0, z0), (x1, z1) = SECTION[i], SECTION[i + 1]
            px, pz = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
            break
        s -= SEG[i]
    nx = nz = 0.0
    for k in range(3):
        w = 1.0 / (_seg_dist(px, pz, k) + 0.25) ** 2
        nx += EDGE_N[k][0] * w
        nz += EDGE_N[k][1] * w
    ln = math.hypot(nx, nz)
    return px, pz, nx / ln, nz / ln


def depth(u, y):
    """岩のせり出し（m）。両端・断面の端に向かって 0 になる"""
    x, z, nx, nz = section(u)
    taper = smooth(YA, YA + 2.5, y) * (1 - smooth(YB - 2.5, YB, y)) * smooth(0.0, 0.12, u) * (1 - smooth(0.88, 1.0, u))
    n = noise.fractal(Vector((x * 0.9, y * 0.6, z * 0.9)), 0.6, 2.1, 5)
    d = 0.35 + 0.45 * n + 0.25 * noise.noise(Vector((x * 3.1, y * 2.3, z * 3.1)))
    if nz > 0.5:   # 床は歩けるよう低めに
        d *= 0.45
    return max(0.0, d) * taper


def fn(u, v):
    y = YA + (YB - YA) * v
    x, z, nx, nz = section(u)
    d = depth(u, y)
    return (x + nx * d, y, z + nz * d)


surface("cave_rock", 90, 120, fn, M_rock, size=(TOT, YB - YA), tile=2.4, flip=True)

# 鍾乳石
for k in range(22):
    y = rnd.uniform(YA + 2.5, YB - 2.5)
    u = rnd.uniform(0.82, 0.95)
    x, y_, z = fn(u, (y - YA) / (YB - YA))
    h = rnd.uniform(0.25, 1.1) * (0.5 + smooth(YA, (YA + YB) / 2, y))
    kit.cyl("stalactite", rnd.uniform(0.012, 0.03), h, (x, y, z - h + 0.05), M_rock, segs=8,
            r_top=rnd.uniform(0.07, 0.16))
# 床の石筍
for k in range(8):
    y = rnd.uniform(YA + 3, YB - 3)
    x, _, z = fn(rnd.uniform(0.08, 0.22), (y - YA) / (YB - YA))
    h = rnd.uniform(0.2, 0.55)
    kit.cyl("stalagmite", rnd.uniform(0.08, 0.15), h, (x, y, z - 0.05), M_rock, segs=8, r_top=0.015)

# 洞窟の中を照らす作業灯（暖色）
for y in (5.0, 10.0):
    kit.point_light((-2.2, y, 3.0), power=220, color=(1.0, 0.78, 0.5), radius=0.2, name="cave_light")

# 岩のせり出した床には入れない
r.meta.rect(X0, YA + 2.0, -2.6, YB - 2.0)

# 検索ワードは岩肌に食い込ませる
sy = r.slots["left"]["y"]
u_slot = (0.6 + 1.55) / TOT
x, _, _ = fn(u_slot, (sy - YA) / (YB - YA))
r.slots["left"]["x"] = x - 0.05
r.place_slots()
r.finish()
