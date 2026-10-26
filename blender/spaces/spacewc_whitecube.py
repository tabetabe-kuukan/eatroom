"""v2 サンプル：ホワイトキューブ — 白い壁の展示室が3つ続く

単語の手がかりになる物は置かない。検索ワードは three.js 側で slot の位置に組み立てる
（名詞はオブジェクトを壁・床・台に埋め込み、抽象的な言葉は張り紙・新聞・書類の中の言葉になる）。

第1区画 (y 0〜14)  : 展示室1
第2区画 (y 15〜29) : 展示室2
第3区画 (y 30〜44) : 展示室3（突き当たりの壁にも1つ）
"""
import random

import kit
from kit import Meta, box, mat_color, mat_pbr, plane

FAST = "fast" in getattr(kit, "OPTS", set())
random.seed(21)
kit.reset()
kit.setup_cycles()
kit.world_color((0.9, 0.9, 0.9), 0.05)
meta = Meta("wc")

W, H = 9.0, 4.6           # 部屋の幅・天井高
X0, X1 = -W / 2, W / 2
ROOMS = ((-1.0, 14.0), (15.0, 29.0), (30.0, 44.0))
DOOR = 2.6                # 部屋どうしの開口の幅
T = 0.3                   # 仕切り壁の厚さ

M_wall = mat_color("white_wall", (0.88, 0.88, 0.87), 0.85)
M_floor = mat_color("gallery_floor", (0.86, 0.86, 0.85), 0.45)
M_ceil = mat_color("ceiling_white", (0.92, 0.92, 0.92), 0.9)
M_gap = mat_color("shadow_gap", (0.05, 0.05, 0.05), 0.8)
M_plinth = mat_color("plinth_white", (0.93, 0.93, 0.92), 0.55)
M_panel = mat_color("light_panel", (1, 1, 1), 0.5, emit=(1.0, 0.98, 0.95), emit_strength=2.2)
M_track = mat_color("track_black", (0.03, 0.03, 0.03), 0.4)

Y0, Y1 = ROOMS[0][0], ROOMS[-1][1]
box("floor", (W + 0.6, Y1 - Y0 + 0.6, 0.2), (0, (Y0 + Y1) / 2, -0.1), M_floor)
box("ceiling", (W + 0.6, Y1 - Y0 + 0.6, 0.2), (0, (Y0 + Y1) / 2, H + 0.1), M_ceil)
for side in (-1, 1):
    box("wall_side", (0.3, Y1 - Y0, H), (side * (W / 2 + 0.15), (Y0 + Y1) / 2, H / 2), M_wall)
    # 壁と床の間の影の目地
    box("gap", (0.03, Y1 - Y0, 0.04), (side * (W / 2 - 0.012), (Y0 + Y1) / 2, 0.02), M_gap)
box("wall_start", (W, 0.3, H), (0, Y0 - 0.15, H / 2), M_wall)
box("wall_end", (W, 0.3, H), (0, Y1 + 0.15, H / 2), M_wall)

# 部屋の仕切り（中央に開口）
for (_, ya), (yb, _) in zip(ROOMS[:-1], ROOMS[1:]):
    y = (ya + yb) / 2
    seg = (W - DOOR) / 2
    for side in (-1, 1):
        cx = side * (DOOR / 2 + seg / 2)
        box("partition", (seg, T, H), (cx, y, H / 2), M_wall)
        meta.rect(min(cx - seg / 2, cx + seg / 2), y - T / 2, max(cx - seg / 2, cx + seg / 2), y + T / 2)
    box("door_head", (DOOR, T, 0.9), (0, y, H - 0.45), M_wall)

# 天井：拡散光のパネルを格子状に。白い部屋全体がやわらかく明るい
for (ya, yb) in ROOMS:
    for k in range(3):
        y = ya + 2.3 + k * (yb - ya - 4.6) / 2
        for x in (-2.4, 2.4):
            box("light_panel", (2.4, 2.4, 0.04), (x, y, H - 0.02), M_panel)
            kit.area_light((x, y, H - 0.06), size=(2.4, 2.4), power=300, color=(1.0, 0.98, 0.95), name="panel")
    # スポットのレール
    box("track", (0.04, yb - ya - 1.0, 0.04), (0, (ya + yb) / 2, H - 0.25), M_track)

# ---------------------------------------------------------------- 検索ワードを置く場所と、それを照らすスポット
def spot_to(x, y, z, tx, ty, tz, power=30):
    kit.spot_at((x, y, z), (tx, ty, tz), power=power, angle_deg=38, blend=0.6, color=(1.0, 0.95, 0.88), radius=0.08,
                name="track_spot")
    box("spot_body", (0.08, 0.08, 0.16), (x, y, z + 0.05), M_track)


def plinth(x, y, h=0.9, s=0.6):
    box("plinth", (s, s, h), (x, y, h / 2), M_plinth)
    meta.rect(x - s / 2 - 0.05, y - s / 2 - 0.05, x + s / 2 + 0.05, y + s / 2 + 0.05)


for zone, (ya, yb) in enumerate(ROOMS, start=1):
    ym = (ya + yb) / 2
    # 左の壁
    meta.slot(zone, X0 + 0.01, ym - 3.0, 1.55, "wall", normal=(1, 0, 0), w=1.8, h=1.4)
    spot_to(-1.2, ym - 3.0, H - 0.3, X0, ym - 3.0, 1.55)
    # 中央の台
    plinth(0.0, ym + 0.5)
    meta.slot(zone, 0.0, ym + 0.5, 0.9, "table", normal=(0, 0, 1), up=(0, 1, 0), w=0.55, h=0.55)
    spot_to(0.0, ym - 0.6, H - 0.3, 0.0, ym + 0.5, 0.95, power=22)
    # 右の壁（第3区画は突き当たりの壁）
    if zone < 3:
        meta.slot(zone, X1 - 0.01, ym + 3.5, 1.55, "wall", normal=(-1, 0, 0), w=1.8, h=1.4)
        spot_to(1.2, ym + 3.5, H - 0.3, X1, ym + 3.5, 1.55)
    else:
        meta.slot(zone, 0.0, Y1 - 0.01, 1.7, "wall", normal=(0, -1, 0), w=2.2, h=1.6, radius=3.2)
        spot_to(0.0, Y1 - 1.5, H - 0.3, 0.0, Y1, 1.7, power=40)

# ---------------------------------------------------------------- 当たり判定・区画
meta.spawn(0, 0.0, 0)
meta.zones(-100, 14.5, 29.5)
meta.rect(X0 - 0.3, Y0, X0, Y1)
meta.rect(X1, Y0, X1 + 0.3, Y1)
meta.rect(X0, Y0 - 0.3, X1, Y0)
meta.rect(X0, Y1, X1, Y1 + 0.3)

kit.finalize("wc", meta, hdri_file=None,
             lm_size=2048 if FAST else 4096, lm_samples=96 if FAST else 512,
             ao_size=1024, ao_samples=32 if FAST else 96)
