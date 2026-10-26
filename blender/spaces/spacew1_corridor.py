"""v2 空間1：白い回廊 — 昼の光が差し込む、漆喰塗りの長い回廊

お題の単語は遊ぶたびに変わるため、この空間には単語の手がかりになる物を置かない。
検索ワードは three.js 側で slot の位置に組み立てる（名詞はオブジェクトを壁や床に埋め込み、
抽象的な言葉は張り紙・新聞・書類の中の言葉になる）。

第1区画 (y 0〜15)  : 回廊の入口。右のアーチから日が差す
第2区画 (y 15〜30) : 左の壁にくぼみ（壁龕）が並ぶ
第3区画 (y 30〜45) : 突き当たりの壁と、床の割れ目
"""
import os
import random

import kit
from kit import Meta, box, mat_color, mat_pbr

FAST = "fast" in getattr(kit, "OPTS", set())
random.seed(11)
kit.reset()
kit.setup_cycles()
hdri = kit.world_hdri("courtyard", strength=1.0, rot_deg=120)
kit.sun((52, 0, 128), strength=4.5, color=(1.0, 0.94, 0.84), angle_deg=1.2)
meta = Meta("w1")

X0, X1, Y0, Y1, H = -2.2, 2.2, -1.5, 45.0, 4.2
M_wall = mat_pbr("stucco", "white_stucco", tile=2.0, tint=(0.95, 0.93, 0.9))
M_floor = mat_pbr("klinker", "floor_klinkers_01", tile=1.2)
M_ceil = mat_pbr("ceil_plaster", "white_plaster_02", tile=2.0)
M_stone = mat_pbr("pillar_stone", "large_sandstone_blocks_01", tile=1.5)
M_ground = mat_pbr("court_gravel", "gravel_floor_02", tile=2.0)
M_wood = mat_pbr("beam_wood", "dark_wood", tile=1.0)

# 床・天井・左の壁・両端
box("floor", (X1 - X0 + 0.4, Y1 - Y0, 0.2), (0, (Y0 + Y1) / 2, -0.1), M_floor)
box("ceiling", (X1 - X0 + 0.4, Y1 - Y0, 0.2), (0, (Y0 + Y1) / 2, H + 0.1), M_ceil)
box("wall_left", (0.3, Y1 - Y0, H), (X0 - 0.15, (Y0 + Y1) / 2, H / 2), M_wall)
box("wall_start", (X1 - X0, 0.3, H), (0, Y0 - 0.15, H / 2), M_wall)
box("wall_end", (X1 - X0 + 0.6, 0.3, H), (0, Y1 + 0.15, H / 2), M_wall)
# 天井の梁
for y in range(0, 45, 3):
    box("beam", (X1 - X0, 0.18, 0.22), (0, y + 0.5, H - 0.11), M_wood)

# 右側：柱とアーチ（上部の壁）。柱の間から中庭の光が入る
PITCH = 3.0
for k in range(16):
    y = Y0 + 0.5 + k * PITCH
    box("pillar", (0.45, 0.5, H), (X1 + 0.22, y, H / 2), M_stone)
    meta.rect(X1, y - 0.25, X1 + 0.45, y + 0.25)
box("arch_wall", (0.45, Y1 - Y0, 1.0), (X1 + 0.22, (Y0 + Y1) / 2, H - 0.5), M_wall)
box("parapet", (0.45, Y1 - Y0, 0.7), (X1 + 0.22, (Y0 + Y1) / 2, 0.35), M_stone)
meta.rect(X1, Y0, X1 + 0.45, Y1)
# 中庭（見えるだけ）
box("court", (14, Y1 - Y0 + 10, 0.2), (X1 + 7.4, (Y0 + Y1) / 2, -0.35), M_ground)
box("court_wall", (0.4, Y1 - Y0 + 10, 3.0), (X1 + 12, (Y0 + Y1) / 2, 1.2), M_wall)
T_shrub = kit.model_template("shrub_02", decimate=0.3)
for k in range(9):
    kit.place(T_shrub, (X1 + 3 + random.uniform(0, 6), 2 + k * 5 + random.uniform(-1, 1), -0.25),
              rot_z=random.uniform(0, 360), scale=random.uniform(0.8, 1.2))

# 第2区画：左の壁のくぼみ（壁龕）。ここに単語が埋まる
NICHES = (18.5, 23.0, 27.5)
for y in NICHES:
    # 両脇の柱と上の梁を壁から張り出させて、くぼんだ枠に見せる
    for dy in (-0.85, 0.85):
        box("niche_jamb", (0.28, 0.2, 2.1), (X0 + 0.14, y + dy, 1.5), M_stone)
        meta.rect(X0, y + dy - 0.1, X0 + 0.28, y + dy + 0.1)
    box("niche_head", (0.28, 1.9, 0.25), (X0 + 0.14, y, 2.6), M_stone)
    box("niche_sill", (0.32, 1.5, 0.08), (X0 + 0.16, y, 0.72), M_stone)

# 突き当たりの壁の手前：床の段
box("step", (X1 - X0, 1.2, 0.15), (0, Y1 - 0.6, 0.075), M_stone)
meta.floor(X0, Y1 - 1.2, X1, Y1, 0.15)

# 夕方の補助光（中庭からの反射を少し足す）
kit.area_light((0, 22, H - 0.3), size=(3.0, 40), power=600, color=(1.0, 0.96, 0.9), name="bounce")

# ---------------------------------------------------------------- 検索ワードを置く場所
# 第1区画
meta.slot(1, X0 + 0.02, 4.0, 1.5, "wall", normal=(1, 0, 0), w=1.6, h=1.2)
meta.slot(1, -0.6, 8.5, 0.0, "floor", normal=(0, 0, 1), up=(0, 1, 0), w=1.4, h=1.0)
meta.slot(1, X0 + 0.02, 12.5, 1.5, "wall", normal=(1, 0, 0), w=1.6, h=1.2)
# 第2区画（壁龕の中）
for y in NICHES:
    meta.slot(2, X0 + 0.02, y, 1.6, "wall", normal=(1, 0, 0), w=1.3, h=1.3)
# 第3区画
meta.slot(3, X0 + 0.02, 34.0, 1.5, "wall", normal=(1, 0, 0), w=1.8, h=1.3)
meta.slot(3, 0.4, 38.5, 0.0, "floor", normal=(0, 0, 1), up=(0, 1, 0), w=1.6, h=1.2)
meta.slot(3, 0.0, Y1 - 0.02, 1.7, "wall", normal=(0, -1, 0), w=2.0, h=1.6, radius=3.0)

# ---------------------------------------------------------------- 当たり判定・区画
meta.spawn(0, 0.0, 0)
meta.zones(-100, 15.0, 30.0)
meta.rect(X0 - 0.3, Y0, X0, Y1)
meta.rect(X0, Y0 - 0.3, X1, Y0)
meta.rect(X0, Y1, X1, Y1 + 0.3)

kit.finalize("w1", meta, hdri_file=hdri,
             lm_size=2048 if FAST else 4096, lm_samples=64 if FAST else 512,
             ao_size=1024, ao_samples=32 if FAST else 96)
