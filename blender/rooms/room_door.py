"""部屋モジュール：扉（扉・戸締まり）

白い壁のあちこちに、どこにも通じていない古い木の扉が生えている。
右の壁には両開きの大きな扉、左の壁には普通の扉が 2 枚（1 枚は少し開いて奥が真っ暗）、
床の近くには小さな扉。
"""
import kit
from kit import box, mat_color, mat_pbr
from room import X0, X1, Room, boxes

r = Room("room_door")
r.shell()
M_wood = mat_pbr("door_wood", "dark_wood", tile=1.0)
M_frame = mat_pbr("door_frame", "plywood", tile=1.2, tint=(0.75, 0.6, 0.45))
M_brass = mat_color("door_brass", (0.75, 0.55, 0.25), 0.3, metal=1.0)
M_void = mat_color("door_void", (0.0, 0.0, 0.0), 1.0)


def door(side, y, w=0.92, h=2.1, ajar=0.0, panels=2, knob=True):
    """side=-1 で左の壁、+1 で右の壁。ajar は開く角度（度）"""
    wall = X0 if side < 0 else X1
    n = -side                  # 部屋側を向く x の向き
    # 枠
    t = 0.07
    items = [
        ((0.06, t, h + t), (wall + n * 0.03, y - w / 2 - t / 2, (h + t) / 2), (0, 0, 0)),
        ((0.06, t, h + t), (wall + n * 0.03, y + w / 2 + t / 2, (h + t) / 2), (0, 0, 0)),
        ((0.06, w + 2 * t, t), (wall + n * 0.03, y, h + t / 2), (0, 0, 0)),
    ]
    boxes("door_frame", items, M_frame)
    if ajar:
        # 開いた隙間の奥は真っ暗
        box("door_void", (0.01, w, h), (wall + n * 0.006, y, h / 2), M_void)
    # 扉の板（蝶番は y - w/2 の側）
    import math
    a = math.radians(ajar) * (1 if side > 0 else -1)
    hx, hy = wall + n * 0.045, y - w / 2
    cx = hx + n * math.sin(abs(a)) * w / 2
    cy = hy + math.cos(a) * w / 2
    box("door_slab", (0.045, w, h), (cx, cy, h / 2), M_wood, rot=(0, 0, math.degrees(a)), bevel=0.006)
    # 鏡板（浮き出た四角）
    for k in range(panels):
        pz = h * (0.28 + 0.46 * k) if panels == 2 else h / 2
        ph = h * (0.36 if panels == 2 else 0.7)
        px = cx + n * 0.028
        box("door_panel", (0.012, w * 0.7, ph), (px, cy, pz), M_wood, rot=(0, 0, math.degrees(a)))
    if knob:
        kx = hx + n * (0.07 + math.sin(abs(a)) * (w - 0.1))
        ky = hy + math.cos(a) * (w - 0.1)
        kit.cyl("door_knob", 0.03, 0.06, (kx - n * 0.03, ky, h * 0.47), M_brass, rot=(0, 90, 0), segs=12)


# 右の壁：両開きの大きな扉（2 枚）
for dy, aj in ((-0.62, 0), (0.62, 0)):
    door(1, 6.6 + dy, w=1.2, h=3.2, ajar=aj, panels=2, knob=False)
box("big_door_ring", (0.03, 0.18, 0.18), (X1 - 0.12, 6.45, 1.6), M_brass)
box("big_door_ring", (0.03, 0.18, 0.18), (X1 - 0.12, 6.75, 1.6), M_brass)
# 左の壁：普通の扉。奥の 1 枚は少し開いている
door(-1, 8.6)
door(-1, 11.8, ajar=24)
# 床の近くの小さな扉
door(-1, 2.4, w=0.26, h=0.4, panels=1)
door(1, 13.2, w=0.3, h=0.46, panels=1)

r.place_slots()
r.finish()
