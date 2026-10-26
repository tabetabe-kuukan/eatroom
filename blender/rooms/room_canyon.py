"""部屋モジュール：渓谷（渓谷・谷・U字谷・崖）

展示室の床が奥で裂け、深い谷になっている。谷底には川が流れ、木の吊り橋で向こうへ渡る。
"""
import math
import random

from mathutils import Vector, noise

import kit
from kit import box, mat_color, mat_pbr
from room import X0, X1, Room, boxes, smooth, surface

rnd = random.Random(6)
r = Room("room_canyon")
HY0, HY1 = 9.3, 12.8          # 谷の範囲（y）
DEPTH = 7.0
r.shell(floor_hole=(X0, HY0, X1, HY1))
M_rock = mat_pbr("canyon_rock", "rock_face_01", tile=2.5)
M_water = mat_color("canyon_water", (0.05, 0.16, 0.18), 0.05)
M_plank = mat_pbr("bridge_plank", "weathered_planks", tile=1.0)
M_rope = mat_color("bridge_rope", (0.45, 0.36, 0.24), 0.9)
M_post = mat_pbr("bridge_post", "dark_wood", tile=1.0)

# 谷：穴の縁を一周する断面を下へ押し出す。崖はでこぼこ、底は川
PER = 2 * ((X1 - X0) + (HY1 - HY0))


def rim(u):
    """穴の縁を一周する点と内向きの向き（u: 0..1）"""
    s = u * PER
    w, d = X1 - X0, HY1 - HY0
    if s < w:
        return X0 + s, HY0, (0, 1)
    s -= w
    if s < d:
        return X1, HY0 + s, (-1, 0)
    s -= d
    if s < w:
        return X1 - s, HY1, (0, -1)
    s -= w
    return X0, HY1 - s, (1, 0)


def wall_fn(u, v):
    x, y, (nx, ny) = rim(u)
    z = -v * DEPTH
    narrow = smooth(0.0, 1.0, v) * 0.9          # 下へ行くほど谷は狭まる
    n = noise.fractal(Vector((x * 0.7, y * 0.7, z * 0.5)), 0.6, 2.0, 5)
    inset = 0.08 + narrow + 0.35 * n * smooth(0.0, 0.15, v)
    return (x + nx * inset, y + ny * inset, z)


surface("canyon_wall", 160, 40, wall_fn, M_rock, size=(PER, DEPTH), tile=2.5)
box("canyon_water", (X1 - X0, HY1 - HY0, 0.02), (0, (HY0 + HY1) / 2, -DEPTH + 0.35), M_water)
for k in range(10):
    kit.cyl("canyon_stone", rnd.uniform(0.15, 0.35), rnd.uniform(0.2, 0.4),
            (rnd.uniform(X0 + 1.5, X1 - 1.5), rnd.uniform(HY0 + 1.2, HY1 - 1.2), -DEPTH + 0.2), M_rock, segs=7,
            r_top=rnd.uniform(0.05, 0.15))
kit.point_light((0, (HY0 + HY1) / 2, -DEPTH + 1.5), power=120, color=(0.6, 0.8, 0.9), radius=0.5, name="canyon_glow")

# 縁の崩れ（岩のかけら）
for k in range(18):
    side = rnd.choice((HY0, HY1))
    x = rnd.uniform(X0 + 0.3, X1 - 0.3)
    if abs(x) < 0.9:
        continue
    kit.cyl("rim_rock", rnd.uniform(0.08, 0.22), rnd.uniform(0.05, 0.16), (x, side + rnd.uniform(-0.25, 0.25), -0.02),
            M_rock, segs=6, r_top=rnd.uniform(0.03, 0.1))

# 吊り橋（たわんだ板と、両側のロープ）
BW = 1.1
SAG = 0.22
Y0b, Y1b = HY0 - 0.5, HY1 + 0.5


def sag(y):
    return -SAG * math.sin(math.pi * (y - Y0b) / (Y1b - Y0b))


planks = []
y = Y0b + 0.12
while y < Y1b - 0.1:
    planks.append(((BW, 0.2, 0.04), (rnd.uniform(-0.02, 0.02), y, sag(y) + 0.02), (rnd.uniform(-2, 2), 0, rnd.uniform(-3, 3))))
    y += 0.25
boxes("bridge_planks", planks, M_plank)
for sx in (-BW / 2 - 0.05, BW / 2 + 0.05):
    for zoff in (0.9, 0.04):
        pts = [(sx, Y0b + (Y1b - Y0b) * k / 16, sag(Y0b + (Y1b - Y0b) * k / 16) * (1.3 if zoff > 0.5 else 1.0) + zoff)
               for k in range(17)]
        kit.tube("bridge_rope", pts, [0.018] * 17, M_rope, segs=6)
    for k in range(1, 16):
        yy = Y0b + (Y1b - Y0b) * k / 16
        box("bridge_hanger", (0.012, 0.012, 0.86), (sx, yy, sag(yy) * 1.15 + 0.47), M_rope)
    for yy in (Y0b - 0.05, Y1b + 0.05):
        box("bridge_post", (0.12, 0.12, 1.1), (sx, yy, 0.55), M_post)
# 歩ける床：橋は真ん中がたわむ。橋の外は谷に落ちないよう壁にする
mid = (Y0b + Y1b) / 2
r.meta.floor(-BW / 2, Y0b, BW / 2, mid, 0.0, -SAG)
r.meta.floor(-BW / 2, mid, BW / 2, Y1b, -SAG, 0.0)
r.meta.rect(X0, HY0 - 0.1, -BW / 2 - 0.08, HY1 + 0.1)
r.meta.rect(BW / 2 + 0.08, HY0 - 0.1, X1, HY1 + 0.1)

# 右の壁の検索ワードは谷の手前に移す
r.slots["right"]["y"] = 6.0
r.place_slots()
r.finish()
