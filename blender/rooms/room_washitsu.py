"""部屋モジュール：和室（畳・和室・旅館…）

展示室の左半分が和室に食われている。畳が敷かれ、左の壁は障子、天井は板張りになる。
境目の畳は所々欠けていて、白い床がのぞく。
"""
import os
import random

import kit
from kit import box, mat_color, mat_image, mat_pbr
from room import H, L, W, X0, Room, boxes

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(HERE, "textures", "generated")
rnd = random.Random(8)

r = Room("room_washitsu")
XA, XB = X0, X0 + max(1.9, W * 0.42)   # 和室の範囲（x）。部屋が狭いほど細くなる
YA, YB = 1.4, 13.6          # 和室の範囲（y）
r.shell(panel_skip=lambda x, y: x < 0)

M_tatami = mat_image("tatami", os.path.join(TEX, "room_tatami.png"), rough=0.85, tile=1.82)
M_heri = mat_color("tatami_heri", (0.05, 0.06, 0.09), 0.7)
M_wood = mat_pbr("wa_wood", "plywood", tile=1.4, tint=(1.0, 0.86, 0.66))
M_dark = mat_pbr("wa_wood_dark", "dark_wood", tile=1.2)
M_paper = mat_color("shoji_paper", (0.93, 0.91, 0.86), 0.9, emit=(1.0, 0.95, 0.85), emit_strength=0.35)

# ---------------------------------------------------------------- 畳（2 枚横 → 4 枚縦 の繰り返し）
TW, TL, TH = 0.91, 1.82, 0.055
mats, heri = [], []


def tatami(x0, y0, w, l):
    # 境目の畳は所々食べられている
    edge = x0 + w > XB - 0.2 or y0 < YA + 0.3 or y0 + l > YB - 0.3
    if edge and rnd.random() < 0.35:
        return
    cx, cy = x0 + w / 2, y0 + l / 2
    mats.append(((w - 0.004, l - 0.004, TH), (cx, cy, TH / 2), (0, 0, 0)))
    long_y = l > w
    for s in (-1, 1):
        if long_y:
            heri.append(((0.035, l - 0.004, TH + 0.002), (cx + s * (w / 2 - 0.018), cy, TH / 2 + 0.001), (0, 0, 0)))
        else:
            heri.append(((w - 0.004, 0.035, TH + 0.002), (cx, cy + s * (l / 2 - 0.018), TH / 2 + 0.001), (0, 0, 0)))


y = YA
row = 0
while y + TW <= YB:
    if row % 3 < 2:
        for k in range(max(1, int((XB - XA) // TL))):
            tatami(XA + k * TL, y, TL, TW)
        y += TW
    else:
        if y + TL > YB:
            break
        for k in range(max(1, int((XB - XA) // TW))):
            tatami(XA + k * TW, y, TW, TL)
        y += TL
    row += 1
boxes("tatami", mats, M_tatami)
boxes("tatami_heri", heri, M_heri)

# ---------------------------------------------------------------- 左の壁：障子・柱・鴨居
SH = min(2.3, H - 1.1)       # 障子の高さ
XS = X0 + 0.06
bars, paper = [], []
n = int((YB - YA) / 0.9)
for k in range(n):
    y0 = YA + k * 0.9
    cy = y0 + 0.45
    paper.append(((0.01, 0.88, SH - 0.1), (XS - 0.02, cy, SH / 2), (0, 0, 0)))
    for s in (-1, 1):   # 框
        bars.append(((0.04, 0.035, SH), (XS, cy + s * 0.43, SH / 2), (0, 0, 0)))
    for zz in (0.03, SH - 0.03):
        bars.append(((0.04, 0.9, 0.05), (XS, cy, zz), (0, 0, 0)))
    for j in range(1, 8):    # 組子（横）
        bars.append(((0.025, 0.86, 0.012), (XS + 0.005, cy, j * SH / 8), (0, 0, 0)))
    for j in (-1, 0, 1):     # 組子（縦）
        bars.append(((0.025, 0.012, SH - 0.08), (XS + 0.005, cy + j * 0.215, SH / 2), (0, 0, 0)))
boxes("shoji_frame", bars, M_wood)
boxes("shoji_paper", paper, M_paper)
posts = []
for y in (YA, YA + 3.6, YA + 7.2, YA + 10.8, YB):
    posts.append(((0.12, 0.12, H), (X0 + 0.06, y, H / 2), (0, 0, 0)))
posts.append(((0.12, YB - YA + 0.12, 0.12), (X0 + 0.06, (YA + YB) / 2, SH + 0.06), (0, 0, 0)))     # 鴨居
posts.append(((0.08, YB - YA + 0.12, 0.1), (X0 + 0.07, (YA + YB) / 2, SH + 0.45), (0, 0, 0)))      # 長押
boxes("wa_posts", posts, M_dark)

# ---------------------------------------------------------------- 天井：竿縁の板張り
planks, rods = [], []
x = XA
while x < XB - 0.05:
    w = min(0.42, XB - x)
    planks.append(((w - 0.004, YB - YA, 0.02), (x + w / 2, (YA + YB) / 2, H - 0.012), (0, 0, 0)))
    x += 0.42
for y in [YA + k * 0.45 for k in range(int((YB - YA) / 0.45) + 1)]:
    rods.append(((XB - XA, 0.03, 0.035), ((XA + XB) / 2, y, H - 0.04), (0, 0, 0)))
boxes("wa_ceiling", planks, M_wood)
boxes("wa_ceiling_rods", rods, M_dark)

# 和紙の吊り照明
M_lamp = mat_color("washi_lamp", (0.95, 0.9, 0.8), 0.9, emit=(1.0, 0.82, 0.55), emit_strength=2.0)
for y in (4.6, 10.4):
    kit.cyl("washi_lamp", 0.26, 0.36, (X0 + (XB - X0) * 0.55, y, H - 1.25), M_lamp, segs=20)
    kit.cyl("lamp_cord", 0.006, 0.9, (X0 + (XB - X0) * 0.55, y, H - 0.89), M_dark, segs=6)
    kit.point_light((X0 + (XB - X0) * 0.55, y, H - 1.08), power=160, color=(1.0, 0.8, 0.55), radius=0.25, name="washi_light")

# ちゃぶ台と座布団
CX = X0 + (XB - X0) * 0.55
kit.cyl("chabudai_top", 0.48, 0.035, (CX, 9.6, 0.3), M_dark, segs=32)
for dx, dy in ((-0.3, -0.3), (0.3, -0.3), (-0.3, 0.3), (0.3, 0.3)):
    box("chabudai_leg", (0.04, 0.04, 0.25), (CX + dx, 9.6 + dy, TH + 0.12), M_dark)
M_zabuton = mat_color("zabuton", (0.45, 0.12, 0.1), 0.85)
for dx, dy, rz in ((-0.85, 0.1, 8), (0.8, -0.2, -12)):
    box("zabuton", (0.55, 0.6, 0.07), (CX + dx, 9.6 + dy, TH + 0.035), M_zabuton, rot=(0, 0, rz), bevel=0.02)
r.meta.rect(CX - 0.6, 9.0, CX + 0.6, 10.2)


def night():
    # 夜は行灯のように片方だけ、ごく弱く灯る
    import bpy
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.name.startswith("washi_light"):
            o.data.energy *= 0.12
    M_lamp.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0.3
    M_paper.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0.0


r.night_fns.append(night)
# 検索ワードは障子に食い込ませる
r.slots["left"]["x"] = XS - 0.01
r.place_slots()
r.finish()
