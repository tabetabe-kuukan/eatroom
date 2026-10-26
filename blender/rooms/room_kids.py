"""部屋モジュール：子ども部屋

展示室の右奥が子ども部屋に食われている。星と雲の壁紙、木の床、丸いラグ、小さなベッド、
積み木やおもちゃ箱。天井には蓄光の星が貼ってあり、夜にはそれだけがほのかに光る。
"""
import os
import random

import kit
from kit import box, mat_color, mat_image, mat_pbr
from room import H, W, X1, Room, boxes

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(HERE, "textures", "generated")
rnd = random.Random(12)

r = Room("room_kids")
XA, YA, YB = X1 - min(3.1, W * 0.38), 7.4, 14.5
r.shell()
M_paper = mat_image("kids_wallpaper", os.path.join(TEX, "room_kids_wallpaper.png"), rough=0.85, tile=1.3)
M_floor = mat_pbr("kids_floor", "plywood", tile=1.5, tint=(1.0, 0.92, 0.8))
M_white = mat_color("kids_white", (0.95, 0.95, 0.93), 0.6)
M_trim = mat_pbr("kids_trim", "plywood", tile=1.0)
M_rug = mat_color("kids_rug", (0.95, 0.62, 0.55), 0.95)
M_rug2 = mat_color("kids_rug2", (0.98, 0.86, 0.5), 0.95)
M_blanket = mat_color("kids_blanket", (0.55, 0.72, 0.9), 0.9)
M_star = mat_color("glow_star", (0.85, 0.95, 0.75), 0.5, emit=(0.6, 1.0, 0.55), emit_strength=0.6)
COLORS = [(0.85, 0.2, 0.2), (0.2, 0.45, 0.85), (0.95, 0.75, 0.15), (0.2, 0.7, 0.35), (0.95, 0.5, 0.15)]
M_blocks = [mat_color(f"toy_block_{i}", c, 0.5) for i, c in enumerate(COLORS)]

# 壁紙（端はちぎれたように段になっている）
segs = []
y = YA
while y < YB:
    w = rnd.uniform(0.25, 0.5)
    top = min(2.6, H - 0.9) if y > YA + 0.8 else rnd.uniform(1.4, min(2.5, H - 1.0))
    segs.append(((0.012, w, top), (X1 - 0.006, y + w / 2, top / 2), (0, 0, 0)))
    y += w
boxes("kids_wallpaper", segs, M_paper)
box("kids_wall_trim", (0.03, YB - YA - 0.8, 0.06), (X1 - 0.015, (YA + YB) / 2 + 0.4, min(2.6, H - 0.9) + 0.03), M_trim)
# 木の床（境目は板が欠けている）
planks = []
y = YA
while y < YB - 0.05:
    x0 = XA + rnd.uniform(0, 1.2)
    planks.append(((X1 - x0, 0.15, 0.02), ((X1 + x0) / 2, y + 0.075, 0.01), (0, 0, 0)))
    y += 0.15
boxes("kids_floor", planks, M_floor)
# 丸いラグ
kit.cyl("kids_rug", 1.15, 0.012, (X1 - 1.8, 9.6, 0.02), M_rug, segs=40)
kit.cyl("kids_rug2", 0.7, 0.014, (X1 - 1.8, 9.6, 0.02), M_rug2, segs=40)
# 小さなベッド（右の壁際）
BX, BY = X1 - 0.55, 13.3
box("kids_bed_frame", (1.0, 1.75, 0.3), (BX, BY, 0.18), M_trim, bevel=0.02)
box("kids_bed_head", (1.0, 0.06, 0.85), (BX, BY + 0.9, 0.43), M_trim, bevel=0.02)
box("kids_mattress", (0.92, 1.65, 0.14), (BX, BY, 0.4), M_white, bevel=0.04)
box("kids_blanket", (0.96, 1.1, 0.06), (BX, BY - 0.27, 0.49), M_blanket, bevel=0.03)
box("kids_pillow", (0.55, 0.3, 0.1), (BX, BY + 0.6, 0.52), M_white, bevel=0.04)
r.meta.rect(BX - 0.55, BY - 0.95, X1, BY + 0.95)
# おもちゃ箱
box("kids_toybox", (0.7, 0.45, 0.45), (X1 - 2.5, 13.9, 0.23), M_blocks[1], bevel=0.02)
box("kids_toybox_lid", (0.72, 0.47, 0.05), (X1 - 2.5, 13.9, 0.48), M_blocks[2], bevel=0.01)
r.meta.rect(X1 - 2.9, 13.6, X1 - 2.1, 14.2)
# 積み木（積んだもの・崩れたもの）
for k in range(4):
    box("toy_block", (0.12, 0.12, 0.12), (X1 - 2.2, 8.8, 0.08 + k * 0.12), M_blocks[k % 5], rot=(0, 0, rnd.uniform(-12, 12)))
for k in range(9):
    box("toy_block", (0.12, 0.12, 0.12), (rnd.uniform(X1 - 2.5, X1 - 0.9), rnd.uniform(8.6, 10.6), 0.08),
        M_blocks[rnd.randrange(5)], rot=(0, 0, rnd.uniform(0, 90)))
try:
    duck = kit.model_template("rubber_duck_toy")
    kit.place(duck, (X1 - 1.2, 9.2, 0.02), rot_z=200, scale=2.2)
except Exception as e:  # noqa: BLE001
    kit.log("duck skipped", e)
# 天井の蓄光の星
for k in range(40):
    kit.cyl("glow_star", rnd.uniform(0.03, 0.06), 0.006, (rnd.uniform(XA, X1 - 0.2), rnd.uniform(YA, YB - 0.2), H - 0.008),
            M_star, segs=5)
# 枕元の小さな常夜灯
M_night = mat_color("kids_nightlight", (1.0, 0.85, 0.6), 0.5, emit=(1.0, 0.7, 0.35), emit_strength=2.0)
kit.cyl("kids_nightlight", 0.07, 0.12, (X1 - 0.12, 14.3, 0.75), M_night, segs=12)
kit.point_light((X1 - 0.25, 14.2, 0.9), power=4, color=(1.0, 0.7, 0.4), radius=0.08, name="kids_nightlight")


def night():
    # 夜は蓄光の星と常夜灯だけが光る
    M_star.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 2.5


r.night_fns.append(night)
r.slots["right"]["x"] = X1 - 0.02
r.place_slots()
r.finish()
