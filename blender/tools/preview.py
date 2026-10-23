"""ビルド済みの .blend を Cycles でプレビューする（WebGL 側との見比べ用）。
  blender -b blender/space02.blend -P blender/tools/preview.py -- out.png x y z yaw_deg pitch_deg [samples]
座標は Blender 座標（+Y が奥）。"""
import math
import sys

import bpy

a = sys.argv[sys.argv.index("--") + 1:]
out = a[0]
x, y, z, yaw, pitch = map(float, a[1:6])
samples = int(a[6]) if len(a) > 6 else 64
sc = bpy.context.scene
cam = bpy.data.cameras.new("PreviewCam")
cam.lens = 18
o = bpy.data.objects.new("PreviewCam", cam)
sc.collection.objects.link(o)
o.location = (x, y, z)
o.rotation_euler = (math.radians(90 + pitch), 0, math.radians(yaw))
sc.camera = o
sc.render.engine = "CYCLES"
sc.cycles.samples = samples
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 800, 450
sc.view_settings.view_transform = "AgX"
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
