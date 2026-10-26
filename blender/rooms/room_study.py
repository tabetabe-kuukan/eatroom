"""部屋モジュール：書斎（書斎・本棚・古書・蔵書…）

展示室の左の壁が天井近くまである本棚に食われている。床は濃い木の板張りになり、
書き物机と緑の傘のランプ、本棚に立てかけた梯子がある。
"""
import os
import random

import kit
from kit import box, mat_color, mat_image, mat_pbr
from room import H, W, X0, Room, boxes

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(HERE, "textures", "generated")
rnd = random.Random(9)

r = Room("room_study")
YA, YB = 1.0, 14.0
SH, SD = min(3.3, H - 0.6), 0.38   # 本棚の高さ・奥行き
r.shell()
M_shelf = mat_pbr("study_shelf", "dark_wood", tile=1.0)
M_books = mat_image("study_books", os.path.join(TEX, "room_books.png"), rough=0.75, tile=1.0)
M_floor = mat_pbr("study_floor", "dark_wood", tile=1.4, tint=(1.0, 0.85, 0.75))
M_green = mat_color("lamp_shade", (0.1, 0.4, 0.2), 0.3, emit=(0.6, 0.9, 0.5), emit_strength=0.4)
M_bulb = mat_color("lamp_bulb", (1, 1, 1), 0.5, emit=(1.0, 0.85, 0.6), emit_strength=6.0)
M_brass = mat_color("lamp_brass", (0.7, 0.52, 0.25), 0.35, metal=1.0)
M_rug = mat_color("study_rug", (0.42, 0.1, 0.1), 0.95)

# 本棚と本
frame, books = [], []
UNIT = 1.0
y = YA
while y < YB - 0.01:
    for s in (0, UNIT):
        frame.append(((SD, 0.04, SH), (X0 + SD / 2, y + s, SH / 2), (0, 0, 0)))
    frame.append(((0.02, UNIT, SH), (X0 + 0.01, y + UNIT / 2, SH / 2), (0, 0, 0)))   # 背板
    for k in range(7):
        z = 0.08 + k * (SH - 0.1) / 6
        frame.append(((SD, UNIT, 0.035), (X0 + SD / 2, y + UNIT / 2, z), (0, 0, 0)))
        if k == 6:
            continue
        yy = y + 0.03
        while yy < y + UNIT - 0.06:
            w = rnd.uniform(0.025, 0.065)
            h = rnd.uniform(0.22, 0.34)
            d = rnd.uniform(0.2, 0.3)
            if rnd.random() < 0.06:      # 所々抜けている・倒れている
                yy += w * 2
                continue
            tilt = rnd.uniform(-14, -6) if rnd.random() < 0.05 else 0
            books.append(((d, w, h), (X0 + 0.04 + d / 2, yy + w / 2, z + 0.02 + h / 2), (tilt, 0, 0)))
            yy += w + 0.002
    y += UNIT
boxes("study_shelves", frame, M_shelf)
boxes("study_books", books, M_books)
r.meta.rect(X0, YA, X0 + SD + 0.05, YB)

# 板張りの床（境目は板の長さがばらばら）
planks = []
y = YA
while y < YB:
    x1 = X0 + W * rnd.uniform(0.35, 0.45)
    planks.append(((x1 - X0, 0.18, 0.02), ((X0 + x1) / 2, y + 0.09, 0.01), (0, 0, 0)))
    y += 0.18
boxes("study_floor", planks, M_floor)
box("study_rug", (min(1.8, W * 0.22), 2.6, 0.012), (X0 + 1.9, 10.2, 0.025), M_rug)
# 書き物机・椅子・ランプ
DX, DY = X0 + 1.8, 10.4
box("study_desk_top", (0.75, 1.4, 0.05), (DX, DY, 0.76), M_shelf, bevel=0.01)
for dx in (-0.32, 0.32):
    for dy in (-0.64, 0.64):
        box("study_desk_leg", (0.05, 0.05, 0.74), (DX + dx, DY + dy, 0.37), M_shelf)
box("study_drawer", (0.7, 0.45, 0.16), (DX, DY - 0.4, 0.65), M_shelf)
box("study_chair_seat", (0.45, 0.45, 0.05), (DX + 0.7, DY, 0.46), M_shelf)
box("study_chair_back", (0.05, 0.45, 0.5), (DX + 0.92, DY, 0.73), M_shelf)
kit.cyl("lamp_base", 0.08, 0.03, (DX - 0.15, DY + 0.45, 0.785), M_brass, segs=16)
kit.cyl("lamp_stem", 0.012, 0.32, (DX - 0.15, DY + 0.45, 0.8), M_brass, segs=8)
box("lamp_shade", (0.16, 0.36, 0.09), (DX - 0.1, DY + 0.45, 1.13), M_green, bevel=0.03)
box("lamp_bulb", (0.05, 0.24, 0.02), (DX - 0.1, DY + 0.45, 1.08), M_bulb)
kit.point_light((DX - 0.1, DY + 0.45, 1.02), power=25, color=(1.0, 0.8, 0.55), radius=0.05, name="desk_lamp")
r.meta.rect(DX - 0.45, DY - 0.75, DX + 1.0, DY + 0.75)
# 本棚に立てかけた梯子
rails = []
for dy in (-0.22, 0.22):
    rails.append(((0.05, 0.05, SH - 0.1), (X0 + SD + 0.35, 6.5 + dy, (SH - 0.1) / 2), (0, -10, 0)))
for k in range(int((SH - 0.4) / 0.34)):
    z = 0.3 + k * 0.34
    rails.append(((0.04, 0.44, 0.04), (X0 + SD + 0.35 + ((SH - 0.1) / 2 - z) * 0.176, 6.5, z), (0, 0, 0)))
boxes("study_ladder", rails, M_shelf)


def night():
    # 夜は机のランプだけが灯っている
    import bpy
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.name.startswith("desk_lamp"):
            o.data.energy = 18


r.night_fns.append(night)
# 検索ワードは本の列に食い込ませる
r.slots["left"]["x"] = X0 + 0.3
r.place_slots()
r.finish()
