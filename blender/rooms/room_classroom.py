"""部屋モジュール：教室（教室・理科室・実験室・研究所・理科）

展示室の右側が教室に食われている。右の壁に消し残しのある黒板、その前に教壇と教卓、
板張りの床に木の机と椅子が並ぶ。境目の机は途中で白い床に飲み込まれている。
"""
import os
import random

from kit import box, mat_color, mat_image, mat_pbr
from room import H, X1, Room, boxes

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(HERE, "textures", "generated")
rnd = random.Random(10)

r = Room("room_classroom")
YA, YB = 3.0, 14.2
r.shell()
M_board = mat_image("blackboard", os.path.join(TEX, "room_blackboard.png"), rough=0.9)
M_alu = mat_color("board_frame", (0.62, 0.62, 0.6), 0.4, metal=0.8)
M_floor = mat_pbr("class_floor", "plywood", tile=1.2, tint=(0.95, 0.8, 0.62))
M_desk = mat_pbr("class_desk", "plywood", tile=0.8)
M_steel = mat_color("class_steel", (0.35, 0.38, 0.36), 0.5, metal=0.6)
M_chalk = [mat_color(f"chalk_{i}", c, 0.9) for i, c in enumerate([(0.95, 0.95, 0.92), (0.95, 0.85, 0.3), (0.95, 0.5, 0.5)])]

# 黒板（右の壁）
BY0, BY1, BZ0, BZ1 = 5.4, 12.6, 0.85, min(2.15, H - 1.0)
from kit import plane  # noqa: E402
plane("blackboard", BY1 - BY0, BZ1 - BZ0, (X1 - 0.03, (BY0 + BY1) / 2, (BZ0 + BZ1) / 2), M_board, rot=(90, 0, -90))
frame = [((0.05, BY1 - BY0 + 0.1, 0.05), (X1 - 0.03, (BY0 + BY1) / 2, z), (0, 0, 0)) for z in (BZ0 - 0.02, BZ1 + 0.02)]
frame += [((0.05, 0.05, BZ1 - BZ0 + 0.1), (X1 - 0.03, y, (BZ0 + BZ1) / 2), (0, 0, 0)) for y in (BY0 - 0.02, BY1 + 0.02)]
frame.append(((0.12, BY1 - BY0, 0.03), (X1 - 0.08, (BY0 + BY1) / 2, BZ0 - 0.06), (0, 0, 0)))   # チョーク置き
boxes("board_frame", frame, M_alu)
for k in range(5):
    box("chalk", (0.012, 0.08, 0.012), (X1 - 0.08, 7.0 + k * 0.3, BZ0 - 0.04), M_chalk[k % 3], rot=(0, 0, rnd.uniform(-20, 20)))

# 板張りの床（境目は長さがばらばら）
planks = []
y = YA
while y < YB:
    x0 = X1 - rnd.uniform(2.9, 3.9)
    planks.append(((X1 - x0, 0.16, 0.02), ((X1 + x0) / 2, y + 0.08, 0.01), (0, 0, 0)))
    y += 0.16
boxes("class_floor", planks, M_floor)
# 教壇と教卓
box("platform", (1.3, BY1 - BY0 + 0.6, 0.2), (X1 - 0.65, (BY0 + BY1) / 2, 0.1), M_desk)
box("teacher_desk", (0.6, 1.3, 0.85), (X1 - 1.6, 8.4, 0.425), M_desk, bevel=0.01)
r.meta.floor(X1 - 1.3, BY0 - 0.3, X1, BY1 + 0.3, 0.2)
r.meta.rect(X1 - 1.9, 7.75, X1 - 1.3, 9.05)

# 生徒の机と椅子（黒板を向いて並ぶ）。境目の机は床に飲み込まれて傾いている
desks, steel = [], []
for col, x in enumerate((X1 - 3.25, X1 - 2.15)):
    for row, y in enumerate((4.0, 5.6, 10.6, 12.2)):
        sink = 0.25 if col == 0 and rnd.random() < 0.5 else 0.0
        tilt = rnd.uniform(-8, 8) if sink else 0
        desks.append(((0.45, 0.6, 0.03), (x + 0.2, y, 0.7 - sink), (tilt, 0, 0)))
        desks.append(((0.32, 0.36, 0.025), (x - 0.25, y, 0.42 - sink), (0, 0, 0)))
        desks.append(((0.03, 0.36, 0.35), (x - 0.42, y, 0.62 - sink), (0, 0, 0)))
        for dy in (-0.26, 0.26):
            steel.append(((0.025, 0.025, 0.7 - sink), (x + 0.2, y + dy, (0.7 - sink) / 2), (0, 0, 0)))
            steel.append(((0.025, 0.025, 0.42 - sink), (x - 0.25, y + dy * 0.6, (0.42 - sink) / 2), (0, 0, 0)))
        r.meta.rect(x - 0.45, y - 0.32, x + 0.45, y + 0.32)
boxes("class_desks", desks, M_desk)
boxes("class_desk_legs", steel, M_steel)

# 検索ワードは黒板に食い込ませる
r.slots["right"]["x"] = X1 - 0.05
r.place_slots()
r.finish()
