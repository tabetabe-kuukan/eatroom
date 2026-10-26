"""Blender をバックグラウンドで起動して空間を1つビルドする。

  blender -b --factory-startup -P blender/build.py -- 01 [fast]

通常は `node scripts/blender-build.mjs 01` から呼ぶ。ログは blender/logs/ に出る。
"""
import glob
import os
import runpy
import sys
import traceback

BL = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BL, "lib"))
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
sid = args[0] if args else "01"
os.makedirs(os.path.join(BL, "logs"), exist_ok=True)
logf = open(os.path.join(BL, "logs", f"space{sid}.log"), "w", encoding="utf-8", buffering=1)
sys.stdout = sys.stderr = logf

import kit  # noqa: E402

kit.OPTS = set(args[1:])
code = 0
try:
    # 部屋のモジュール（room_xxx）は blender/rooms/ にある
    if sid.startswith("room_"):
        script = os.path.join(BL, "rooms", f"{sid}.py")
    else:
        script = glob.glob(os.path.join(BL, "spaces", f"space{sid}_*.py"))[0]
    runpy.run_path(script, run_name="__main__")
except Exception:
    traceback.print_exc()
    code = 1
print("EXIT", code, flush=True)
logf.close()
os._exit(code)
