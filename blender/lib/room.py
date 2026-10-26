"""v2 の部屋モジュール：ホワイトキューブの展示室 1 つ分（幅 9m・奥行 15m・天井 4.6m）。

three.js 側で 3 つ並べて 1 つの空間にする（第1〜第3区画）。
検索ワードに空間を表す言葉（洞窟・和室・扉など）があると、その区画の部屋が
「一部がそれに置き換わった」モジュールに差し替わる。

座標（Blender）: x = -4.5〜4.5、y = 0〜15（奥へ）、z = 上。両端の壁に幅 2.6m の開口がある。
昼と夜（深夜の美術館）の 2 枚のライトマップを焼く。
"""
import bpy

import kit
from kit import Meta, box, mat_color

OPTS = getattr(kit, "OPTS", set())
FAST = "fast" in OPTS
# 区画が進むほど部屋は狭く、天井は低くなる（size1 = 第1区画 … size3 = 第3区画）
SIZE = next((int(o[4:]) for o in OPTS if o.startswith("size") and o[4:].isdigit()), 1)
W, H = {1: (9.0, 4.6), 2: (7.0, 4.0), 3: (5.4, 3.5)}[SIZE]
L = 15.0
X0, X1 = -W / 2, W / 2
DOOR = 2.6
DOOR_H = min(3.7, H - 0.7)
T = 0.15                    # 端の壁の厚さ（隣の部屋の壁と合わせて 0.3m）

# 検索ワードを置く場所（区画ごとに 3 つ）。部屋ごとに位置・向きを変えられる
SLOTS = {
    "left": dict(x=X0 + 0.01, y=4.5, z=1.55, kind="wall", normal=(1, 0, 0), w=1.8, h=1.4),
    "table": dict(x=0.0, y=8.0, z=0.9, kind="table", normal=(0, 0, 1), up=(0, 1, 0), w=0.55, h=0.55),
    "right": dict(x=X1 - 0.01, y=11.0, z=1.55, kind="wall", normal=(-1, 0, 0), w=1.8, h=1.4),
}


class Room:
    def __init__(self, name):
        kit.reset()
        kit.setup_cycles()
        kit.world_color((0.9, 0.9, 0.9), 0.05)
        self.name = f"{name}_s{SIZE}"
        self.meta = Meta(self.name)
        self.slots = {k: dict(v) for k, v in SLOTS.items()}
        self.night_fns = []
        self.M_wall = mat_color("white_wall", (0.88, 0.88, 0.87), 0.85)
        self.M_floor = mat_color("gallery_floor", (0.86, 0.86, 0.85), 0.45)
        self.M_ceil = mat_color("ceiling_white", (0.92, 0.92, 0.92), 0.9)
        self.M_gap = mat_color("shadow_gap", (0.05, 0.05, 0.05), 0.8)
        self.M_plinth = mat_color("plinth_white", (0.93, 0.93, 0.92), 0.55)
        self.M_panel = mat_color("light_panel", (1, 1, 1), 0.5, emit=(1.0, 0.98, 0.95), emit_strength=2.2)
        self.M_track = mat_color("track_black", (0.03, 0.03, 0.03), 0.4)
        self.M_exit = mat_color("exit_sign", (0.1, 0.5, 0.25), 0.4, emit=(0.15, 1.0, 0.45), emit_strength=3.0)

    # ------------------------------------------------------------ 箱
    def shell(self, floor_hole=None, right_open=None, panel_skip=None, gaps=True, ceiling=True):
        """floor_hole=(x0, y0, x1, y1): 床に穴をあける。right_open=(y0, y1, z_top): 右の壁に開口。
        ceiling=False で天井がなく、空が見える"""
        M = self
        # 床
        if floor_hole:
            hx0, hy0, hx1, hy1 = floor_hole
            kit.floor_box("floor", X0 - 0.3, -0.05, X1 + 0.3, hy0, -0.2, 0, M.M_floor)
            kit.floor_box("floor", X0 - 0.3, hy1, X1 + 0.3, L + 0.05, -0.2, 0, M.M_floor)
            if hx0 > X0:
                kit.floor_box("floor", X0 - 0.3, hy0, hx0, hy1, -0.2, 0, M.M_floor)
            if hx1 < X1:
                kit.floor_box("floor", hx1, hy0, X1 + 0.3, hy1, -0.2, 0, M.M_floor)
        else:
            kit.floor_box("floor", X0 - 0.3, -0.05, X1 + 0.3, L + 0.05, -0.2, 0, M.M_floor)
        if ceiling:
            box("ceiling", (W + 0.6, L + 0.1, 0.2), (0, L / 2, H + 0.1), M.M_ceil)
        # 左右の壁
        kit.floor_box("wall_side", X0 - 0.3, 0, X0, L, 0, H, M.M_wall)
        self.meta.rect(X0 - 0.3, 0, X0, L)
        if right_open:
            y0, y1, zt = right_open
            kit.floor_box("wall_side", X1, 0, X1 + 0.3, y0, 0, H, M.M_wall)
            kit.floor_box("wall_side", X1, y1, X1 + 0.3, L, 0, H, M.M_wall)
            kit.floor_box("wall_side", X1, y0, X1 + 0.3, y1, zt, H, M.M_wall)
            self.meta.rect(X1, 0, X1 + 0.3, y0)
            self.meta.rect(X1, y1, X1 + 0.3, L)
        else:
            kit.floor_box("wall_side", X1, 0, X1 + 0.3, L, 0, H, M.M_wall)
            self.meta.rect(X1, 0, X1 + 0.3, L)
        if gaps:
            box("gap", (0.03, L, 0.04), (X0 + 0.012, L / 2, 0.02), M.M_gap)
            if not right_open:
                box("gap", (0.03, L, 0.04), (X1 - 0.012, L / 2, 0.02), M.M_gap)
        # 両端の壁（中央に開口）。出口の誘導灯を付ける
        seg = (W - DOOR) / 2
        for (ya, yb) in ((0, T), (L - T, L)):
            for side in (-1, 1):
                cx = side * (DOOR / 2 + seg / 2)
                kit.floor_box("end_wall", cx - seg / 2, ya, cx + seg / 2, yb, 0, H, M.M_wall)
                self.meta.rect(cx - seg / 2, ya, cx + seg / 2, yb)
            kit.floor_box("door_head", -DOOR / 2, ya, DOOR / 2, yb, DOOR_H, H, M.M_wall)
        for y, face in ((T + 0.02, 1), (L - T - 0.02, -1)):
            box("exit_sign", (0.42, 0.04, 0.16), (0, y, DOOR_H + 0.3), M.M_exit)
        # 天井の照明パネル
        skip = panel_skip or (lambda x, y: False)
        if not ceiling:
            return
        PS = min(2.4, W * 0.36)
        for k in range(3):
            y = 2.3 + k * (L - 4.6) / 2
            for x in (-W * 0.27, W * 0.27):
                if skip(x, y):
                    continue
                box("light_panel", (PS, 2.4, 0.04), (x, y, H - 0.02), M.M_panel)
                kit.area_light((x, y, H - 0.06), size=(PS, 2.4), power=300 * PS / 2.4, color=(1.0, 0.98, 0.95), name="panel")
        box("track", (0.04, L - 1.0, 0.04), (0, L / 2, H - 0.25), M.M_track)

    # ------------------------------------------------------------ 検索ワードの場所
    def spot_to(self, x, y, z, tx, ty, tz, power=30):
        kit.spot_at((x, y, z), (tx, ty, tz), power=power, angle_deg=38, blend=0.6, color=(1.0, 0.95, 0.88),
                    radius=0.08, name="track_spot")
        box("spot_body", (0.08, 0.08, 0.16), (x, y, z + 0.05), self.M_track)

    def place_slots(self, plinth=True, spot=True):
        s = self.slots
        # 壁の痕跡の場所は three.js 側で毎回ランダムに決めるので、壁にはスポットを焼かない
        # （痕跡ごとの光だまりは three.js で描く）。ここの slot は置き場所が見つからないときの予備
        for key in ("left", "right"):
            d = s[key]
            n = d["normal"]
            self.meta.slot(1, d["x"], d["y"], d["z"], d["kind"], normal=n, w=d["w"], h=d["h"], key=key)
        t = s["table"]
        if plinth:
            ph = t["z"]
            box("plinth", (0.6, 0.6, ph), (t["x"], t["y"], ph / 2), self.M_plinth)
            self.meta.rect(t["x"] - 0.35, t["y"] - 0.35, t["x"] + 0.35, t["y"] + 0.35)
        if spot:
            self.spot_to(t["x"], t["y"] - 1.1, H - 0.3, t["x"], t["y"], t["z"] + 0.05, power=22)
        self.meta.slot(1, t["x"], t["y"], t["z"], t["kind"], normal=t["normal"], up=t.get("up", (0, 1, 0)),
                       w=t["w"], h=t["h"], key="table")

    # ------------------------------------------------------------ 夜（深夜の美術館）
    def night(self):
        """天井の照明を消し、作品のスポットだけを弱く残す。誘導灯の緑がほのかに床を照らす"""
        for o in bpy.data.objects:
            if o.type != "LIGHT":
                continue
            if o.name.startswith("panel"):
                o.hide_render = True
            elif o.name.startswith("track_spot"):
                o.data.energy *= 0.9
                o.data.color = (1.0, 0.86, 0.68)
        m = bpy.data.materials.get("light_panel")
        if m:
            m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0.0
        for y, d in ((T + 0.35, 1), (L - T - 0.35, -1)):
            kit.point_light((0, y, DOOR_H + 0.15), power=2.5, color=(0.25, 1.0, 0.5), radius=0.15, name="exit_glow")
        kit.world_color((0.35, 0.42, 0.6), 0.015)
        for fn in self.night_fns:
            fn()

    def finish(self):
        self.meta.spawn(0, 1.5, 0)
        self.meta.zones(-100)
        self.meta.d["module"] = {"length": L, "width": W, "height": H, "door": DOOR, "doorH": DOOR_H, "size": SIZE}
        kit.finalize(self.name, self.meta, hdri_file=None,
                     lm_size=1024 if FAST else 2048, lm_samples=64 if FAST else 384,
                     ao_size=512 if FAST else 1024, ao_samples=24 if FAST else 64, night=self.night)


# ------------------------------------------------------------ 補助
def boxes(name, items, mat, tile=None, collection="static"):
    """多数の箱を 1 つのメッシュで作る。items: [(size, loc, rot_deg), ...]（loc は箱の中心）"""
    import math
    import bmesh
    from mathutils import Matrix
    bm = bmesh.new()
    for size, loc, rot in items:
        ret = bmesh.ops.create_cube(bm, size=1.0)
        m = Matrix.Translation(loc) @ Matrix.Rotation(math.radians(rot[2]), 4, "Z") @ \
            Matrix.Rotation(math.radians(rot[1]), 4, "Y") @ Matrix.Rotation(math.radians(rot[0]), 4, "X") @ \
            Matrix.Diagonal((*size, 1))
        bmesh.ops.transform(bm, matrix=m, verts=ret["verts"])
    return kit.mesh_obj(name, bm, mat, collection, tile=tile)


def surface(name, nu, nv, fn, mat, size=(1.0, 1.0), tile=2.0, flip=False, collection="static"):
    """fn(u, v) -> (x, y, z) の格子面（u, v は 0..1）。size は u・v 方向のおおよその長さ（m）で、
    曲面でもテクスチャが途切れないよう格子に沿った UV を付ける。なめらかに陰影をつける"""
    import bmesh
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    vs = [[bm.verts.new(fn(i / nu, j / nv)) for i in range(nu + 1)] for j in range(nv + 1)]
    for j in range(nv):
        for i in range(nu):
            # 面の表は du × dv の向き。flip で裏返す（開いた曲面は自動では向きを決められない）
            quad = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            if flip:
                quad.reverse()
            f = bm.faces.new([vs[jj][ii] for ii, jj in quad])
            f.smooth = True
            for lp, (ii, jj) in zip(f.loops, quad):
                lp[uvl].uv = (ii / nu * size[0] / tile, jj / nv * size[1] / tile)
    return kit.mesh_obj(name, bm, mat, collection, uv=None)


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
