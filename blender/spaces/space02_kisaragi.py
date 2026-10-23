"""空間2：きさらぎ駅 — 深夜の電車と無人駅

床の高さ: 車内とホームは z=1.0、線路（バラスト）は z=0。
第1区画 (y -2〜17)   : 誰も乗っていない深夜の車内。窓の外は真っ暗。LED「0:24」「本日の終電です」
第2区画 (y 17〜50.5) : 無人駅のホーム。切れかけの蛍光灯、無人駅のお知らせ、ベンチに圏外の携帯電話、遠くの太鼓と鈴
第3区画 (y 50.5〜)   : かすれた駅名標、線路脇に落ちた携帯（掲示板の画面）、トンネルへ続く足跡
"""
import math
import os
import random

import kit
from kit import GEN, Meta, box, cyl, fluorescent, footprints, grass, grid_terrain, mat_color, mat_image, mat_pbr, place, plane, tube

FAST = "fast" in getattr(kit, "OPTS", set())
random.seed(2)
kit.reset()
kit.setup_cycles()
kit.world_color((0.0025, 0.003, 0.006), 1.0)
meta = Meta("02")

FL = 1.0          # 車内・ホームの床の高さ
CEIL = FL + 2.3   # 車内の天井
HX = 1.4          # 車内の半幅
CAR_Y0, CAR_Y1 = -2.0, 18.6
DOOR_EXIT = (16.9, 18.1)  # +X 側の開いたドア

# ---------------------------------------------------------------- マテリアル
M_floor = mat_pbr("car_floor", "old_linoleum_flooring_01", tile=1.6)
M_wall = mat_pbr("car_wall", "beige_wall_001", tile=1.5, tint=(0.95, 0.95, 0.9))
M_ceil = mat_color("car_ceiling", (0.82, 0.82, 0.8), 0.6)
M_steel = mat_color("stainless", (0.62, 0.63, 0.64), 0.32, metal=1.0)
M_glass = mat_color("night_glass", (0.008, 0.009, 0.012), 0.04)
M_seat = mat_pbr("seat_moquette", "denim_fabric_04", tile=0.5, tint=(0.75, 0.9, 1.0))
M_seat_base = mat_color("seat_base", (0.5, 0.5, 0.48), 0.5, metal=0.6)
M_strap = mat_color("strap", (0.85, 0.85, 0.82), 0.4)
M_plat = mat_pbr("platform", "concrete_floor_worn_001", tile=2.5)
M_tactile = mat_color("tactile", (0.75, 0.6, 0.12), 0.7)
M_gravel = mat_pbr("ballast", "gravel_floor_02", tile=1.5)
M_tunnel = kit.double_sided(mat_pbr("tunnel_concrete", "concrete_wall_008", tile=2.5))
M_plank = mat_pbr("shelter_plank", "weathered_plank_siding", tile=1.5)
M_rail = mat_color("rail", (0.32, 0.27, 0.22), 0.45, metal=0.8)
M_sleeper = mat_color("sleeper", (0.42, 0.41, 0.39), 0.85)
M_dark = mat_color("under_dark", (0.05, 0.05, 0.05), 0.8)
M_winlit = mat_color("car_window_lit", (0.6, 0.62, 0.58), 0.1, emit=(0.95, 0.95, 0.85), emit_strength=1.4)
M_fp = mat_image("footprint", os.path.join(GEN, "footprint.png"), rough=0.9, cut=True)
M_grass = kit.double_sided(mat_image("grass_blades", os.path.join(GEN, "grass_blade.png"), rough=0.75))

# ---------------------------------------------------------------- 第1区画：車内
box("car_floor", (2 * HX, CAR_Y1 - CAR_Y0, 0.08), (0, (CAR_Y0 + CAR_Y1) / 2, FL - 0.04), M_floor)
box("car_ceiling", (2 * HX, CAR_Y1 - CAR_Y0, 0.06), (0, (CAR_Y0 + CAR_Y1) / 2, CEIL + 0.03), M_ceil)
# 両端の壁（貫通扉の窓は黒いガラス）
for y, s in ((CAR_Y0, 1), (CAR_Y1, -1)):
    box("end_wall_l", (HX - 0.45, 0.08, 2.3), (-(HX + 0.45) / 2, y, FL + 1.15), M_wall)
    box("end_wall_r", (HX - 0.45, 0.08, 2.3), ((HX + 0.45) / 2, y, FL + 1.15), M_wall)
    box("end_door", (0.9, 0.06, 1.95), (0, y, FL + 0.975), M_steel)
    box("end_door_top", (0.9, 0.08, 0.35), (0, y, FL + 2.125), M_wall)
    plane("end_door_win", 0.5, 0.8, (0, y + 0.035 * s, FL + 1.45), M_glass, rot=(90, 0, 180 if s > 0 else 0))

DOORS = [(1.4, 2.6), (8.4, 9.6), DOOR_EXIT]


def side_wall(side):
    """窓帯つきの側壁。ドアの位置は扉（閉）または開口"""
    x = side * HX
    cuts = sorted(DOORS)
    segs, y = [], CAR_Y0
    for a, b in cuts:
        segs.append((y, a))
        y = b
    segs.append((y, CAR_Y1))
    for (a, b) in segs:
        L, cy = b - a, (a + b) / 2
        box("wall_low", (0.06, L, 0.95), (x, cy, FL + 0.475), M_wall)
        box("wall_up", (0.06, L, 0.55), (x, cy, CEIL - 0.275), M_wall)
        plane("window", L, 0.8, (x - side * 0.01, cy, FL + 1.35), M_glass, rot=(90, 0, -90 * side))
        if side > 0:  # ホーム側から見ると車内の明かりが漏れている
            plane("window_out", L, 0.8, (HX + 0.085, cy, FL + 1.35), M_winlit, rot=(90, 0, 90))
        n = max(1, round(L / 1.6))
        for k in range(n + 1):
            box("mullion", (0.07, 0.06, 0.8), (x - side * 0.02, a + L * k / n, FL + 1.35), M_steel)
        box("sill", (0.12, L, 0.04), (x - side * 0.05, cy, FL + 0.95), M_steel)
    for (a, b) in cuts:
        cy = (a + b) / 2
        box("door_head", (0.08, b - a, 0.35), (x, cy, CEIL - 0.175), M_wall)
        if side > 0 and (a, b) == DOOR_EXIT:
            box("door_pocket", (0.05, 0.6, 1.95), (x + 0.05, b + 0.32, FL + 0.975), M_steel)  # 開いた扉
            continue
        for k, (da, db) in enumerate(((a, cy), (cy, b))):
            box("door_leaf", (0.05, db - da - 0.01, 1.95), (x, (da + db) / 2, FL + 0.975), M_steel)
            plane("door_win", 0.3, 0.6, (x - side * 0.03, (da + db) / 2, FL + 1.45), M_glass, rot=(90, 0, -90 * side))


side_wall(1)
side_wall(-1)

# 座席（ロングシート）
SEATS = [(-1.6, 1.25), (2.75, 8.25), (9.75, 16.75)]
for side in (1, -1):
    for (a, b) in SEATS:
        if side > 0 and b > DOOR_EXIT[0]:
            b = DOOR_EXIT[0] - 0.15
        L, cy = b - a, (a + b) / 2
        x = side * (HX - 0.24)
        box("seat_base", (0.42, L, 0.4), (x, cy, FL + 0.2), M_seat_base)
        box("seat_cushion", (0.48, L, 0.09), (side * (HX - 0.27), cy, FL + 0.445), M_seat, bevel=0.02)
        box("seat_back", (0.08, L, 0.48), (side * (HX - 0.07), cy, FL + 0.76), M_seat, rot=(0, side * -8, 0))
        meta.rect(min(side * (HX - 0.52), side * HX), a, max(side * (HX - 0.52), side * HX), b)
        # 袖仕切りと縦の手すり
        for yy in (a, b):
            cyl("pole", 0.018, 2.3, (side * (HX - 0.5), yy, FL), M_steel, segs=10)
            meta.circle(side * (HX - 0.5), yy, 0.05)
        # 荷物棚
        box("rack", (0.3, L, 0.03), (side * (HX - 0.16), cy, FL + 1.88), M_steel)

# つり革
for side in (1, -1):
    tube("hold_bar", [(side * 0.72, CAR_Y0 + 0.4, CEIL - 0.32), (side * 0.72, CAR_Y1 - 0.4, CEIL - 0.32)], [0.016, 0.016],
         M_steel, segs=8)
    y = CAR_Y0 + 0.8
    while y < CAR_Y1 - 0.6:
        box("strap", (0.025, 0.012, 0.24), (side * 0.72, y, CEIL - 0.45), M_strap)
        ring = [(side * 0.72, y + 0.065 * math.cos(a), CEIL - 0.62 + 0.065 * math.sin(a)) for a in
                [i / 12 * 2 * math.pi for i in range(13)]]
        tube("strap_ring", ring, [0.009] * 13, M_strap, segs=6)
        y += 0.46

# 蛍光灯（2列）
y = CAR_Y0 + 0.9
i = 0
while y < CAR_Y1 - 0.5:
    for side in (1, -1):
        fluorescent(f"car_fl_{i}_{side}", side * 0.55, y, CEIL - 0.01, length=1.2, power=22)
    y += 1.55
    i += 1

# LED 表示と路線図（痕跡: 深夜・終電）
M_led1 = mat_image("led_next", os.path.join(GEN, "s02_led_next.png"), rough=0.3, emit_strength=1.5)
M_led2 = mat_image("led_last", os.path.join(GEN, "s02_led_last.png"), rough=0.3, emit_strength=1.5)
box("led_box1", (0.08, 0.7, 0.2), (HX - 0.05, 9.0, CEIL - 0.13), M_dark)
plane("led_face1", 0.66, 0.165, (HX - 0.095, 9.0, CEIL - 0.13), M_led1, rot=(90, 0, -90))
box("led_box2", (0.08, 0.7, 0.2), (-HX + 0.05, 2.0, CEIL - 0.13), M_dark)
plane("led_face2", 0.66, 0.165, (-HX + 0.095, 2.0, CEIL - 0.13), M_led2, rot=(90, 0, 90))
M_route = mat_image("routemap", os.path.join(GEN, "s02_routemap.png"), rough=0.6)
plane("routemap", 1.4, 0.26, (-HX + 0.04, 5.5, CEIL - 0.37), M_route, rot=(90, 0, 90))
meta.trace("densha", 0, 0.5, FL + 1.0, radius=2.0)
meta.trace("shuden", -0.6, 2.0, FL + 2.0, radius=2.0)
meta.trace("shinya", 0.6, 9.0, FL + 2.0, radius=2.0)

# 車体の外側（ホームから見える部分）と2両目（真っ暗）
for side in (1, -1):
    x = side * (HX + 0.06)
    if side > 0:
        box("body_out_a", (0.04, DOOR_EXIT[0] - CAR_Y0, 2.6), (x, (CAR_Y0 + DOOR_EXIT[0]) / 2, FL + 1.1), M_steel)
        box("body_out_b", (0.04, 40 - DOOR_EXIT[1], 2.6), (x, (DOOR_EXIT[1] + 40) / 2, FL + 1.1), M_steel)
        box("body_out_top", (0.04, DOOR_EXIT[1] - DOOR_EXIT[0], 0.4), (x, sum(DOOR_EXIT) / 2, CEIL + 0.1), M_steel)
    else:
        box("body_out_l", (0.04, 40 - CAR_Y0, 2.6), (x, (CAR_Y0 + 40) / 2, FL + 1.1), M_steel)
box("body_roof", (2 * HX + 0.16, 40 - CAR_Y0, 0.2), (0, (CAR_Y0 + 40) / 2, CEIL + 0.2), M_steel)
box("body_under", (2 * HX - 0.3, 40 - CAR_Y0, FL - 0.25), (0, (CAR_Y0 + 40) / 2, (FL - 0.25) / 2 + 0.25), M_dark)
box("car2_end", (2 * HX + 0.16, 0.1, 3.0), (0, 40, FL + 1.0), M_steel)
for k in range(9):  # 2両目の窓（明かりは消えている）
    yy = 20.5 + k * 2.1
    plane("car2_win", 1.3, 0.8, (HX + 0.085, yy, FL + 1.35), M_glass, rot=(90, 0, 90))
box("stripe", (0.01, 40 - CAR_Y0, 0.12), (HX + 0.085, (CAR_Y0 + 40) / 2, FL + 0.8),
    mat_color("line_green", (0.1, 0.4, 0.25), 0.5))

# ---------------------------------------------------------------- 線路とバラスト
grid_terrain("ballast", -3.5, CAR_Y0 - 6, 3.4, 100, 0.5, lambda x, y: 0.04 * math.sin(x * 3.1 + y) * math.cos(y * 2.3),
             M_gravel, collection="vlit")
for x in (-0.533, 0.533):
    box("rail", (0.07, 100 - CAR_Y0, 0.15), (x, (CAR_Y0 + 100) / 2, 0.2), M_rail)
y = 40.3
while y < 99:
    box("sleeper", (2.0, 0.2, 0.14), (0, y, 0.08), M_sleeper)
    y += 0.62
# 線路の外側の土手（暗い草地）
def bank(x, y):
    return 0.3 + max(0.0, abs(x) - 4) * 0.35 + 0.25 * math.sin(y * 0.3 + x)


grid_terrain("bank_r", 3.4, 49, 14, 100, 1.0, bank, mat_pbr("bank_soil", "brown_mud_02", tile=3.0), collection="vlit")
grid_terrain("bank_l", -14, CAR_Y0 - 6, -3.5, 100, 1.0, bank, mat_pbr("bank_soil", "brown_mud_02", tile=3.0), collection="vlit")
grass("bank_grass", [(random.uniform(3.3, 7), random.uniform(52, 92)) for _ in range(160)] +
      [(random.uniform(-6, -3.4), random.uniform(38, 92)) for _ in range(120)], M_grass,
      ground_fn=lambda x, y: bank(x, y) - 0.05, height=(0.3, 0.8), collection="vlit")

# ---------------------------------------------------------------- 第2区画：ホーム
PX0, PX1, PY0, PY1 = 1.52, 6.2, 13.6, 50.5
box("platform", (PX1 - PX0, PY1 - PY0, FL), ((PX0 + PX1) / 2, (PY0 + PY1) / 2, FL / 2), M_plat)
box("tactile", (0.3, PY1 - PY0, 0.01), (2.05, (PY0 + PY1) / 2, FL + 0.005), M_tactile)
box("edge_white", (0.08, PY1 - PY0, 0.01), (1.62, (PY0 + PY1) / 2, FL + 0.005), mat_color("paint_white", (0.8, 0.8, 0.76), 0.6))
# ホームの後ろの柵
y = PY0
while y <= PY1:
    cyl("fence_post", 0.03, 1.1, (PX1 - 0.05, y, FL), M_rail, segs=6)
    y += 2.0
for z in (0.5, 1.0):
    box("fence_rail", (0.03, PY1 - PY0, 0.03), (PX1 - 0.05, (PY0 + PY1) / 2, FL + z), M_rail)

# 屋根（y 20〜32）。蛍光灯は1本が切れかけ、1本は消えている
for yy in (20.2, 26.0, 31.8):
    cyl("roof_post", 0.06, 2.6, (5.7, yy, FL), M_rail, segs=8)
    meta.circle(5.7, yy, 0.12)
box("roof", (4.6, 12.4, 0.12), (3.9, 26.0, FL + 2.68), mat_pbr("roof_metal", "corrugated_iron_02", tile=2.0))
fluorescent("plat_fl_a", 3.6, 22.5, FL + 2.6, length=1.2, power=45, flicker=True)
fluorescent("plat_fl_b", 3.6, 27.0, FL + 2.6, length=1.2, power=40)
fluorescent("plat_fl_c", 3.6, 31.0, FL + 2.6, length=1.2, lit=False)

# 待合所（3方の壁）と無人駅のお知らせ
SX0, SX1, SY0, SY1 = 4.9, 6.1, 21.0, 24.6
box("shelter_back", (0.08, SY1 - SY0, 2.3), (SX1, (SY0 + SY1) / 2, FL + 1.15), M_plank)
box("shelter_s0", (SX1 - SX0, 0.08, 2.3), ((SX0 + SX1) / 2, SY0, FL + 1.15), M_plank)
box("shelter_s1", (SX1 - SX0, 0.08, 2.3), ((SX0 + SX1) / 2, SY1, FL + 1.15), M_plank)
box("shelter_roof", (SX1 - SX0 + 0.3, SY1 - SY0 + 0.3, 0.08), ((SX0 + SX1) / 2, (SY0 + SY1) / 2, FL + 2.34), M_plank)
box("shelter_bench", (0.4, SY1 - SY0 - 0.3, 0.06), (SX1 - 0.25, (SY0 + SY1) / 2, FL + 0.45), M_plank)
M_mujin = mat_image("mujin_notice", os.path.join(GEN, "s02_mujin.png"), rough=0.6)
plane("mujin", 0.5, 0.62, (SX0 - 0.002 + 0.0, SY0 - 0.045, FL + 1.5), M_mujin, rot=(90, 0, 0))
meta.rect(SX0, SY0 - 0.06, SX1 + 0.1, SY1 + 0.06)
meta.trace("mujineki", 4.6, 20.4, FL + 1.4, radius=2.4)

# ベンチと圏外の携帯電話
T_bench = kit.model_template("painted_wooden_bench")
place(T_bench, (5.45, 29.6, FL), rot_z=90)
meta.rect(5.05, 28.95, 5.9, 30.25)
M_phone = mat_color("phone_body", (0.04, 0.04, 0.05), 0.3, metal=0.4)
M_scr1 = mat_image("phone_kengai", os.path.join(GEN, "s02_phone_kengai.png"), rough=0.15, emit_strength=1.2)
box("phone1", (0.075, 0.155, 0.009), (5.35, 29.3, FL + 0.455), M_phone, rot=(0, 0, 15))
plane("phone1_scr", 0.068, 0.144, (5.35, 29.3, FL + 0.4605), M_scr1, rot=(0, 0, 15))
meta.trace("kengai", 4.9, 29.4, FL + 0.6, radius=2.0)

# ホームの端の街灯
cyl("lamp_pole", 0.06, 4.0, (5.8, 40.0, FL), M_rail, segs=8)
box("lamp_arm", (0.9, 0.08, 0.08), (5.4, 40.0, FL + 3.95), M_rail)
box("lamp_head", (0.36, 0.2, 0.08), (5.0, 40.0, FL + 3.9), M_dark)
box("lamp_glow", (0.32, 0.16, 0.02), (5.0, 40.0, FL + 3.85),
    mat_color("lamp_warm", (1.0, 0.85, 0.6), 0.4, emit=(1.0, 0.82, 0.55), emit_strength=8))
kit.spot_light((5.0, 40.0, FL + 3.82), (0, 0, 0), power=260, angle_deg=110, blend=0.8, color=(1.0, 0.85, 0.62), name="lamp")
meta.circle(5.8, 40.0, 0.12)
meta.trace("taiko", 3.6, 46.0, FL + 1.0, radius=3.0)
meta.sound("taiko", 26.0, 135.0, 6.0)

# 駅名標（かすれて読めそうで読めない）
M_eki = mat_image("ekimei", os.path.join(GEN, "s02_ekimei.png"), rough=0.55)
for dx in (-0.85, 0.85):
    cyl("eki_post", 0.04, 2.3, (3.9 + dx, 48.0, FL), M_rail, segs=8)
    meta.circle(3.9 + dx, 48.0, 0.1)
box("eki_back", (1.84, 0.04, 0.7), (3.9, 48.03, FL + 1.85), M_rail)
plane("eki_face", 1.8, 0.675, (3.9, 48.0 - 0.025, FL + 1.85), M_eki, rot=(90, 0, 0))
kit.point_light((3.9, 46.6, FL + 2.6), power=6, color=(0.75, 0.8, 0.9), radius=0.3, name="eki_fill")
meta.trace("ekimei", 3.9, 46.5, FL + 1.8, radius=2.6)

# ホームの端のスロープ（線路へ降りる）
import bmesh  # noqa: E402

bm = bmesh.new()
v = [bm.verts.new(p) for p in [(1.8, PY1, FL), (3.2, PY1, FL), (3.2, PY1 + 4.0, 0.02), (1.8, PY1 + 4.0, 0.02)]]
bm.faces.new(v)
kit.mesh_obj("ramp", bm, M_plat)
box("ramp_side", (0.1, 4.0, FL), (3.25, PY1 + 2.0, FL / 2), M_plat)

# ---------------------------------------------------------------- 第3区画：線路を歩いた先のトンネル
TY = 86.0
TX = 0.6  # トンネル中心
box("portal_l", (3.8, 1.2, 7.0), (-4.1, TY, 3.5), M_tunnel)
box("portal_r", (2.6, 1.2, 7.0), (4.7, TY, 3.5), M_tunnel)
box("portal_top", (5.6, 1.2, 2.2), (TX, TY, 5.9), M_tunnel)
ring = [(TX, yy, 1.9) for yy in [TY - 0.6 + k * 2.0 for k in range(20)]]
tube("tunnel", ring, [2.85] * len(ring), M_tunnel, segs=24)
# 奥にかすかな赤い灯り（異界）
box("far_red", (0.12, 0.05, 0.12), (TX - 1.9, TY + 34, 1.8),
    mat_color("red_lamp", (0.6, 0.05, 0.03), 0.4, emit=(1.0, 0.08, 0.04), emit_strength=12))
kit.point_light((TX - 1.6, TY + 33.5, 1.8), power=25, color=(1.0, 0.12, 0.06), radius=0.1, name="red")
meta.trace("tunnel", 1.4, 80.0, 1.5, radius=3.4)

# 線路を歩いた足跡（スロープの下からトンネルの中へ）
fp_path = [(2.5, PY1 + 4.3), (2.1, 60), (1.5, 68), (1.2, 76), (0.9, TY + 2), (0.6, TY + 6)]
footprints("footprints", fp_path, M_fp, z_fn=lambda x, y: 0.035, size=(0.13, 0.31))

# 線路脇に落ちた携帯（掲示板の画面）
M_scr2 = mat_image("phone_bbs", os.path.join(GEN, "s02_phone_bbs.png"), rough=0.15, emit_strength=1.3)
box("phone2", (0.075, 0.155, 0.009), (2.0, 64.0, 0.075), M_phone, rot=(4, -3, -25))
plane("phone2_scr", 0.068, 0.144, (2.0, 64.0, 0.0805), M_scr2, rot=(4, -3, -25))
meta.trace("bbs", 2.0, 64.0, 0.3, radius=2.0)

# ---------------------------------------------------------------- 床・当たり判定・区画
meta.spawn(0, 0.3, 0)
meta.zones(-100, 17.4, PY1)
meta.floor(-HX, CAR_Y0, HX + 0.2, CAR_Y1, FL)
meta.floor(PX0 - 0.2, PY0, PX1, PY1, FL)
meta.floor(1.8, PY1, 3.2, PY1 + 4.0, FL, 0.0)
# 車内
meta.rect(-HX - 0.3, CAR_Y0 - 0.4, HX + 0.3, CAR_Y0 + 0.05)
meta.rect(-HX - 0.3, CAR_Y1 - 0.05, HX + 0.3, CAR_Y1 + 0.4)
meta.rect(-HX - 0.3, CAR_Y0, -HX + 0.04, CAR_Y1)
meta.rect(HX - 0.04, CAR_Y0, HX + 0.3, DOOR_EXIT[0])
meta.rect(HX - 0.04, DOOR_EXIT[1], HX + 0.3, CAR_Y1)
# ホーム（車両側は車体、車両がない所は縁で止める）
meta.rect(HX, CAR_Y1, PX0 + 0.08, 40.0)
meta.rect(1.2, 40.0, 1.8, PY1 + 4.0)
meta.rect(PX0, PY0 - 0.5, PX1, PY0)
meta.rect(PX1 - 0.15, PY0, PX1 + 0.5, PY1 + 1)
meta.rect(3.2, PY1, PX1, PY1 + 0.5)
meta.rect(3.2, PY1, 3.5, PY1 + 4.0)
# 線路
meta.rect(3.3, PY1 + 4.0, 3.9, 96)
meta.rect(-2.4, 40.0, -1.8, 96)
meta.rect(-1.8, 39.6, 1.2, 40.0)
meta.rect(-2.4, TY + 6.5, 3.6, TY + 7.0)
meta.rect(-6, TY - 0.6, TX - 2.4, TY + 0.6)
meta.rect(TX + 2.6, TY - 0.6, 6, TY + 0.6)

# 反射用の HDRI（ベイクの照明には使わない）
env_hdri = os.path.basename(kit.ph.hdri("dresden_station_night"))
kit.finalize("02", meta, hdri_file=env_hdri,
             lm_size=2048 if FAST else 4096, lm_samples=64 if FAST else 512,
             ao_size=1024, ao_samples=32 if FAST else 96)
