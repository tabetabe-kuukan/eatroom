"""部屋モジュール：縁側（縁側・軒下・庭・日本庭園…）

右の壁の手前半分が抜けて、板張りの縁側と小さな庭になっている。
庭は白砂利に飛び石、苔むした石と植え込み。奥は土塀で、上は空（昼は日が差し、夜は月明かり）。
"""
import random

import kit
from kit import box, mat_color, mat_pbr
from room import X1, Y, Room, boxes

rnd = random.Random(14)
r = Room("room_engawa")
OY0, OY1, OZ = Y(1.6), Y(9.6), 2.9    # 開口（y の範囲と上端の高さ）
GX1 = X1 + 4.2                         # 庭の奥（土塀）
GZ = -0.35                             # 庭の地面の高さ
r.shell(right_open=(OY0, OY1, OZ))
M_board = mat_pbr("engawa_board", "weathered_planks", tile=1.2, tint=(1.0, 0.9, 0.8))
M_beam = mat_pbr("engawa_beam", "dark_wood", tile=1.0)
M_gravel = mat_pbr("garden_gravel", "gravel_floor_02", tile=1.5)
M_stone = mat_pbr("garden_stone", "mossy_rock", tile=0.8)
M_clay = mat_color("garden_clay_wall", (0.62, 0.5, 0.36), 0.95)
M_tile = mat_color("roof_tile", (0.16, 0.17, 0.19), 0.5)
M_moss = mat_color("garden_moss", (0.22, 0.32, 0.12), 0.95)
M_zabuton = mat_color("engawa_zabuton", (0.2, 0.25, 0.45), 0.9)

# 縁側の板（開口に沿って長手方向に張る）
EX0 = X1 - 1.6
boards = []
x = EX0
while x < X1 + 0.9:
    boards.append(((0.14, OY1 - OY0 + 0.4, 0.04), (x + 0.07, (OY0 + OY1) / 2, 0.02), (0, 0, 0)))
    x += 0.145
boxes("engawa_boards", boards, M_board)
# 縁の框・柱・鴨居・軒
box("engawa_edge", (0.12, OY1 - OY0 + 0.4, 0.3), (X1 + 0.96, (OY0 + OY1) / 2, -0.11), M_beam)
posts = [((0.13, 0.13, OZ), (X1 + 0.9, y, OZ / 2), (0, 0, 0)) for y in (OY0 + 0.1, (OY0 + OY1) / 2, OY1 - 0.1)]
posts.append(((0.14, OY1 - OY0, 0.16), (X1 + 0.9, (OY0 + OY1) / 2, OZ + 0.08), (0, 0, 0)))
boxes("engawa_posts", posts, M_beam)
rafters = [((1.5, 0.07, 0.09), (X1 + 1.05, OY0 + 0.25 + k * 0.45, OZ + 0.32), (0, -12, 0)) for k in range(int((OY1 - OY0) / 0.45))]
boxes("eave_rafters", rafters, M_beam)
box("eave_roof", (1.7, OY1 - OY0 + 0.6, 0.06), (X1 + 1.1, (OY0 + OY1) / 2, OZ + 0.45), M_tile, rot=(0, -12, 0))
# 庭の地面・土塀・左右の塀
kit.floor_box("garden_ground", X1 + 0.3, OY0 - 0.6, GX1, OY1 + 0.6, GZ - 0.2, GZ, M_gravel)
kit.floor_box("garden_wall", GX1, OY0 - 0.6, GX1 + 0.3, OY1 + 0.6, GZ, 2.3, M_clay)
box("garden_wall_cap", (0.6, OY1 - OY0 + 1.4, 0.12), (GX1 + 0.15, (OY0 + OY1) / 2, 2.36), M_tile)
for y in (OY0 - 0.6, OY1 + 0.6):
    kit.floor_box("garden_side", X1 + 0.3, y - 0.15, GX1 + 0.3, y + 0.15, GZ, 2.3, M_clay)
# 沓脱石・飛び石・苔・石・植え込み
box("kutsunugi", (0.6, 0.9, 0.3), (X1 + 1.35, Y(5.6), GZ + 0.1), M_stone, bevel=0.05)
for k in range(7):
    kit.cyl("stepping_stone", rnd.uniform(0.22, 0.3), 0.06, (X1 + 1.9 + k * 0.35, Y(5.6) + (k % 2) * 0.4 - 0.2, GZ - 0.02), M_stone, segs=9)
for k in range(5):
    kit.cyl("moss", rnd.uniform(0.4, 0.8), 0.03, (rnd.uniform(X1 + 1.5, GX1 - 0.5), rnd.uniform(OY0, OY1), GZ), M_moss, segs=14)
for k, tpl_id in enumerate(("mossy_rock", "stone_01", "shrub_02", "shrub_02")):
    try:
        tpl = kit.model_template(tpl_id, decimate=0.08)
        pos = [(GX1 - 0.9, Y(3.0)), (GX1 - 1.4, Y(7.8)), (GX1 - 0.6, Y(5.2)), (X1 + 2.0, Y(8.6))][k]
        kit.place(tpl, (pos[0], pos[1], GZ), rot_z=rnd.uniform(0, 360), scale=[0.35, 0.8, 2.2, 1.6][k])
    except Exception as e:  # noqa: BLE001
        kit.log("garden model skipped", tpl_id, e)
# 縁側の座布団と盆
box("engawa_zabuton", (0.55, 0.6, 0.07), (X1 + 0.3, Y(4.2), 0.075), M_zabuton, rot=(0, 0, 6), bevel=0.02)
# 日差し（昼）。庭の上は空
sun = kit.sun(rot_deg=(48, 0, 110), strength=3.0, color=(1.0, 0.95, 0.85))
kit.world_color((0.75, 0.85, 1.0), 0.6)
# 庭と縁側は歩ける。庭の外には出られない
r.meta.floor(X1 + 0.3, OY0 - 0.45, GX1, OY1 + 0.45, GZ)
r.meta.rect(GX1, OY0 - 0.6, GX1 + 0.3, OY1 + 0.6)
r.meta.rect(X1 + 0.3, OY0 - 0.75, GX1, OY0 - 0.45)
r.meta.rect(X1 + 0.3, OY1 + 0.45, GX1, OY1 + 0.75)
r.meta.rect(X1 + 1.05, Y(5.6) - 0.45, X1 + 1.65, Y(5.6) + 0.45)


def night():
    # 夜は日差しが月明かりになる
    import bpy
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.data.type == "SUN":
            o.data.energy = 1.0
            o.data.color = (0.6, 0.7, 1.0)
    kit.world_color((0.2, 0.25, 0.4), 0.05)


r.night_fns.append(night)
r.place_slots()
r.finish()
