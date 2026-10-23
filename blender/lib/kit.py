"""空間ビルド用の共通ツール（bpy）。

座標の約束:
  Blender は Z-up。プレイヤーは Blender の +Y 方向へ奥に進む。
  glTF/three.js では (x, y, z)_blender -> (x, z, -y)_three になる。
  床の高さは常に z=0（three の y=0）。目線は three 側で 1.6m。
"""
import json
import math
import os
import random
import shutil
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector, noise

import ph

BL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # blender/
ROOT = os.path.dirname(BL)
GEN = os.path.join(BL, "textures", "generated")
EXPORT = os.path.join(BL, "export")
os.makedirs(EXPORT, exist_ok=True)

T0 = time.time()


def log(*a):
    print(f"[{time.time() - T0:7.1f}s]", *a, flush=True)


# ------------------------------------------------------------------ シーン
def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights,
                 bpy.data.cameras, bpy.data.curves, bpy.data.worlds):
        for d in list(coll):
            coll.remove(d)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    for name in ("static", "vlit", "dynamic", "templates"):
        c = bpy.data.collections.new(name)
        sc.collection.children.link(c)
    # テンプレートはレンダーにもエクスポートにも出さない
    bpy.data.collections["templates"].hide_render = True
    random.seed(1)


def coll(name="static"):
    return bpy.data.collections[name]


def setup_cycles(samples=256):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    gpu = False
    for t in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
        try:
            prefs.compute_device_type = t
        except TypeError:
            continue
        prefs.get_devices()
        devs = [d for d in prefs.devices if d.type == t]
        if devs:
            for d in prefs.devices:
                d.use = d.type == t
            gpu = True
            log("cycles device", t, [d.name for d in devs])
            break
    sc.cycles.device = "GPU" if gpu else "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 4
    sc.cycles.glossy_bounces = 2
    sc.cycles.transparent_max_bounces = 8
    sc.cycles.sample_clamp_indirect = 8.0


def world_hdri(asset_id, strength=1.0, rot_deg=0.0, res="1k"):
    path = ph.hdri(asset_id, res)
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value[2] = math.radians(rot_deg)
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(path, check_existing=True)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    w.light_settings.distance = 1.2  # AO ベイクの距離
    return os.path.basename(path)


def world_color(rgb, strength=1.0):
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*rgb, 1)
    bg.inputs["Strength"].default_value = strength
    w.light_settings.distance = 1.2


# ------------------------------------------------------------------ ライト（ベイク用）
def sun(rot_deg, strength=4.0, color=(1, 0.95, 0.85), angle_deg=1.0):
    l = bpy.data.lights.new("Sun", "SUN")
    l.energy = strength
    l.color = color
    l.angle = math.radians(angle_deg)
    o = bpy.data.objects.new("Sun", l)
    o.rotation_euler = [math.radians(a) for a in rot_deg]
    bpy.context.scene.collection.objects.link(o)
    return o


def point_light(loc, power=100, color=(1, 1, 1), radius=0.05, name="Point"):
    l = bpy.data.lights.new(name, "POINT")
    l.energy = power
    l.color = color
    l.shadow_soft_size = radius
    o = bpy.data.objects.new(name, l)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    return o


def area_light(loc, size=(1, 0.2), power=100, color=(1, 1, 1), rot=(0, 0, 0), name="Area"):
    """デフォルトは真下向き"""
    l = bpy.data.lights.new(name, "AREA")
    l.energy = power
    l.color = color
    l.shape = "RECTANGLE"
    l.size, l.size_y = size
    o = bpy.data.objects.new(name, l)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    bpy.context.scene.collection.objects.link(o)
    return o


def spot_light(loc, rot, power=200, angle_deg=60, blend=0.5, color=(1, 1, 1), radius=0.05, name="Spot"):
    l = bpy.data.lights.new(name, "SPOT")
    l.energy = power
    l.color = color
    l.spot_size = math.radians(angle_deg)
    l.spot_blend = blend
    l.shadow_soft_size = radius
    o = bpy.data.objects.new(name, l)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    bpy.context.scene.collection.objects.link(o)
    return o


# ------------------------------------------------------------------ マテリアル
TILE = {}  # material name -> タイル1枚の大きさ（m）


def _img(path, noncolor=False):
    img = bpy.data.images.load(path, check_existing=True)
    if noncolor:
        img.colorspace_settings.name = "Non-Color"
    return img


def _new_mat(name):
    m = bpy.data.materials.get(name)
    if m:
        return m, False
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, True


def mat_pbr(name, tex_id, tile=2.0, tint=None, rough_add=0.0, normal_strength=1.0, res="1k", metal=None):
    """Poly Haven のテクスチャで PBR マテリアルを作る。tile はタイル1枚の大きさ（m）"""
    m, new = _new_mat(name)
    TILE[name] = tile
    if not new:
        return m
    t = ph.texture(tex_id, res)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    diff = nt.nodes.new("ShaderNodeTexImage")
    diff.image = _img(t["diff"])
    if tint:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(diff.outputs["Color"], mix.inputs["A"])
        mix.inputs["B"].default_value = (*tint, 1)
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    else:
        nt.links.new(diff.outputs["Color"], b.inputs["Base Color"])
    if "arm" in t:
        arm = nt.nodes.new("ShaderNodeTexImage")
        arm.image = _img(t["arm"], True)
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(arm.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
        if metal is None:
            nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
        else:
            b.inputs["Metallic"].default_value = metal
    elif "rough" in t:
        r = nt.nodes.new("ShaderNodeTexImage")
        r.image = _img(t["rough"], True)
        nt.links.new(r.outputs["Color"], b.inputs["Roughness"])
    if "nor" in t:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = _img(t["nor"], True)
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_color(name, rgb, rough=0.6, metal=0.0, emit=None, emit_strength=1.0, alpha=None):
    m, new = _new_mat(name)
    TILE[name] = 1.0
    if not new:
        return m
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    if alpha is not None:
        b.inputs["Alpha"].default_value = alpha
    return m


def mat_image(name, path, rough=0.7, metal=0.0, cut=False, emit_strength=0.0, normal_from=None, tile=1.0):
    """画像1枚のマテリアル（看板・ラベルなど）。cut=True でアルファ切り抜き（名前に _cut を付ける）"""
    if cut and not name.endswith("_cut"):
        name += "_cut"
    m, new = _new_mat(name)
    TILE[name] = tile
    if not new:
        return m
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = _img(path)
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if cut:
        nt.links.new(tex.outputs["Alpha"], b.inputs["Alpha"])
    if emit_strength:
        nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit_strength
    m.use_backface_culling = False
    return m


def double_sided(m):
    m.use_backface_culling = False
    return m


# ------------------------------------------------------------------ メッシュ
def _link(obj, collection="static"):
    coll(collection).objects.link(obj)
    return obj


def mesh_obj(name, bm, mat=None, collection="static", uv="box", tile=None, uv_offset=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    _link(obj, collection)
    if mat:
        me.materials.append(mat)
    if uv == "box":
        box_uv(obj, tile or TILE.get(mat.name if mat else "", 1.0), uv_offset)
    return obj


def box_uv(obj, tile=1.0, offset=None):
    """ワールド座標でボックス投影 UV を付ける（テクスチャ密度がそろう）"""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    mw = obj.matrix_world
    if offset is None:
        offset = (random.random() * 10, random.random() * 10)
    for f in bm.faces:
        n = (mw.to_3x3() @ f.normal)
        ax = max(range(3), key=lambda i: abs(n[i]))
        for lp in f.loops:
            co = mw @ lp.vert.co
            if ax == 0:
                u, v = (co.y if n.x > 0 else -co.y), co.z
            elif ax == 1:
                u, v = (-co.x if n.y > 0 else co.x), co.z
            else:
                u, v = co.x, (co.y if n.z > 0 else -co.y)
            lp[uvl].uv = (u / tile + offset[0], v / tile + offset[1])
    bm.to_mesh(me)
    bm.free()


def _xf(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    m = Matrix.Translation(loc) @ Matrix.Rotation(math.radians(rot[2]), 4, "Z") @ \
        Matrix.Rotation(math.radians(rot[1]), 4, "Y") @ Matrix.Rotation(math.radians(rot[0]), 4, "X") @ \
        Matrix.Diagonal((*scale, 1))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)


def box(name, size, loc, mat, rot=(0, 0, 0), collection="static", tile=None, bevel=0.0):
    """loc は底面中心ではなく箱の中心"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=bevel / max(size), segments=1, affect="EDGES")
    _xf(bm, loc, rot, size)
    return mesh_obj(name, bm, mat, collection, tile=tile)


def floor_box(name, x0, y0, x1, y1, z0, z1, mat, collection="static", tile=None):
    return box(name, (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat,
               collection=collection, tile=tile)


def cyl(name, r, h, loc, mat, segs=16, r_top=None, rot=(0, 0, 0), cap=True, collection="static", tile=None):
    """loc は底面中心"""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, segments=segs, radius1=r, radius2=r if r_top is None else r_top,
                          depth=h)
    bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    _xf(bm, loc, rot)
    return mesh_obj(name, bm, mat, collection, tile=tile)


def plane(name, w, h, loc, mat, rot=(90, 0, 0), collection="static", flip=False):
    """画像を貼る板。rot=(90,0,0) で -Y 側（手前）を向いて立つ。UV は 0..1"""
    bm = bmesh.new()
    s = -1 if flip else 1
    vs = [bm.verts.new(v) for v in [(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)]]
    f = bm.faces.new(vs)
    uvl = bm.loops.layers.uv.new("UVMap")
    for lp, uv in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        lp[uvl].uv = uv
    _xf(bm, loc, rot)
    return mesh_obj(name, bm, mat, collection, uv=None)


def lathe(name, profile, loc, mat, segs=24, collection="static", uv_mode="cyl"):
    """profile: [(r, z), ...] 下から上へ。UV は円周 u / 高さ v（0..1）"""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rings.append(ring)
    uvl = bm.loops.layers.uv.new("UVMap")
    zmin, zmax = profile[0][1], profile[-1][1]
    for k in range(len(rings) - 1):
        for i in range(segs):
            j = (i + 1) % segs
            f = bm.faces.new([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
            for lp, (ii, kk) in zip(f.loops, [(i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1)]):
                lp[uvl].uv = (ii / segs, (profile[kk][1] - zmin) / (zmax - zmin))
    # 底のふた
    if profile[0][0] > 0:
        bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _xf(bm, loc)
    return mesh_obj(name, bm, mat, collection, uv=None)


def tube(name, path_pts, radii, mat, segs=12, collection="static", flatten=1.0):
    """path_pts に沿ったチューブ。radii は各点の半径。UV: u=周, v=長さ方向"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rings = []
    n = len(path_pts)
    for k, p in enumerate(path_pts):
        p = Vector(p)
        t = (Vector(path_pts[min(k + 1, n - 1)]) - Vector(path_pts[max(k - 1, 0)])).normalized()
        side = t.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(t).normalized()
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            off = side * math.cos(a) * radii[k] + up * math.sin(a) * radii[k] * flatten
            ring.append(bm.verts.new(p + off))
        rings.append(ring)
    for k in range(n - 1):
        for i in range(segs):
            j = (i + 1) % segs
            f = bm.faces.new([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
            for lp, (ii, kk) in zip(f.loops, [(i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1)]):
                lp[uvl].uv = (ii / segs * 2, kk / (n - 1) * 4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, mat, collection, uv=None)


def grid_terrain(name, x0, y0, x1, y1, res, height_fn, mat, collection="static", tile=None):
    """height_fn(x, y) -> z の地形グリッド"""
    bm = bmesh.new()
    nx = max(2, int((x1 - x0) / res) + 1)
    ny = max(2, int((y1 - y0) / res) + 1)
    vs = []
    for j in range(ny):
        row = []
        for i in range(nx):
            x = x0 + (x1 - x0) * i / (nx - 1)
            y = y0 + (y1 - y0) * j / (ny - 1)
            row.append(bm.verts.new((x, y, height_fn(x, y))))
        vs.append(row)
    for j in range(ny - 1):
        for i in range(nx - 1):
            bm.faces.new([vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]])
    return mesh_obj(name, bm, mat, collection, tile=tile)


def grass(name, points, mat, blades=(10, 18), height=(0.25, 0.65), width=(0.012, 0.028), spread=0.18,
          ground_fn=None, collection="static", seed=3):
    """手続き的な草むら。points は株の中心 (x, y)。各葉は3節のテーパー帯"""
    rnd = random.Random(seed)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    for (cx, cy) in points:
        nb = rnd.randint(*blades)
        for _ in range(nb):
            a = rnd.uniform(0, 2 * math.pi)
            d = rnd.uniform(0, spread)
            bx, by = cx + math.cos(a) * d, cy + math.sin(a) * d
            bz = ground_fn(bx, by) if ground_fn else 0.0
            h = rnd.uniform(*height)
            w = rnd.uniform(*width)
            yaw = rnd.uniform(0, 2 * math.pi)
            lean = rnd.uniform(0.1, 0.6)
            ldir = rnd.uniform(0, 2 * math.pi)
            side = Vector((math.cos(yaw), math.sin(yaw), 0))
            lv = Vector((math.cos(ldir), math.sin(ldir), 0))
            segs = 2
            left, right = [], []
            for s in range(segs + 1):
                t = s / segs
                c = Vector((bx, by, bz)) + lv * (lean * h * t * t) + Vector((0, 0, h * t * (1 - 0.25 * lean * t)))
                ww = w * (1 - t * 0.92)
                left.append(bm.verts.new(c - side * ww))
                right.append(bm.verts.new(c + side * ww))
            for s in range(segs):
                f = bm.faces.new([left[s], right[s], right[s + 1], left[s + 1]])
                for lp, uv in zip(f.loops, [(0, s / segs), (1, s / segs), (1, (s + 1) / segs), (0, (s + 1) / segs)]):
                    lp[uvl].uv = uv
    return mesh_obj(name, bm, mat, collection, uv=None)


# ------------------------------------------------------------------ 照明器具
def fluorescent(name, x, y, z, length=1.2, power=60, lit=True, along="y", flicker=False, color=(1.0, 0.97, 0.9),
                housing=None, width=0.14):
    """天井の蛍光灯（器具 + 発光管 + ベイク用エリアライト）。flicker=True で three 側で点滅させる"""
    hm = housing or mat_color("fixture_white", (0.8, 0.8, 0.78), 0.5)
    sx, sy = (width, length) if along == "y" else (length, width)
    box(f"{name}_housing", (sx + 0.04, sy + 0.04, 0.05), (x, y, z + 0.025), hm)
    if lit:
        em = mat_color("tube_flicker" if flicker else "tube_on", color, 0.4, emit=color, emit_strength=6.0)
    else:
        em = mat_color("tube_off", (0.55, 0.56, 0.55), 0.4)
    box(f"{name}_tube", (sx, sy, 0.03), (x, y, z - 0.012), em)
    if lit:
        area_light((x, y, z - 0.04), size=(sx, sy), power=power, color=color, name=f"{name}_light")
        # 天井側にも少し回り込ませる（乳白カバー越しの光）
        area_light((x, y, z - 0.035), size=(sx * 1.4, sy * 1.1), power=power * 0.18, color=color, rot=(180, 0, 0),
                   name=f"{name}_up")


def footprints(name, pts, mat, stride=0.65, gap=0.13, size=(0.11, 0.27), z_fn=None, collection="static", seed=5):
    """点列に沿って左右交互の足跡デカールを置く（地面から少し浮かせる）"""
    rnd = random.Random(seed)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    # 経路を等間隔にリサンプル
    path = [Vector((p[0], p[1], 0)) for p in pts]
    acc, out = 0.0, []
    for a, b in zip(path, path[1:]):
        seg = (b - a).length
        while acc <= seg:
            out.append((a.lerp(b, acc / seg if seg else 0), (b - a).normalized()))
            acc += stride
        acc -= seg
    for i, (p, d) in enumerate(out):
        side = 1 if i % 2 else -1
        n = Vector((-d.y, d.x, 0))
        c = p + n * gap * side * 0.5 + Vector((rnd.uniform(-0.02, 0.02), rnd.uniform(-0.03, 0.03), 0))
        ang = math.atan2(d.y, d.x) - math.pi / 2 + rnd.uniform(-0.12, 0.12) + side * 0.08
        z = (z_fn(c.x, c.y) if z_fn else 0.0) + 0.006
        w, h = size
        corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
        vs = []
        for cx, cy in corners:
            if side > 0:
                cx = -cx  # 右足は鏡像
            rx = cx * math.cos(ang) - cy * math.sin(ang)
            ry = cx * math.sin(ang) + cy * math.cos(ang)
            vs.append(bm.verts.new((c.x + rx, c.y + ry, z)))
        f = bm.faces.new(vs)
        for lp, uv in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
            lp[uvl].uv = uv
    return mesh_obj(name, bm, mat, collection, uv=None)


# ------------------------------------------------------------------ モデル読み込み
_TEMPLATES = {}


def model_template(asset_id, res="1k", decimate=None, scale=1.0):
    """Poly Haven のモデルを1つのメッシュにまとめたテンプレートにする"""
    key = (asset_id, res, decimate, scale)
    if key in _TEMPLATES:
        return _TEMPLATES[key]
    path = ph.model(asset_id, res)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll("templates").objects.link(o)
    # 変形を適用して親子を外す
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    for o in meshes:
        o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
        _normalize_uv(o)
    if len(meshes) > 1:
        with bpy.context.temp_override(active_object=meshes[0], selected_editable_objects=meshes,
                                       selected_objects=meshes):
            bpy.ops.object.join()
    obj = meshes[0]
    obj.name = f"TPL_{asset_id}"
    if scale != 1.0:
        obj.data.transform(Matrix.Diagonal((scale, scale, scale, 1)))
    if decimate:
        mod = obj.modifiers.new("dec", "DECIMATE")
        mod.ratio = decimate
        with bpy.context.temp_override(object=obj, active_object=obj):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for m in obj.data.materials:
        if m and m.node_tree:
            b = m.node_tree.nodes.get("Principled BSDF")
            if b and b.inputs["Alpha"].is_linked and not m.name.endswith("_cut"):
                m.name = m.name + "_cut"
    _TEMPLATES[key] = obj
    log("template", asset_id, "tris", sum(len(p.vertices) - 2 for p in obj.data.polygons))
    return obj


def _normalize_uv(o):
    uvs = o.data.uv_layers
    if not uvs:
        uvs.new(name="UVMap")
        return
    if uvs[0].name != "LM":
        uvs[0].name = "UVMap"
    for l in [l for l in uvs if l.name not in ("UVMap", "LM")]:
        uvs.remove(l)


def place(template, loc, rot_z=0.0, scale=1.0, collection="static", rot=None, name=None):
    o = template.copy()  # メッシュデータは共有（結合時に複製される）
    o.name = name or template.name.replace("TPL_", "")
    o["lm_uv"] = "copy"
    r = rot or (0, 0, rot_z)
    o.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(math.radians(r[2]), 4, "Z") @ \
        Matrix.Rotation(math.radians(r[1]), 4, "Y") @ Matrix.Rotation(math.radians(r[0]), 4, "X") @ \
        Matrix.Diagonal((scale, scale, scale, 1))
    _link(o, collection)
    return o


# ------------------------------------------------------------------ メタデータ（three.js 用）
def to3(x, y, z=0.0):
    return [round(x, 3), round(z, 3), round(-y, 3)]


class Meta:
    def __init__(self, space_id):
        self.d = {"space": space_id, "spawn": None, "zones": [], "traces": {}, "colliders": [], "lights": [],
                  "sounds": {}, "markers": {}, "lightmap": None}

    def spawn(self, x, y, yaw_deg=0.0, z=0.0):
        """yaw 0 で +Y（奥）を向く"""
        self.d["spawn"] = {"pos": to3(x, y, z), "yaw": math.radians(yaw_deg)}

    def zones(self, *y_starts):
        """各区画の開始 y（第1区画は 0 などで開始）。three では z = -y 以下で区画に入る"""
        self.d["zones"] = [round(-y, 3) for y in y_starts]

    def trace(self, tid, x, y, z=0.5, radius=2.4):
        self.d["traces"][tid] = {"pos": to3(x, y, z), "radius": radius}

    def rect(self, x0, y0, x1, y1):
        """軸平行の壁（Blender 座標の矩形）"""
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        self.d["colliders"].append({"x": round(cx, 3), "z": round(-cy, 3), "hx": round(abs(x1 - x0) / 2, 3),
                                    "hz": round(abs(y1 - y0) / 2, 3), "rot": 0})

    def obox(self, cx, cy, hx, hy, rot_deg):
        self.d["colliders"].append({"x": round(cx, 3), "z": round(-cy, 3), "hx": hx, "hz": hy,
                                    "rot": round(math.radians(rot_deg), 4)})

    def floor(self, x0, y0, x1, y1, h0, h1=None):
        """歩ける床の高さ（矩形、y 方向に h0→h1 で傾斜）。重なる場合は高い方"""
        h1 = h0 if h1 is None else h1
        self.d.setdefault("floors", []).append({"x0": round(min(x0, x1), 3), "x1": round(max(x0, x1), 3),
                                                 "z0": round(-max(y0, y1), 3), "z1": round(-min(y0, y1), 3),
                                                 "hz0": round(h1 if y1 > y0 else h0, 3),
                                                 "hz1": round(h0 if y1 > y0 else h1, 3)})

    def circle(self, cx, cy, r):
        self.d["colliders"].append({"x": round(cx, 3), "z": round(-cy, 3), "r": r})

    def light(self, x, y, z, color=(1, 1, 1), intensity=1.0, distance=8.0, flicker=0.0, kind="point"):
        self.d["lights"].append({"pos": to3(x, y, z), "color": list(color), "intensity": intensity,
                                 "distance": distance, "flicker": flicker, "kind": kind})

    def sound(self, sid, x, y, z=1.0):
        self.d["sounds"][sid] = to3(x, y, z)

    def marker(self, mid, x, y, z=0.0, yaw_deg=0.0):
        self.d["markers"][mid] = {"pos": to3(x, y, z), "yaw": math.radians(yaw_deg)}

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.d, f, ensure_ascii=False, indent=1)


# ------------------------------------------------------------------ 仕上げ（結合・ベイク・書き出し）
def _join(objs, name):
    objs = [o for o in objs if o.type == "MESH"]
    for o in objs:
        if o.data.users > 1:
            o.data = o.data.copy()
        _normalize_uv(o)
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    o = objs[0]
    o.name = name
    # 変形を適用
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
    return o


def _select_only(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def prep_lightmap_uv(objs):
    """結合前に各オブジェクトへ LM レイヤーを作る。
    Poly Haven のモデルは元の UV（重なりなし）を流用し、それ以外は個別に Smart UV Project する。"""
    done = set()
    for o in objs:
        me = o.data
        if me.name in done:
            continue
        done.add(me.name)
        _normalize_uv(o)
        lm = me.uv_layers.new(name="LM")
        if o.get("lm_uv") == "copy":
            src = me.uv_layers["UVMap"]
            buf = np.zeros(len(src.data) * 2, dtype=np.float32)
            src.data.foreach_get("uv", buf)
            lm.data.foreach_set("uv", buf)
            continue
        me.uv_layers.active = lm
        _select_only(o)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0,
                                 correct_aspect=True, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode="OBJECT")


def lightmap_uv(obj, margin=0.002):
    """結合後: 島のテクセル密度をそろえて詰める"""
    me = obj.data
    lm = me.uv_layers["LM"]
    me.uv_layers["UVMap"].active_render = True
    me.uv_layers.active = lm
    _select_only(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.average_islands_scale()
    try:
        bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, margin=margin)
    except Exception as e:
        log("pack_islands fallback", e)
        bpy.ops.uv.pack_islands(rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")


def _bake_target(obj, img):
    nodes = []
    for m in obj.data.materials:
        if not m or not m.use_nodes:
            continue
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.name = "__BAKE__"
        n.image = img
        n.select = True
        m.node_tree.nodes.active = n
        nodes.append((m, n))
    return nodes


def _remove_bake_nodes(nodes):
    for m, n in nodes:
        m.node_tree.nodes.remove(n)


def _srgb_encode(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def _masked_blur(rgb, mask, radius=1):
    """島の外ににじまないブラー（ベイクのノイズを軽く取る）"""
    acc = np.zeros_like(rgb)
    wacc = np.zeros(mask.shape, dtype=np.float32)
    h, w = mask.shape
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            wgt = 1.0 / (1 + dx * dx + dy * dy)
            sm = np.roll(np.roll(mask, dy, 0), dx, 1) * wgt
            acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * sm[..., None]
            wacc += sm
    out = np.where(wacc[..., None] > 0, acc / np.maximum(wacc[..., None], 1e-6), rgb)
    return out


def bake_lightmap(obj, size, samples, path_png, blur=1):
    sc = bpy.context.scene
    sc.cycles.samples = samples
    img = bpy.data.images.new("LM_bake", size, size, alpha=True, float_buffer=True)
    nodes = _bake_target(obj, img)
    _select_only(obj)
    sc.render.bake.margin = 6
    sc.render.bake.use_clear = True
    t = time.time()
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=6, use_clear=True)
    log("lightmap bake", f"{time.time() - t:.1f}s")
    _remove_bake_nodes(nodes)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)
    rgb, mask = px[..., :3], (px[..., 3] > 0.5).astype(np.float32)
    if blur:
        rgb = _masked_blur(rgb, mask, blur)
    lum = rgb.max(axis=2)[mask > 0]
    scale = float(max(0.25, np.percentile(lum, 99.5))) if lum.size else 1.0
    enc = _srgb_encode(rgb / scale)
    out = bpy.data.images.new("LM_out", size, size, alpha=False)
    out.colorspace_settings.name = "Non-Color"
    o = np.ones((size, size, 4), dtype=np.float32)
    o[..., :3] = enc
    out.pixels.foreach_set(o.ravel())
    out.filepath_raw = path_png
    out.file_format = "PNG"
    out.save()
    log("lightmap saved", path_png, "scale", round(scale, 3))
    return scale


def bake_ao(obj, size, samples, path_png):
    sc = bpy.context.scene
    sc.cycles.samples = samples
    img = bpy.data.images.new("AO_bake", size, size, alpha=True, float_buffer=True)
    nodes = _bake_target(obj, img)
    _select_only(obj)
    t = time.time()
    bpy.ops.object.bake(type="AO", margin=4, use_clear=True)
    log("ao bake", f"{time.time() - t:.1f}s")
    _remove_bake_nodes(nodes)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)
    rgb, mask = px[..., :3], (px[..., 3] > 0.5).astype(np.float32)
    rgb = _masked_blur(rgb, mask, 1)
    out = bpy.data.images.new("AO_out", size, size, alpha=False)
    out.colorspace_settings.name = "Non-Color"
    o = np.ones((size, size, 4), dtype=np.float32)
    o[..., :3] = np.clip(rgb, 0, 1)
    out.pixels.foreach_set(o.ravel())
    out.filepath_raw = path_png
    out.file_format = "PNG"
    out.save()


def bake_vertex_light(obj, samples, scale):
    """細かい物（草・シダ）は頂点カラーに照明をベイクする。値は scale で割って 0..1 に収める"""
    sc = bpy.context.scene
    sc.cycles.samples = samples
    me = obj.data
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    ca = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    me.color_attributes.active_color = ca
    _select_only(obj)
    t = time.time()
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, target="VERTEX_COLORS")
    log("vertex bake", f"{time.time() - t:.1f}s")
    n = len(ca.data)
    arr = np.zeros(n * 4, dtype=np.float32)
    ca.data.foreach_get("color", arr)
    arr = arr.reshape(n, 4)
    arr[:, :3] = np.clip(arr[:, :3] / scale, 0, 1)
    arr[:, 3] = 1
    ca.data.foreach_set("color", arr.ravel())
    obj["vlit"] = round(scale, 4)


def _gltf_output_group():
    """glTF エクスポーターが読む「glTF Material Output」ノードグループ（Occlusion 入力）"""
    g = bpy.data.node_groups.get("glTF Material Output")
    if g:
        return g
    g = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
    g.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    return g


def attach_ao_occlusion(obj, ao_path):
    """ベイクした AO を LM の UV で occlusion スロットにつなぐ。
    Blender の glTF エクスポーターはマテリアルが使う UV しか書き出さないので、
    これで TEXCOORD_1（ライトマップ用 UV）も一緒に書き出される。"""
    img = bpy.data.images.load(ao_path, check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    grp = _gltf_output_group()
    for m in obj.data.materials:
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        if any(n.type == "GROUP" and n.node_tree == grp for n in nt.nodes):
            continue
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.uv_map = "LM"
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.name = "__AO__"
        out = nt.nodes.new("ShaderNodeGroup")
        out.node_tree = grp
        nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
        nt.links.new(tex.outputs["Color"], out.inputs["Occlusion"])


def export_glb(path, objs):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_extras=True, export_apply=True,
              export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT",
              export_image_format="AUTO", export_lights=False, export_cameras=False,
              export_vertex_color="ACTIVE")
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError as e:
        log("export arg fallback", e)
        kw.pop("export_vertex_color", None)
        bpy.ops.export_scene.gltf(**kw)
    log("exported", path, f"{os.path.getsize(path) / 1e6:.1f}MB")


def finalize(space_id, meta, hdri_file=None, lm_size=2048, lm_samples=512, ao_size=1024, ao_samples=96,
             bake=True):
    tag = f"space{space_id}"
    static = [o for o in coll("static").all_objects if o.type == "MESH"]
    log("static objects", len(static))
    prep_lightmap_uv(static)
    lm_obj = _join(static, f"{tag}_static")
    lm_obj["lightmap"] = 1
    tris = sum(len(p.vertices) - 2 for p in lm_obj.data.polygons)
    log("static tris", tris, "materials", len(lm_obj.data.materials))
    lightmap_uv(lm_obj)
    meta.d["tris"] = tris
    if bake:
        scale = bake_lightmap(lm_obj, lm_size, lm_samples, os.path.join(EXPORT, f"{tag}_lm.png"))
        ao_path = os.path.join(EXPORT, f"{tag}_ao.png")
        bake_ao(lm_obj, ao_size, ao_samples, ao_path)
        attach_ao_occlusion(lm_obj, ao_path)
        meta.d["lightmap"] = {"file": f"{tag}_lm.webp", "scale": round(scale, 4)}
    else:
        scale = 1.0
    meta.d["hdri"] = hdri_file
    extra = []
    vl = [o for o in coll("vlit").all_objects if o.type == "MESH"]
    if vl:
        v_obj = _join(vl, f"{tag}_vlit")
        log("vlit tris", sum(len(p.vertices) - 2 for p in v_obj.data.polygons))
        if bake:
            bake_vertex_light(v_obj, max(32, lm_samples // 2), scale)
        extra.append(v_obj)
    dyn = [o for o in coll("dynamic").all_objects if o.type == "MESH"]
    export_glb(os.path.join(EXPORT, f"{tag}.glb"), [lm_obj] + extra + dyn)
    meta.save(os.path.join(EXPORT, f"{tag}.json"))
    with open(os.path.join(EXPORT, f"{tag}.credits.json"), "w", encoding="utf-8") as f:
        json.dump(list(ph.USED.values()), f, ensure_ascii=False, indent=1)
    # 生成スクリプトから再現できる .blend も残す
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BL, f"{tag}.blend"), compress=True)
    log("done", tag)
