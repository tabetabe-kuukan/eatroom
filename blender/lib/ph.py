"""Poly Haven（CC0）素材のダウンロードとキャッシュ。

https://polyhaven.com/  — すべて CC0。使った素材は credits に記録し、
scripts/make-credits.mjs が CREDITS.md にまとめる。
"""
import json
import os
import subprocess
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # blender/
CACHE = os.path.join(HERE, "cache", "polyhaven")
UA = {"User-Agent": "tabetabe-kukan-build/0.1"}

USED = {}  # id -> info（このビルドで使った素材）


def _get(url):
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except Exception as e:  # Blender 同梱 Python で SSL が通らない環境向けに curl で取り直す
        print("urllib failed, retry with curl:", e, flush=True)
        r = subprocess.run(["curl", "-sSL", "--fail", "-A", UA["User-Agent"], url], capture_output=True,
                           timeout=300)
        if r.returncode != 0:
            raise RuntimeError(f"download failed {url}: {r.stderr.decode(errors='ignore')}")
        return r.stdout


def _json(url, cache_path):
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            return json.load(f)
    data = json.loads(_get(url).decode("utf-8"))
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return data


def _download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = _get(url)
    with open(path, "wb") as f:
        f.write(data)
    return path


def info(asset_id):
    return _json(f"https://api.polyhaven.com/info/{asset_id}", os.path.join(CACHE, asset_id, "info.json"))


def files(asset_id):
    return _json(f"https://api.polyhaven.com/files/{asset_id}", os.path.join(CACHE, asset_id, "files.json"))


def _record(asset_id, kind):
    i = info(asset_id)
    USED[asset_id] = {
        "id": asset_id,
        "kind": kind,
        "name": i.get("name", asset_id),
        "authors": list((i.get("authors") or {}).keys()),
        "url": f"https://polyhaven.com/a/{asset_id}",
        "license": "CC0",
    }


def texture(asset_id, res="1k"):
    """PBR テクスチャ一式のローカルパスを返す: diff, nor, rough, ao, arm（あるものだけ）"""
    fl = files(asset_id)
    out = {}
    keymap = {"diff": "Diffuse", "nor": "nor_gl", "rough": "Rough", "ao": "AO", "arm": "arm", "alpha": "Alpha"}
    for short, key in keymap.items():
        if key in fl and res in fl[key]:
            entry = fl[key][res].get("jpg") or fl[key][res].get("png")
            url = entry["url"]
            out[short] = _download(url, os.path.join(CACHE, asset_id, os.path.basename(url)))
    _record(asset_id, "texture")
    return out


def model(asset_id, res="1k"):
    """glTF モデルをダウンロードして .gltf のパスを返す"""
    fl = files(asset_id)
    g = fl["gltf"][res]["gltf"]
    base = os.path.join(CACHE, asset_id, f"gltf_{res}")
    path = _download(g["url"], os.path.join(base, os.path.basename(g["url"])))
    for rel, entry in g.get("include", {}).items():
        _download(entry["url"], os.path.join(base, rel))
    _record(asset_id, "model")
    return path


def hdri(asset_id, res="1k"):
    fl = files(asset_id)
    url = fl["hdri"][res]["hdr"]["url"]
    _record(asset_id, "hdri")
    return _download(url, os.path.join(CACHE, asset_id, os.path.basename(url)))
