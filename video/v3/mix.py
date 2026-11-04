"""Звук ролика v3: озвучка + музыка (Hitman, K. MacLeod, CC BY 4.0) + синтезированные SFX.

python3 mix.py voice.mp3 music.mp3 out.wav
"""
import subprocess, sys
import numpy as np

SR = 44100
END = 52.6
MUSIC_OFF = 28.15      # момент в треке, который звучит на 0.0 с видео (вход бита 52.15 -> 24.0 с)
STOP_AT, RESTART = 36.35, 37.12


def load(p):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", p, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"])
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


N = int(END * SR)
T = np.arange(N) / SR
rng = np.random.default_rng(5)


def at(t):
    return int(t * SR)


def add(buf, t, sig, gain=1.0, pan=0.0):
    i = at(t)
    if i >= N:
        return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(sig), 0] += sig * gain * l * 1.41
    buf[i:i + len(sig), 1] += sig * gain * r * 1.41


def lp(x, a):  # one-pole lowpass, a in (0,1)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc); y[i] = acc
    return y


def lp_fast(x, cutoff):
    # FFT brickwall-ish lowpass with soft roll-off
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def bp(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (f > lo) & (f < hi)
    return np.fft.irfft(X, len(x))


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)


# ---------------------------------------------------------------- SFX
def whoosh(dur=0.6, lo=300, hi=4000, rev=False):
    n = int(dur * SR); x = rng.standard_normal(n)
    out = np.zeros(n); seg = 2048
    for s in range(0, n, seg):
        k = s / n; k = 1 - k if rev else k
        c = lo + (hi - lo) * np.sin(np.pi * min(1, k * 1.1)) ** 2
        out[s:s + seg] = bp(x[s:s + seg], c * .5, c * 1.6)[: len(out[s:s + seg])]
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    if rev:
        e = np.linspace(0, 1, n) ** 3
    return out * e / (np.abs(out).max() + 1e-9)


def boom(dur=1.6, f0=70, f1=32, click=True):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)
    s = np.tanh(s * 2.2)
    if click:
        c = rng.standard_normal(n) * np.exp(-t * 60); s += lp_fast(c, 3000) * .6
    return s / np.abs(s).max()


def tick(f=3200):
    n = int(.03 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + rng.standard_normal(n) * .4) * np.exp(-t * 260)


def beep(f=2000, dur=.09):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sign(np.sin(2 * np.pi * f * t)) * .3 * np.minimum(1, (dur - t) / .01)


def ding(f=1320):
    n = int(1.2 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 1.5 * t) * (t > .09)) * np.exp(-t * 4) * np.minimum(1, t / .003)


def buzz(dur=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    am = (np.sin(2 * np.pi * 7 * t) > -0.2).astype(float)
    s = (np.sin(2 * np.pi * 155 * t) + .4 * np.sign(np.sin(2 * np.pi * 155 * t))) * am
    return lp_fast(s, 900) * .8


def thud():
    n = int(.6 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * (90 * np.exp(-t * 8) + 45) * t) * np.exp(-t * 9)
    s += lp_fast(rng.standard_normal(n), 1500) * np.exp(-t * 40) * 1.5
    return np.tanh(s * 1.5)


def paper():
    n = int(.35 * SR); t = np.arange(n) / SR
    s = bp(rng.standard_normal(n), 1500, 7000) * (np.abs(np.sin(t * 90)) ** 2) * np.exp(-t * 7)
    return s / np.abs(s).max()


def pop(f=600):
    n = int(.12 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (f + 900 * np.exp(-t * 60)) * t) * np.exp(-t * 35)


def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n); x = rng.standard_normal(n); seg = 2048
    for st in range(0, n, seg):
        c = 400 + 6000 * (st / n) ** 2
        s[st:st + seg] = bp(x[st:st + seg], c * .7, c * 1.4)[: len(s[st:st + seg])]
    s += np.sin(2 * np.pi * np.cumsum(200 + 900 * (t / dur) ** 2) / SR) * .3
    return s * (t / dur) ** 2 / (np.abs(s).max() + 1e-9)


def reverb(x, dur=1.4, wet=.22):
    n = int(dur * SR); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 4.5)
    ir = lp_fast(ir, 5000); ir /= np.sqrt((ir ** 2).sum())
    out = np.zeros_like(x)
    for ch in range(2):
        L_ = len(x) + n
        y = np.fft.irfft(np.fft.rfft(x[:, ch], L_) * np.fft.rfft(ir, L_), L_)[: len(x)]
        out[:, ch] = x[:, ch] + wet * y
    return out


def build_sfx():
    s = np.zeros((N, 2))
    add(s, 0.0, boom(2.5, 50, 28, click=False), .35)
    add(s, 0.2, whoosh(.9, 200, 1800), .25)
    add(s, 1.12, beep(), .18); add(s, 1.25, beep(), .18)
    add(s, 1.9, whoosh(.5, 300, 2500), .12, -.4)
    add(s, 3.24, whoosh(.4, 400, 3000), .1, .4)
    add(s, 4.12, buzz(1.1), .35); add(s, 4.15, ding(1568), .22)
    add(s, 4.85, whoosh(.5, 300, 6000), .35)
    for i, tt in enumerate(np.arange(5.3, 8.7, .09)):
        add(s, tt, tick(2500 + (i % 5) * 300), .05 + .05 * (tt - 5.3) / 3.4, (i % 3 - 1) * .5)
    for i, tt in enumerate(np.linspace(8.85, 9.75, 10)):
        add(s, tt, ding(1800 + i * 90) * np.exp(-np.arange(int(1.2 * SR)) / SR * 10), .08, (i / 5 - 1))
    add(s, 10.64, boom(1.8, 65, 30), .5); add(s, 11.12, ding(2093), .25)
    add(s, 12.0, whoosh(.6, 300, 4000), .25)
    add(s, 14.18, thud(), .45); add(s, 15.86, thud(), .5); add(s, 16.45, pop(900), .3)
    for tt in np.arange(17.64, 19.7, .5):
        add(s, tt, tick(1800), .3)
    add(s, 18.2, thud(), .25)
    tt, gap = 19.8, .5
    while tt < 22.4:
        add(s, tt, tick(2200), .22); tt += gap; gap = max(.06, gap * .82)
    add(s, 23.27, thud(), .8); add(s, 23.27, boom(1.2, 80, 35), .45)
    add(s, 23.35, riser(.68), .3)
    add(s, 24.02, boom(2.2, 75, 30), .7)
    add(s, 24.95, pop(1400), .3)
    add(s, 26.04, whoosh(.35, 600, 5000), .2); add(s, 26.1, ding(1046) * .6, .15)
    add(s, 26.82, whoosh(.9, 150, 2500), .4, -.6)
    add(s, 27.6, beep(2600, .06), .15); add(s, 28.0, beep(3100, .06), .12)
    add(s, 28.3, pop(700), .35, -.3); add(s, 28.75, pop(500), .35, .3)
    for i in range(5):
        add(s, 29.42 + i * .14, thud() * .7, .3); add(s, 29.42 + i * .14, paper(), .18)
    add(s, 31.38, whoosh(.5, 300, 3500), .25); add(s, 32.0, ding(1760), .22)
    add(s, 33.7, boom(1.6, 70, 32), .5)
    for i in range(14):
        add(s, 33.8 + i * .13, paper(), .1, (i % 2) * 1.2 - .6)
    add(s, 35.66, whoosh(.45, 400, 4000), .25)
    add(s, 36.62, whoosh(.5, 300, 6000, rev=True), .4)
    add(s, 37.1, boom(2.8, 60, 26), .9)
    add(s, 39.92, whoosh(.6, 300, 4000), .25)
    for i in range(6):
        add(s, 43.52 + i * .22, pop(400 + i * 60), .22)
    add(s, 43.4, whoosh(.5, 300, 3000), .2)
    add(s, 46.02, boom(1.4, 70, 34), .45)
    add(s, 48.2, whoosh(.6, 300, 4500), .3)
    add(s, 51.35, boom(3.0, 60, 26), .7)
    return reverb(s)


def build_music(path):
    m = load(path)
    out = np.zeros((N, 2))
    a = m[at(MUSIC_OFF): at(MUSIC_OFF) + at(STOP_AT)]
    out[: len(a)] = a
    # «тейп-стоп» 0.25 с: замедляем последний фрагмент
    ts_len = at(.25); seg = m[at(MUSIC_OFF + STOP_AT): at(MUSIC_OFF + STOP_AT) + ts_len * 2]
    idx = np.cumsum(np.linspace(1, 0.05, ts_len)); idx = idx[idx < len(seg) - 1]
    tape = np.stack([np.interp(idx, np.arange(len(seg)), seg[:, c]) for c in range(2)], 1) * np.linspace(1, 0, len(idx))[:, None]
    out[at(STOP_AT): at(STOP_AT) + len(tape)] = tape
    b = m[at(MUSIC_OFF + RESTART): at(MUSIC_OFF + RESTART) + (N - at(RESTART))]
    out[at(RESTART): at(RESTART) + len(b)] = b
    # вступление: мягкий фейд-ин, финал — фейд-аут
    out[: at(1.0)] *= np.linspace(.2, 1, at(1.0))[:, None]
    f = at(1.4); out[-f:] *= np.linspace(1, 0, f)[:, None]
    return out


def duck(music, voice, depth=.5):
    e = np.abs(voice).mean(1)
    win = at(.05); e = np.convolve(e, np.ones(win) / win, "same")
    g = np.zeros_like(e); acc = 0; att, rel = 1 - np.exp(-1 / (SR * .03)), 1 - np.exp(-1 / (SR * .35))
    thr = np.percentile(e[e > 1e-4], 40)
    tgt = np.clip(e / thr, 0, 1)
    # быстрая огибающая (векторно через прореживание)
    step = 64; tg = tgt[::step]; gg = np.zeros_like(tg)
    for i in range(len(tg)):
        c = att * step if tg[i] > acc else rel * step
        acc += min(1, c) * (tg[i] - acc); gg[i] = acc
    g = np.repeat(gg, step)[: len(e)]
    return music * (1 - depth * g)[:, None]


if __name__ == "__main__":
    vpath, mpath, outp = sys.argv[1:4]
    v = load(vpath); voice = np.zeros((N, 2)); voice[: min(N, len(v))] = v[:N]
    music = build_music(mpath)
    sfx = build_sfx()
    gain = np.where(T < 24.0, 1.6, 0.6)
    gain = np.convolve(gain, np.ones(at(.02)) / at(.02), "same")  # без щелчка на стыке
    music = duck(music * gain[:, None], voice, .5)
    mix = voice * 1.0 + music * .55 + sfx * .5
    mix = np.tanh(mix * 1.1) / 1.1
    mix /= np.abs(mix).max() / .95
    raw = (mix * 32767).astype(np.int16)
    import wave
    with wave.open(outp, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(raw.tobytes())
    print("ok", outp, len(mix) / SR)
