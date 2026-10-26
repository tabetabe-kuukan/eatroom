"""部屋モジュール：空（検索ワードに「空」がある区画）

展示室の天井が食べられて、なくなっている。白い壁の上は空で、昼は日が差し込み、夜は月明かり。
"""
import bpy

import kit
from room import Room

r = Room("room_sky")
r.shell(ceiling=False)
# 空の光（青空からの拡散光と、斜めの日差し）
kit.world_color((0.62, 0.76, 1.0), 1.4)
kit.sun(rot_deg=(38, 0, 125), strength=3.5, color=(1.0, 0.96, 0.88))


def night():
    # 夜は月明かり。空からの光は暗い紺色になる
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.data.type == "SUN":
            o.data.energy = 0.35
            o.data.color = (0.6, 0.7, 1.0)
    kit.world_color((0.08, 0.1, 0.2), 0.25)


r.night_fns.append(night)
r.place_slots(spot=False)
r.finish()
