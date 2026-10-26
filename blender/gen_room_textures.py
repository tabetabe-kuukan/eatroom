"""v2 の部屋モジュール用のテクスチャ（畳・子ども部屋の壁紙・黒板・本の背表紙）を Pillow で作る。

使い方:  python blender/gen_room_textures.py
出力先:  blender/textures/generated/room_*.png
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "textures", "generated")
os.makedirs(OUT, exist_ok=True)


def save(img, name):
    img.save(os.path.join(OUT, name))
    print("saved", name)


def tatami():
    """畳表（い草の目）。縦 1024 が畳の長辺方向"""
    rnd = random.Random(3)
    w, h = 512, 1024
    img = Image.new("RGB", (w, h), (176, 168, 112))
    d = ImageDraw.Draw(img)
    # い草の目：細い横縞が密に並ぶ（畳の短辺方向に走る）
    for y in range(0, h, 4):
        c = 150 + rnd.randint(-10, 12)
        d.line([(0, y), (w, y)], fill=(c + 18, c + 12, int(c * 0.62)), width=2)
        d.line([(0, y + 2), (w, y + 2)], fill=(c - 14, c - 18, int(c * 0.5)), width=1)
    # 経糸
    for x in range(0, w, 32):
        d.line([(x, 0), (x, h)], fill=(120, 112, 70), width=1)
    # 日焼けのむら
    noise = Image.effect_noise((w // 16, h // 16), 40).resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(8))
    img = Image.blend(img, Image.merge("RGB", (noise, noise, noise.point(lambda v: v * 0.6))), 0.12)
    save(img, "room_tatami.png")


def kids_wallpaper():
    """子ども部屋の壁紙：淡い水色に星と雲"""
    rnd = random.Random(7)
    s = 1024
    img = Image.new("RGB", (s, s), (196, 222, 236))
    d = ImageDraw.Draw(img)
    for i in range(0, s, 64):
        d.line([(i, 0), (i, s)], fill=(206, 230, 242), width=20)
    def star(cx, cy, r, col):
        pts = []
        for k in range(10):
            a = -math.pi / 2 + k * math.pi / 5
            rr = r if k % 2 == 0 else r * 0.45
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        d.polygon(pts, fill=col)
    for _ in range(40):
        star(rnd.randint(0, s), rnd.randint(0, s), rnd.randint(14, 30), rnd.choice([(250, 220, 120), (250, 190, 170), (255, 245, 200)]))
    for _ in range(9):
        cx, cy = rnd.randint(0, s), rnd.randint(0, s)
        for k in range(4):
            r = rnd.randint(28, 46)
            d.ellipse([cx + k * 34 - r, cy - r + (k % 2) * 10, cx + k * 34 + r, cy + r], fill=(250, 250, 252))
    save(img, "room_kids_wallpaper.png")


def blackboard():
    """黒板：消し残しのチョークの跡"""
    rnd = random.Random(11)
    w, h = 2048, 768
    img = Image.new("RGB", (w, h), (38, 66, 52))
    d = ImageDraw.Draw(img)
    # 黒板消しの跡（横長の白いかすれ）
    smear = Image.new("L", (w, h), 0)
    sd = ImageDraw.Draw(smear)
    for _ in range(90):
        x, y = rnd.randint(-100, w), rnd.randint(0, h)
        sd.rectangle([x, y, x + rnd.randint(120, 380), y + rnd.randint(30, 70)], fill=rnd.randint(10, 32))
    smear = smear.filter(ImageFilter.GaussianBlur(14))
    img = Image.composite(Image.new("RGB", (w, h), (190, 200, 192)), img, smear)
    d = ImageDraw.Draw(img)
    # 消えかけの図形と線
    for _ in range(14):
        x, y = rnd.randint(80, w - 300), rnd.randint(60, h - 200)
        c = (150 + rnd.randint(0, 40),) * 3
        kind = rnd.random()
        if kind < 0.4:
            d.line([(x, y), (x + rnd.randint(100, 300), y + rnd.randint(-60, 60))], fill=c, width=3)
        elif kind < 0.7:
            r = rnd.randint(30, 90)
            d.ellipse([x, y, x + r, y + r], outline=c, width=3)
        else:
            for k in range(rnd.randint(3, 7)):
                d.line([(x, y + k * 22), (x + rnd.randint(60, 220), y + k * 22)], fill=c, width=2)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    # 粉の粒
    px = img.load()
    for _ in range(30000):
        x, y = rnd.randrange(w), rnd.randrange(h)
        r, g, b = px[x, y]
        px[x, y] = (min(255, r + 25), min(255, g + 25), min(255, b + 25))
    save(img, "room_blackboard.png")


def book_spines():
    """本の背表紙を並べたアトラス（横 16 冊 × 縦 4 段）。1 冊 = 64×256px"""
    rnd = random.Random(5)
    cols, rows, bw, bh = 16, 4, 64, 256
    img = Image.new("RGB", (cols * bw, rows * bh), (40, 30, 24))
    d = ImageDraw.Draw(img)
    palette = [(112, 34, 30), (40, 58, 92), (36, 70, 48), (128, 96, 52), (70, 40, 66), (150, 130, 96),
               (30, 30, 34), (96, 70, 40), (140, 60, 36), (60, 80, 84), (180, 160, 120), (88, 24, 30)]
    for r in range(rows):
        for c in range(cols):
            x0, y0 = c * bw, r * bh
            col = rnd.choice(palette)
            d.rectangle([x0 + 1, y0, x0 + bw - 2, y0 + bh], fill=col)
            gold = (196, 160, 90)
            for yy in (y0 + 20, y0 + bh - 26):
                d.rectangle([x0 + 6, yy, x0 + bw - 8, yy + 3], fill=gold)
            # 題名のかわりの金の帯と小さなラベル
            d.rectangle([x0 + 14, y0 + 60, x0 + bw - 16, y0 + 60 + rnd.randint(50, 110)], fill=tuple(min(255, v + 30) for v in col))
            if rnd.random() < 0.5:
                d.rectangle([x0 + 10, y0 + bh - 70, x0 + bw - 12, y0 + bh - 46], fill=(220, 210, 180))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    save(img, "room_books.png")


if __name__ == "__main__":
    tatami()
    kids_wallpaper()
    blackboard()
    book_spines()
