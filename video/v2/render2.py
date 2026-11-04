"""«Перекупы» v2 — история от второго лица, быстрый монтаж (кадр ~1 с).

Дизайн-токены:
  INK    #0A1018  фон ночи
  TEAL   #12303F  атмосфера/свет мониторов (как в референсе)
  YEL    #FFD21F  только нейросеть и бренд (цвет смайла)
  ORG    #FF8A2A  время, срочность
  GRN    #39D98A  деньги, успех
  PAPER  #EEF1F5  текст
Шрифты: Oswald (субтитры), Russo One (логотип), JetBrains Mono (HUD).
Принцип: мир холодный и тёмный — жёлтым светится только то, что делает нейросеть.

Запуск: python3 render2.py <build_dir>   (build_dir/vo/timing.json из ../tts.py)
"""
import json, math, os, random, subprocess, sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import render as R  # noqa: E402  общие примитивы (шрифты, иконки, телефон, карта, логотип)
from render import (font, clamp, ease_out, ease_in_out, back_out, prog, lerp, mix, alpha, rrect, text_c, glow,
                    icon, check, cross, fmt_rub)  # noqa: E402

W, H, FPS = R.W, R.H, R.FPS
LEAD, TAIL = 0.12, 0.18

INK = (10, 16, 24)
TEAL = (18, 48, 63)
YEL = (255, 210, 31)
ORG = (255, 138, 42)
GRN = (57, 217, 138)
RED = (255, 72, 72)
PAPER = (238, 241, 245)
GREY = (120, 136, 156)
DIM = (52, 64, 82)
PANEL = (16, 26, 38)
PANEL2 = (24, 38, 54)


# ------------------------------------------------------------ helpers
def vgrad(w, h, c1, c2, power=1.0):
    a = np.linspace(0, 1, h)[:, None] ** power
    arr = (np.array(c1)[None, None, :] * (1 - a[..., None]) + np.array(c2)[None, None, :] * a[..., None])
    arr = np.repeat(arr, w, axis=1).astype(np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def base(c1=INK, c2=(6, 10, 16), glow_c=TEAL, gx=0.5, gy=0.4, gs=1.0):
    img = vgrad(W, H, c1, c2)
    glow(img, (W * gx, H * gy), 950, glow_c, gs)
    return img


_face = None


def face():
    """Смайл крупно (лицо + очки) — «аватар» нейросети."""
    global _face
    if _face is None:
        src = Image.open(os.path.join(R.HERE, "assets/character.png")).convert("RGB")
        s = src.width / 1254
        box = tuple(int(v * s) for v in (300, 170, 960, 830))
        c = src.crop(box)
        m = Image.new("L", c.size, 0)
        ImageDraw.Draw(m).ellipse((c.width * 0.05, c.height * 0.12, c.width * 0.95, c.height * 0.98), fill=255)
        c.putalpha(m.filter(ImageFilter.GaussianBlur(c.width * 0.025)))
        _face = c
    return _face


def paste_face(img, cx, cy, size, rot=0, circle=False):
    f = face().resize((int(size), int(size)), Image.LANCZOS)
    if circle:
        m = Image.new("L", f.size, 0)
        ImageDraw.Draw(m).ellipse((0, 0, f.width - 1, f.height - 1), fill=255)
        bg = Image.new("RGBA", f.size, YEL + (255,))
        bg.alpha_composite(f)
        bg.putalpha(m)
        f = bg
    if rot:
        f = f.rotate(rot, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(f, (int(cx - f.width / 2), int(cy - f.height / 2)))


def city_skyline(d, x0, x1, ybase, seed, t, lit_col=(255, 196, 110), h_rng=(120, 420), dark=(8, 13, 22)):
    rnd = random.Random(seed)
    x = x0
    while x < x1:
        bw = rnd.randint(50, 120)
        bh = rnd.randint(*h_rng)
        d.rectangle((x, ybase - bh, x + bw, ybase), fill=dark)
        for wy in range(ybase - bh + 14, ybase - 10, 22):
            for wx in range(x + 8, x + bw - 10, 18):
                r = rnd.random()
                if r < 0.18 or (r < 0.2 and int(t * 2 + wx) % 3 == 0):
                    d.rectangle((wx, wy, wx + 8, wy + 11), fill=lit_col)
        x += bw + rnd.randint(2, 12)


def card(d, x, y, w, h, title, price, sub, ic="phone", hl=None, dim=0.0):
    rrect(d, (x, y, x + w, y + h), 20, fill=mix(PANEL, INK, dim * 0.6), outline=hl or mix(DIM, INK, dim), width=4 if hl else 2)
    s = h - 30
    rrect(d, (x + 15, y + 15, x + 15 + s, y + 15 + s), 14, fill=mix(PANEL2, INK, dim * 0.5))
    icon(d, ic, x + 15 + s / 2, y + 15 + s / 2, s * 0.62, mix((170, 182, 200), DIM, dim))
    tx = x + s + 40
    d.text((tx, y + h * 0.16), title, font=font("cap", int(h * 0.19), 500), fill=mix(PAPER, DIM, dim))
    d.text((tx, y + h * 0.42), price, font=font("cap", int(h * 0.27), 700), fill=mix(hl or PAPER, DIM, dim))
    d.text((tx, y + h * 0.82), sub, font=font("mono", int(h * 0.11), 500), fill=mix(GREY, DIM, dim), anchor="ls")


def iphone_back(img, cx, cy, w, turn=1.0, col=(150, 146, 140)):
    """Тыльная сторона смартфона (титановый корпус, блок камер)."""
    h = w * 2.05
    ww = max(8, w * abs(turn))
    lay = Image.new("RGBA", (int(w * 1.4), int(h * 1.2)), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    ox, oy = (lay.width - ww) / 2, (lay.height - h) / 2
    body = vgrad(int(ww), int(h), mix(col, PAPER, 0.25), mix(col, INK, 0.45))
    m = Image.new("L", body.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, body.width - 1, body.height - 1), int(w * 0.16), fill=255)
    body.putalpha(m)
    lay.alpha_composite(body, (int(ox), int(oy)))
    d.rounded_rectangle((ox, oy, ox + ww, oy + h), int(w * 0.16), outline=mix(col, PAPER, 0.5), width=4)
    if turn > 0.35:
        k = ww / w
        bx, by, bs = ox + ww * 0.07, oy + h * 0.035, w * 0.46 * k
        d.rounded_rectangle((bx, by, bx + bs, by + w * 0.46), int(w * 0.09), fill=mix(col, INK, 0.3), outline=mix(col, PAPER, 0.4), width=3)
        for (lx, ly) in ((0.27, 0.27), (0.27, 0.73), (0.73, 0.5)):
            r = w * 0.095
            px, py = bx + bs * lx, by + w * 0.46 * ly
            d.ellipse((px - r * k, py - r, px + r * k, py + r), fill=(18, 20, 26), outline=(90, 92, 100), width=4)
            d.ellipse((px - r * 0.45 * k, py - r * 0.45, px + r * 0.45 * k, py + r * 0.45), fill=(30, 40, 70))
        # логотип не рисуем — нейтральный корпус
    img.alpha_composite(lay, (int(cx - lay.width / 2), int(cy - lay.height / 2)))


# ------------------------------------------------------------ shots
def sh_bedroom(img, t, D, mode="dawn", close=False):
    night = mode == "night"
    img.paste(vgrad(W, H, (12, 20, 32), (5, 8, 13)), (0, 0))
    d = ImageDraw.Draw(img)
    wx0, wy0, wx1, wy1 = 170, 230, 910, 980
    sky = vgrad(wx1 - wx0, wy1 - wy0, (8, 14, 30) if night else (16, 28, 58), (20, 30, 54) if night else (150, 86, 64), 1.6)
    img.paste(sky, (wx0, wy0))
    d = ImageDraw.Draw(img)
    if night:
        d.ellipse((700, 300, 790, 390), fill=(220, 226, 236))
        d.ellipse((728, 290, 818, 380), fill=(16, 28, 50))
    city_skyline(d, wx0, wx1, wy1, 7, t, h_rng=(140, 480))
    d.rectangle((wx0, wy0, wx1, wy1), outline=(30, 40, 56), width=26)
    d.line(((wx0 + wx1) / 2, wy0, (wx0 + wx1) / 2, wy1), fill=(30, 40, 56), width=18)
    d.line((wx0, (wy0 + wy1) / 2, wx1, (wy0 + wy1) / 2), fill=(30, 40, 56), width=18)
    # шторы
    d.polygon([(100, 180), (240, 180), (200, 1080), (90, 1080)], fill=(20, 28, 42))
    d.polygon([(840, 180), (980, 180), (990, 1080), (880, 1080)], fill=(20, 28, 42))
    # свет из окна на полу
    if not night:
        lt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(lt).polygon([(wx0, wy1), (wx1, wy1), (1080, 1500), (0, 1500)], fill=(150, 90, 60, 40))
        img.alpha_composite(lt.filter(ImageFilter.GaussianBlur(30)))
        d = ImageDraw.Draw(img)
    # кровать
    by = 1180 if not close else 1060
    d.rounded_rectangle((-40, by, 820, H + 40), 60, fill=(26, 36, 56))
    d.ellipse((60, by - 70, 420, by + 90), fill=(44, 56, 78))  # подушка
    d.ellipse((180, by - 90, 330, by + 50), fill=(14, 18, 26))  # голова
    for i in range(4):
        y = by + 160 + i * 90
        d.arc((-200 + i * 30, y - 60, 900, y + 140), 190, 340, fill=(36, 48, 70), width=6)
    # тумбочка + телефон
    d.rectangle((830, 1180, 1080, 1600), fill=(20, 26, 38))
    d.rectangle((830, 1180, 1080, 1206), fill=(34, 42, 58))
    lit = not night and t > 0.25
    j = (math.sin(t * 90) * 4) if lit else 0
    d.rounded_rectangle((890 + j, 1150, 1010 + j, 1180), 8, fill=(40, 44, 54))
    if lit:
        glow(img, (950, 1150), 260, YEL, 0.55 + 0.25 * math.sin(t * 20))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((894 + j, 1152, 1006 + j, 1170), 6, fill=(255, 236, 160))
        for r in (60, 95):
            d.arc((950 - r + j, 1160 - r, 950 + r + j, 1160 + r), 200, 340, fill=alpha(YEL, 0.6), width=5)
    if night:
        for i in range(3):
            k = ((t * 0.6 + i / 3) % 1)
            d.text((340 + k * 120 + i * 20, by - 140 - k * 260), "z", font=font("cap", int(50 + 40 * k), 600),
                   fill=mix((14, 18, 26), (130, 150, 180), 1 - k))


def sh_phone_buzz(img, t, D):
    img.paste(vgrad(W, H, (14, 18, 26), (6, 8, 12)), (0, 0))
    d = ImageDraw.Draw(img)
    # стол — дерево
    for i in range(14):
        y = 300 + i * 120
        d.line((0, y + math.sin(i) * 20, W, y + 30 + math.cos(i) * 20), fill=(24, 22, 26), width=3)
    j = math.sin(t * 95) * 7
    lay = Image.new("RGBA", (700, 1300), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    ld.rounded_rectangle((60, 40, 640, 1260), 80, fill=(28, 30, 36), outline=(90, 94, 104), width=5)
    ld.rounded_rectangle((78, 58, 622, 1242), 66, fill=(8, 10, 16))
    lay2 = lay.rotate(-14 + j * 0.3, expand=True, resample=Image.BICUBIC)
    glow(img, (540 + j, 900), 720, YEL, 0.5 + 0.2 * math.sin(t * 18))
    img.alpha_composite(lay2, (int(540 - lay2.width / 2 + j), int(900 - lay2.height / 2)))
    d = ImageDraw.Draw(img)
    # уведомление на экране
    text_c(d, (540 + j, 560), "07:00", font("cap", 150, 400), PAPER)
    nk = back_out(prog(t, 0.15, 0.4), 1.4)
    if nk > 0:
        x, y, w = 140 + j, 760, 800
        rrect(d, (x, y, x + w * nk, y + 230), 38, fill=(40, 44, 54))
        if nk > 0.8:
            paste_face(img, x + 80, y + 80, 100, circle=True)
            d = ImageDraw.Draw(img)
            d.text((x + 150, y + 42), "Перекупы · нейросеть", font=font("cap", 34, 500), fill=GREY)
            d.text((x + 150, y + 88), "Нашла выгодную сделку", font=font("cap", 46, 700), fill=PAPER)
            d.text((x + 40, y + 160), "iPhone 15 Pro · 55 000 ₽ · рынок 80 000 ₽", font=font("mono", 28, 600), fill=YEL)
    for r in (420, 500):
        rr = r + (t * 200) % 60
        d.arc((540 - rr, 900 - rr * 1.3, 540 + rr, 900 + rr * 1.3), 300, 340, fill=alpha(YEL, 0.5), width=6)
        d.arc((540 - rr, 900 - rr * 1.3, 540 + rr, 900 + rr * 1.3), 120, 160, fill=alpha(YEL, 0.5), width=6)


def sh_clock(img, t, D, txt="07:00", ff=False):
    d = ImageDraw.Draw(img)
    rrect(d, (110, 600, 970, 1050), 40, fill=(12, 8, 8), outline=(50, 24, 20), width=4)
    if ff:
        hh = 7 + int(prog(t, 0, D * 0.8) * 3)
        mm = int((prog(t, 0, D * 0.8) * 180) % 60)
        txt = f"{min(hh, 10):02d}:{mm if hh < 10 else 0:02d}"
    glow(img, (540, 820), 480, ORG if not ff else RED, 0.45)
    d = ImageDraw.Draw(img)
    f = font("mono", 250, 800)
    text_c(d, (540, 820), "88:88", f, (40, 18, 14))
    col = ORG if not ff else RED
    shown = txt if (int(t * 3) % 2 == 0 or ff or t > 0.5) else txt.replace(":", " ")
    text_c(d, (540, 820), shown, f, col)
    if ff:
        text_c(d, (540, 1120), "+3 часа", font("cap", 80, 700), RED)


def sh_setup(img, t, D):
    scr = R.phone_frame(img, 540, 900, 620, 1180, screen_fill=(10, 14, 20))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = scr
    paste_face(img, (x0 + x1) / 2, y0 + 170, 150, circle=True)
    d = ImageDraw.Draw(img)
    text_c(d, ((x0 + x1) / 2, y0 + 290), "Где искать?", font("cap", 54, 700), PAPER)
    cities = ["Москва", "Казань", "Самара", "Уфа", "Екатеринбург"]
    for i, c in enumerate(cities):
        y = y0 + 360 + i * 98
        k = prog(t, 0.1 + i * 0.15, 0.2)
        rrect(d, (x0 + 40, y, x1 - 40, y + 82), 20, fill=PANEL)
        d.text((x0 + 70, y + 41), c, font=font("cap", 40, 500), fill=PAPER, anchor="lm")
        bx = x1 - 140
        on = i != 3
        rrect(d, (bx, y + 20, bx + 80, y + 62), 21, fill=YEL if (on and k > 0.5) else (50, 58, 72))
        kx = lerp(bx + 21, bx + 59, ease_out(k) if on else 0)
        d.ellipse((kx - 17, y + 24, kx + 17, y + 58), fill=PAPER)
    chips = ["Телефоны", "Авто", "Инструменты"]
    x = x0 + 40
    for c in chips:
        w = d.textlength(c, font=font("cap", 34, 500)) + 50
        rrect(d, (x, y1 - 170, x + w, y1 - 110), 30, outline=YEL, width=3)
        text_c(d, (x + w / 2, y1 - 140), c, font("cap", 34, 500), YEL)
        x += w + 16


def sh_stopwatch(img, t, D, txt="02:00", sub=""):
    d = ImageDraw.Draw(img)
    cx, cy, r = 540, 860, 330
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(40, 54, 72), width=24)
    d.rectangle((cx - 40, cy - r - 70, cx + 40, cy - r - 20), fill=(40, 54, 72))
    k = ease_out(prog(t, 0, min(D, 1.2)))
    d.arc((cx - r, cy - r, cx + r, cy + r), -90, -90 + 360 * k * 0.9, fill=YEL, width=24)
    a = math.radians(-90 + 360 * k * 0.9)
    d.line((cx, cy, cx + math.cos(a) * r * 0.8, cy + math.sin(a) * r * 0.8), fill=PAPER, width=10)
    d.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), fill=PAPER)
    text_c(d, (cx, cy + r + 120), txt, font("mono", 120, 800), YEL)
    if sub:
        text_c(d, (cx, cy + r + 215), sub, font("cap", 44, 500), GREY)


def sh_ai_core(img, t, D):
    glow(img, (540, 840), 600, YEL, 0.35)
    d = ImageDraw.Draw(img)
    for i, (r, sp, dash) in enumerate(((340, 0.6, 18), (420, -0.4, 30), (510, 0.25, 50))):
        for k in range(dash):
            a0 = k / dash * 360 + t * sp * 60
            d.arc((540 - r, 840 - r, 540 + r, 840 + r), a0, a0 + 360 / dash * 0.5, fill=alpha(YEL, 0.55 - i * 0.12), width=5)
    for i in range(6):
        a = t * 0.8 + i / 6 * math.tau
        x, y = 540 + math.cos(a) * 470, 840 + math.sin(a) * 470
        rrect(d, (x - 70, y - 40, x + 70, y + 40), 12, fill=PANEL, outline=DIM, width=2)
        icon(d, ["phone", "car", "tool", "console", "tv", "phone"][i], x - 35, y, 50, GREY)
        d.line((x - 5, y - 10, x + 55, y - 10), fill=GREY, width=5)
        d.line((x - 5, y + 10, x + 35, y + 10), fill=YEL, width=5)
    s = 560 * (1 + 0.02 * math.sin(t * 4))
    paste_face(img, 540, 840, s)


def sh_counter(img, t, D):
    d = ImageDraw.Draw(img)
    rnd = random.Random(3)
    for col in range(5):
        sp = 600 + col * 140
        for i in range(10):
            y = (i * 230 + t * sp + col * 70) % (H + 230) - 230
            x = 40 + col * 205
            rrect(d, (x, y, x + 180, y + 200), 16, fill=(14, 22, 32), outline=(26, 36, 50), width=2)
            icon(d, rnd.choice(["phone", "car", "tool", "console", "tv"]), x + 90, y + 70, 80, (40, 54, 72))
            d.line((x + 20, y + 145, x + 160, y + 145), fill=(36, 48, 64), width=8)
            d.line((x + 20, y + 170, x + 110, y + 170), fill=(36, 48, 64), width=8)
    ov = Image.new("RGBA", (W, H), (6, 10, 16, 170))
    img.alpha_composite(ov)
    d = ImageDraw.Draw(img)
    n = int(lerp(380_000, 1_284_391, ease_out(prog(t, 0, D * 0.9))))
    text_c(d, (540, 840), f"{n:,}".replace(",", " "), font("cap", 190, 700), YEL)
    text_c(d, (540, 990), "объявлений за ночь", font("cap", 56, 500), PAPER)


def sh_map(img, t, D):
    d = ImageDraw.Draw(img)
    ox, oy = 0, 380
    sx = lerp(-60, 1140, ease_in_out(prog(t, 0, D * 0.85)))
    for (x, y) in R.ru_dots():
        y2 = y + oy - 400
        d.ellipse((x - 3, y2 - 3, x + 3, y2 + 3), fill=(36, 70, 92) if x < sx else (24, 34, 48))
    for (name, lon, lat) in R.CITIES:
        x, y = R.ru_proj(lon, lat)
        y += oy - 400
        if x < sx:
            pk = ((t * 1.3 + lon / 50) % 1)
            r = 8 + 36 * pk
            d.ellipse((x - r, y - r, x + r, y + r), outline=alpha(YEL, 1 - pk), width=3)
            d.ellipse((x - 7, y - 7, x + 7, y + 7), fill=YEL)
    band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for i in range(30):
        bd.line((sx - i * 4, oy - 60, sx - i * 4, oy + 700), fill=alpha(YEL, 0.18 * (1 - i / 30)), width=4)
    img.alpha_composite(band)
    d = ImageDraw.Draw(img)
    text_c(d, (540, 330), "18 городов", font("cap", 110, 700), PAPER)
    text_c(d, (540, 430), "проверяются каждые 5 минут", font("cap", 46, 500), GREY)


def sh_big_icon(img, t, D, kind="phone", n=""):
    glow(img, (540, 820), 520, TEAL, 0.9)
    d = ImageDraw.Draw(img)
    k = back_out(prog(t, 0, 0.3))
    r = 300 * k
    d.ellipse((540 - r, 820 - r, 540 + r, 820 + r), outline=(40, 70, 90), width=6)
    icon(d, kind, 540, 820, 420 * k, PAPER)
    if n:
        text_c(d, (540, 1210), n, font("cap", 96, 700), YEL)
        text_c(d, (540, 1300), "объявлений", font("cap", 44, 500), GREY)


def sh_price_dots(img, t, D):
    d = ImageDraw.Draw(img)
    rnd = random.Random(11)
    x0, x1, yb = 100, 980, 1150
    d.line((x0, yb, x1, yb), fill=DIM, width=4)
    mx = 700
    k = prog(t, 0, D * 0.6)
    for i in range(140):
        v = rnd.gauss(mx, 90)
        if not x0 < v < x1:
            continue
        h = rnd.random() * 520
        if i / 140 > k:
            continue
        d.ellipse((v - 9, yb - 40 - h - 9, v + 9, yb - 40 - h + 9), fill=(70, 86, 108))
    d.line((mx, 520, mx, yb), fill=PAPER, width=4)
    text_c(d, (mx, 480), "рынок", font("cap", 44, 500), PAPER)
    if t > D * 0.5:
        p = back_out(prog(t, D * 0.5, 0.3))
        d.ellipse((330 - 26 * p, 860 - 26 * p, 330 + 26 * p, 860 + 26 * p), fill=YEL)
        glow(img, (330, 860), 140, YEL, 0.6)
        d = ImageDraw.Draw(img)
        d.line((350, 860, mx - 10, 860), fill=alpha(YEL, 0.8), width=4)
        text_c(d, (330, 780), "−31%", font("cap", 80, 700), YEL)
    d.text((x0, yb + 30), "дешевле", font=font("cap", 40, 500), fill=GREY)
    d.text((x1, yb + 30), "дороже", font=font("cap", 40, 500), fill=GREY, anchor="ra")


def sh_spotlight(img, t, D):
    d = ImageDraw.Draw(img)
    items = [("Kia Rio 2017", "820 000 ₽", "car"), ("iPhone 13", "41 000 ₽", "phone"), ("PS5", "45 000 ₽", "console"),
             ("Makita", "9 800 ₽", "tool"), ("Samsung S23", "49 000 ₽", "phone"), ("TV 55\"", "36 000 ₽", "tv")]
    best = 3
    for i in range(7):
        y = 250 + i * 160
        if i == best:
            continue
        it = items[i % len(items)]
        card(d, 90, y, 900, 140, it[0], it[1], "рыночная цена", it[2], dim=0.75)
    k = ease_out(prog(t, 0.05, 0.35))
    lt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(lt).polygon([(470, 0), (610, 0), (1040, 250 + best * 160 + 170), (40, 250 + best * 160 + 170)],
                               fill=(255, 220, 90, int(55 * k)))
    img.alpha_composite(lt.filter(ImageFilter.GaussianBlur(20)))
    d = ImageDraw.Draw(img)
    s = lerp(1, 1.08, k)
    w, h = 900 * s, 140 * s
    card(d, 540 - w / 2, 250 + best * 160 + 70 - h / 2, w, h, "iPhone 15 Pro, 256 ГБ", "55 000 ₽", "4 мин назад · Казань", "phone", hl=YEL)


def sh_iphone(img, t, D):
    glow(img, (540, 860), 600, (90, 100, 120), 0.6)
    turn = math.cos(lerp(-1.0, 0.0, ease_out(prog(t, 0, D * 0.8))))
    iphone_back(img, 540, 860, 470, turn)
    d = ImageDraw.Draw(img)
    text_c(d, (540, 1430), "iPhone 15 Pro · 256 ГБ", font("cap", 56, 500), PAPER)


def sh_tag(img, t, D, val="", sub="", col="white"):
    c = YEL if col == "yellow" else PAPER
    if col == "yellow":
        glow(img, (540, 850), 600, YEL, 0.35)
    sw = math.sin(t * 5) * 6 * (1 - prog(t, 0, 1.2))
    lay = Image.new("RGBA", (900, 520), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    ld.polygon([(120, 60), (860, 60), (860, 460), (120, 460), (20, 260)], fill=(22, 30, 42) if col != "yellow" else (40, 34, 10),
               outline=c, width=6)
    ld.ellipse((80, 235, 130, 285), outline=c, width=6)
    text_c(ld, (500, 230), val, font("cap", 170, 700), c)
    text_c(ld, (500, 380), sub, font("cap", 46, 500), GREY)
    k = back_out(prog(t, 0, 0.3))
    lay = lay.resize((max(1, int(900 * k)), max(1, int(520 * k)))).rotate(sw - 4, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(lay, (int(540 - lay.width / 2), int(850 - lay.height / 2)))
    if col != "yellow":
        pass


def sh_boxes(img, t, D):
    d = ImageDraw.Draw(img)
    d.rectangle((0, 1250, W, H), fill=(18, 24, 34))
    boxes = [(120, 900, 520, 1260), (540, 960, 960, 1260), (240, 560, 640, 900), (600, 700, 880, 960)]
    for i, (a, b, c_, e) in enumerate(boxes):
        k = ease_out(prog(t, i * 0.08, 0.3))
        dy = (1 - k) * -300
        d.rectangle((a, b + dy, c_, e + dy), fill=(140, 98, 58), outline=(100, 68, 38), width=4)
        d.rectangle(((a + c_) / 2 - 30, b + dy, (a + c_) / 2 + 30, e + dy), fill=(170, 130, 80))
    # стикер
    k = back_out(prog(t, 0.4, 0.3))
    if k > 0:
        lay = Image.new("RGBA", (520, 300), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        ld.rectangle((10, 10, 510, 290), fill=(250, 236, 140))
        text_c(ld, (260, 110), "Переезд!", font("cap", 84, 700), (40, 34, 20))
        text_c(ld, (260, 210), "продам срочно, сегодня", font("cap", 40, 500), (80, 70, 40))
        lay = lay.rotate(7, expand=True, resample=Image.BICUBIC).resize((int(560 * k), int(360 * k)))
        img.alpha_composite(lay, (int(540 - lay.width / 2), 300))


def sh_grinder(img, t, D, crossed=False):
    d = ImageDraw.Draw(img)
    # монитор с лентой
    rrect(d, (130, 380, 950, 980), 20, fill=(10, 16, 24), outline=(40, 50, 66), width=8)
    off = (t * 700) % 120
    for i in range(7):
        y = 400 + i * 120 - off
        if 390 < y < 900:
            d.rectangle((170, y, 910, y + 95), fill=(22, 34, 48))
            d.rectangle((185, y + 12, 255, y + 82), fill=(34, 48, 64))
            d.line((280, y + 30, 700, y + 30), fill=(48, 62, 80), width=10)
            d.line((280, y + 62, 500, y + 62), fill=(48, 62, 80), width=10)
    d.rectangle((130, 360, 950, 400), fill=(8, 12, 18))
    d.rectangle((130, 960, 950, 1000), fill=(8, 12, 18))
    d.rectangle((500, 1000, 580, 1100), fill=(30, 38, 50))
    glow(img, (540, 700), 520, TEAL, 0.6)
    d = ImageDraw.Draw(img)
    # силуэт со спины
    d.ellipse((400, 1060, 680, 1360), fill=(6, 8, 12))
    d.rounded_rectangle((220, 1290, 860, 1900), 200, fill=(6, 8, 12))
    if crossed:
        k = ease_out(prog(t, 0.15, 0.3))
        d.line((140, 400, lerp(140, 940, k), lerp(400, 980, k)), fill=RED, width=22)
        if t > 0.45:
            k2 = ease_out(prog(t, 0.45, 0.3))
            d.line((940, 400, lerp(940, 140, k2), lerp(400, 980, k2)), fill=RED, width=22)
    else:
        text_c(d, (540, 300), "обновить… обновить… обновить…", font("cap", 46, 500), GREY)


def sh_sold(img, t, D, short=False):
    d = ImageDraw.Draw(img)
    card(d, 90, 700, 900, 220, "iPhone 15 Pro, 256 ГБ", "55 000 ₽", "Казань", "phone", dim=0.5)
    k = prog(t, 0.08, 0.25)
    if k > 0:
        s = lerp(2.0, 1.0, back_out(k))
        lay = Image.new("RGBA", (760, 220), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        ld.rounded_rectangle((8, 8, 752, 212), 24, outline=RED, width=12)
        text_c(ld, (380, 112), "УЖЕ ПРОДАНО", font("cap", 104, 700), RED)
        lay = lay.resize((int(760 * s), int(220 * s))).rotate(-9, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(lay, (int(540 - lay.width / 2), int(810 - lay.height / 2)))


def sh_notif(img, t, D):
    scr = R.phone_frame(img, 540, 960, 640, 1240, screen_fill=(10, 12, 18))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = scr
    text_c(d, ((x0 + x1) / 2, y0 + 210), "07:01", font("cap", 140, 400), PAPER)
    x, y, w = x0 + 26, y0 + 330, x1 - x0 - 52
    rrect(d, (x, y, x + w, y + 300), 36, fill=(38, 42, 52))
    paste_face(img, x + 80, y + 80, 104, circle=True)
    d = ImageDraw.Draw(img)
    d.text((x + 150, y + 44), "Перекупы", font=font("cap", 32, 500), fill=GREY)
    d.text((x + 150, y + 86), "iPhone 15 Pro — 55 000 ₽", font=font("cap", 42, 700), fill=PAPER)
    d.text((x + 34, y + 170), "рынок 80 000 ₽ · Казань", font=font("mono", 28, 600), fill=YEL)
    rrect(d, (x + 34, y + 222, x + w - 34, y + 280), 20, fill=YEL)
    text_c(d, (x + w / 2, y + 251), "Открыть объявление", font("cap", 36, 700), (20, 18, 8))
    tk = prog(t, 0.35, 0.4)
    if tk > 0:
        r = 40 + 90 * tk
        cx, cy = x + w / 2 + 60, y + 251
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=alpha(PAPER, 1 - tk), width=6)
        d.ellipse((cx - 32, cy - 32, cx + 32, cy + 32), fill=alpha(PAPER, 0.5 * (1 - tk)))


def sh_call(img, t, D):
    scr = R.phone_frame(img, 540, 960, 640, 1240, screen_fill=(14, 22, 20))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = scr
    cx = (x0 + x1) / 2
    d.ellipse((cx - 110, y0 + 180, cx + 110, y0 + 400), fill=(40, 60, 56))
    text_c(d, (cx, y0 + 290), "П", font("cap", 120, 600), PAPER)
    text_c(d, (cx, y0 + 470), "Продавец", font("cap", 64, 600), PAPER)
    s = int(t * 1.0) + 3
    text_c(d, (cx, y0 + 540), f"00:{s:02d}", font("mono", 40, 500), GREY)
    for i in range(16):
        h = 20 + 70 * abs(math.sin(t * 9 + i * 0.7))
        x = cx - 240 + i * 32
        d.rounded_rectangle((x, y0 + 700 - h / 2, x + 14, y0 + 700 + h / 2), 7, fill=GRN)
    d.ellipse((cx - 70, y1 - 230, cx + 70, y1 - 90), fill=RED)
    text_c(d, (cx, y1 - 160), "✕", font("logo", 60), PAPER)


def sh_route(img, t, D):
    d = ImageDraw.Draw(img)
    rnd = random.Random(5)
    for i in range(26):
        x = rnd.randint(-100, 1100)
        d.line((x, 0, x + rnd.randint(-300, 300), H), fill=(22, 32, 44), width=rnd.choice((4, 8, 14)))
    for i in range(30):
        y = rnd.randint(0, H)
        d.line((0, y, W, y + rnd.randint(-200, 200)), fill=(22, 32, 44), width=rnd.choice((4, 8, 14)))
    pts = [(240, 1500), (300, 1300), (520, 1220), (560, 980), (760, 860), (800, 600), (700, 420)]
    k = ease_in_out(prog(t, 0, D * 0.85))
    total = len(pts) - 1
    seg = k * total
    path = [pts[0]]
    for i in range(1, len(pts)):
        if i <= seg:
            path.append(pts[i])
        else:
            f = seg - (i - 1)
            if f > 0:
                path.append((lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)))
            break
    if len(path) > 1:
        d.line(path, fill=YEL, width=16, joint="curve")
    d.ellipse((220, 1480, 260, 1520), fill=PAPER)
    px, py = 700, 420
    d.ellipse((px - 40, py - 100, px + 40, py - 20), fill=ORG)
    d.polygon([(px - 34, py - 50), (px + 34, py - 50), (px, py)], fill=ORG)
    d.ellipse((px - 15, py - 75, px + 15, py - 45), fill=INK)
    rrect(d, (560, 220, 960, 330), 30, fill=PANEL, outline=DIM, width=2)
    text_c(d, (760, 275), "40 мин · 18 км", font("cap", 50, 600), PAPER)


def sh_road(img, t, D):
    img.paste(vgrad(W, 900, (14, 22, 40), (150, 90, 70), 1.8), (0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((440, 760, 640, 960), fill=(255, 190, 120))
    city_skyline(d, 0, W, 900, 21, t, h_rng=(60, 220), dark=(20, 22, 34))
    d.rectangle((0, 900, W, H), fill=(14, 16, 22))
    d.polygon([(500, 900), (580, 900), (1200, H), (-120, H)], fill=(28, 30, 38))
    for i in range(10):
        k = ((i / 10) + t * 1.2) % 1
        y = 900 + (H - 900) * k ** 2
        h = 10 + 140 * k ** 2
        w = 3 + 22 * k
        d.polygon([(540 - w / 2, y), (540 + w / 2, y), (540 + w, y + h), (540 - w, y + h)], fill=(220, 210, 170))
    # машина сзади
    cy = 1500 + math.sin(t * 12) * 3
    d.rounded_rectangle((270, cy - 170, 810, cy + 150), 60, fill=(16, 18, 24))
    d.rounded_rectangle((330, cy - 300, 750, cy - 140), 70, fill=(12, 14, 20))
    d.rounded_rectangle((360, cy - 280, 720, cy - 170), 40, fill=(70, 60, 64))
    for x in (300, 700):
        d.rounded_rectangle((x, cy - 70, x + 80, cy - 20), 12, fill=RED)
    glow(img, (340, cy - 45), 120, RED, 0.6)
    glow(img, (740, cy - 45), 120, RED, 0.6)


def sh_course(img, t, D):
    d = ImageDraw.Draw(img)
    rrect(d, (80, 250, 1000, 1360), 40, fill=PANEL, outline=DIM, width=2)
    d.text((140, 300), "Обучение «Перекуп с нуля»", font=font("cap", 44, 500), fill=YEL)
    d.text((140, 360), "от А до Я", font=font("cap", 110, 700), fill=PAPER)
    mods = ["Где искать и как выбирать товар", "Проверка: серийник, АКБ, Face ID", "Торг без стеснения",
            "Как продать дороже и быстрее", "Как не нарваться на мошенников", "Как выйти на поток сделок"]
    for i, m in enumerate(mods):
        y = 540 + i * 125
        k = prog(t, 0.05 + i * 0.12, 0.25)
        if k <= 0:
            continue
        x = 140 + (1 - ease_out(k)) * 50
        rrect(d, (x, y, x + 800, y + 105), 22, fill=mix(PANEL, PANEL2, k))
        d.text((x + 30, y + 52), m, font=font("cap", 40, 500), fill=mix(PANEL, PAPER, k), anchor="lm")
        d.ellipse((x + 720, y + 28, x + 770, y + 78), fill=mix(PANEL, (20, 70, 46), k))
        check(d, x + 745, y + 53, 22, GRN, 5, prog(t, 0.2 + i * 0.12, 0.2))


def sh_check(img, t, D, v="serial"):
    scr = R.phone_frame(img, 540, 900, 640, 1220, screen_fill=(240, 242, 246))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = scr
    cx = (x0 + x1) / 2
    dark = (20, 24, 30)
    k = prog(t, 0.1, 0.5)
    if v == "serial":
        d.text((x0 + 50, y0 + 170), "Об этом устройстве", font=font("cap", 50, 700), fill=dark)
        rows = [("Модель", "iPhone 15 Pro"), ("Память", "256 ГБ"), ("Серийный номер", "F2LXK8Q1MN"), ("Гарантия", "активна")]
        for i, (a, b) in enumerate(rows):
            y = y0 + 300 + i * 110
            d.text((x0 + 50, y), a, font=font("cap", 38, 500), fill=(120, 126, 136))
            d.text((x1 - 50, y), b, font=font("cap", 38, 600), fill=dark, anchor="ra")
            d.line((x0 + 50, y + 75, x1 - 50, y + 75), fill=(220, 224, 230), width=2)
        hy = y0 + 300 + 2 * 110 - 14
        d.rounded_rectangle((x0 + 30, hy, x1 - 30, hy + 70), 14, outline=GRN, width=5)
    elif v == "battery":
        d.text((x0 + 50, y0 + 170), "Аккумулятор", font=font("cap", 50, 700), fill=dark)
        rrect(d, (cx - 180, y0 + 330, cx + 160, y0 + 520), 30, outline=dark, width=10)
        d.rectangle((cx + 160, y0 + 390, cx + 190, y0 + 460), fill=dark)
        p = lerp(0, 0.91, ease_out(k))
        rrect(d, (cx - 160, y0 + 350, cx - 160 + 300 * p, y0 + 500), 18, fill=GRN)
        text_c(d, (cx, y0 + 650), f"{int(p * 100)}%", font("cap", 150, 700), dark)
        text_c(d, (cx, y0 + 780), "максимальная ёмкость", font("cap", 40, 500), (120, 126, 136))
    else:
        s = 260
        x, y = cx - s / 2, y0 + 300
        col = GRN if k > 0.6 else dark
        for (ax, ay, a0) in ((x, y, 180), (x + s - 80, y, 270), (x, y + s - 80, 90), (x + s - 80, y + s - 80, 0)):
            d.arc((ax, ay, ax + 80, ay + 80), a0, a0 + 90, fill=col, width=12)
        d.line((x + 40, y, x + 90, y), fill=col, width=12)
        d.line((x + s - 90, y, x + s - 40, y), fill=col, width=12)
        d.ellipse((cx - 60, y + 80, cx - 40, y + 110), fill=col)
        d.ellipse((cx + 40, y + 80, cx + 60, y + 110), fill=col)
        d.arc((cx - 70, y + 110, cx + 70, y + 200), 20, 160, fill=col, width=10)
        text_c(d, (cx, y0 + 700), "Face ID работает" if k > 0.6 else "Сканирование…", font("cap", 52, 700), col)


def sh_haggle(img, t, D):
    d = ImageDraw.Draw(img)
    msgs = [(False, "Состояние отличное, коробка есть"), (True, "Отдадите за 52?"), (False, "Ну… давайте за 52")]
    for i, (me, m) in enumerate(msgs):
        k = back_out(prog(t, i * 0.35, 0.25))
        if k <= 0:
            continue
        f = font("cap", 50, 500)
        w = d.textlength(m, font=f) + 80
        y = 560 + i * 200
        x = 1000 - w if me else 80
        rrect(d, (x, y, x + w * k, y + 130), 40, fill=YEL if me else PANEL2)
        if k > 0.8:
            d.text((x + 40, y + 65), m, font=f, fill=(20, 18, 8) if me else PAPER, anchor="lm")
    text_c(d, (540, 420), "было 55 000 · стало 52 000", font("cap", 70, 700), PAPER)


def sh_cash(img, t, D, val="", sub=""):
    rnd = random.Random(9)
    k = ease_out(prog(t, 0, 0.5))
    for i in range(14):
        lay = Image.new("RGBA", (560, 260), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        ld.rounded_rectangle((0, 0, 559, 259), 14, fill=(196, 110, 84), outline=(240, 190, 160), width=4)
        ld.ellipse((390, 50, 530, 210), outline=(240, 190, 160), width=4)
        ld.text((30, 30), "5000", font=font("cap", 70, 700), fill=(250, 220, 200))
        lay = lay.rotate(rnd.uniform(-30, 30) * k, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(lay, (int(540 - lay.width / 2 + rnd.uniform(-160, 160) * k), int(820 - lay.height / 2 + rnd.uniform(-120, 120) * k)))
    d = ImageDraw.Draw(img)
    text_c(d, (540, 1250), val, font("cap", 140, 700), PAPER)
    text_c(d, (540, 1360), sub, font("cap", 46, 500), GREY)


def sh_listing(img, t, D):
    scr = R.phone_frame(img, 540, 900, 640, 1220, screen_fill=(12, 16, 22))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = scr
    rrect(d, (x0 + 30, y0 + 110, x1 - 30, y0 + 560), 30, fill=PANEL2)
    icon(d, "phone", (x0 + x1) / 2, y0 + 335, 300, (190, 196, 210))
    d.text((x0 + 40, y0 + 600), "iPhone 15 Pro, 256 ГБ", font=font("cap", 46, 600), fill=PAPER)
    d.text((x0 + 40, y0 + 670), "77 000 ₽", font=font("cap", 96, 700), fill=PAPER)
    views = int(lerp(0, 148, ease_out(prog(t, 0, D))))
    d.text((x0 + 40, y0 + 800), f"Просмотров: {views}  ·  В избранном: {views // 9}", font=font("mono", 26, 600), fill=GREY)
    rrect(d, (x0 + 40, y1 - 140, x1 - 40, y1 - 50), 26, fill=(20, 70, 46))
    text_c(d, ((x0 + x1) / 2, y1 - 95), "Опубликовано", font("cap", 44, 700), GRN)


def sh_buyer(img, t, D):
    d = ImageDraw.Draw(img)
    text_c(d, (540, 380), "19:42", font("cap", 120, 400), GREY)
    msgs = [(False, "Добрый вечер! Ещё продаёте?"), (True, "Да, актуально"), (False, "Беру. Через час буду")]
    for i, (me, m) in enumerate(msgs):
        k = back_out(prog(t, i * 0.3, 0.25))
        if k <= 0:
            continue
        f = font("cap", 50, 500)
        w = d.textlength(m, font=f) + 80
        y = 580 + i * 200
        x = 1000 - w if me else 80
        rrect(d, (x, y, x + w * k, y + 130), 40, fill=(30, 60, 50) if me else PANEL2)
        if k > 0.8:
            d.text((x + 40, y + 65), m, font=f, fill=PAPER, anchor="lm")


def sh_profit(img, t, D):
    glow(img, (540, 840), 650, GRN, 0.45)
    sh_cash(img, t, D)
    d = ImageDraw.Draw(img)
    v = int(lerp(0, 25000, ease_out(prog(t, 0, 0.9))) / 100) * 100
    s = back_out(prog(t, 0, 0.3))
    text_c(d, (540, 1250), "+" + fmt_rub(v), font("cap", int(200 * s) + 1, 700), GRN)
    text_c(d, (540, 1380), "купил за 52 000 · продал за 77 000", font("cap", 44, 500), GREY)


def sh_calendar(img, t, D):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = 220, 480, 860, 1280
    rrect(d, (x0, y0, x1, y1), 30, fill=(238, 236, 228))
    d.rounded_rectangle((x0, y0, x1, y0 + 200), 30, fill=(214, 64, 52))
    d.rectangle((x0, y0 + 150, x1, y0 + 200), fill=(214, 64, 52))
    text_c(d, ((x0 + x1) / 2, y0 + 100), "СЕГОДНЯ", font("cap", 80, 700), PAPER)
    text_c(d, ((x0 + x1) / 2, y0 + 470), "1", font("cap", 400, 700), (30, 30, 34))
    text_c(d, ((x0 + x1) / 2, y1 - 90), "день", font("cap", 70, 500), (90, 90, 96))
    for i in range(4):
        d.ellipse((x0 + 90 + i * 140, y0 - 30, x0 + 130 + i * 140, y0 + 30), fill=(60, 60, 66))


def sh_reveal(img, t, D):
    R.sc_reveal(img, t * 1.4 + 0.5, D * 1.4, {})


def sh_price(img, t, D):
    glow(img, (540, 820), 700, YEL, 0.3)
    d = ImageDraw.Draw(img)
    k = max(0.02, back_out(prog(t, 0, 0.35), 1.2))
    w, h = 860 * k, 1000 * k
    x0, y0 = 540 - w / 2, 820 - h / 2
    rrect(d, (x0, y0, x0 + w, y0 + h), 46, fill=PANEL, outline=YEL, width=5)
    if k < 0.9:
        return
    d.text((x0 + 70, y0 + 80), "Подписка «Перекупы»", font=font("cap", 50, 600), fill=YEL)
    rows = ["Нейросеть: сделки по всей России", "Уведомления сразу на телефон", "Обучение от А до Я"]
    for i, r in enumerate(rows):
        y = y0 + 190 + i * 90
        d.ellipse((x0 + 70, y - 4, x0 + 118, y + 44), fill=(20, 70, 46))
        check(d, x0 + 94, y + 20, 22, GRN, 5, prog(t, 0.3 + i * 0.12, 0.2))
        d.text((x0 + 140, y + 20), r, font=font("cap", 42, 500), fill=PAPER, anchor="lm")
    pk = back_out(prog(t, 0.6, 0.3))
    if pk > 0:
        text_c(d, (540, y0 + 640), "2 000 ₽", font("cap", int(230 * pk) + 1, 700), YEL)
        text_c(d, (540, y0 + 790), "первый месяц", font("cap", 56, 600), PAPER)
        text_c(d, (540, y0 + 870), "дальше 4 000 ₽ в месяц", font("cap", 40, 500), GREY)


def sh_scale(img, t, D):
    R.sc_value(img, t + 0.6, D, {})


def sh_cta(img, t, D):
    R.sc_cta(img, t + 0.8, D, {})


SHOTS = {k[3:]: v for k, v in globals().items() if k.startswith("sh_")}
WARM = {"reveal", "cta", "price", "ai_core", "profit"}


# ------------------------------------------------------------ captions / HUD
def groups_for(words, accent):
    acc = {a.lower() for a in accent}
    gs, cur = [], []
    for i, w in enumerate(words):
        gap = w["s"] - words[i - 1]["e"] if i else 0
        chars = sum(len(x["w"]) + 1 for x in cur) + len(w["w"])
        if cur and (len(cur) >= 2 or gap > 0.1 or chars > 15):
            gs.append(cur)
            cur = []
        w = dict(w, acc=w["w"].lower().strip(".,!?—:«»") in acc)
        cur.append(w)
    if cur:
        gs.append(cur)
    return gs


def draw_caption(img, tt, groups):
    cur = None
    for i, g in enumerate(groups):
        end = groups[i + 1][0]["s"] if i + 1 < len(groups) else g[-1]["e"] + 0.3
        if g[0]["s"] - 0.04 <= tt < end:
            cur = g
    if not cur:
        return
    d = ImageDraw.Draw(img)
    size = 118
    f = font("cap", size, 700)
    parts = [w["w"].upper() for w in cur]
    sp = d.textlength(" ", font=f) * 1.6
    widths = [d.textlength(p, font=f) for p in parts]
    total = sum(widths) + sp * (len(parts) - 1)
    if total > 960:
        size = int(size * 960 / total)
        f = font("cap", size, 700)
        sp = d.textlength(" ", font=f) * 1.6
        widths = [d.textlength(p, font=f) for p in parts]
        total = sum(widths) + sp * (len(parts) - 1)
    x = W / 2 - total / 2
    y = 1600
    for w, p, wd in zip(cur, parts, widths):
        if tt >= w["s"] - 0.04:
            k = prog(tt, w["s"] - 0.04, 0.1)
            s = lerp(1.12, 1.0, ease_out(k))
            col = YEL if w["acc"] else PAPER
            fs = font("cap", int(size * s), 700)
            d.text((x + wd / 2 + 5, y + 7), p, font=fs, fill=(0, 0, 0), anchor="ms")
            d.text((x + wd / 2, y), p, font=fs, fill=col, anchor="ms", stroke_width=4, stroke_fill=(0, 0, 0))
        x += wd + sp


def draw_hud(img, label, clock_s):
    d = ImageDraw.Draw(img)
    d.text((48, 66), label, font=font("mono", 26, 800), fill=ORG)
    d.text((48, 102), "ПЕРЕКУПЫ", font=font("mono", 20, 600), fill=DIM)
    s = int(clock_s)
    d.text((W - 48, 66), f"{s // 3600 % 24:02d}:{s % 3600 // 60:02d}:{s % 60:02d}", font=font("mono", 34, 600), fill=PAPER, anchor="ra")


# ------------------------------------------------------------ render
def plan(scenes):
    out, start = [], 0.0
    for sc in scenes:
        D = round((sc["audio_dur"] + LEAD + TAIL) * FPS) / FPS
        words = sc["words"]
        shots, wi = [], 0
        for (anchor, name, args) in sc["shots"]:
            st = 0.0
            for j in range(wi, len(words)):
                if words[j]["w"] == anchor:
                    st = 0.0 if not shots else LEAD + words[j]["s"] - 0.06
                    wi = j + 1
                    break
            shots.append([st, name, args])
        for i in range(len(shots)):
            shots[i].append((shots[i + 1][0] if i + 1 < len(shots) else D) - shots[i][0])
        h, m, s = map(int, sc["clock"].split(":"))
        out.append(dict(sc, start=start, dur=D, plan=shots, clock_s=h * 3600 + m * 60 + s))
        start += D
    return out, start


def render_line(args):
    idx, sc, out = args
    random.seed(idx)
    groups = groups_for(sc["words"], sc["accent"])
    n = int(round(sc["dur"] * FPS))
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                          "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", out],
                         stdin=subprocess.PIPE)
    vig = R.vignette()
    for fi in range(n):
        t = fi / FPS
        shot = sc["plan"][0]
        for s in sc["plan"]:
            if t >= s[0]:
                shot = s
        st, name, a, sd = shot
        lt = t - st
        img = base(glow_c=(46, 34, 10) if name in WARM else TEAL)
        SHOTS[name](img, lt, sd, **a)
        # камера: медленный наезд + лёгкий сдвиг, направление чередуется
        si = sc["plan"].index(shot)
        z = 1.0 + 0.07 * (lt / max(sd, 0.5)) + 0.05 * (1 - ease_out(prog(lt, 0, 0.25)))
        dx = (1 if (si + idx) % 2 else -1) * 24 * (lt / max(sd, 0.5))
        cw, ch = W / z, H / z
        x0 = (W - cw) / 2 + dx
        y0 = (H - ch) / 2
        img = img.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((W, H), Image.BILINEAR)
        img.alpha_composite(vig)
        if lt < 2 / FPS and (fi > 0 or idx > 0):
            arr = np.array(img)
            for _ in range(6):
                y = random.randint(0, H - 80)
                hh = random.randint(16, 70)
                arr[y:y + hh] = np.roll(arr[y:y + hh], random.randint(-70, 70), axis=1)
            arr[..., 0] = np.roll(arr[..., 0], 10, axis=1)
            img = Image.fromarray(arr, "RGBA")
        draw_hud(img, sc["label"], sc["clock_s"] + t)
        draw_caption(img, t - LEAD, groups)
        p.stdin.write(img.convert("RGB").tobytes())
    p.stdin.close()
    p.wait()
    return out


def main(build):
    scenes = json.load(open(os.path.join(build, "vo", "timing.json")))
    lines, total = plan(scenes)
    json.dump([{"id": l["id"], "start": l["start"], "dur": l["dur"]} for l in lines], open(os.path.join(build, "layout.json"), "w"), indent=1)
    only = os.environ.get("ONLY")
    jobs = [(i, l, os.path.join(build, f"seg_{i:02d}.mp4")) for i, l in enumerate(lines) if not only or l["id"] in only.split(",")]
    with Pool(int(os.environ.get("JOBS", os.cpu_count() or 2))) as pool:
        for o in pool.imap_unordered(render_line, jobs):
            print("done", o, flush=True)
    print("total", total, "shots", sum(len(l["plan"]) for l in lines))


if __name__ == "__main__":
    main(sys.argv[1])
