"""空間3：鮫島事件 — 深夜のネットカフェと、消された記録

第1区画 (y 0〜14)  : 深夜のネットカフェ風の個室が並ぶ通路。光るモニター（掲示板・書き込み画面）、深夜パックの貼り紙
第2区画 (y 14〜28) : 壁一面の「この投稿は削除されました」。机の上の黒塗りの報告書、「抹消」の印
第3区画 (y 28〜40) : 倉庫。中身が空の段ボール箱に「事件資料」のラベル、誰も内容を知らない記録、「触れないこと」
"""
import math
import os
import random

import kit
from kit import GEN, Meta, box, cyl, fluorescent, mat_color, mat_image, mat_pbr, place, plane

FAST = "fast" in getattr(kit, "OPTS", set())
random.seed(3)
kit.reset()
kit.setup_cycles()
kit.world_color((0.002, 0.002, 0.003), 1.0)
meta = Meta("03")

H = 2.6  # 天井高

M_carpet = mat_pbr("carpet", "dirty_carpet", tile=1.5)
M_lino = mat_pbr("linoleum", "linoleum_brown", tile=1.5)
M_conc = mat_pbr("storage_floor", "concrete_floor_worn_001", tile=2.0)
M_part = mat_pbr("partition", "plywood", tile=1.2, tint=(0.45, 0.42, 0.4))
M_wall = mat_pbr("office_wall", "painted_plaster_wall", tile=2.0, tint=(0.8, 0.8, 0.78))
M_ceil = mat_color("ceiling_dark", (0.25, 0.25, 0.25), 0.8)
M_desk = mat_pbr("desk_top", "wood_table_001", tile=1.0)
M_black = mat_color("plastic_black", (0.03, 0.03, 0.035), 0.4)
M_standby = mat_color("screen_standby", (0.02, 0.05, 0.16), 0.2, emit=(0.05, 0.12, 0.45), emit_strength=1.2)
M_off = mat_color("screen_off", (0.01, 0.01, 0.012), 0.08)
M_card = mat_color("cardboard", (0.52, 0.4, 0.26), 0.85)
M_deleted = mat_image("deleted_wall", os.path.join(GEN, "s03_deleted.png"), rough=0.8, tile=1.3)
M_paper = mat_color("paper", (0.85, 0.84, 0.8), 0.9)

# ---------------------------------------------------------------- 第1区画：個室の並ぶ通路
CX = 0.65   # 通路の半幅
BX = 1.95   # 個室の奥
box("floor1", (2 * BX + 0.2, 15.0, 0.06), (0, 6.5, -0.03), M_carpet)
box("ceil1", (2 * BX + 0.2, 15.0, 0.06), (0, 6.5, H + 0.03), M_ceil)
for side in (1, -1):
    box("outer_wall", (0.1, 15.0, H), (side * (BX + 0.05), 6.5, H / 2), M_wall)
box("back_wall1", (2 * BX + 0.2, 0.1, H), (0, -1.05, H / 2), M_wall)

T_chair = kit.model_template("modern_arm_chair_01", decimate=0.35)
M_bbs = mat_image("scr_bbs", os.path.join(GEN, "s03_bbs_list.png"), rough=0.2, emit_strength=1.6)
M_post = mat_image("scr_post", os.path.join(GEN, "s03_post.png"), rough=0.2, emit_strength=1.6)
SCREENS = {(1, 2): M_bbs, (-1, 6): M_post}
OFF = {(1, 4), (-1, 1), (1, 7), (-1, 4)}

booth_y = [-0.8 + i * 1.65 for i in range(9)]
for side in (1, -1):
    for i, y0 in enumerate(booth_y[:-1]):
        y1 = booth_y[i + 1]
        # 仕切り・前面（入口は奥側 0.7m）
        box("partition", (BX - CX, 0.04, 1.9), (side * (CX + BX) / 2, y0, 0.95), M_part)
        meta.rect(min(side * CX, side * BX), y0 - 0.04, max(side * CX, side * BX), y0 + 0.04)
        fy1 = y0 + 0.9
        box("front", (0.04, fy1 - y0, 1.9), (side * CX, (y0 + fy1) / 2, 0.95), M_part)
        meta.rect(min(side * (CX - 0.03), side * (CX + 0.03)), y0, max(side * (CX - 0.03), side * (CX + 0.03)), fy1)
        # 机・モニター・椅子
        dx = side * (BX - 0.27)
        box("desk", (0.52, y1 - y0 - 0.1, 0.04), (dx, (y0 + y1) / 2, 0.72), M_desk)
        box("desk_leg", (0.04, 0.04, 0.72), (dx - side * 0.2, y0 + 0.15, 0.36), M_black)
        box("desk_leg", (0.04, 0.04, 0.72), (dx - side * 0.2, y1 - 0.15, 0.36), M_black)
        my = (y0 + y1) / 2
        mx = side * (BX - 0.2)
        box("monitor", (0.04, 0.58, 0.36), (mx, my, 1.0), M_black)
        box("monitor_stand", (0.12, 0.2, 0.25), (mx + side * 0.03, my, 0.8), M_black)
        box("keyboard", (0.16, 0.44, 0.02), (side * (BX - 0.42), my, 0.75), M_black)
        key = (side, i)
        scr = SCREENS.get(key) or (M_off if key in OFF else M_standby)
        plane("screen", 0.54, 0.32, (mx - side * 0.021, my, 1.0), scr, rot=(90, 0, -90 * side))
        if scr is not M_off:
            p = 14 if scr in (M_bbs, M_post) else 4
            col = (0.75, 0.82, 1.0) if scr in (M_bbs, M_post) else (0.2, 0.35, 1.0)
            kit.area_light((mx - side * 0.04, my, 1.0), size=(0.5, 0.3), power=p, color=col, rot=(90, 0, -90 * side),
                           name="screen_glow")
        meta.rect(min(side * (BX - 0.53), side * BX), y0 + 0.05, max(side * (BX - 0.53), side * BX), y1 - 0.05)
        cx = side * (BX - 0.85)
        place(T_chair, (cx, my, 0), rot_z=90 if side > 0 else -90, scale=0.85)
        meta.circle(cx, my, 0.32)

meta.trace("keijiban", 0.2, (booth_y[2] + booth_y[3]) / 2, 1.0, radius=1.6)
meta.trace("kakikomi", -0.2, (booth_y[6] + booth_y[7]) / 2, 1.0, radius=1.6)
# 深夜パックの貼り紙（通路の左の前面パネル）
M_pack = mat_image("pack_poster", os.path.join(GEN, "s03_pack.png"), rough=0.5)
py = booth_y[4] + 0.45
plane("pack", 0.42, 0.6, (-CX + 0.025, py, 1.35), M_pack, rot=(90, 0, 90))
meta.trace("shinya", -0.2, py, 1.3, radius=1.7)
# 通路の照明（ほとんど消えている）
for k, y in enumerate((1.5, 5.5, 9.5, 13.0)):
    lit = k in (1, 3)
    cyl("downlight", 0.08, 0.02, (0, y, H - 0.02), mat_color("downlight_on" if lit else "downlight_off", (1, 0.9, 0.75) if lit else (0.4, 0.4, 0.4), 0.4,
                                                        emit=(1, 0.85, 0.65) if lit else None, emit_strength=4), segs=12)
    if lit:
        kit.spot_light((0, y, H - 0.05), (0, 0, 0), power=70, angle_deg=90, blend=0.7, color=(1, 0.85, 0.65), radius=0.05)
# 非常口の緑
box("exit_sign", (0.36, 0.04, 0.14), (0, -1.0 + 0.03, H - 0.25), mat_color("exit_green", (0.1, 0.8, 0.3), 0.3, emit=(0.15, 1, 0.4), emit_strength=3))

# ---------------------------------------------------------------- 第2区画：削除された投稿の部屋
RX = 3.0
Y2, Y3 = 13.9, 28.0
box("floor2", (2 * RX, Y3 - Y2, 0.06), (0, (Y2 + Y3) / 2, -0.03), M_lino)
box("ceil2", (2 * RX, Y3 - Y2, 0.06), (0, (Y2 + Y3) / 2, H + 0.03), M_ceil)
for side in (1, -1):
    box("del_wall", (0.06, Y3 - Y2, H), (side * RX, (Y2 + Y3) / 2, H / 2), M_deleted)
    box("front2", (RX - CX, 0.1, H), (side * (RX + CX) / 2, Y2, H / 2), M_deleted)
    box("back2", (RX - 0.6, 0.1, H), (side * (RX + 0.6) / 2, Y3, H / 2), M_deleted)
    meta.rect(min(side * RX, side * (RX + 0.3)), Y2, max(side * RX, side * (RX + 0.3)), Y3)
    meta.rect(min(side * CX, side * RX), Y2 - 0.08, max(side * CX, side * RX), Y2 + 0.08)
    meta.rect(min(side * 0.6, side * RX), Y3 - 0.08, max(side * 0.6, side * RX), Y3 + 0.08)
box("door_head2", (1.2, 0.1, H - 2.05), (0, Y3, 2.05 + (H - 2.05) / 2), M_deleted)
meta.trace("sakujo", 1.8, 16.5, 1.2, radius=2.8)
fluorescent("room_fl_a", 0, 18.5, H, length=1.2, power=110, flicker=True)
fluorescent("room_fl_b", 0, 24.0, H, length=1.2, lit=False)
kit.point_light((0, 24, 2.2), power=15, color=(0.6, 0.7, 1.0), radius=0.5, name="fill2")

# 机と黒塗りの報告書
T_desk = kit.model_template("metal_office_desk")
place(T_desk, (0, 21.0, 0), rot_z=0)
meta.rect(-1.0, 20.5, 1.0, 21.5)
M_red = mat_image("redacted_doc", os.path.join(GEN, "s03_redacted.png"), rough=0.85)
for k in range(5):
    plane("redacted", 0.21, 0.297, (-0.6 + k * 0.28 + random.uniform(-0.03, 0.03), 21.0 + random.uniform(-0.15, 0.15), 0.792 + k * 0.0006),
          M_red, rot=(0, 0, random.uniform(-14, 14)))
meta.trace("kuronuri", 0, 20.2, 0.8, radius=1.9)

# 小机とシュレッダー、「抹消」の書類
box("side_table", (0.7, 0.5, 0.04), (2.2, 25.5, 0.72), M_desk)
for dx in (-0.3, 0.3):
    box("side_leg", (0.04, 0.04, 0.72), (2.2 + dx, 25.5, 0.36), M_black)
M_mas = mat_image("massho_doc", os.path.join(GEN, "s03_massho.png"), rough=0.85)
plane("massho", 0.21, 0.297, (2.15, 25.5, 0.7425), M_mas, rot=(0, 0, -8))
box("shredder", (0.38, 0.3, 0.55), (2.4, 24.6, 0.275), M_black)
for k in range(14):  # 細切れの紙
    box("shred", (0.006, 0.003, random.uniform(0.15, 0.3)), (2.25 + k * 0.022, 24.6, 0.6), M_paper,
        rot=(random.uniform(-20, 20), random.uniform(-25, 25), 0))
meta.rect(1.8, 24.3, 2.65, 25.8)
meta.trace("massho", 1.5, 25.2, 0.8, radius=1.9)

# ---------------------------------------------------------------- 第3区画：倉庫
SX = 2.6
Y4 = 40.0
box("floor3", (2 * SX, Y4 - Y3, 0.06), (0, (Y3 + Y4) / 2, -0.03), M_conc)
box("ceil3", (2 * SX, Y4 - Y3, 0.06), (0, (Y3 + Y4) / 2, H + 0.03), M_ceil)
for side in (1, -1):
    box("st_wall", (0.1, Y4 - Y3, H), (side * SX, (Y3 + Y4) / 2, H / 2), M_wall)
    meta.rect(min(side * (SX - 0.05), side * (SX + 0.3)), Y3, max(side * (SX - 0.05), side * (SX + 0.3)), Y4)
box("st_back", (2 * SX, 0.1, H), (0, Y4, H / 2), M_wall)
meta.rect(-SX, Y4 - 0.05, SX, Y4 + 0.3)

T_shelf = kit.model_template("steel_frame_shelves_01", scale=0.1)  # 元データが 10 倍の大きさ
T_box = kit.model_template("cardboard_box_01", decimate=0.25)
for side in (1, -1):
    for k, y in enumerate((30.0, 31.25, 34.6, 35.85)):
        place(T_shelf, (side * (SX - 0.35), y, 0), rot_z=90)
        meta.rect(min(side * (SX - 0.62), side * SX), y - 0.6, max(side * (SX - 0.62), side * SX), y + 0.6)
        for lvl in (0.08, 0.83, 1.42):
            if random.random() < 0.7:
                place(T_box, (side * (SX - 0.38) + random.uniform(-0.05, 0.05), y + random.uniform(-0.3, 0.3), lvl + 0.02),
                      rot_z=random.uniform(-10, 10) + 90)

# 中身が空の段ボール箱（ふたが開いている）とラベル
bx, by = 0.2, 35.0
w, d, h = 0.5, 0.36, 0.32
box("open_bottom", (w, d, 0.01), (bx, by, 0.005), M_card)
for sx_, sy_, sz, loc in [((0.01, d, h), None, None, (bx - w / 2, by, h / 2)), ((0.01, d, h), None, None, (bx + w / 2, by, h / 2)),
                          ((w, 0.01, h), None, None, (bx, by - d / 2, h / 2)), ((w, 0.01, h), None, None, (bx, by + d / 2, h / 2))]:
    box("open_side", sx_, loc, M_card)
box("flap_a", (w, 0.01, d / 2), (bx, by - d / 2 - 0.07, h + 0.06), M_card, rot=(-55, 0, 0))
box("flap_b", (w, 0.01, d / 2), (bx, by + d / 2 + 0.07, h + 0.06), M_card, rot=(55, 0, 0))
box("flap_c", (0.01, d, w / 2.2), (bx - w / 2 - 0.08, by, h + 0.07), M_card, rot=(0, 60, 0))
M_label = mat_image("case_label", os.path.join(GEN, "s03_label.png"), rough=0.7)
plane("label", 0.3, 0.176, (bx, by - d / 2 - 0.007, h * 0.5), M_label, rot=(90, 0, 0))
meta.rect(bx - w / 2 - 0.1, by - d / 2 - 0.1, bx + w / 2 + 0.1, by + d / 2 + 0.1)
meta.trace("inpei", bx, by - 0.8, 0.4, radius=1.8)

# 裸電球
cyl("bulb_cord", 0.004, 0.6, (bx, by, H - 0.6), M_black, segs=6)
cyl("bulb", 0.035, 0.08, (bx, by, H - 0.68), mat_color("bulb_glow", (1, 0.85, 0.6), 0.3, emit=(1, 0.8, 0.55), emit_strength=8),
    segs=10)
kit.point_light((bx, by, H - 0.72), power=90, color=(1.0, 0.78, 0.5), radius=0.04, name="bulb")

# ブラウン管（スレッドの画面）
box("crt_cart", (0.6, 0.45, 0.7), (-1.6, 37.6, 0.35), M_black)
box("crt", (0.5, 0.42, 0.42), (-1.6, 37.6, 0.91), mat_color("crt_body", (0.62, 0.6, 0.55), 0.6))
M_thr = mat_image("thread_scr", os.path.join(GEN, "s03_thread.png"), rough=0.15, emit_strength=1.1)
plane("crt_screen", 0.4, 0.3, (-1.6, 37.6 - 0.212, 0.92), M_thr, rot=(90, 0, 0))
kit.area_light((-1.6, 37.6 - 0.25, 0.92), size=(0.4, 0.3), power=10, color=(0.85, 0.9, 1.0), rot=(90, 0, 0), name="crt_glow")
meta.rect(-1.95, 37.35, -1.25, 37.85)
meta.trace("ni_channel", -1.3, 36.6, 0.9, radius=1.7)

# 奥の壁の貼り紙
M_note = mat_image("dont_touch", os.path.join(GEN, "s03_notice.png"), rough=0.6)
plane("notice", 0.42, 0.6, (0.9, Y4 - 0.055, 1.45), M_note, rot=(90, 0, 0))
meta.trace("fureru", 0.8, 38.4, 1.3, radius=1.8)

# ---------------------------------------------------------------- 区画・スポーン
meta.spawn(0, -0.3, 0)
meta.zones(-100, Y2 + 0.4, Y3 + 0.3)
meta.rect(-BX, -1.1, BX, -0.95)
meta.sound("hum", 0, 20, 2.3)

env_hdri = os.path.basename(kit.ph.hdri("unfinished_office_night"))
kit.finalize("03", meta, hdri_file=env_hdri,
             lm_size=2048 if FAST else 4096, lm_samples=64 if FAST else 512,
             ao_size=1024, ao_samples=32 if FAST else 96)
