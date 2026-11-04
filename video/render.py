"""Рендер вертикального ролика «Перекупы» (1080x1920, 30 fps).

Стилистика: тёмный кинематографичный моушн-дизайн, HUD-подписи сверху,
крупные субтитры по словам снизу, оранжево-жёлтые акценты.

Запуск:  python3 render.py <build_dir>
(в build_dir/vo должны лежать mp3 и timing.json из tts.py)
"""
import json, math, os, random, subprocess, sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
LEAD = 0.25          # пауза перед репликой в сцене
TAIL = 0.30          # пауза после реплики

BG = (7, 9, 13)
PANEL = (17, 22, 32)
PANEL2 = (25, 32, 46)
LINE = (44, 54, 72)
ORANGE = (255, 122, 26)
YELLOW = (255, 210, 31)
GREEN = (46, 232, 122)
RED = (255, 59, 59)
WHITE = (240, 242, 246)
GREY = (120, 130, 150)
DIM = (70, 78, 96)


# ---------------------------------------------------------------- fonts
_font_cache = {}


def font(kind, size, weight=700):
    key = (kind, size, weight)
    if key in _font_cache:
        return _font_cache[key]
    p = {"cap": "Oswald-VF.ttf", "mono": "JetBrainsMono-VF.ttf", "logo": "RussoOne-Regular.ttf"}[kind]
    f = ImageFont.truetype(os.path.join(HERE, "assets/fonts", p), size)
    if kind != "logo":
        f.set_variation_by_axes([weight])
    _font_cache[key] = f
    return f


# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    x = clamp(x)
    return 3 * x * x - 2 * x * x * x


def back_out(x, s=1.9):
    x = clamp(x) - 1
    return x * x * ((s + 1) * x + s) + 1


def prog(t, start, dur):
    return clamp((t - start) / dur)


def lerp(a, b, k):
    return a + (b - a) * k


def mix(c1, c2, k):
    return tuple(int(lerp(a, b, k)) for a, b in zip(c1, c2))


def alpha(c, a):
    return (*c[:3], int(255 * clamp(a)))


# ---------------------------------------------------------------- assets
_char = None


def character():
    """Вырезаем персонажа (смайл в очках) из обложки с мягкими краями."""
    global _char
    if _char is None:
        src = Image.open(os.path.join(HERE, "assets/character.png")).convert("RGB")
        s = src.width / 1254
        box = tuple(int(v * s) for v in (180, 150, 1100, 890))
        crop = src.crop(box)
        mask = Image.new("L", crop.size, 0)
        md = ImageDraw.Draw(mask)
        w, h = crop.size
        md.ellipse((w * 0.06, h * 0.04, w * 0.94, h * 1.02), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(w * 0.05))
        crop.putalpha(mask)
        _char = crop
    return _char


_vignette = None


def vignette():
    global _vignette
    if _vignette is None:
        yy, xx = np.mgrid[0:H, 0:W]
        d = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.58)) ** 2)
        a = np.clip((d - 0.55) * 1.4, 0, 1) ** 1.6 * 235
        arr = np.zeros((H, W, 4), np.uint8)
        arr[..., 3] = a.astype(np.uint8)
        # лёгкие сканлайны
        arr[::4, :, 3] = np.maximum(arr[::4, :, 3], 18)
        # затемнение низа под субтитры
        grad = np.clip((yy - H * 0.70) / (H * 0.30), 0, 1) * 150
        arr[..., 3] = np.maximum(arr[..., 3], grad.astype(np.uint8))
        _vignette = Image.fromarray(arr, "RGBA")
    return _vignette


# ---------------------------------------------------------------- primitives
def rrect(d, box, r, fill=None, outline=None, width=2):
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


def text_c(d, xy, s, f, fill, anchor="mm", **kw):
    d.text(xy, s, font=f, fill=fill, anchor=anchor, **kw)


def glow(img, box_or_xy, radius, color, strength=1.0):
    """Мягкое цветное свечение (круг) поверх кадра."""
    x, y = box_or_xy
    r = int(radius)
    g = Image.new("RGBA", (r * 2, r * 2), (0, 0, 0, 0))
    gd = ImageDraw.Draw(g)
    gd.ellipse((r * 0.25, r * 0.25, r * 1.75, r * 1.75), fill=alpha(color, 0.55 * strength))
    g = g.filter(ImageFilter.GaussianBlur(r * 0.32))
    img.alpha_composite(g, (int(x - r), int(y - r)))


def bg_base(t, tint=(18, 26, 40), cx=0.5, cy=0.42):
    img = Image.new("RGBA", (W, H), BG + (255,))
    glow(img, (W * cx, H * cy), 900, tint, 1.0)
    return img


def grid_floor(d, t, color=(30, 40, 58)):
    """Перспективная сетка внизу — «пол» киберпространства."""
    hz = 1180
    for i in range(-12, 13):
        x0 = W / 2 + i * 40
        x1 = W / 2 + i * 260
        d.line((x0, hz, x1, H), fill=color, width=1)
    off = (t * 0.6) % 1
    for j in range(12):
        k = (j + off) / 12
        y = hz + (H - hz) * k ** 2.2
        d.line((0, y, W, y), fill=color, width=1)


def check(d, cx, cy, s, color, width=8, k=1.0):
    pts = [(cx - s * 0.5, cy), (cx - s * 0.15, cy + s * 0.35), (cx + s * 0.55, cy - s * 0.4)]
    if k <= 0:
        return
    seg1 = clamp(k / 0.4)
    p1 = (lerp(pts[0][0], pts[1][0], seg1), lerp(pts[0][1], pts[1][1], seg1))
    d.line([pts[0], p1], fill=color, width=width, joint="curve")
    if k > 0.4:
        seg2 = clamp((k - 0.4) / 0.6)
        p2 = (lerp(pts[1][0], pts[2][0], seg2), lerp(pts[1][1], pts[2][1], seg2))
        d.line([pts[1], p2], fill=color, width=width, joint="curve")


def cross(d, cx, cy, s, color, width=7):
    d.line((cx - s, cy - s, cx + s, cy + s), fill=color, width=width)
    d.line((cx - s, cy + s, cx + s, cy - s), fill=color, width=width)


def icon(d, kind, cx, cy, s, color):
    """Простые векторные иконки товаров."""
    if kind == "phone":
        rrect(d, (cx - s * 0.32, cy - s * 0.55, cx + s * 0.32, cy + s * 0.55), s * 0.09, outline=color, width=4)
        d.ellipse((cx - s * 0.2, cy - s * 0.45, cx - s * 0.02, cy - s * 0.27), outline=color, width=3)
        d.ellipse((cx + s * 0.0, cy - s * 0.45, cx + s * 0.18, cy - s * 0.27), outline=color, width=3)
    elif kind == "car":
        d.rounded_rectangle((cx - s * 0.6, cy - s * 0.05, cx + s * 0.6, cy + s * 0.3), s * 0.1, outline=color, width=4)
        d.polygon([(cx - s * 0.35, cy - s * 0.05), (cx - s * 0.2, cy - s * 0.32), (cx + s * 0.25, cy - s * 0.32),
                   (cx + s * 0.4, cy - s * 0.05)], outline=color, width=4)
        for ox in (-0.33, 0.33):
            d.ellipse((cx + s * ox - s * 0.12, cy + s * 0.2, cx + s * ox + s * 0.12, cy + s * 0.44), fill=PANEL2, outline=color, width=4)
    elif kind == "tool":
        d.line((cx - s * 0.4, cy + s * 0.4, cx + s * 0.15, cy - s * 0.15), fill=color, width=10)
        d.ellipse((cx + s * 0.02, cy - s * 0.5, cx + s * 0.5, cy - s * 0.02), outline=color, width=6)
        d.rectangle((cx + s * 0.2, cy - s * 0.52, cx + s * 0.34, cy - s * 0.3), fill=PANEL2)
    elif kind == "tv":
        rrect(d, (cx - s * 0.6, cy - s * 0.38, cx + s * 0.6, cy + s * 0.3), 8, outline=color, width=4)
        d.line((cx - s * 0.2, cy + s * 0.45, cx + s * 0.2, cy + s * 0.45), fill=color, width=4)
    elif kind == "console":
        rrect(d, (cx - s * 0.55, cy - s * 0.22, cx + s * 0.55, cy + s * 0.3), s * 0.2, outline=color, width=4)
        d.line((cx - s * 0.35, cy + s * 0.04, cx - s * 0.15, cy + s * 0.04), fill=color, width=4)
        d.line((cx - s * 0.25, cy - s * 0.06, cx - s * 0.25, cy + s * 0.14), fill=color, width=4)
        d.ellipse((cx + s * 0.18, cy - s * 0.04, cx + s * 0.3, cy + s * 0.08), fill=color)


def fmt_rub(v):
    return f"{int(v):,}".replace(",", " ") + " ₽"


def listing_card(d, x, y, w, h, item, accent=None, dim=0.0):
    """Карточка объявления (без чужих логотипов)."""
    col = mix(WHITE, DIM, dim)
    rrect(d, (x, y, x + w, y + h), 18, fill=mix(PANEL, BG, dim * 0.6), outline=accent or LINE, width=3 if accent else 2)
    th = h - 28
    rrect(d, (x + 14, y + 14, x + 14 + th, y + 14 + th), 12, fill=mix(PANEL2, BG, dim * 0.5))
    icon(d, item["icon"], x + 14 + th / 2, y + 14 + th / 2, th * 0.7, mix(GREY, DIM, dim))
    tx = x + th + 36
    d.text((tx, y + 20), item["title"], font=font("cap", int(h * 0.2), 600), fill=col)
    d.text((tx, y + 20 + h * 0.3), fmt_rub(item["price"]), font=font("cap", int(h * 0.26), 700),
           fill=mix(accent or WHITE, DIM, dim))
    d.text((tx, y + h - 18), item["city"], font=font("mono", int(h * 0.13), 500), fill=mix(GREY, DIM, dim), anchor="ls")


ITEMS = [
    {"icon": "phone", "title": "iPhone 14 Pro 256", "price": 61000, "city": "Москва · 2 мин"},
    {"icon": "car", "title": "Kia Rio 2017", "price": 820000, "city": "Казань · 5 мин"},
    {"icon": "tool", "title": "Перфоратор Makita", "price": 6500, "city": "Самара · 1 мин"},
    {"icon": "console", "title": "PlayStation 5", "price": 39000, "city": "Екатеринбург · 8 мин"},
    {"icon": "tv", "title": "Телевизор 4K 55\"", "price": 28000, "city": "Новосибирск · 3 мин"},
    {"icon": "phone", "title": "Samsung S23", "price": 37000, "city": "Краснодар · 4 мин"},
    {"icon": "tool", "title": "Шуруповёрт DeWalt", "price": 7900, "city": "Пермь · 6 мин"},
    {"icon": "phone", "title": "iPhone 13", "price": 33000, "city": "Ростов · 9 мин"},
    {"icon": "car", "title": "VW Polo 2016", "price": 760000, "city": "Уфа · 12 мин"},
    {"icon": "console", "title": "Xbox Series X", "price": 34000, "city": "Омск · 7 мин"},
]


def phone_frame(img, cx, cy, w, h, screen_fill=(12, 15, 22)):
    d = ImageDraw.Draw(img)
    x0, y0 = cx - w / 2, cy - h / 2
    shadow = Image.new("RGBA", (int(w + 160), int(h + 160)), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((80, 100, w + 80, h + 80), 70, fill=(0, 0, 0, 200))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(30)), (int(x0 - 80), int(y0 - 80)))
    rrect(d, (x0, y0, x0 + w, y0 + h), 70, fill=(30, 33, 40), outline=(80, 86, 100), width=4)
    rrect(d, (x0 + 14, y0 + 14, x0 + w - 14, y0 + h - 14), 58, fill=screen_fill)
    rrect(d, (cx - 70, y0 + 32, cx + 70, y0 + 68), 18, fill=(0, 0, 0))
    return (x0 + 14, y0 + 14, x0 + w - 14, y0 + h - 14)


# ---------------------------------------------------------------- Russia dot map
RU_OUTLINE = [(28, 60), (30, 69.5), (40, 67), (44, 68.5), (55, 68.5), (60, 69.5), (68, 72.5), (73, 72), (80, 73.5),
              (87, 75), (100, 77.5), (113, 73.7), (128, 73), (140, 72.5), (150, 71.5), (160, 69.7), (170, 70),
              (180, 68.5), (180, 65), (177, 62.5), (163, 60), (160, 54), (156, 51), (155, 57), (142, 59.3),
              (137, 54), (141, 52), (131, 43), (127, 49.5), (120, 53.3), (108, 49.5), (97, 50), (87, 49.2),
              (80, 51), (68, 54.5), (61, 51), (55, 51), (48, 47), (47, 42), (40, 43.5), (37, 46.5), (38, 47.5),
              (40, 49.5), (35, 52), (31, 56), (28, 56.5)]
CITIES = [("Москва", 37.6, 55.75), ("Санкт-Петербург", 30.3, 59.9), ("Казань", 49.1, 55.8), ("Екатеринбург", 60.6, 56.8),
          ("Новосибирск", 82.9, 55.0), ("Краснодар", 39.0, 45.0), ("Ростов", 39.7, 47.2), ("Самара", 50.1, 53.2),
          ("Уфа", 56.0, 54.7), ("Омск", 73.4, 55.0), ("Красноярск", 92.9, 56.0), ("Иркутск", 104.3, 52.3),
          ("Хабаровск", 135.0, 48.5), ("Владивосток", 131.9, 43.1), ("Якутск", 129.7, 62.0), ("Мурманск", 33.0, 68.9),
          ("Пермь", 56.2, 58.0), ("Тюмень", 65.5, 57.1)]


def ru_proj(lon, lat, ox=40, oy=520, k=6.4):
    return ox + (lon - 25) * k, oy + (79 - lat) * k * 1.55


def _pip(x, y, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside = not inside
        j = i
    return inside


_ru_dots = None


def ru_dots():
    global _ru_dots
    if _ru_dots is None:
        poly = [ru_proj(*p) for p in RU_OUTLINE]
        pts = []
        for y in range(400, 1000, 13):
            for x in range(20, 1080, 13):
                if _pip(x, y, poly):
                    pts.append((x, y))
        _ru_dots = pts
    return _ru_dots


# ================================================================ scenes
def sc_hook(img, t, D, sc):
    d = ImageDraw.Draw(img)
    grid_floor(d, t)
    k = ease_out(prog(t, 0, 0.7))
    cy = lerp(1500, 860, k)
    scr = phone_frame(img, W / 2, cy, 560, 1080)
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = scr
    # «фото» товара
    rrect(d, (x0 + 30, y0 + 90, x1 - 30, y0 + 520), 30, fill=PANEL2)
    glow(img, ((x0 + x1) / 2, y0 + 300), 220, (90, 110, 160), 0.7)
    d = ImageDraw.Draw(img)
    icon(d, "phone", (x0 + x1) / 2, y0 + 305, 300, (200, 206, 220))
    d.text((x0 + 40, y0 + 560), "iPhone 15 Pro, 256 ГБ", font=font("cap", 46, 600), fill=WHITE)
    d.text((x0 + 40, y0 + 625), "Состояние идеал · срочно", font=font("mono", 24, 500), fill=GREY)
    # цена падает
    pk = ease_in_out(prog(t, 1.2, 1.6))
    price = lerp(95000, 48000, pk)
    pcol = mix(WHITE, YELLOW, pk)
    d.text((x0 + 40, y0 + 680), fmt_rub(round(price / 100) * 100), font=font("cap", 92, 700), fill=pcol)
    d.text((x0 + 40, y0 + 810), "рынок: 95 000 ₽", font=font("mono", 30, 500), fill=GREY)
    if pk > 0.9:
        d.line((x0 + 150, y0 + 830, x0 + 330, y0 + 830), fill=RED, width=4)
    rrect(d, (x0 + 40, y1 - 120, x1 - 40, y1 - 40), 24, fill=(30, 140, 80))
    text_c(d, ((x0 + x1) / 2, y1 - 80), "Позвонить", font("cap", 40, 600), WHITE)
    # штамп -49%
    sk = prog(t, 3.0, 0.35)
    if sk > 0:
        s = lerp(2.2, 1.0, back_out(sk))
        stamp = Image.new("RGBA", (420, 200), (0, 0, 0, 0))
        sd = ImageDraw.Draw(stamp)
        rrect(sd, (10, 10, 410, 190), 26, outline=GREEN, width=10)
        text_c(sd, (210, 100), "−49%", font("cap", 130, 700), GREEN)
        stamp = stamp.resize((int(420 * s), int(200 * s))).rotate(-12, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(stamp, (int(W * 0.66 - stamp.width / 2), int(cy - 470 - stamp.height / 2)))


def sc_grind(img, t, D, sc):
    d = ImageDraw.Draw(img)
    # бесконечная лента объявлений
    speed = 900 + 1400 * ease_in_out(t / D)
    off = (t * speed) % 190
    for i in range(-1, 12):
        y = 230 + i * 190 - off
        it = ITEMS[(i + int(t * speed / 190)) % len(ITEMS)]
        listing_card(d, 90, y, 900, 160, it, dim=0.55)
    # затемнение + таймер
    ov = Image.new("RGBA", (W, H), (5, 6, 9, 150))
    img.alpha_composite(ov)
    d = ImageDraw.Draw(img)
    hours = lerp(0, 6 * 3600 + 47 * 60, ease_in_out(prog(t, 0.2, D - 0.6)))
    hh, mm, ss = int(hours // 3600), int(hours % 3600 // 60), int(hours % 60)
    rrect(d, (150, 640, 930, 900), 22, fill=(14, 6, 6), outline=(90, 20, 20), width=3)
    glow(img, (540, 770), 380, RED, 0.35)
    d = ImageDraw.Draw(img)
    text_c(d, (540, 770), f"{hh:02d}:{mm:02d}:{ss:02d}", font("mono", 150, 800), RED)
    text_c(d, (540, 940), "В ПОИСКЕ ВРУЧНУЮ", font("mono", 34, 600), (200, 90, 90))
    n = int(lerp(0, 540, ease_in_out(prog(t, 0.5, D - 0.8))))
    text_c(d, (540, 1010), f"ПРОСМОТРЕНО: {n} ОБЪЯВЛЕНИЙ · НАЙДЕНО: 0", font("mono", 26, 500), GREY)
    # кнопка «обновить» мигает
    if int(t * 4) % 2 == 0:
        text_c(d, (540, 1090), "ОБНОВИТЬ СТРАНИЦУ...", font("mono", 30, 700), ORANGE)


def draw_logo(img, cx, cy, scale=1.0, sweep=None, crown=True):
    f = font("logo", int(150 * scale))
    d = ImageDraw.Draw(img)
    txt = "ПЕРЕКУПЫ"
    bb = d.textbbox((0, 0), txt, font=f)
    tw = bb[2] - bb[0]
    # мазок-подчёркивание
    uy = cy + 95 * scale
    pts = [(cx - tw * 0.48, uy + 8 * scale), (cx - tw * 0.1, uy - 6 * scale), (cx + tw * 0.3, uy - 14 * scale),
           (cx + tw * 0.48, uy - 22 * scale)]
    d.line(pts, fill=YELLOW, width=int(14 * scale), joint="curve")
    d.text((cx + 6, cy + 8), txt, font=f, fill=(0, 0, 0), anchor="mm")
    d.text((cx, cy), txt, font=f, fill=WHITE, anchor="mm")
    if crown:
        x, y, s = cx + tw * 0.44, cy - 110 * scale, 34 * scale
        d.line([(x - s, y + s * 0.6), (x - s, y - s * 0.4), (x - s * 0.4, y + s * 0.1), (x, y - s * 0.6),
                (x + s * 0.4, y + s * 0.1), (x + s, y - s * 0.4), (x + s, y + s * 0.6), (x - s, y + s * 0.6)],
               fill=YELLOW, width=int(7 * scale), joint="curve")
    if sweep is not None and 0 <= sweep <= 1:
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sx = lerp(cx - tw * 0.7, cx + tw * 0.7, sweep)
        sd.polygon([(sx - 30, cy - 120), (sx + 40, cy - 120), (sx - 10, cy + 120), (sx - 80, cy + 120)], fill=(255, 255, 255, 120))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))


def paste_char(img, cx, cy, width, rot=0.0, a=1.0):
    ch = character()
    s = width / ch.width
    c = ch.resize((int(ch.width * s), int(ch.height * s)), Image.LANCZOS)
    if rot:
        c = c.rotate(rot, expand=True, resample=Image.BICUBIC)
    if a < 1:
        c.putalpha(c.getchannel("A").point(lambda v: int(v * a)))
    img.alpha_composite(c, (int(cx - c.width / 2), int(cy - c.height / 2)))


def sc_reveal(img, t, D, sc):
    glow(img, (540, 700), 700, ORANGE, 0.35 + 0.1 * math.sin(t * 3))
    glow(img, (540, 700), 420, YELLOW, 0.25)
    d = ImageDraw.Draw(img)
    # лучи
    for i in range(18):
        a = i / 18 * math.tau + t * 0.25
        d.line((540, 700, 540 + math.cos(a) * 1200, 700 + math.sin(a) * 1200), fill=(40, 30, 14), width=18)
    k = prog(t, 0.9, 0.6)
    if k > 0:
        s = back_out(k)
        paste_char(img, 540, 720, 820 * s, rot=math.sin(t * 2) * 2)
    lk = prog(t, 2.0, 0.4)
    if lk > 0:
        draw_logo(img, 540, lerp(1380, 1270, ease_out(lk)), lerp(0.6, 0.95, back_out(lk)), sweep=prog(t, 2.6, 0.8))
    # вспышка
    fk = prog(t, 0.9, 0.35)
    if 0 < fk < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (255, 230, 160, int(160 * (1 - fk)))))
    if t < 0.9:
        d = ImageDraw.Draw(img)
        text_c(d, (540, 700), "███" if int(t * 10) % 2 else "▒▒▒", font("mono", 60), DIM)


def sc_scan(img, t, D, sc):
    d = ImageDraw.Draw(img)
    sx = lerp(-60, 1140, ease_in_out(prog(t, 0.3, D * 0.55)))
    for (x, y) in ru_dots():
        lit = x < sx
        c = (40, 70, 110) if lit else (28, 36, 52)
        d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=c)
    # линия сканирования
    band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for i in range(40):
        bd.line((sx - i * 3, 380, sx - i * 3, 1020), fill=alpha(ORANGE, 0.25 * (1 - i / 40)), width=3)
    bd.line((sx, 360, sx, 1040), fill=alpha(YELLOW, 0.9), width=4)
    img.alpha_composite(band)
    d = ImageDraw.Draw(img)
    for i, (name, lon, lat) in enumerate(CITIES):
        x, y = ru_proj(lon, lat)
        if x < sx:
            age = t - (0.3 + D * 0.55 * ((x + 60) / 1200))
            pulse = (age * 1.2) % 1
            r = 8 + 40 * pulse
            d.ellipse((x - r, y - r, x + r, y + r), outline=alpha(ORANGE, 1 - pulse), width=3)
            d.ellipse((x - 8, y - 8, x + 8, y + 8), fill=YELLOW)
            if name in ("Москва", "Новосибирск", "Владивосток", "Екатеринбург", "Краснодар", "Якутск"):
                d.text((x + 14, y - 14), name.upper(), font=font("mono", 22, 600), fill=WHITE, anchor="ls")
    n = int(lerp(0, 1_284_391, ease_in_out(prog(t, 0.3, D * 0.8))))
    text_c(d, (540, 300), f"{n:,}".replace(",", " "), font("mono", 96, 800), WHITE)
    text_c(d, (540, 370), "ОБЪЯВЛЕНИЙ ПРОВЕРЕНО СЕГОДНЯ", font("mono", 28, 600), GREY)
    # категории
    cats = [("phone", "ТЕЛЕФОНЫ"), ("car", "МАШИНЫ"), ("tool", "ИНСТРУМЕНТЫ"), ("tv", "ТЕХНИКА")]
    wt = {w["w"].lower(): w["s"] for w in sc["words"]}
    starts = [wt.get("телефоны", D * 0.6), wt.get("машины", D * 0.68), wt.get("инструменты", D * 0.75), wt.get("техника", D * 0.83)]
    for i, ((ic, name), st) in enumerate(zip(cats, starts)):
        k = prog(t, st + LEAD - 0.1, 0.3)
        if k <= 0:
            continue
        col, row = i % 2, i // 2
        x = 90 + col * 460
        y = 1100 + row * 150 + (1 - back_out(k)) * 60
        rrect(d, (x, y, x + 440, y + 125), 24, fill=PANEL, outline=ORANGE, width=3)
        icon(d, ic, x + 70, y + 62, 80, ORANGE)
        d.text((x + 135, y + 62), name, font=font("cap", 44, 700), fill=WHITE, anchor="lm")


def sc_filter(img, t, D, sc):
    d = ImageDraw.Draw(img)
    items = ITEMS[:6]
    best = 2
    for i, it in enumerate(items):
        y = 260 + i * 170
        k = prog(t, 0.6 + i * 0.12, 0.3)
        if i == best:
            continue
        dim = ease_out(k)
        x = 90 + (ease_in_out(prog(t, 2.0, 0.6)) * (-1200 if i % 2 else 1200))
        listing_card(d, x, y, 900, 150, it, dim=dim)
        if k > 0:
            cross(d, x + 850, y + 75, 22 * ease_out(k), RED)
    y = 260 + best * 170
    bk = ease_in_out(prog(t, 2.0, 0.7))
    by = lerp(y, 620, bk)
    s = lerp(1.0, 1.15, bk)
    if bk > 0.2:
        glow(img, (540, by + 80), 520, GREEN, 0.45 * bk)
        d = ImageDraw.Draw(img)
    it = dict(ITEMS[0], price=38000, title="iPhone 14 Pro 256", city="Казань · 1 мин")
    cw, ch = 900 * s, 150 * s
    listing_card(d, 540 - cw / 2, by, cw, ch, it, accent=GREEN if t > 0.6 else None)
    if bk > 0.5:
        k2 = back_out(prog(t, 2.5, 0.4))
        rrect(d, (540 - 240 * k2, by + ch + 40, 540 + 240 * k2, by + ch + 160), 24, fill=(14, 60, 36))
        if k2 > 0.5:
            text_c(d, (540, by + ch + 100), "ВЫГОДА −38%", font("cap", 64, 700), GREEN)
        text_c(d, (540, by + ch + 220), "рынок 61 000 ₽ / цена 38 000 ₽", font("mono", 30, 500), GREY)


def notif_card(img, x, y, w, k):
    d = ImageDraw.Draw(img)
    h = 250
    rrect(d, (x, y, x + w, y + h), 34, fill=(36, 40, 52), outline=(70, 76, 92), width=2)
    rrect(d, (x + 26, y + 26, x + 96, y + 96), 18, fill=YELLOW)
    text_c(d, (x + 61, y + 63), "П", font("logo", 44), (20, 20, 20))
    d.text((x + 116, y + 40), "ПЕРЕКУПЫ · AI", font=font("mono", 26, 700), fill=WHITE)
    d.text((x + w - 30, y + 40), "сейчас", font=font("mono", 24, 500), fill=GREY, anchor="ra")
    d.text((x + 116, y + 80), "Найдено: iPhone 14 Pro", font=font("cap", 40, 600), fill=WHITE)
    d.text((x + 30, y + 140), "41 000 ₽", font=font("cap", 58, 700), fill=YELLOW)
    d.text((x + 260, y + 160), "рынок 62 000 ₽ · Казань", font=font("mono", 26, 500), fill=GREY)
    rrect(d, (x + 30, y + h - 8 - 0, x + w - 30, y + h - 2), 3, fill=GREEN)


def sc_notify(img, t, D, sc):
    scr = phone_frame(img, W / 2, 860, 600, 1120, screen_fill=(10, 12, 18))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = scr
    text_c(d, ((x0 + x1) / 2, y0 + 130), "МОИ ГОРОДА", font("mono", 32, 700), GREY)
    cities = ["Москва", "Казань", "Екатеринбург", "Краснодар", "Новосибирск", "Самара"]
    on = {0, 1, 2, 4}
    for i, c in enumerate(cities):
        y = y0 + 190 + i * 104
        rrect(d, (x0 + 40, y, x1 - 40, y + 86), 20, fill=PANEL)
        d.text((x0 + 70, y + 43), c, font=font("cap", 40, 600), fill=WHITE, anchor="lm")
        k = prog(t, 0.4 + i * 0.22, 0.25)
        bx = x1 - 140
        active = i in on and k > 0
        rrect(d, (bx, y + 22, bx + 80, y + 64), 21, fill=GREEN if active else (50, 56, 70))
        kx = lerp(bx + 21, bx + 59, ease_out(k) if i in on else 0)
        d.ellipse((kx - 17, y + 26, kx + 17, y + 60), fill=WHITE)
    # уведомление
    nk = prog(t, 2.6, 0.45)
    if nk > 0:
        ny = lerp(-300, 230, back_out(nk, 1.2))
        notif_card(img, 60, ny, 960, nk)
        d = ImageDraw.Draw(img)
        if t > 3.2:
            # «ссылка» — палец/тап
            tk = prog(t, 4.6, 0.5)
            if tk > 0:
                r = 30 + 60 * tk
                d.ellipse((800 - r, ny + 160 - r, 800 + r, ny + 160 + r), outline=alpha(WHITE, 1 - tk), width=5)
            rrect(d, (700, ny + 270, 1000, ny + 340), 20, fill=ORANGE)
            text_c(d, (850, ny + 305), "ОТКРЫТЬ", font("cap", 36, 700), (20, 14, 8))


def sc_deal(img, t, D, sc):
    d = ImageDraw.Draw(img)
    steps = ["ОТКРЫЛ", "ПОЗВОНИЛ", "ПРИЕХАЛ", "ЗАБРАЛ", "ПЕРЕПРОДАЛ"]
    words = [w for w in sc["words"]]
    wt = {}
    for w in words:
        wt.setdefault(w["w"].upper(), w["s"])
    ys = [300 + i * 150 for i in range(5)]
    # линия-таймлайн
    last = 0
    for i, s in enumerate(steps):
        st = wt.get(s, 0.5 + i * 0.6) + LEAD
        k = prog(t, st - 0.05, 0.3)
        if k > 0:
            last = i
        y = ys[i]
        if i < 4:
            lk = prog(t, st + 0.1, 0.4)
            d.line((200, y + 45, 200, lerp(y + 45, ys[i + 1] - 45, lk)), fill=ORANGE if lk > 0 else LINE, width=6)
        done = k > 0
        d.ellipse((155, y - 45, 245, y + 45), fill=(30, 18, 8) if done else PANEL, outline=ORANGE if done else LINE, width=5)
        if done:
            check(d, 200, y, 44, ORANGE, 8, ease_out(prog(t, st, 0.3)))
            x = 300 + (1 - ease_out(k)) * 80
            d.text((x, y), s, font=font("cap", 80, 700), fill=mix(BG, WHITE, k), anchor="lm")
        else:
            text_c(d, (200, y), str(i + 1), font("mono", 40, 700), DIM)
    # прибыль
    st = wt.get("РАЗНИЦА", D * 0.62) + LEAD
    pk = prog(t, st - 0.2, 1.2)
    if pk > 0:
        glow(img, (540, 1180), 520, GREEN, 0.5 * pk)
        d = ImageDraw.Draw(img)
        val = int(lerp(0, 21000, ease_out(pk)) / 100) * 100
        s = back_out(prog(t, st - 0.2, 0.4))
        f = font("cap", int(170 * s) + 1, 700)
        text_c(d, (540, 1180), "+" + fmt_rub(val), f, GREEN)
        text_c(d, (540, 1300), "купил 41 000 / продал 62 000", font("mono", 30, 500), GREY)


def sc_course(img, t, D, sc):
    d = ImageDraw.Draw(img)
    rrect(d, (80, 220, 1000, 1360), 36, fill=PANEL, outline=LINE, width=2)
    d.text((130, 270), "ОБУЧЕНИЕ «ПЕРЕКУП С НУЛЯ»", font=font("mono", 30, 700), fill=ORANGE)
    d.text((130, 320), "от А до Я", font=font("cap", 72, 700), fill=WHITE)
    mods = ["Как искать товар и не терять время", "Как проверить товар перед покупкой", "Торг: как сбить цену",
            "Как продавать дороже и быстрее", "Риски, мошенники и как их обойти", "Масштаб: от 1 сделки к потоку"]
    for i, m in enumerate(mods):
        y = 460 + i * 130
        k = prog(t, 0.3 + i * 0.45, 0.35)
        if k <= 0:
            continue
        x = 130 + (1 - ease_out(k)) * 60
        a = ease_out(k)
        rrect(d, (x, y, x + 820, y + 108), 20, fill=mix(PANEL, PANEL2, a))
        d.text((x + 30, y + 54), f"{i + 1:02d}", font=font("mono", 36, 800), fill=mix(PANEL, ORANGE, a), anchor="lm")
        d.text((x + 110, y + 54), m, font=font("cap", 38, 500), fill=mix(PANEL, WHITE, a), anchor="lm")
        ck = prog(t, 1.0 + i * 0.6, 0.3)
        if ck > 0:
            d.ellipse((x + 740, y + 28, x + 792, y + 80), fill=(14, 60, 36))
            check(d, x + 766, y + 54, 24, GREEN, 5, ck)
    pk = ease_in_out(prog(t, 0.5, D - 1.0))
    rrect(d, (130, 1265, 950, 1295), 15, fill=PANEL2)
    rrect(d, (130, 1265, 130 + 820 * max(pk, 0.04), 1295), 15, fill=ORANGE)
    d.text((950, 1240), f"{int(pk * 100)}%", font=font("mono", 28, 700), fill=WHITE, anchor="rs")


def sc_price(img, t, D, sc):
    glow(img, (540, 820), 700, YELLOW, 0.3)
    d = ImageDraw.Draw(img)
    k = back_out(prog(t, 0.1, 0.5), 1.2)
    w, h = 860 * k, 980 * k
    if k <= 0.05:
        return
    x0, y0 = 540 - w / 2, 820 - h / 2
    rrect(d, (x0, y0, x0 + w, y0 + h), 44, fill=PANEL, outline=YELLOW, width=5)
    if k < 0.9:
        return
    text_c(d, (540, y0 + 90), "ПОДПИСКА «ПЕРЕКУПЫ»", font("mono", 32, 700), ORANGE)
    rows = [("🤖", "Нейросеть: поиск по всей России"), ("", "Уведомления о выгодных сделках"), ("", "Полное обучение от А до Я")]
    for i, (_, r) in enumerate(rows):
        rk = prog(t, 0.6 + i * 0.25, 0.3)
        if rk <= 0:
            continue
        y = y0 + 180 + i * 90
        d.ellipse((x0 + 70, y - 4, x0 + 118, y + 44), fill=(14, 60, 36))
        check(d, x0 + 94, y + 20, 22, GREEN, 5, rk)
        d.text((x0 + 140, y + 20), r, font=font("cap", 40, 500), fill=WHITE, anchor="lm")
    wt = {w["w"].lower(): w["s"] for w in sc["words"]}
    st = wt.get("первый", D * 0.45) + LEAD
    pk = prog(t, st, 0.5)
    if pk > 0:
        val = int(lerp(4000, 2000, ease_out(prog(t, st + 0.2, 1.0))))
        s = back_out(pk)
        text_c(d, (540, y0 + 600), f"{val:,}".replace(",", " ") + " ₽", font("cap", int(220 * s) + 1, 700), YELLOW)
        text_c(d, (540, y0 + 740), "ПЕРВЫЙ МЕСЯЦ", font("cap", 52, 700), WHITE)
        text_c(d, (540, y0 + 820), "далее 4 000 ₽ / мес", font("mono", 32, 500), GREY)


def sc_value(img, t, D, sc):
    d = ImageDraw.Draw(img)
    cx, cy = 540, 640
    tilt = lerp(0, 16, ease_in_out(prog(t, 0.8, 1.4))) + math.sin(t * 5) * 1.5 * (1 - prog(t, 0.8, 2))
    a = math.radians(tilt)
    L = 320
    lx, ly = cx - L * math.cos(a), cy - L * math.sin(a)
    rx, ry = cx + L * math.cos(a), cy + L * math.sin(a)
    d.polygon([(cx, cy - 10), (cx - 80, 1200), (cx + 80, 1200)], fill=(70, 56, 24))
    rrect(d, (cx - 220, 1190, cx + 220, 1230), 18, fill=(110, 86, 30))
    d.line((lx, ly, rx, ry), fill=(214, 168, 64), width=16)
    d.ellipse((cx - 24, cy - 24, cx + 24, cy + 24), fill=(214, 168, 64))
    for (px, py, label, val, col) in ((lx, ly, "ПОДПИСКА", "2 000 ₽", YELLOW), (rx, ry, "1 СДЕЛКА", "+21 000 ₽", GREEN)):
        d.line((px, py, px - 140, py + 240), fill=(150, 120, 50), width=4)
        d.line((px, py, px + 140, py + 240), fill=(150, 120, 50), width=4)
        d.chord((px - 180, py + 160, px + 180, py + 320), 0, 180, fill=(214, 168, 64))
        text_c(d, (px, py + 130), val, font("cap", 84, 700), col)
        text_c(d, (px, py + 370), label, font("mono", 38, 800), WHITE)


def sc_cta(img, t, D, sc):
    glow(img, (540, 640), 650, ORANGE, 0.35)
    d = ImageDraw.Draw(img)
    for i in range(14):
        a = i / 14 * math.tau - t * 0.3
        d.line((540, 640, 540 + math.cos(a) * 1200, 640 + math.sin(a) * 1200), fill=(36, 26, 12), width=22)
    k = back_out(prog(t, 0.0, 0.5))
    paste_char(img, 540, 650 + math.sin(t * 2.2) * 10, 760 * max(k, 0.01), rot=math.sin(t * 1.7) * 3)
    draw_logo(img, 540, 1130, 0.9, sweep=(t * 0.6) % 1.6)
    d = ImageDraw.Draw(img)
    bk = prog(t, 1.2, 0.4)
    if bk > 0:
        p = 1 + 0.04 * math.sin(t * 7)
        w, h = 720 * back_out(bk) * p, 130 * p
        rrect(d, (540 - w / 2, 1290 - h / 2, 540 + w / 2, 1290 + h / 2), 65, fill=YELLOW)
        if bk > 0.6:
            text_c(d, (540, 1290), "ССЫЛКА В ПРОФИЛЕ", font("cap", 58, 700), (18, 14, 4))
        text_c(d, (540, 1400), "1-й месяц — 2 000 ₽", font("mono", 32, 600), WHITE)


SCENES = {"hook": sc_hook, "grind": sc_grind, "reveal": sc_reveal, "scan": sc_scan, "filter": sc_filter,
          "notify": sc_notify, "deal": sc_deal, "course": sc_course, "price": sc_price, "value": sc_value, "cta": sc_cta}
TINTS = {"grind": (40, 14, 14), "reveal": (40, 26, 8), "filter": (14, 34, 24), "price": (40, 32, 8), "cta": (40, 24, 8)}


# ---------------------------------------------------------------- captions
def caption_groups(words, accent):
    groups, cur = [], []
    for i, w in enumerate(words):
        gap = w["s"] - words[i - 1]["e"] if i else 0
        chars = sum(len(x["w"]) + 1 for x in cur) + len(w["w"])
        if cur and (len(cur) >= 3 or gap > 0.12 or chars > 17):
            groups.append(cur)
            cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    acc = {a.lower() for a in accent}
    for g in groups:
        for w in g:
            w["acc"] = w["w"].lower().strip(".,!?—:") in acc
    return groups


def draw_caption(img, t, groups):
    tt = t - LEAD
    cur = None
    for i, g in enumerate(groups):
        end = groups[i + 1][0]["s"] if i + 1 < len(groups) else g[-1]["e"] + 0.4
        if g[0]["s"] - 0.03 <= tt < end:
            cur = g
    if cur is None:
        return
    d = ImageDraw.Draw(img)
    size = 104
    f = font("cap", size, 700)
    parts = [w["w"].upper() for w in cur]
    sp = d.textlength(" ", font=f)
    widths = [d.textlength(p, font=f) for p in parts]
    total = sum(widths) + sp * (len(parts) - 1)
    if total > 980:
        size = int(size * 980 / total)
        f = font("cap", size, 700)
        sp = d.textlength(" ", font=f)
        widths = [d.textlength(p, font=f) for p in parts]
        total = sum(widths) + sp * (len(parts) - 1)
    x = W / 2 - total / 2
    y = 1560
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for w, p, wd in zip(cur, parts, widths):
        if tt >= w["s"] - 0.03:
            k = prog(tt, w["s"] - 0.03, 0.12)
            col = ORANGE if w["acc"] else WHITE
            dy = (1 - ease_out(k)) * 26
            ld.text((x + 5, y + 7 + dy), p, font=f, fill=(0, 0, 0, int(200 * k)), anchor="ls")
            ld.text((x, y + dy), p, font=f, fill=alpha(col, k), anchor="ls", stroke_width=3, stroke_fill=(0, 0, 0, int(160 * k)))
        x += wd + sp
    img.alpha_composite(layer)


# ---------------------------------------------------------------- HUD
def draw_hud(img, gt, label):
    d = ImageDraw.Draw(img)
    d.text((48, 64), label, font=font("mono", 26, 800), fill=ORANGE)
    d.text((48, 100), "ПЕРЕКУПЫ · AI-ПОИСК", font=font("mono", 20, 500), fill=DIM)
    s = 3 * 3600 + 44 * 60 + 58 + gt
    d.text((W - 48, 64), f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d}", font=font("mono", 34, 600),
           fill=WHITE, anchor="ra")
    if int(gt * 2) % 2 == 0:
        d.ellipse((W - 48 - 14, 112, W - 48, 126), fill=RED)
    d.text((W - 70, 120), "LIVE", font=font("mono", 18, 700), fill=GREY, anchor="rm")


# ---------------------------------------------------------------- render
def render_scene(args):
    idx, sc, start, D, out = args
    random.seed(idx)
    groups = caption_groups(sc["words"], sc.get("accent", []))
    fn = SCENES[sc["id"]]
    n = int(round(D * FPS))
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                          "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    vig = vignette()
    for fi in range(n):
        t = fi / FPS
        img = bg_base(t, TINTS.get(sc["id"], (18, 26, 40)))
        fn(img, t, D, sc)
        # лёгкий «наезд» камеры в начале сцены
        z = 1 + 0.06 * (1 - ease_out(prog(t, 0, 0.45))) + 0.012 * t / D
        if z > 1.0005:
            cw, ch = W / z, H / z
            img = img.crop((int((W - cw) / 2), int((H - ch) / 2), int((W + cw) / 2), int((H + ch) / 2))).resize((W, H), Image.BILINEAR)
        img.alpha_composite(vig)
        # глитч на склейке
        if t < 0.1 and idx > 0:
            arr = np.array(img)
            for _ in range(7):
                y = random.randint(0, H - 80)
                hgt = random.randint(20, 80)
                arr[y:y + hgt] = np.roll(arr[y:y + hgt], random.randint(-80, 80), axis=1)
            arr[..., 0] = np.roll(arr[..., 0], 8, axis=1)
            img = Image.fromarray(arr, "RGBA")
        draw_hud(img, start + t, sc["label"])
        draw_caption(img, t, groups)
        p.stdin.write(img.convert("RGB").tobytes())
    p.stdin.close()
    p.wait()
    return out


def main(build):
    scenes = json.load(open(os.path.join(build, "vo", "timing.json")))
    only = os.environ.get("ONLY")
    jobs, start = [], 0.0
    for i, sc in enumerate(scenes):
        D = sc["audio_dur"] + LEAD + TAIL
        D = round(D * FPS) / FPS
        sc["start"], sc["dur"] = start, D
        if not only or sc["id"] in only.split(","):
            jobs.append((i, sc, start, D, os.path.join(build, f"seg_{i:02d}.mp4")))
        start += D
    json.dump([{"id": s["id"], "start": s["start"], "dur": s["dur"]} for s in scenes],
              open(os.path.join(build, "layout.json"), "w"), indent=1)
    with Pool(int(os.environ.get("JOBS", os.cpu_count() or 2))) as pool:
        for out in pool.imap_unordered(render_scene, jobs):
            print("done", out, flush=True)
    print("total", start)


if __name__ == "__main__":
    main(sys.argv[1])
