"""空間5：メリーさんの電話 — ゴミ捨て場から、駅前、そして自分の部屋の前へ

第1区画 (y 0〜18)  : 夜の住宅街のゴミ捨て場。空になった人形の箱、引っ越しの段ボール
第2区画 (y 18〜36) : 誰もいない駅前。受話器が外れてぶら下がった公衆電話、西洋人形の落とし物の貼り紙
第3区画 (y 36〜56) : アパートの廊下と自分の部屋のドア。だんだん近づく書き置き。部屋の中で電話が鳴っている
演出: 区画を越えるたびに電話が鳴る（three 側 / audio.ringOnZone）
"""
import math
import os
import random

import kit
from kit import GEN, Meta, box, cyl, fluorescent, grid_terrain, mat_color, mat_image, mat_pbr, place, plane, tube

FAST = "fast" in getattr(kit, "OPTS", set())
random.seed(5)
kit.reset()
kit.setup_cycles()
kit.world_color((0.006, 0.007, 0.012), 1.0)
meta = Meta("05")

M_asph = mat_pbr("street", "asphalt_02", tile=3.0)
M_side = mat_pbr("sidewalk", "concrete_pavers", tile=1.5)
M_block = mat_pbr("block_wall", "concrete_block_wall", tile=1.6)
M_house = mat_pbr("house_siding", "exterior_wall_cladding", tile=2.0, tint=(0.75, 0.75, 0.72))
M_pole = mat_pbr("pole_concrete", "concrete", tile=1.0)
M_metal = mat_color("painted_metal", (0.3, 0.32, 0.3), 0.5, metal=0.6)
M_dark = mat_color("dark", (0.03, 0.03, 0.035), 0.6)
M_glass = mat_color("dark_glass", (0.02, 0.025, 0.03), 0.08)
M_lamp = mat_color("lamp_glow", (1, 0.9, 0.7), 0.3, emit=(1.0, 0.85, 0.6), emit_strength=8)

# ---------------------------------------------------------------- 第1区画：住宅街のゴミ捨て場
grid_terrain("road", -3.2, -6, 3.2, 18.5, 1.0, lambda x, y: 0.0, M_asph)
box("white_line", (0.12, 24.0, 0.005), (-2.9, 6.0, 0.003), mat_color("paint", (0.75, 0.75, 0.7), 0.7))
box("walk_r", (1.6, 24.5, 0.12), (4.0, 6.2, 0.06), M_side)
box("curb", (0.15, 24.5, 0.15), (3.2, 6.2, 0.075), M_pole)
box("block_wall_l", (0.2, 24.5, 1.7), (-3.35, 6.2, 0.85), M_block)
box("block_top", (0.24, 24.5, 0.06), (-3.35, 6.2, 1.72), M_pole)
# 塀の向こうの家（窓は暗い。1つだけ明かり）
for k, hy in enumerate((-2.0, 6.0, 14.0)):
    box("house_l", (6.0, 7.0, 6.0), (-7.0, hy, 3.0), M_house)
    box("roof_l", (6.6, 7.6, 0.3), (-7.0, hy, 6.1), M_dark)
    for wy in (hy - 1.8, hy + 1.8):
        for wz in (1.5, 4.2):
            lit = (k, wy, wz) == (1, hy + 1.8, 4.2)
            plane("house_win", 1.0, 0.9, (-3.99, wy, wz),
                  mat_color("win_lit", (1, 0.85, 0.6), 0.3, emit=(1, 0.8, 0.5), emit_strength=2) if lit else M_glass, rot=(90, 0, 90))
for k, hy in enumerate((-1.0, 9.0)):
    box("house_r", (6.0, 8.0, 6.0), (8.0, hy, 3.0), M_house)
    box("roof_r", (6.6, 8.6, 0.3), (8.0, hy, 6.1), M_dark)
    for wy in (hy - 2, hy + 2):
        plane("house_win_r", 1.0, 0.9, (4.99, wy, 4.2), M_glass, rot=(90, 0, -90))
box("fence_r", (0.05, 24.5, 1.1), (4.85, 6.2, 0.55), M_metal)

# 電柱と電線
for py in (1.0, 17.0):
    cyl("utility_pole", 0.17, 9.0, (3.5, py, 0), M_pole, segs=12, r_top=0.12)
    box("crossarm", (1.6, 0.1, 0.1), (3.5, py, 8.2), M_metal)
for dx in (-0.6, 0.0, 0.6):
    tube("wire", [(3.5 + dx, 1.0, 8.25), (3.5 + dx, 9.0, 7.6), (3.5 + dx, 17.0, 8.25)], [0.01, 0.01, 0.01], M_dark, segs=4)
# 街灯（電柱に取り付け）
box("lamp_arm", (0.8, 0.06, 0.06), (3.1, 1.0, 5.5), M_metal)
box("lamp_head", (0.35, 0.18, 0.06), (2.7, 1.0, 5.45), M_metal)
box("lamp_tube", (0.3, 0.12, 0.02), (2.7, 1.0, 5.41), M_lamp)
kit.spot_light((2.7, 1.0, 5.38), (0, 0, 0), power=220, angle_deg=120, blend=0.8, color=(1, 0.85, 0.6), name="street_lamp")

# ゴミ集積所（ブロックの囲い・カラスよけネット・ゴミ袋）
GX, GY = 4.0, 9.0
box("gomi_back", (1.5, 0.12, 0.9), (GX, GY + 1.25, 0.45), M_block)
box("gomi_side_a", (0.12, 2.5, 0.9), (GX + 0.72, GY, 0.45), M_block)
box("gomi_side_b", (0.12, 2.5, 0.9), (GX - 0.72, GY, 0.45), M_block)
T_bag = kit.model_template("trashbag", decimate=0.5)
for k in range(7):
    place(T_bag, (GX + random.uniform(-0.45, 0.45), GY + random.uniform(-0.9, 0.9), 0.1), rot_z=random.uniform(0, 360),
          scale=random.uniform(0.8, 1.05))
M_net = kit.double_sided(mat_image("crow_net", os.path.join(GEN, "s05_net.png"), rough=0.8, cut=True, tile=0.6))
net = box("net", (1.4, 2.3, 0.02), (GX, GY - 0.05, 0.62), M_net, rot=(4, 6, 0))
M_gomi = mat_image("gomi_sign", os.path.join(GEN, "s05_gomi.png"), rough=0.5)
plane("gomi_sign", 0.4, 0.5, (GX, GY + 1.18, 1.25), M_gomi, rot=(90, 0, 0))
box("gomi_sign_post", (0.05, 0.05, 1.0), (GX, GY + 1.2, 0.75), M_metal)
# 集積所を照らす小さな防犯灯
box("gomi_light", (0.25, 0.12, 0.08), (GX, GY + 1.3, 2.2), M_lamp)
box("gomi_light_arm", (0.05, 0.3, 0.05), (GX, GY + 1.45, 2.2), M_metal)
box("gomi_light_pole", (0.06, 0.06, 2.2), (GX, GY + 1.6, 1.1), M_metal)
kit.spot_light((GX, GY + 1.2, 2.14), (25, 0, 0), power=90, angle_deg=100, blend=0.7, color=(0.9, 0.95, 1.0), name="gomi_light")
meta.rect(GX - 0.8, GY - 1.3, GX + 0.8, GY + 1.3)
meta.trace("gomi", GX - 1.2, GY, 0.6, radius=2.4)

# 引っ越しの段ボール
T_box = kit.model_template("cardboard_box_01", decimate=0.25)
M_hik = mat_image("hikkoshi_label", os.path.join(GEN, "s05_hikkoshi.png"), rough=0.8)
for k, (bx, by, bz, rz) in enumerate([(3.9, 12.4, 0.12, 5), (4.3, 12.5, 0.12, -8), (4.05, 12.45, 0.46, 12)]):
    place(T_box, (bx, by, bz), rot_z=rz + 90)
plane("hik_label", 0.3, 0.21, (3.9, 12.4 - 0.27, 0.32), M_hik, rot=(90, 0, 5))
meta.rect(3.6, 12.1, 4.6, 12.8)
meta.trace("hikkoshi", 3.0, 12.4, 0.5, radius=2.0)

# 空になった人形の箱（ふたが開いている）
M_doll = mat_image("doll_box", os.path.join(GEN, "s05_dollbox.png"), rough=0.6)
dbx, dby = 3.75, 14.2
box("dollbox_body", (0.3, 0.14, 0.42), (dbx, dby, 0.33), mat_color("dollbox_red", (0.45, 0.1, 0.16), 0.6), rot=(0, 0, 18))
plane("dollbox_face", 0.29, 0.41, (dbx - 0.022, dby - 0.066, 0.33), M_doll, rot=(90, 0, 18))
box("dollbox_lid", (0.3, 0.14, 0.02), (dbx + 0.05, dby + 0.18, 0.13), mat_color("dollbox_red", (0.45, 0.1, 0.16), 0.6), rot=(0, 70, 30))
meta.trace("ningyo", 3.0, 14.3, 0.4, radius=1.9)

# ---------------------------------------------------------------- 第2区画：誰もいない駅前
PX0, PX1, Y2, Y3 = -6.0, 6.0, 18.5, 36.0
box("plaza", (PX1 - PX0, Y3 - Y2, 0.1), (0, (Y2 + Y3) / 2, -0.05), mat_pbr("plaza_tiles", "patterned_paving", tile=2.0))
for side in (-1, 1):
    box("plaza_wall", (0.3, Y3 - Y2, 3.0), (side * (PX1 + 0.15), (Y2 + Y3) / 2, 1.5), M_house)
    meta.rect(min(side * PX1, side * (PX1 + 0.4)), Y2, max(side * PX1, side * (PX1 + 0.4)), Y3)
    box("plaza_gate", (PX1 - 3.2, 0.3, 3.0), (side * (PX1 + 3.2) / 2, Y2, 1.5), M_house)
    meta.rect(min(side * 3.4, side * PX1), Y2 - 0.15, max(side * 3.4, side * PX1), Y2 + 0.15)
# 駅舎の正面（シャッターは閉まっている。中央だけ扉が開いている）
box("facade_l", (5.0, 0.4, 4.2), (-3.5, Y3, 2.1), M_house)
box("facade_r", (5.0, 0.4, 4.2), (3.5, Y3, 2.1), M_house)
box("facade_top", (2.0, 0.4, 1.9), (0, Y3, 3.25), M_house)
M_shutter = mat_pbr("shutter", "painted_metal_shutter", tile=1.5)
box("shutter_l", (3.0, 0.05, 2.4), (-3.4, Y3 - 0.22, 1.2), M_shutter)
box("shutter_r", (3.0, 0.05, 2.4), (3.4, Y3 - 0.22, 1.2), M_shutter)
M_stn = mat_image("station_sign", os.path.join(GEN, "s05_station.png"), rough=0.4, emit_strength=0.5)
box("station_sign_box", (4.2, 0.2, 0.92), (0, Y3 - 0.3, 3.75), M_dark)
plane("station_sign", 4.1, 0.88, (0, Y3 - 0.405, 3.75), M_stn, rot=(90, 0, 0))
kit.area_light((0, Y3 - 0.6, 3.75), size=(4.0, 0.8), power=25, color=(0.9, 0.95, 1.0), rot=(90, 0, 0), name="sign_glow")
M_lost = mat_image("lost_poster", os.path.join(GEN, "s05_lost.png"), rough=0.6)
plane("lost", 0.5, 0.71, (-1.5, Y3 - 0.205, 1.45), M_lost, rot=(90, 0, 0))
meta.trace("seiyo", -1.4, Y3 - 1.3, 1.4, radius=1.9)

# 自動販売機（明るい）
M_vend = mat_image("vending", os.path.join(GEN, "s05_vending.png"), rough=0.2, emit_strength=1.6)
box("vending_body", (1.0, 0.75, 1.85), (-4.8, 31.0, 0.925), mat_color("vending_white", (0.8, 0.8, 0.82), 0.4), rot=(0, 0, 90))
plane("vending_face", 0.92, 1.8, (-4.8 + 0.38, 31.0, 0.95), M_vend, rot=(90, 0, 90))
kit.area_light((-4.8 + 0.45, 31.0, 1.0), size=(0.9, 1.7), power=60, color=(0.85, 0.92, 1.0), rot=(90, 0, 90), name="vend_glow")
meta.rect(-5.25, 30.45, -4.35, 31.55)

# 公衆電話（受話器が外れて、コードの先でぶら下がっている）
TX, TY = 2.6, 26.0
M_green = mat_color("phone_green", (0.2, 0.5, 0.3), 0.4)
box("phone_stand", (0.12, 0.12, 0.85), (TX, TY, 0.425), M_metal)
box("phone_shelf", (0.5, 0.32, 0.04), (TX, TY, 0.87), M_metal)
box("phone_body", (0.26, 0.22, 0.42), (TX, TY + 0.03, 1.1), M_green)
box("phone_screen", (0.1, 0.01, 0.04), (TX, TY - 0.085, 1.22), mat_color("phone_lcd", (0.4, 0.6, 0.4), 0.3, emit=(0.4, 0.7, 0.4), emit_strength=1.0))
box("phone_hook", (0.05, 0.04, 0.12), (TX - 0.1, TY - 0.09, 1.15), M_dark)
cord = [(TX - 0.08, TY - 0.08, 1.0)] + [(TX - 0.12 + 0.025 * math.sin(k * 1.6), TY - 0.12 + 0.025 * math.cos(k * 1.6), 0.95 - k * 0.035)
                                         for k in range(16)]
tube("phone_cord", cord, [0.008] * len(cord), M_dark, segs=5)
box("receiver", (0.06, 0.05, 0.22), (TX - 0.12, TY - 0.12, 0.3), M_green, rot=(0, 8, 15))
box("phone_roof", (0.7, 0.55, 0.05), (TX, TY, 2.1), M_green)
box("phone_roof_post", (0.06, 0.06, 1.25), (TX + 0.3, TY + 0.22, 1.47), M_metal)
fluorescent("phone_fl", TX, TY, 2.07, length=0.4, power=8, along="x", flicker=True, width=0.06)
meta.rect(TX - 0.3, TY - 0.2, TX + 0.35, TY + 0.3)
meta.trace("koshu", TX - 1.0, TY - 0.6, 1.0, radius=2.2)
meta.sound("ring2", TX, TY, 1.1)
# 駅前の街灯
cyl("plaza_lamp", 0.07, 4.5, (0, 24.0, 0), M_metal, segs=8)
box("plaza_lamp_head", (0.4, 0.4, 0.15), (0, 24.0, 4.55), M_dark)
box("plaza_lamp_glow", (0.36, 0.36, 0.02), (0, 24.0, 4.47), M_lamp)
kit.spot_light((0, 24.0, 4.44), (0, 0, 0), power=180, angle_deg=120, blend=0.8, color=(1, 0.85, 0.6), name="plaza_lamp")
meta.circle(0, 24.0, 0.12)

# ---------------------------------------------------------------- 第3区画：アパートの廊下と自分の部屋のドア
CX, Y4, HC = 1.0, 56.0, 2.5
box("hall_floor", (2 * CX, Y4 - Y3, 0.1), (0, (Y3 + Y4) / 2, -0.05), mat_pbr("hall_carpet", "dirty_carpet", tile=1.2, tint=(0.55, 0.55, 0.58)))
box("hall_ceil", (2 * CX, Y4 - Y3, 0.08), (0, (Y3 + Y4) / 2, HC + 0.04), mat_color("hall_ceiling", (0.7, 0.7, 0.68), 0.8))
M_hwall = mat_pbr("hall_wall", "white_plaster_02", tile=2.0, tint=(0.82, 0.82, 0.8))
for side in (-1, 1):
    box("hall_wall", (0.1, Y4 - Y3, HC), (side * CX, (Y3 + Y4) / 2, HC / 2), M_hwall)
    box("hall_skirting", (0.02, Y4 - Y3, 0.1), (side * (CX - 0.06), (Y3 + Y4) / 2, 0.05), M_dark)
    meta.rect(min(side * CX, side * (CX + 0.3)), Y3, max(side * CX, side * (CX + 0.3)), Y4)
box("hall_end", (2 * CX, 0.1, HC), (0, Y4, HC / 2), M_hwall)
meta.rect(-CX, Y4 - 0.08, CX, Y4 + 0.3)
M_door = mat_pbr("apt_door", "painted_metal_shutter", tile=1.0, tint=(0.55, 0.5, 0.45))
M_knob = mat_color("knob", (0.7, 0.68, 0.6), 0.3, metal=1.0)
doors = [(-1, 39.0), (1, 41.5), (-1, 44.0), (1, 46.5), (-1, 49.0), (1, 51.5)]
for side, dy in doors:
    box("door", (0.05, 0.85, 2.0), (side * (CX - 0.05), dy, 1.0), M_door)
    box("door_frame", (0.06, 0.95, 0.06), (side * (CX - 0.04), dy, 2.03), M_dark)
    cyl("knob", 0.025, 0.06, (side * (CX - 0.1), dy - 0.32, 1.0), M_knob, segs=8, rot=(0, 90 * side, 0))
# 突き当たりの自分の部屋のドア
box("my_door", (0.9, 0.05, 2.0), (0, Y4 - 0.08, 1.0), M_door)
cyl("my_knob", 0.025, 0.06, (0.32, Y4 - 0.14, 1.0), M_knob, segs=8, rot=(90, 0, 0))
box("doorplate", (0.18, 0.01, 0.07), (0, Y4 - 0.11, 1.65), mat_color("plate", (0.75, 0.72, 0.6), 0.4, metal=0.6))
# 非常口の誘導灯（参考画像の廊下）
box("exit", (0.36, 0.05, 0.13), (0, Y4 - 0.08, 2.32), mat_color("exit_green", (0.1, 0.8, 0.3), 0.3, emit=(0.15, 1, 0.4), emit_strength=4))
# 照明：手前は消え、突き当たりだけ点いている
for k, ly in enumerate((38.5, 43.0, 47.5, 52.5)):
    fluorescent(f"hall_fl_{k}", 0, ly, HC, length=1.0, power=55 if k == 3 else 0, lit=k == 3, along="x", flicker=False)
kit.point_light((0, 40.0, 2.3), power=3, color=(0.6, 0.7, 1.0), radius=0.4, name="hall_fill")

# 書き置き（だんだん近づく）
M_doko = mat_image("note_doko", os.path.join(GEN, "s05_note_doko.png"), rough=0.8)
plane("note_doko", 0.21, 0.28, (0.1, 37.6, 0.004), M_doko, rot=(0, 0, 15))
meta.trace("imadoko", 0.1, 37.6, 0.2, radius=1.6)
for k, (side, dy) in enumerate(doors[1:4]):
    M_n = mat_image(f"note_{k + 1}", os.path.join(GEN, f"s05_note_{k + 1}.png"), rough=0.8)
    plane(f"note_{k + 1}", 0.21, 0.28, (side * (CX - 0.08), dy, 1.45), M_n, rot=(90, 0, -90 * side))
meta.trace("chikazuku", 0, 46.5, 1.2, radius=2.2)
M_n4 = mat_image("note_4", os.path.join(GEN, "s05_note_4.png"), rough=0.8)
plane("note_4", 0.21, 0.28, (-0.2, Y4 - 0.11, 1.35), M_n4, rot=(90, 0, 0))
meta.trace("ushiro", 0, Y4 - 1.2, 1.2, radius=1.6)
meta.sound("ring3", 0, Y4 + 2.0, 1.0)
meta.sound("room", 0, Y4 + 2.0, 1.0)

# ---------------------------------------------------------------- 区画・スポーン
meta.spawn(0, -2.0, 0)
meta.zones(-100, Y2 + 0.3, Y3 + 0.3)
meta.rect(-3.25, -4.5, 4.8, -4.0)
meta.rect(-3.6, -4.5, -3.25, Y2)
meta.rect(4.7, -4.5, 5.0, Y2)
meta.rect(3.2, Y2 - 0.15, 4.8, Y2 + 0.15)
meta.rect(-3.25, Y2 - 0.15, -3.2, Y2 + 0.15)
for side in (-1, 1):
    meta.rect(min(side * CX, side * PX1), Y3 - 0.25, max(side * CX, side * PX1), Y3 + 0.25)

env_hdri = os.path.basename(kit.ph.hdri("old_apartments_walkway"))
kit.finalize("05", meta, hdri_file=env_hdri,
             lm_size=2048 if FAST else 4096, lm_samples=64 if FAST else 512,
             ao_size=1024, ao_samples=32 if FAST else 96)
