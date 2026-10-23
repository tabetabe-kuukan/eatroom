"""空間6：お前（最終空間）— 誰もいない屋内プール

この空間の痕跡はプレイヤー自身の記録から three.js 側で作る（src/game/finale.js）。
Blender では器（プール・壁・天窓・椅子・鏡の枠）と、痕跡を置く場所（マーカー）だけを作る。
第1区画 (y 0〜16)  : プールサイド。空間1〜5で歩いた経路が濡れた足跡として残る
第2区画 (y 16〜30) : 左の壁に、プレイヤーが入力した不正解の答えが書かれている
第3区画 (y 30〜40) : 画面の方を向いた椅子と、何も映らない鏡（Reflector）
"""
import os
import random

import kit
from kit import Meta, box, cyl, mat_color, mat_pbr, place, plane, tube

FAST = "fast" in getattr(kit, "OPTS", set())
random.seed(6)
kit.reset()
kit.setup_cycles()
kit.world_color((0.35, 0.42, 0.45), 0.6)
meta = Meta("06")

X0, X1, Y0, Y1, H = -3.4, 9.4, -1.0, 40.0, 6.0
PX0, PX1, PY0, PY1, PD = 0.0, 8.0, 2.0, 28.0, 1.6  # プール

M_wall = mat_pbr("pool_wall", "rounded_square_tiled_wall", tile=1.4, tint=(0.5, 0.95, 0.9))
M_deck = mat_pbr("pool_deck", "anti_slip_concrete", tile=1.5, tint=(0.92, 0.9, 0.85))
M_pool = mat_pbr("pool_tiles", "blue_floor_tiles_01", tile=1.0)
M_white = mat_color("coping_white", (0.85, 0.86, 0.84), 0.4)
M_ceil = mat_color("pool_ceiling", (0.55, 0.78, 0.76), 0.7)
M_steel = mat_color("ladder_steel", (0.7, 0.72, 0.73), 0.3, metal=1.0)
M_sky = mat_color("skylight", (1, 1, 1), 0.3, emit=(0.92, 0.97, 1.0), emit_strength=4)

# 床（プールの穴を残してデッキを敷く）
box("deck_l", (PX0 - X0, Y1 - Y0, 0.2), ((X0 + PX0) / 2, (Y0 + Y1) / 2, -0.1), M_deck)
box("deck_r", (X1 - PX1, Y1 - Y0, 0.2), ((PX1 + X1) / 2, (Y0 + Y1) / 2, -0.1), M_deck)
box("deck_front", (PX1 - PX0, PY0 - Y0, 0.2), ((PX0 + PX1) / 2, (Y0 + PY0) / 2, -0.1), M_deck)
box("deck_back", (PX1 - PX0, Y1 - PY1, 0.2), ((PX0 + PX1) / 2, (PY1 + Y1) / 2, -0.1), M_deck)
# プールの内側
box("pool_floor", (PX1 - PX0, PY1 - PY0, 0.1), ((PX0 + PX1) / 2, (PY0 + PY1) / 2, -PD - 0.05), M_pool)
box("pool_wall_l", (0.1, PY1 - PY0, PD), (PX0 + 0.05, (PY0 + PY1) / 2, -PD / 2), M_pool)
box("pool_wall_r", (0.1, PY1 - PY0, PD), (PX1 - 0.05, (PY0 + PY1) / 2, -PD / 2), M_pool)
box("pool_wall_f", (PX1 - PX0, 0.1, PD), ((PX0 + PX1) / 2, PY0 + 0.05, -PD / 2), M_pool)
box("pool_wall_b", (PX1 - PX0, 0.1, PD), ((PX0 + PX1) / 2, PY1 - 0.05, -PD / 2), M_pool)
for (sx, sy, cx, cy) in [(0.3, PY1 - PY0 + 0.6, PX0 - 0.15, (PY0 + PY1) / 2), (0.3, PY1 - PY0 + 0.6, PX1 + 0.15, (PY0 + PY1) / 2),
                         (PX1 - PX0, 0.3, (PX0 + PX1) / 2, PY0 - 0.15), (PX1 - PX0, 0.3, (PX0 + PX1) / 2, PY1 + 0.15)]:
    box("coping", (sx, sy, 0.05), (cx, cy, 0.025), M_white)
# 水面（three 側で揺れる水のマテリアルに差し替える）
w = plane("water_surface", PX1 - PX0, PY1 - PY0, ((PX0 + PX1) / 2, (PY0 + PY1) / 2, -0.25),
          mat_color("water", (0.2, 0.55, 0.55), 0.05), rot=(0, 0, 0), collection="dynamic")
w["water"] = 1
# はしご
for ly in (5.0, 24.0):
    for dy in (-0.25, 0.25):
        tube("ladder", [(PX0 + 0.05, ly + dy, -1.2), (PX0 + 0.05, ly + dy, 0.6), (PX0 - 0.25, ly + dy, 0.9), (PX0 - 0.3, ly + dy, 0.05)],
             [0.022] * 4, M_steel, segs=8)

# 壁と天井
box("wall_l", (0.2, Y1 - Y0, H), (X0 - 0.1, (Y0 + Y1) / 2, H / 2), M_wall)
box("wall_r", (0.2, Y1 - Y0, H), (X1 + 0.1, (Y0 + Y1) / 2, H / 2), M_wall)
box("wall_f", (X1 - X0, 0.2, H), ((X0 + X1) / 2, Y0 - 0.1, H / 2), M_wall)
box("wall_b", (X1 - X0, 0.2, H), ((X0 + X1) / 2, Y1 + 0.1, H / 2), M_wall)
box("ceiling", (X1 - X0, Y1 - Y0, 0.2), ((X0 + X1) / 2, (Y0 + Y1) / 2, H + 0.1), M_ceil)
# 右の壁の高窓（参考画像の窓）
for k in range(6):
    plane("high_window", 2.6, 1.2, (X1 - 0.01, 3.0 + k * 6.0, 4.2), M_sky, rot=(90, 0, -90))
# 天窓（六角形の代わりに大きな四角）と、差し込む光
for (sx, sy) in ((2.5, 8.0), (6.0, 15.0), (2.0, 22.0), (5.5, 31.0)):
    box("skylight", (2.2, 2.2, 0.05), (sx, sy, H - 0.03), M_sky)
    kit.area_light((sx, sy, H - 0.08), size=(2.2, 2.2), power=900, color=(0.92, 0.97, 1.0), name="sky")

# 第3区画：椅子と鏡の枠
T_chair = kit.model_template("dining_chair_02", decimate=0.3)
place(T_chair, (1.0, 36.6, 0), rot_z=0)  # 画面（プレイヤー）の方を向く
meta.circle(1.0, 36.6, 0.4)
box("mirror_frame", (1.6, 0.08, 2.2), (1.0, Y1 - 0.04, 1.35), mat_color("mirror_frame", (0.25, 0.22, 0.2), 0.5))
meta.marker("mirror", 1.0, Y1 - 0.09, 1.35, 180)

# 痕跡を置く場所（three 側で作る）
meta.marker("footprints", -1.7, 1.0, 0, 0)          # 第1区画の足跡の範囲の始点
meta.marker("footprints_end", -1.7, 15.5, 0, 0)
meta.marker("writing", X0 + 0.02, 23.0, 1.6, 0)     # 第2区画の壁の書き込み
for tid, y in (("ty", 3.5), ("vi", 8.0), ("anta", 12.5)):
    meta.trace(tid, -1.7, y, 0.1, radius=2.4)
for tid, y in (("ci", 18.0), ("wewe", 23.0), ("neo", 28.0)):
    meta.trace(tid, -2.2, y, 1.4, radius=2.4)
meta.trace("you", 1.0, 34.6, 1.0, radius=2.4)

# ---------------------------------------------------------------- 当たり判定・区画
meta.spawn(-1.7, 0.0, 0)
meta.zones(-100, 16.0, 30.0)
meta.rect(PX0 - 0.15, PY0 - 0.15, PX1 + 0.15, PY1 + 0.15)  # プールには入れない
meta.rect(X0 - 0.3, Y0, X0, Y1)
meta.rect(X1, Y0, X1 + 0.3, Y1)
meta.rect(X0, Y0 - 0.3, X1, Y0)
meta.rect(X0, Y1, X1, Y1 + 0.3)

env_hdri = os.path.basename(kit.ph.hdri("indoor_pool"))
kit.finalize("06", meta, hdri_file=env_hdri,
             lm_size=2048 if FAST else 4096, lm_samples=64 if FAST else 512,
             ao_size=1024, ao_samples=32 if FAST else 96)
