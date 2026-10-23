"""空間4：サンチアゴ航空513便事件 — 1954年の空港と、35年後に現れた機内

第1区画 (y 0〜22)  : 夜の空港の待合ロビー。窓の外に滑走路の灯りと、駐機したプロペラ機。「空港」「航空」の表示
第2区画 (y 22〜38) : 搭乗口への通路。1954年の出発案内板（513便 消息不明）、アーヘンのポスター、消息不明の新聞
第3区画 (y 38〜63) : ボーディングブリッジ（1989年・ポルトアレグレ）と機内。埃をかぶった座席、締めたままのシートベルト、乗客名簿
"""
import math
import os
import random

import kit
from kit import GEN, Meta, box, cyl, fluorescent, grid_terrain, mat_color, mat_image, mat_pbr, plane, tube

FAST = "fast" in getattr(kit, "OPTS", set())
random.seed(4)
kit.reset()
kit.setup_cycles()
kit.world_color((0.004, 0.005, 0.009), 1.0)
meta = Meta("04")

M_terr = mat_pbr("terrazzo", "terrazzo_tiles", tile=2.0)
M_ceilt = mat_pbr("ceiling_tiles", "ceiling_interior", tile=1.2)
M_plaster = mat_pbr("plaster", "white_plaster_02", tile=2.0, tint=(0.88, 0.85, 0.78))
M_frame = mat_color("window_frame", (0.18, 0.19, 0.2), 0.5)
M_leather = mat_pbr("seat_leather", "brown_leather", tile=0.6)
M_chrome = mat_color("seat_frame", (0.55, 0.56, 0.57), 0.35, metal=1.0)
M_asph = mat_pbr("apron", "asphalt_02", tile=4.0)
M_alu = mat_color("aluminium", (0.72, 0.74, 0.76), 0.35, metal=1.0)
M_dark = mat_color("dark", (0.04, 0.04, 0.045), 0.6)
M_counter = mat_pbr("counter_wood", "dark_wood", tile=1.0)

# ---------------------------------------------------------------- 第1区画：待合ロビー
LX, RX, Y1, HT = -5.0, 5.0, 22.0, 3.4
box("lobby_floor", (RX - LX, Y1 + 1, 0.1), (0, Y1 / 2 - 0.5, -0.05), M_terr)
box("lobby_ceil", (RX - LX, Y1 + 1, 0.08), (0, Y1 / 2 - 0.5, HT + 0.04), M_ceilt)
box("lobby_wall_l", (0.15, Y1 + 1, HT), (LX - 0.075, Y1 / 2 - 0.5, HT / 2), M_plaster)
box("lobby_wall_front", (RX - LX, 0.15, HT), (0, -1.0, HT / 2), M_plaster)
for side in (-1, 1):
    box("lobby_wall_back", (RX - 1.8, 0.15, HT), (side * (RX + 1.8) / 2, Y1, HT / 2), M_plaster)
box("lobby_back_head", (3.6, 0.15, HT - 2.8), (0, Y1, 2.8 + (HT - 2.8) / 2), M_plaster)
# 窓の壁（ガラスなし、窓枠だけ）
box("win_low", (0.2, Y1 + 1, 0.5), (RX, Y1 / 2 - 0.5, 0.25), M_plaster)
box("win_head", (0.2, Y1 + 1, 0.4), (RX, Y1 / 2 - 0.5, HT - 0.2), M_plaster)
y = -1.0
while y <= Y1:
    box("mullion", (0.12, 0.1, HT - 0.9), (RX, y, 0.5 + (HT - 0.9) / 2), M_frame)
    y += 2.0
box("transom", (0.1, Y1 + 1, 0.06), (RX, Y1 / 2 - 0.5, 2.3), M_frame)

# 天井の蛍光灯（半分ほど消えている）
for i, yy in enumerate((2.5, 6.5, 10.5, 14.5, 18.5)):
    for j, xx in enumerate((-2.6, 0.0, 2.6)):
        lit = (i + j) % 2 == 0 or (i, j) == (4, 1)
        fluorescent(f"lobby_fl_{i}_{j}", xx, yy, HT, length=1.2, power=30, lit=lit, flicker=(i, j) == (2, 2))

# 待合のベンチ（窓を向いて並ぶ）
for rx in (-2.6, -0.2, 2.2):
    y0 = 4.4
    for k in range(13):
        yy = y0 + k * 0.7
        box("seat_base", (0.45, 0.62, 0.05), (rx, yy, 0.42), M_chrome)
        box("seat_cush", (0.46, 0.6, 0.08), (rx + 0.02, yy, 0.48), M_leather, bevel=0.02)
        box("seat_back", (0.07, 0.6, 0.5), (rx - 0.22, yy, 0.8), M_leather, rot=(0, -10, 0), bevel=0.02)
    for yy in (y0 - 0.3, y0 + 12 * 0.7 + 0.3):
        box("seat_leg", (0.4, 0.05, 0.42), (rx, yy, 0.21), M_chrome)
    box("seat_rail", (0.08, 12 * 0.7 + 0.6, 0.06), (rx, y0 + 6 * 0.7, 0.36), M_chrome)
    meta.rect(rx - 0.3, y0 - 0.35, rx + 0.3, y0 + 12 * 0.7 + 0.35)

# 「空港」の吊り看板
M_kuko = mat_image("sign_kuko", os.path.join(GEN, "s04_kuko.png"), rough=0.4, emit_strength=0.6)
box("kuko_box", (2.4, 0.12, 0.62), (0, 3.2, HT - 0.55), M_dark)
plane("kuko", 2.36, 0.59, (0, 3.2 - 0.065, HT - 0.55), M_kuko, rot=(90, 0, 0))
for dx in (-1, 1):
    cyl("kuko_wire", 0.006, 0.25, (dx, 3.2, HT - 0.25), M_frame, segs=4)
meta.trace("kuko", 0, 3.0, 2.4, radius=2.8)

# 航空会社のカウンター
box("counter", (0.7, 3.2, 1.05), (LX + 0.6, 17.5, 0.525), M_counter)
box("counter_top", (0.8, 3.3, 0.05), (LX + 0.6, 17.5, 1.07), mat_color("counter_top", (0.75, 0.72, 0.65), 0.4))
M_koku = mat_image("sign_koku", os.path.join(GEN, "s04_koku.png"), rough=0.5)
plane("koku", 2.8, 0.7, (LX + 0.01, 17.5, 2.3), M_koku, rot=(90, 0, -90 + 180))
meta.rect(LX, 15.85, LX + 1.0, 19.15)
meta.trace("koku", LX + 1.6, 17.5, 1.5, radius=2.4)

# 窓の外：エプロン・滑走路の灯り・プロペラ機
grid_terrain("apron", RX + 0.1, -60, 110, 130, 4.0, lambda x, y: -0.35, M_asph, collection="vlit")
M_rwy_w = mat_color("rwy_white", (1, 0.95, 0.85), 0.4, emit=(1.0, 0.92, 0.75), emit_strength=8)
M_rwy_b = mat_color("rwy_blue", (0.2, 0.3, 1), 0.4, emit=(0.25, 0.4, 1.0), emit_strength=8)
for xx, mat in ((68, M_rwy_w), (82, M_rwy_w), (52, M_rwy_b)):
    yy = -60
    while yy < 130:
        box("rwy_light", (0.25, 0.25, 0.12), (xx, yy, -0.28), mat)
        yy += 7.0
yy = -60
while yy < 130:
    box("rwy_center", (0.4, 3.5, 0.01), (75, yy, -0.345), mat_color("rwy_paint", (0.55, 0.55, 0.52), 0.8))
    yy += 9.0
meta.trace("kassoro", RX - 0.8, 7.0, 1.5, radius=2.6)

# プロペラ機（4発の旅客機）
PX, PZ = 30.0, 2.7
prof_y = [-2.0, -1.2, 0.0, 2.0, 20.0, 24.0, 27.0]
prof_r = [0.25, 1.0, 1.4, 1.55, 1.55, 1.0, 0.35]
tube("fuselage", [(PX, yy, PZ + (0.35 if yy > 22 else 0)) for yy in prof_y], prof_r, M_alu, segs=24)
box("wing", (36.0, 4.0, 0.28), (PX, 9.5, PZ - 0.9), M_alu)
box("tail_fin", (0.25, 3.5, 3.8), (PX, 25.4, PZ + 2.6), M_alu, rot=(-15, 0, 0))
box("tail_plane", (11.0, 2.2, 0.18), (PX, 25.6, PZ + 0.6), M_alu)
for ex in (-11.0, -5.6, 5.6, 11.0):
    tube("nacelle", [(PX + ex, 6.6, PZ - 0.7), (PX + ex, 7.2, PZ - 0.7), (PX + ex, 10.5, PZ - 0.8), (PX + ex, 12.0, PZ - 0.9)],
         [0.35, 0.62, 0.6, 0.25], M_alu, segs=14)
    cyl("spinner", 0.2, 0.4, (PX + ex, 6.4, PZ - 0.7), M_alu, segs=10, rot=(90, 0, 0))
    for b in range(3):
        a = b * 120 + random.uniform(0, 40)
        box("prop_blade", (0.18, 0.04, 1.9), (PX + ex + 0.95 * math.sin(math.radians(a)), 6.3,
                                               PZ - 0.7 + 0.95 * math.cos(math.radians(a))), M_dark, rot=(0, a, 0))
for gx, gy in ((PX - 5.6, 9.5), (PX + 5.6, 9.5), (PX, 0.5)):
    cyl("gear", 0.08, PZ - 0.9, (gx, gy, -0.35), M_dark, segs=8)
    cyl("wheel", 0.45, 0.3, (gx - 0.15, gy, 0.1), M_dark, segs=16, rot=(0, 90, 0))
for k in range(16):  # 客室の窓（暗い）
    plane("plane_window", 0.28, 0.35, (PX - 1.56, 4.0 + k * 1.0, PZ + 0.35), M_dark, rot=(90, 0, 90 + 180))
kit.spot_at((14.0, 2.0, 16.0), (PX, 12.0, PZ), power=12000, angle_deg=45, blend=0.5, color=(1.0, 0.85, 0.6), name="flood")
meta.trace("propeller", RX - 0.8, 14.0, 1.5, radius=2.6)

# ---------------------------------------------------------------- 第2区画：搭乗口への通路
CX, Y2, Y3, HC = 1.8, 22.0, 38.0, 2.8
box("corr_floor", (2 * CX, Y3 - Y2, 0.1), (0, (Y2 + Y3) / 2, -0.05), M_terr)
box("corr_ceil", (2 * CX, Y3 - Y2, 0.08), (0, (Y2 + Y3) / 2, HC + 0.04), M_ceilt)
for side in (-1, 1):
    box("corr_wall", (0.12, Y3 - Y2, HC), (side * CX, (Y2 + Y3) / 2, HC / 2), M_plaster)
    meta.rect(min(side * CX, side * (CX + 0.3)), Y2, max(side * CX, side * (CX + 0.3)), Y3)
fluorescent("corr_fl_a", 0, 25.0, HC, length=1.2, power=28)
fluorescent("corr_fl_b", 0, 30.5, HC, length=1.2, power=26, flicker=True)
fluorescent("corr_fl_c", 0, 35.5, HC, length=1.2, lit=False)

M_board = mat_image("dep_board", os.path.join(GEN, "s04_board.png"), rough=0.3, emit_strength=0.8)
box("board_box", (0.14, 2.1, 1.22), (-CX + 0.07, 26.0, 1.85), M_dark)
plane("board", 2.0, 1.125, (-CX + 0.145, 26.0, 1.85), M_board, rot=(90, 0, 90))
meta.trace("y1954", -0.8, 26.0, 1.6, radius=2.2)

M_aachen = mat_image("aachen_poster", os.path.join(GEN, "s04_aachen.png"), rough=0.6)
plane("aachen", 0.6, 0.85, (CX - 0.065, 31.0, 1.5), M_aachen, rot=(90, 0, -90))
meta.trace("aachen", 0.8, 31.0, 1.5, radius=2.0)

box("bench2", (0.45, 1.6, 0.06), (-CX + 0.3, 35.0, 0.45), M_leather)
for dy in (-0.7, 0.7):
    box("bench2_leg", (0.4, 0.05, 0.45), (-CX + 0.3, 35.0 + dy, 0.225), M_chrome)
M_n54 = mat_image("news_1954", os.path.join(GEN, "s04_news1954.png"), rough=0.9)
plane("news54", 0.36, 0.5, (-CX + 0.32, 35.1, 0.483), M_n54, rot=(0, 0, 8))
meta.rect(-CX, 34.2, -CX + 0.6, 35.8)
meta.trace("fumei", -0.9, 35.0, 0.6, radius=1.9)

# ---------------------------------------------------------------- 第3区画：ボーディングブリッジと機内
BX, Y4, HB = 0.95, 45.0, 2.3
box("bridge_floor", (2 * BX, Y4 - Y3, 0.1), (0, (Y3 + Y4) / 2, -0.05), mat_pbr("bridge_floor", "rubber_tiles", tile=1.0))
box("bridge_ceil", (2 * BX, Y4 - Y3, 0.08), (0, (Y3 + Y4) / 2, HB + 0.04), M_dark)
for side in (-1, 1):
    box("bridge_wall", (0.08, Y4 - Y3, HB), (side * BX, (Y3 + Y4) / 2, HB / 2), mat_pbr("bridge_wall", "corrugated_iron", tile=1.5))
    meta.rect(min(side * BX, side * (BX + 0.3)), Y3, max(side * BX, side * (BX + 0.3)), Y4)
    box("corr_end", (CX - BX, 0.12, HC), (side * (CX + BX) / 2, Y3, HC / 2), M_plaster)
    meta.rect(min(side * BX, side * CX), Y3 - 0.06, max(side * BX, side * CX), Y3 + 0.06)
M_porto = mat_image("porto_poster", os.path.join(GEN, "s04_porto.png"), rough=0.5)
plane("porto", 1.2, 0.6, (BX - 0.045, 40.0, 1.55), M_porto, rot=(90, 0, -90))
M_n89 = mat_image("news_1989", os.path.join(GEN, "s04_news1989.png"), rough=0.9)
plane("news89", 0.36, 0.5, (-0.3, 42.3, 0.006), M_n89, rot=(0, 0, -20))
cyl("bridge_bulb", 0.04, 0.06, (0, 41.5, HB - 0.06), mat_color("bulb_warm", (1, 0.85, 0.6), 0.3, emit=(1, 0.8, 0.55), emit_strength=6), segs=8)
kit.point_light((0, 41.5, HB - 0.15), power=25, color=(1, 0.8, 0.55), radius=0.05, name="bridge_bulb")
meta.trace("porto", 0.4, 40.0, 1.5, radius=1.8)
meta.trace("y1989", -0.2, 42.3, 0.3, radius=1.6)

# 機内（胴体の内側）
CY0, CY1, CR, CZ = 45.0, 63.0, 1.75, 1.0
M_cabin = kit.double_sided(mat_color("cabin_wall", (0.62, 0.6, 0.55), 0.85))
tube("cabin_shell", [(0, yy, CZ) for yy in (CY0 - 0.05, CY1 + 0.05)], [CR, CR], M_cabin, segs=28)
box("cabin_floor", (2 * CR, CY1 - CY0, 0.1), (0, (CY0 + CY1) / 2, -0.05), mat_pbr("cabin_carpet", "dirty_carpet", tile=1.2, tint=(0.7, 0.75, 0.9)))
for side in (-1, 1):  # 入口の壁（中央に扉の開口）
    box("cabin_front", (CR - 0.6, 0.1, 2 * CR), (side * (CR + 0.6) / 2, CY0, CZ), M_cabin)
box("cabin_front_top", (1.2, 0.1, CZ + CR - 2.0), (0, CY0, 2.0 + (CZ + CR - 2.0) / 2), M_cabin)
box("cockpit_door", (0.8, 0.06, 1.9), (0, CY1 - 0.05, 0.95), mat_color("door_panel", (0.45, 0.42, 0.38), 0.6))
box("cabin_end", (2 * CR, 0.1, 2 * CR), (0, CY1, CZ), M_cabin)
for side in (-1, 1):
    box("bins", (0.42, CY1 - CY0 - 0.6, 0.38), (side * 1.25, (CY0 + CY1) / 2, 2.0), mat_color("bins", (0.7, 0.68, 0.62), 0.7))
    meta.rect(min(side * 1.48, side * (CR + 0.2)), CY0, max(side * 1.48, side * (CR + 0.2)), CY1)

M_dust = mat_pbr("dusty_seat", "denim_fabric_04", tile=0.5, tint=(0.62, 0.6, 0.58))
M_belt = mat_color("seatbelt", (0.42, 0.38, 0.28), 0.8)
M_buckle = mat_color("buckle", (0.6, 0.58, 0.52), 0.35, metal=1.0)
M_win = mat_color("daylight_window", (1, 0.98, 0.94), 0.3, emit=(1.0, 0.97, 0.9), emit_strength=5)
rows = []
yy = CY0 + 1.4
while yy < CY1 - 1.0:
    rows.append(yy)
    yy += 0.86
for r, yy in enumerate(rows):
    for side in (-1, 1):
        for xx in (side * 0.66, side * 1.1):
            box("c_seat_base", (0.42, 0.44, 0.38), (xx, yy, 0.19), M_dark)
            box("c_seat_cush", (0.42, 0.46, 0.1), (xx, yy, 0.43), M_dust, bevel=0.02)
            box("c_seat_back", (0.42, 0.09, 0.66), (xx, yy + 0.24, 0.82), M_dust, rot=(-8, 0, 0), bevel=0.02)
            # 締めたままのシートベルト（座っていた人だけがいない）
            box("belt_l", (0.18, 0.05, 0.012), (xx - 0.1, yy - 0.02, 0.487), M_belt, rot=(0, 0, 8))
            box("belt_r", (0.18, 0.05, 0.012), (xx + 0.1, yy - 0.02, 0.487), M_belt, rot=(0, 0, -8))
            box("buckle", (0.06, 0.06, 0.016), (xx, yy - 0.03, 0.49), M_buckle)
        # 窓（外は昼の光）と差し込む光
        wx = side * (CR - 0.08)
        plane("cabin_win", 0.24, 0.32, (wx, yy, 1.25), M_win, rot=(90, 0, -90 * side))
        kit.area_light((wx - side * 0.05, yy, 1.25), size=(0.24, 0.32), power=7, color=(1.0, 0.96, 0.88), rot=(90, 0, -90 * side),
                       name="sunwin")
    meta.rect(-1.42, yy - 0.3, -0.42, yy + 0.32)
    meta.rect(0.42, yy - 0.3, 1.42, yy + 0.32)
# 埃（床にたまった灰色）
for k in range(16):
    plane("dust_patch", random.uniform(0.3, 0.8), random.uniform(0.3, 0.8),
          (random.uniform(-0.35, 0.35), random.uniform(CY0 + 1, CY1 - 1), 0.004), mat_color("dust", (0.3, 0.29, 0.27), 1.0),
          rot=(0, 0, random.uniform(0, 180)))
meta.trace("hakkotsu", 0, 54.0, 0.8, radius=2.2)
# 乗客名簿（最前列の座席に置かれたクリップボード）
M_man = mat_image("manifest", os.path.join(GEN, "s04_manifest.png"), rough=0.85)
box("clipboard", (0.24, 0.33, 0.01), (0.66, rows[0] - 0.02, 0.485), mat_color("clip_board", (0.45, 0.3, 0.18), 0.7), rot=(0, 0, 12))
plane("manifest", 0.21, 0.297, (0.66, rows[0] - 0.02, 0.4915), M_man, rot=(0, 0, 12))
meta.trace("jokyaku", 0.25, rows[0] - 0.4, 0.6, radius=1.7)
meta.rect(-CR, CY1 - 0.3, CR, CY1 + 0.3)

# ---------------------------------------------------------------- 区画・スポーン
meta.spawn(0, 0.2, 0)
meta.zones(-100, Y2 + 0.3, Y3 + 0.3)
meta.rect(LX - 0.3, -1.2, RX + 0.3, -0.85)
meta.rect(LX - 0.3, -1, LX, Y1)
meta.rect(RX - 0.25, -1, RX + 0.3, Y1)
meta.rect(LX, Y1 - 0.08, -CX, Y1 + 0.08)
meta.rect(CX, Y1 - 0.08, RX, Y1 + 0.08)

env_hdri = os.path.basename(kit.ph.hdri("rostock_laage_airport"))
kit.finalize("04", meta, hdri_file=env_hdri,
             lm_size=2048 if FAST else 4096, lm_samples=64 if FAST else 512,
             ao_size=1024, ao_samples=32 if FAST else 96)
