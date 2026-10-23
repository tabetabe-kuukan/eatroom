"""文字や図柄のテクスチャ（看板・地図・ラベルなど）を Pillow で生成する。

使い方:  python blender/gen_textures.py [空間番号...]
出力先:  blender/textures/generated/

フォントはすべて SIL Open Font License のもの（BIZ UD / しっぽり明朝）。
見つからない場合は Windows 標準の游明朝・游ゴシックにフォールバックする。
"""
import math
import os
import random
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "textures", "generated")
os.makedirs(OUT, exist_ok=True)

WIN = os.environ.get("WINDIR", r"C:\Windows")
USERFONTS = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Windows", "Fonts")
FONT_CANDIDATES = {
    "mincho_heavy": [os.path.join(USERFONTS, "ShipporiMinchoB1-OTF-ExtraBold.otf"),
                     os.path.join(WIN, "Fonts", "yumindb.ttf")],
    "mincho": [os.path.join(USERFONTS, "ShipporiMinchoB1-OTF-Medium.otf"),
               os.path.join(WIN, "Fonts", "BIZ-UDMinchoM.ttc"), os.path.join(WIN, "Fonts", "yumin.ttf")],
    "gothic_bold": [os.path.join(WIN, "Fonts", "BIZ-UDGothicB.ttc"), os.path.join(WIN, "Fonts", "YuGothB.ttc")],
    "gothic": [os.path.join(WIN, "Fonts", "BIZ-UDGothicR.ttc"), os.path.join(WIN, "Fonts", "YuGothR.ttc")],
    "latin_bold": [os.path.join(WIN, "Fonts", "bahnschrift.ttf"), os.path.join(WIN, "Fonts", "arialbd.ttf")],
    "mono": [os.path.join(WIN, "Fonts", "consola.ttf"), os.path.join(WIN, "Fonts", "cour.ttf")],
}


def font(kind, size):
    for p in FONT_CANDIDATES[kind]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise FileNotFoundError(kind)


def save(img, name):
    p = os.path.join(OUT, name)
    img.save(p)
    print("wrote", p)


def noise_layer(size, scale, seed, octaves=4):
    """低周波ノイズ（L画像）。縮小ランダム画像を拡大して重ねる。"""
    rnd = random.Random(seed)
    w, h = size
    acc = None
    amp_total = 0.0
    for o in range(octaves):
        s = max(2, int(scale * (2 ** o)))
        small = Image.new("L", (s, max(2, int(s * h / w))))
        small.putdata([rnd.randint(0, 255) for _ in range(small.width * small.height)])
        big = small.resize(size, Image.BICUBIC)
        amp = 0.5 ** o
        acc = big if acc is None else Image.blend(acc, big, amp / (amp_total + amp))
        amp_total += amp
    # コントラストを戻す（重ね合わせで平均に寄るため）
    return acc.point(lambda v: max(0, min(255, int((v - 128) * 1.8 + 128))))


def grime(img, seed, strength=0.35, tint=(90, 70, 40)):
    """汚れ・日焼けを重ねる。"""
    n = noise_layer(img.size, 6, seed)
    n = n.point(lambda v: max(0, min(255, int((v - 110) * 2.2))))
    stain = Image.new("RGB", img.size, tint)
    mask = n.point(lambda v: int(v * strength))
    return Image.composite(stain, img, mask)


def speckle(img, seed, count=4000, color=(60, 45, 30), alpha=90):
    rnd = random.Random(seed)
    over = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    for _ in range(count):
        x, y = rnd.randrange(img.width), rnd.randrange(img.height)
        r = rnd.choice([0, 0, 0, 1, 1, 2])
        d.ellipse([x - r, y - r, x + r, y + r], fill=color + (rnd.randint(alpha // 3, alpha),))
    base = img.convert("RGBA")
    base.alpha_composite(over)
    return base.convert("RGB")


def draw_text_center(d, xy, text, f, fill, spacing=0):
    x, y = xy
    bbox = d.textbbox((0, 0), text, font=f)
    w = bbox[2] - bbox[0] + spacing * (len(text) - 1)
    if spacing:
        cx = x - w / 2
        for ch in text:
            cb = d.textbbox((0, 0), ch, font=f)
            d.text((cx - cb[0], y - (bbox[3] + bbox[1]) / 2), ch, font=f, fill=fill)
            cx += cb[2] - cb[0] + spacing
    else:
        d.text((x - w / 2 - bbox[0], y - (bbox[3] + bbox[1]) / 2), text, font=f, fill=fill)


def vertical_text(d, x, y, text, f, fill, step=None):
    step = step or f.size * 1.05
    for i, ch in enumerate(text):
        cb = d.textbbox((0, 0), ch, font=f)
        d.text((x - (cb[2] + cb[0]) / 2, y + i * step - cb[1]), ch, font=f, fill=fill)


def fade(img, amount):
    white = Image.new("RGB", img.size, (236, 230, 214))
    return Image.blend(img, white, amount)


# ---------------------------------------------------------------- 共通
def grass_blade():
    w, h = 64, 512
    img = Image.new("RGB", (w, h))
    px = img.load()
    rnd = random.Random(3)
    for y in range(h):
        t = 1 - y / (h - 1)  # 0=根元, 1=先端
        base = (38 + 60 * t, 62 + 90 * t, 22 + 26 * t)
        if t > 0.82:  # 先端は枯れ色
            k = (t - 0.82) / 0.18
            base = tuple(b * (1 - k) + c * k for b, c in zip(base, (150, 140, 80)))
        for x in range(w):
            stripe = 10 * math.sin(x / w * math.pi * 6 + rnd.random() * 0.3)
            px[x, y] = tuple(int(max(0, min(255, c + stripe + rnd.uniform(-6, 6)))) for c in base)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    save(img, "grass_blade.png")


# ---------------------------------------------------------------- 空間1 ツチノコ
def s01_bounty():
    W, H = 1024, 768
    img = Image.new("RGB", (W, H), (226, 220, 200))
    d = ImageDraw.Draw(img)
    # 赤い帯
    d.rectangle([0, 0, W, 200], fill=(170, 40, 32))
    draw_text_center(d, (W / 2, 104), "懸賞金", font("mincho_heavy", 150), (240, 232, 214), spacing=40)
    draw_text_center(d, (W / 2, 370), "百万円", font("mincho_heavy", 230), (28, 24, 22), spacing=18)
    # 名前の行（あとで剥がれで隠す）
    draw_text_center(d, (W / 2, 548), "ツチノコを生け捕りにした方に", font("mincho", 60), (40, 34, 30))
    draw_text_center(d, (W / 2, 640), "※ 写真のみの場合は対象外です", font("gothic", 36), (60, 50, 44))
    draw_text_center(d, (W / 2, 712), "村おこし実行委員会", font("gothic_bold", 34), (150, 40, 32))
    # 名前部分の塗装剥がれ（読めないように）
    rnd = random.Random(11)
    peel = Image.new("L", (W, H), 0)
    pd = ImageDraw.Draw(peel)
    for _ in range(110):
        cx, cy = rnd.uniform(110, 610), rnd.uniform(508, 588)
        rx, ry = rnd.uniform(20, 70), rnd.uniform(14, 40)
        pd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    peel = peel.filter(ImageFilter.GaussianBlur(3)).point(lambda v: 255 if v > 90 else 0)
    rust = Image.new("RGB", (W, H), (120, 70, 40))
    rust = grime(rust, 5, 0.6, (70, 40, 25))
    img = Image.composite(rust, img, peel)
    img = fade(img, 0.28)
    img = grime(img, 7, 0.45, (120, 90, 50))
    # 縦の雨垂れ
    drip = Image.new("L", (W, H), 0)
    dd = ImageDraw.Draw(drip)
    for _ in range(60):
        x = rnd.uniform(0, W)
        dd.line([x, 0, x + rnd.uniform(-4, 4), rnd.uniform(100, H)], fill=rnd.randint(30, 90), width=rnd.randint(2, 7))
    drip = drip.filter(ImageFilter.GaussianBlur(4))
    img = Image.composite(Image.new("RGB", (W, H), (110, 85, 55)), img, drip)
    img = speckle(img, 9, 6000)
    save(img, "s01_bounty.png")


def s01_map():
    W = H = 1024
    img = Image.new("RGB", (W, H), (232, 226, 206))
    d = ImageDraw.Draw(img)
    # 等高線（ノイズの等値線）
    n = noise_layer((256, 256), 3, 21, 3).resize((W, H), Image.BICUBIC)
    npx = n.load()
    for y in range(1, H - 1, 1):
        for x in range(1, W - 1, 1):
            v = npx[x, y] // 9
            if v != npx[x + 1, y] // 9 or v != npx[x, y + 1] // 9:
                img.putpixel((x, y), (176, 140, 96))
    # 川
    pts = [(0, 300 + 40 * math.sin(i / 3)) for i in range(0)]
    river = [(x, 760 + 60 * math.sin(x / 140) + 20 * math.sin(x / 37)) for x in range(0, W + 10, 10)]
    d.line(river, fill=(90, 140, 190), width=7)
    # 林道（破線）
    road = [(140 + 0.2 * y + 50 * math.sin(y / 120), y) for y in range(0, H + 10, 8)]
    for i in range(0, len(road) - 2, 3):
        d.line([road[i], road[i + 1]], fill=(60, 50, 40), width=5)
    f = font("mincho", 34)
    d.text((250, 120), "林道 奥沢線", font=f, fill=(60, 50, 40))
    d.text((620, 840), "沢", font=font("mincho", 40), fill=(70, 110, 160))
    # 目撃地点（赤丸と日付）
    rnd = random.Random(4)
    fs = font("gothic_bold", 30)
    spots = [(330, 260, "8/3"), (420, 410, "8/9"), (300, 520, "8/12 跳ねた"), (520, 600, "8/15"), (380, 690, "8/21"),
             (610, 330, "?")]
    for x, y, t in spots:
        r = rnd.uniform(18, 26)
        for k in range(2):
            j = rnd.uniform(-3, 3)
            d.ellipse([x - r + j, y - r - j, x + r + j, y + r + j], outline=(196, 30, 28), width=4)
        d.text((x + r + 8, y - 18), t, font=fs, fill=(190, 30, 28))
    # 目撃地点を結ぶ赤い矢印
    seq = [(330, 260), (420, 410), (300, 520), (520, 600), (380, 690)]
    d.line(seq, fill=(196, 30, 28), width=3)
    d.text((620, 120), "目撃情報", font=font("mincho_heavy", 52), fill=(30, 26, 24))
    d.text((620, 186), "見かけたら役場へ", font=font("gothic", 30), fill=(30, 26, 24))
    # 折り目
    for x in (W // 3, 2 * W // 3):
        d.line([x, 0, x, H], fill=(200, 192, 170), width=3)
    d.line([0, H // 2, W, H // 2], fill=(200, 192, 170), width=3)
    img = grime(img, 13, 0.4, (150, 120, 70))
    img = speckle(img, 14, 2500)
    save(img, "s01_map.png")


def s01_sake_label():
    W, H = 256, 512
    img = Image.new("RGB", (W, H), (236, 228, 206))
    d = ImageDraw.Draw(img)
    d.rectangle([10, 10, W - 10, H - 10], outline=(150, 30, 30), width=6)
    vertical_text(d, W / 2, 40, "地酒", font("mincho_heavy", 120), (30, 26, 24))
    vertical_text(d, W / 2 + 70, 300, "奥沢", font("mincho", 44), (150, 30, 30))
    img = grime(img, 31, 0.35)
    save(img, "s01_sake_label.png")


def s01_canopy():
    """杉の樹冠の切り抜きマスク（RGBA）。白い部分が葉。"""
    W = H = 1024
    n = noise_layer((W, H), 10, 41, 5)
    n2 = noise_layer((W, H), 40, 42, 3)
    m = ImageChops.add(n.point(lambda v: v * 0.8), n2.point(lambda v: v * 0.35))
    alpha = m.point(lambda v: 255 if v > 105 else 0).filter(ImageFilter.MaxFilter(3))
    col = Image.new("RGB", (W, H), (22, 38, 20))
    col = grime(col, 43, 0.6, (40, 60, 28))
    img = col.convert("RGBA")
    img.putalpha(alpha)
    save(img, "s01_canopy.png")


def s01_snakeskin():
    W = H = 512
    img = Image.new("RGB", (W, H), (214, 204, 182))
    d = ImageDraw.Draw(img)
    rnd = random.Random(51)
    s = 26
    for row in range(-1, H // (s // 2) + 2):
        for col in range(-1, W // s + 2):
            x = col * s + (s / 2 if row % 2 else 0)
            y = row * s * 0.55
            c = rnd.randint(-14, 10)
            d.polygon([(x, y - s * 0.5), (x + s * 0.5, y), (x, y + s * 0.5), (x - s * 0.5, y)],
                      fill=(220 + c, 210 + c, 186 + c), outline=(150, 136, 110))
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    img = grime(img, 52, 0.3, (120, 100, 70))
    save(img, "s01_snakeskin.png")


def s01_rindo():
    W, H = 512, 768
    img = Image.new("RGB", (W, H), (232, 230, 222))
    d = ImageDraw.Draw(img)
    d.rectangle([14, 14, W - 14, H - 14], outline=(30, 30, 30), width=8)
    vertical_text(d, W / 2 - 70, 60, "林道", font("mincho_heavy", 150), (25, 25, 25), step=160)
    vertical_text(d, W / 2 + 95, 70, "奥沢線", font("mincho_heavy", 92), (25, 25, 25), step=100)
    draw_text_center(d, (W / 2, 470), "起 点", font("gothic_bold", 60), (25, 25, 25))
    d.rectangle([40, 540, W - 40, 640], fill=(180, 36, 30))
    draw_text_center(d, (W / 2, 590), "一般車両通行止", font("gothic_bold", 52), (245, 240, 230))
    draw_text_center(d, (W / 2, 700), "奥沢森林組合", font("gothic", 36), (40, 40, 40))
    img = fade(img, 0.15)
    img = grime(img, 61, 0.5, (90, 80, 50))
    img = speckle(img, 62, 3000)
    save(img, "s01_rindo.png")


def s01_marker():
    W, H = 256, 1024
    img = Image.new("RGB", (W, H), (120, 118, 112))
    img = grime(img, 71, 0.6, (80, 82, 70))
    img = speckle(img, 72, 9000, (40, 40, 38), 120)
    d = ImageDraw.Draw(img)
    f = font("mincho_heavy", 120)
    vertical_text(d, W / 2 + 3, 83, "此先奥沢", f, (150, 150, 144), step=200)
    vertical_text(d, W / 2, 80, "此先奥沢", f, (48, 46, 42), step=200)
    moss = noise_layer((W, H), 5, 73).point(lambda v: 255 if v > 175 else 0).filter(ImageFilter.GaussianBlur(3))
    img = Image.composite(Image.new("RGB", (W, H), (62, 80, 36)), img, moss)
    save(img, "s01_marker.png")


def s01_stripe():
    W, H = 512, 64
    img = Image.new("RGB", (W, H), (220, 180, 20))
    d = ImageDraw.Draw(img)
    for x in range(-64, W + 64, 128):
        d.polygon([(x, 0), (x + 64, 0), (x + 128, H), (x + 64, H)], fill=(25, 25, 25))
    img = grime(img, 81, 0.5, (90, 70, 40))
    save(img, "s01_stripe.png")


SPACES = {
    "00": [grass_blade],
    "01": [s01_bounty, s01_map, s01_sake_label, s01_canopy, s01_snakeskin, s01_rindo, s01_marker, s01_stripe],
}

if __name__ == "__main__":
    keys = sys.argv[1:] or list(SPACES.keys())
    for k in keys:
        for fn in SPACES[k]:
            fn()
