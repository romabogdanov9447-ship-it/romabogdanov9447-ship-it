"""Сборка: склейка сегментов, голос, синтезированный фоновый бит и «вжухи» на склейках."""
import json, os, subprocess, sys, wave

import numpy as np

SR = 44100
LEAD = 0.25


def music(total, cuts):
    n = int(total * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    bpm = 96
    beat = 60 / bpm
    # тёмный пэд: Am - F - C - G (по 2 такта)
    roots = [55.0, 43.65, 65.41, 49.0]
    chords = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]]
    bar = beat * 4
    for i in range(int(total / (bar * 2)) + 1):
        s, e = int(i * bar * 2 * SR), int(min(total, (i + 1) * bar * 2) * SR)
        if s >= n:
            break
        seg = t[s:e] - t[s]
        r = roots[i % 4]
        env = np.minimum(1, seg / 0.4) * np.minimum(1, (seg[-1] - seg + 1e-3) / 0.4)
        for semi in chords[i % 4]:
            f = r * 2 ** (semi / 12) * 2
            for det in (-0.6, 0.6):
                out[s:e] += 0.05 * np.sin(2 * np.pi * (f + det) * seg) * env
        out[s:e] += 0.10 * np.sin(2 * np.pi * r * seg) * env  # саб-бас
    # кик и хэт
    kick_len = int(0.25 * SR)
    kt = np.arange(kick_len) / SR
    kick = np.sin(2 * np.pi * (45 + 90 * np.exp(-kt * 30)) * kt) * np.exp(-kt * 9)
    hat_len = int(0.05 * SR)
    hat = np.random.default_rng(1).standard_normal(hat_len) * np.exp(-np.arange(hat_len) / SR * 80)
    hat = np.diff(hat, prepend=0)
    start_beats = 4  # первые такты без барабанов
    for b in range(int(total / beat)):
        p = int(b * beat * SR)
        if b >= start_beats and p + kick_len < n:
            out[p:p + kick_len] += 0.35 * kick
        hp = int((b + 0.5) * beat * SR)
        if hp + hat_len < n:
            out[hp:hp + hat_len] += 0.05 * hat
    # вжухи на склейках
    rng = np.random.default_rng(2)
    wl = int(0.45 * SR)
    for c in cuts:
        p = int((c - 0.3) * SR)
        if p < 0 or p + wl >= n:
            continue
        noise = rng.standard_normal(wl)
        k = np.ones(40) / 40
        noise = np.convolve(noise, k, "same")
        env = np.sin(np.linspace(0, np.pi, wl)) ** 2
        out[p:p + wl] += 0.5 * noise * env
    # плавное начало/конец
    fade = int(1.5 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)
    out[:int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))
    out /= np.max(np.abs(out)) + 1e-9
    return (out * 0.9 * 32767).astype(np.int16)


def main(build, final):
    lay = json.load(open(os.path.join(build, "layout.json")))
    total = lay[-1]["start"] + lay[-1]["dur"]
    cuts = [s["start"] for s in lay[1:]]
    m = music(total, cuts)
    with wave.open(os.path.join(build, "music.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(m.tobytes())
    with open(os.path.join(build, "segs.txt"), "w") as f:
        for i in range(len(lay)):
            f.write(f"file 'seg_{i:02d}.mp4'\n")
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", os.path.join(build, "segs.txt"),
                           "-c", "copy", os.path.join(build, "video.mp4")])
    inputs, filt, labels = [], [], []
    for i, s in enumerate(lay):
        inputs += ["-i", os.path.join(build, "vo", s["id"] + ".mp3")]
        ms = int((s["start"] + LEAD) * 1000)
        filt.append(f"[{i + 2}:a]aresample=44100,adelay={ms}|{ms},apad[v{i}]")
        labels.append(f"[v{i}]")
    filt.append(f"{''.join(labels)}amix=inputs={len(lay)}:normalize=0,atrim=0:{total:.3f},"
                f"acompressor=threshold=-18dB:ratio=3,volume=1.6[vo]")
    filt.append("[vo]asplit=2[vo1][vo2]")
    filt.append("[1:a]volume=0.22[mus]")
    filt.append("[mus][vo2]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=300[duck]")
    filt.append("[vo1][duck]amix=inputs=2:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11[a]")
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(build, "video.mp4"),
                           "-i", os.path.join(build, "music.wav"), *inputs,
                           "-filter_complex", ";".join(filt), "-map", "0:v", "-map", "[a]",
                           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-movflags", "+faststart",
                           "-t", f"{total:.3f}", final])
    print("ok", final, total)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
