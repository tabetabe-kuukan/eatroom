"""空間1：ツチノコ — 夏の山里の林道

第1区画 (y 0〜26)  : 林道の起点、苔むした石垣、杉林、草むら（雰囲気のみ）
第2区画 (y 26〜50) : 道の右手の空き地。色あせた懸賞金の看板、木箱の罠、一升瓶
第3区画 (y 50〜72) : 暗くなる林道。胴の太い蛇の抜け殻、目撃地点に印を付けた地図。倒木で行き止まり
"""
import math
import os
import random

from mathutils import noise, Vector

import kit
from kit import GEN, Meta, box, cyl, grass, grid_terrain, lathe, mat_color, mat_image, mat_pbr, place, plane, tube

FAST = "fast" in getattr(kit, "OPTS", set())
random.seed(7)
kit.reset()
kit.setup_cycles()
hdri = kit.world_hdri("mossy_forest", strength=0.9, rot_deg=40)
kit.sun((38, 0, 205), strength=5.5, color=(1.0, 0.93, 0.80), angle_deg=1.5)
meta = Meta("01")

# ---------------------------------------------------------------- 地形
Y0, Y1 = -22, 90
X0, X1 = -26, 26
CLEAR = (26, 46, 6.3)  # 空き地: y0, y1, x の奥


def n2(x, y, s=0.15):
    return noise.noise(Vector((x * s, y * s, 0.37)))


def in_clearing(x, y):
    return CLEAR[0] < y < CLEAR[1] and 2.3 < x < CLEAR[2]


def h(x, y):
    """地面の高さ"""
    if abs(x) <= 2.35:  # 林道（わだち）
        rut = 0.035 * (math.cos((abs(x) - 0.9) * 3.0) if abs(x) < 1.6 else 0)
        return -rut + 0.015 * n2(x, y, 1.3)
    if x < 0:  # 左：石垣の上の段
        if x > -3.2:  # 石垣の前の側溝（石垣の面が地形を隠す）
            return -0.06 + 0.03 * n2(x, y, 1.0)
        return 1.8 + (-3.2 - x) * 0.22 + 0.35 * n2(x, y) * min(1, (-3.2 - x) / 2)
    # 右：斜面（空き地は平ら）
    if in_clearing(x, y):
        edge = min(y - CLEAR[0], CLEAR[1] - y, CLEAR[2] - x)
        lift = max(0.0, 0.6 - edge) * 0.4
        return 0.02 + 0.04 * n2(x, y, 0.8) + lift
    d = x - 2.35
    if CLEAR[0] - 2 < y < CLEAR[1] + 2 and x > CLEAR[2] - 0.5:
        d = x - CLEAR[2] + 0.5
    return (d ** 1.35) * 0.42 + 0.3 * n2(x, y) * min(1, d)


M_ground = mat_pbr("forest_leaves", "forest_leaves_02", tile=3.0)
M_road = mat_pbr("road_dirt", "brown_mud_leaves_01", tile=2.5)
M_wall = mat_pbr("ishigaki", "japanese_stone_wall", tile=2.2)
M_bark = mat_pbr("cedar_bark", "japanese_cedar_bark", tile=1.6)
M_wood = mat_pbr("old_wood", "weathered_planks", tile=1.2)
M_moss = mat_pbr("moss_rock", "mossy_rock", tile=1.5)
M_grass = kit.double_sided(mat_image("grass_blades", os.path.join(GEN, "grass_blade.png"), rough=0.75))

grid_terrain("terrain", X0, Y0, X1, Y1, 0.6, h, M_ground)
# 林道の路面（地面より少し浮かせる）
grid_terrain("road", -2.4, Y0, 2.4, 74, 0.3, lambda x, y: h(x, y) + 0.012, M_road)

# ---------------------------------------------------------------- 石垣（左）
import bmesh  # noqa: E402

bm = bmesh.new()
prev = None
step = 1.5
y = Y0
while y <= Y1:
    j = 0.05 * n2(0, y, 0.6)
    bot = bm.verts.new((-2.8 + j, y, -0.1))
    top = bm.verts.new((-3.2 + j, y, 1.78))
    back = bm.verts.new((-3.6 + j, y, 1.78))
    cur = (bot, top, back)
    if prev:
        bm.faces.new([prev[0], cur[0], cur[1], prev[1]])
        bm.faces.new([prev[1], cur[1], cur[2], prev[2]])
    prev = cur
    y += step
for f in bm.faces:  # 正面は道側（+X）、天端は上を向かせる
    c = f.calc_center_median()
    f.normal_update()
    if (c.z < 1.7 and f.normal.x < 0) or (c.z >= 1.7 and f.normal.z < 0):
        f.normal_flip()
kit.mesh_obj("ishigaki", bm, M_wall)
# 石垣の上の草
grass("wall_grass", [(-3.3 + random.uniform(-0.25, 0.25), random.uniform(Y0, 72)) for _ in range(260)], M_grass,
      ground_fn=lambda x, y: 1.78, height=(0.2, 0.55), seed=11)

# ---------------------------------------------------------------- 杉林
tree_pts = []
for i in range(5000):
    x = random.uniform(X0 + 1, X1 - 1)
    y = random.uniform(Y0 + 1, Y1 - 1)
    if -4.0 < x < 3.6:
        continue
    if CLEAR[0] - 1 < y < CLEAR[1] + 1 and x < CLEAR[2] + 1.5:
        continue
    if any((x - a) ** 2 + (y - b) ** 2 < 2.7 ** 2 for a, b in tree_pts):
        continue
    tree_pts.append((x, y))
for i, (x, y) in enumerate(tree_pts):
    r = random.uniform(0.2, 0.42)
    z = h(x, y) - 0.25
    cyl(f"cedar_{i}", r, 13.5, (x, y, z), M_bark, segs=10, r_top=r * 0.7, cap=False)
    if abs(x) < 12:
        cyl(f"cedar_root_{i}", r * 1.65, 0.75, (x, y, z), M_bark, segs=10, r_top=r * 1.0, cap=False)
kit.log("trees", len(tree_pts))

# 遠景（霧の向こう）: 地形と杉を頂点ライティングで安く延長して、世界の端を見せない
for (fy0, fy1) in ((Y0 - 50, Y0 + 0.3), (Y1 - 0.3, Y1 + 60)):
    grid_terrain("far_terrain", X0, fy0, X1, fy1, 2.0, h, M_ground, collection="vlit")
far_pts = []
for i in range(4000):
    x = random.uniform(X0 + 1, X1 - 1)
    y = random.choice([random.uniform(Y0 - 48, Y0 - 1), random.uniform(Y1 + 1, Y1 + 58)])
    if any((x - a) ** 2 + (y - b) ** 2 < 2.9 ** 2 for a, b in far_pts):
        continue
    far_pts.append((x, y))
    r = random.uniform(0.2, 0.42)
    cyl(f"far_cedar_{i}", r, 13.5, (x, y, h(x, y) - 0.25), M_bark, segs=7, r_top=r * 0.7, cap=False, collection="vlit")
kit.log("far trees", len(far_pts))

# 樹冠（切り抜きテクスチャ）— 第3区画は2枚重ねて暗くする
M_canopy = kit.double_sided(mat_image("canopy", os.path.join(GEN, "s01_canopy.png"), rough=0.9, cut=True))


def canopy(name, z, y0, y1, uv_scale, off):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in [(X0 - 8, y0, z), (X1 + 8, y0, z), (X1 + 8, y1, z), (X0 - 8, y1, z)]]
    f = bm.faces.new(vs)
    uvl = bm.loops.layers.uv.new("UVMap")
    for lp in f.loops:
        co = lp.vert.co
        lp[uvl].uv = (co.x / uv_scale + off, co.y / uv_scale + off)
    # ライトマップには入れない（影だけベイクに効かせ、three 側では暗い葉として描く）
    o = kit.mesh_obj(name, bm, M_canopy, collection="dynamic", uv=None)
    o["unlit"] = 1


canopy("canopy_a", 13.4, Y0 - 50, Y1 + 60, 8.0, 0.0)
canopy("canopy_b", 13.1, 44, Y1 + 60, 6.0, 0.37)

# ---------------------------------------------------------------- 植物・岩
T_fern = kit.model_template("fern_02", decimate=0.3)
T_rock = kit.model_template("rock_moss_set_01", decimate=0.12)
T_stump = kit.model_template("tree_stump_01", decimate=0.12)

for i in range(34):
    side = random.choice([-1, 1])
    if side > 0:
        x = random.uniform(3.0, 7.5)
        y = random.uniform(Y0 + 4, 72)
        if in_clearing(x, y):
            continue
    else:
        x = random.uniform(-6.5, -3.5)
        y = random.uniform(Y0 + 4, 72)
    place(T_fern, (x, y, h(x, y) - 0.05), rot_z=random.uniform(0, 360), scale=random.uniform(0.7, 1.15), collection="vlit")
for (x, y, rz, s) in [(5.5, 12, 30, 0.8), (-6, 40, 120, 0.7), (4.6, 60, 250, 0.9)]:
    place(T_rock, (x, y, h(x, y) - 0.25), rot_z=rz, scale=s)
place(T_stump, (6.0, 44.0, h(6.0, 44.0) - 0.05), rot_z=40)
place(T_stump, (-5.0, 18.0, h(-5.0, 18.0) - 0.05), rot_z=200, scale=0.9)

# 道ばたの草むら
edge = []
for i in range(650):
    y = random.uniform(Y0 + 2, 73)
    side = random.choice([-1, 1])
    x = side * random.uniform(2.05, 2.8)
    edge.append((x, y))
for i in range(120):  # 道の真ん中（わだちの間）
    edge.append((random.uniform(-0.35, 0.35), random.uniform(Y0 + 2, 73)))
for i in range(300):  # 空き地
    edge.append((random.uniform(2.4, CLEAR[2] - 0.2), random.uniform(CLEAR[0] + 0.3, CLEAR[1] - 0.3)))
for i in range(240):  # 右の斜面
    x, y = random.uniform(2.8, 9), random.uniform(Y0 + 2, 75)
    if not in_clearing(x, y):
        edge.append((x, y))
grass("grass_edge", edge, M_grass, ground_fn=h, seed=21, collection="vlit")
# 第1区画の深い草むら（痕跡「草むら」）
deep = [(random.gauss(3.2, 0.5), random.gauss(19.0, 1.2)) for _ in range(140)]
grass("grass_deep", deep, M_grass, ground_fn=h, height=(0.6, 1.15), blades=(20, 34), spread=0.28, seed=31, collection="vlit")

# ---------------------------------------------------------------- 第1区画：起点の遮断機と標識
M_stripe = mat_image("stripe", os.path.join(GEN, "s01_stripe.png"), rough=0.6)
M_steel = mat_pbr("rust_steel", "rusty_metal_02", tile=1.0)
cyl("gate_post_l", 0.07, 1.0, (-2.3, -1.6, 0), M_steel)
cyl("gate_post_r", 0.07, 1.0, (2.3, -1.6, 0), M_steel)
bar = tube("gate_bar", [(-2.35, -1.6, 0.92), (2.35, -1.6, 0.92)], [0.045, 0.045], M_stripe, segs=10)
M_sign = mat_image("rindo_sign", os.path.join(GEN, "s01_rindo.png"), rough=0.6)
cyl("rindo_post", 0.045, 2.3, (2.75, 2.6, 0), M_steel)
box("rindo_back", (0.62, 0.03, 0.92), (2.75, 2.63, 1.75), M_steel)
plane("rindo_face", 0.6, 0.9, (2.75, 2.61, 1.75), M_sign, rot=(90, 0, 0))
meta.trace("rindo", 2.0, 2.6, 1.4, radius=3.2)

# 道標（石柱）
M_marker = mat_image("marker_stone", os.path.join(GEN, "s01_marker.png"), rough=0.85)
box("marker_body", (0.24, 0.24, 1.0), (-2.45, 10.5, 0.45), M_moss)
plane("marker_face", 0.22, 0.92, (-2.45, 10.379, 0.5), M_marker, rot=(90, 0, 0))
meta.trace("yamaoku", -2.2, 10.5, 0.8)
meta.trace("kusamura", 3.0, 19.0, 0.6, radius=2.6)
meta.sound("rustle", 3.4, 19.0, 0.4)

# ---------------------------------------------------------------- 第2区画：懸賞金の看板・罠・一升瓶
M_bounty = mat_image("bounty", os.path.join(GEN, "s01_bounty.png"), rough=0.55, metal=0.2)
sx, sy = 4.6, 30.5
for dx in (-0.55, 0.55):
    px = sx + dx * math.cos(math.radians(-45))
    py = sy + dx * math.sin(math.radians(-45))
    cyl(f"bounty_post", 0.05, 2.0, (px, py, h(px, py) - 0.3), M_wood, segs=8)
    meta.circle(px, py, 0.12)
box("bounty_back", (1.32, 0.025, 1.0), (sx, sy, 1.25), M_steel, rot=(0, 0, -45))
plane("bounty_face", 1.3, 0.975, (sx - 0.009, sy - 0.009, 1.25), M_bounty, rot=(90, 0, -45))
meta.trace("kenshokin", sx - 0.6, sy - 0.6, 1.2, radius=2.8)

# 木箱の罠：伏せた箱をつっかえ棒で持ち上げる
T_crate = kit.model_template("wooden_crate_01")
tx, ty = 3.3, 38.6
# 箱を伏せて手前側をつっかえ棒で持ち上げる（奥の辺が地面に着く）
place(T_crate, (tx, ty + 0.05, 0.36), rot=(148, 0, 8), scale=1.25)
cyl("trap_stick", 0.018, 0.5, (tx + 0.05, ty - 0.2, 0.0), M_wood, segs=6, rot=(-8, 0, 0))
tube("trap_string", [(tx + 0.05, ty - 0.08, 0.3), (tx - 0.3, ty - 0.9, 0.05), (tx - 1.2, ty - 2.6, 0.02)],
     [0.004, 0.004, 0.004], mat_color("string", (0.62, 0.55, 0.42), 0.9), segs=4)
meta.circle(tx, ty, 0.5)
meta.trace("wana", tx - 0.5, ty - 0.6, 0.4, radius=2.6)

# 一升瓶（エサ）
M_glass = mat_color("sake_glass", (0.10, 0.07, 0.03), rough=0.08)
M_label = mat_image("sake_label", os.path.join(GEN, "s01_sake_label.png"), rough=0.8)
prof = [(0.0, 0.0), (0.052, 0.0), (0.054, 0.01), (0.054, 0.26), (0.05, 0.29), (0.032, 0.33), (0.017, 0.36),
        (0.016, 0.395), (0.018, 0.40), (0.0, 0.40)]
bx, by = tx - 0.05, ty - 0.05
lathe("issho_bin", prof, (bx, by, 0.0), M_glass)
lathe("issho_label", [(0.0555, 0.08), (0.0555, 0.22)], (bx, by, 0.0), M_label, segs=24)
M_cap = mat_color("cap_gold", (0.6, 0.45, 0.15), rough=0.35, metal=1.0)
cyl("issho_cap", 0.019, 0.03, (bx, by, 0.39), M_cap, segs=12)

# ---------------------------------------------------------------- 第3区画：抜け殻と地図
# 蛇の抜け殻（胴が異様に太い）
M_skin = mat_image("snake_skin", os.path.join(GEN, "s01_snakeskin.png"), rough=0.45)
slab = box("skin_slab", (1.1, 0.7, 0.16), (-1.75, 56.8, 0.05), M_moss, rot=(0, 0, 12))
pts, radii = [], []
N = 28
for i in range(N):
    t = i / (N - 1)
    pts.append((-2.25 + 1.0 * t, 56.55 + 0.12 * math.sin(t * 5.5) + 0.3 * t, 0.17 + 0.0 * t))
    body = math.sin(min(1, t * 1.25) * math.pi) ** 0.55
    radii.append(max(0.01, 0.105 * body * (1 - 0.85 * max(0, t - 0.8) / 0.2)))
skin = tube("snake_skin", pts, radii, M_skin, segs=14, flatten=0.55)
meta.trace("hebi", -1.7, 56.7, 0.4, radius=2.5)

# 掲示板（屋根つき）と目撃地図
M_map = mat_image("sighting_map", os.path.join(GEN, "s01_map.png"), rough=0.8)
bx, by, rz = 3.1, 64.0, -28
c, s = math.cos(math.radians(rz)), math.sin(math.radians(rz))


def at(dx, dy, dz):
    return (bx + dx * c - dy * s, by + dx * s + dy * c, dz)


for dx in (-0.75, 0.75):
    cyl("board_post", 0.05, 2.3, at(dx, 0.05, -0.2), M_wood, segs=8)
    meta.circle(*at(dx, 0.05, 0)[:2], 0.12)
box("board_back", (1.6, 0.05, 1.05), at(0, 0.06, 1.35), M_wood, rot=(0, 0, rz))
box("board_roof", (1.9, 0.5, 0.04), at(0, 0.0, 2.08), M_wood, rot=(-18, 0, rz))
plane("board_map", 0.9, 0.9, at(-0.15, 0.03, 1.36), M_map, rot=(90, 0, rz))
M_paper = mat_color("old_paper", (0.78, 0.74, 0.62), rough=0.9)
plane("board_note1", 0.3, 0.42, at(0.55, 0.03, 1.5), M_paper, rot=(90, 4, rz))
plane("board_note2", 0.26, 0.36, at(0.5, 0.031, 1.02), M_paper, rot=(90, -6, rz))
meta.trace("chizu", bx - 0.8, by - 0.9, 1.3, radius=2.6)

# 行き止まり：倒木
cyl("fallen_cedar", 0.48, 11, (-5.5, 72.6, 0.42), M_bark, segs=12, rot=(0, 90, 8))
place(T_fern, (-0.8, 73.6, 0), rot_z=10, scale=1.2, collection="vlit")
place(T_fern, (1.2, 73.9, 0), rot_z=190, scale=1.3, collection="vlit")
place(T_rock, (0.4, 74.5, -0.2), rot_z=80, scale=0.8)

# ---------------------------------------------------------------- 当たり判定・区画・スポーン
meta.spawn(0, 0.6, 0)
meta.zones(-100, 26, 50)
meta.rect(-3.6, -3, -2.6, 75)             # 石垣
meta.rect(-3.0, -2.2, 3.0, -1.4)          # 遮断機
meta.rect(2.6, -3, 3.3, CLEAR[0])         # 右の斜面（手前）
meta.rect(2.6, CLEAR[0] - 0.6, CLEAR[2] + 0.5, CLEAR[0])   # 空き地の手前側
meta.rect(CLEAR[2], CLEAR[0], CLEAR[2] + 0.6, CLEAR[1])    # 空き地の奥
meta.rect(2.6, CLEAR[1], CLEAR[2] + 0.5, CLEAR[1] + 0.6)   # 空き地の奥側
meta.rect(2.6, CLEAR[1], 3.3, 75)         # 右の斜面（奥）
meta.rect(-3.0, 71.6, 3.0, 72.6)          # 倒木
meta.marker("ground", 0, 0, 0)

kit.finalize("01", meta, hdri_file=hdri,
             lm_size=2048 if FAST else 4096, lm_samples=64 if FAST else 384,
             ao_size=1024, ao_samples=32 if FAST else 96)
