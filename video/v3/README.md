# «Перекупы» v3 — 3D-ролик на озвучку ElevenLabs

Готовое видео: `../output/perekupy_v3.mp4` — 1080×1920 (9:16), 60 fps, H.264 + AAC, ~52 с.

- `storyboard.md` — раскадровка: варианты по каждой сцене и выбранный.
- `scene.html` — вся 3D-сцена (Three.js) и таймлайн; `renderAt(t)` отдаёт кадр детерминированно.
- `render.js` — покадровый рендер через Playwright (headless Chromium) → ffmpeg.
- `mix.py` — сведение звука: озвучка + музыка + синтезированные эффекты.
- `words.json` — тайминги слов озвучки (распознаны faster-whisper), по ним идут субтитры.

## Музыка — обязательно указать в описании ролика

> Music: "Hitman" by Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0
> https://creativecommons.org/licenses/by/4.0/

## Сборка

```bash
# рядом с scene.html: ./three -> node_modules/three, ./fonts (../assets/fonts), ./img (char.png, face.png), words.json
python3 -m http.server 8765 &
node render.js out 60 4
ffmpeg -f concat -i out/parts.txt -c copy video.mp4
python3 mix.py voice.mp3 Hitman.mp3 mix.wav
ffmpeg -i video.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -af loudnorm=I=-14:TP=-1 perekupy_v3.mp4
```
