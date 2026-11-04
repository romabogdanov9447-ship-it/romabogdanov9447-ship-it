"""Озвучка сценария через edge-tts + тайминги слов для субтитров."""
import asyncio, json, sys, os, subprocess
import edge_tts

VOICE = os.environ.get("VOICE", "ru-RU-DmitryNeural")
RATE = os.environ.get("RATE", "+12%")

async def one(text, out_mp3):
    c = edge_tts.Communicate(text, VOICE, rate=RATE, pitch="-4Hz", boundary="WordBoundary")
    words = []
    with open(out_mp3, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "s": ch["offset"] / 1e7, "e": (ch["offset"] + ch["duration"]) / 1e7})
    return words

async def main(script, outdir):
    os.makedirs(outdir, exist_ok=True)
    scenes = json.load(open(script))
    cache_path = f"{outdir}/timing.json"
    cache = {c["id"]: c for c in json.load(open(cache_path))} if os.path.exists(cache_path) else {}
    for sc in scenes:
        mp3 = f"{outdir}/{sc['id']}.mp3"
        old = cache.get(sc["id"])
        if old and old.get("text") == sc["text"] and old.get("words") and os.path.getsize(mp3) > 0:
            sc["words"], sc["audio_dur"] = old["words"], old["audio_dur"]
            continue
        for attempt in range(10):
            try:
                sc["words"] = await one(sc["text"], mp3); break
            except Exception as ex:
                print("retry", sc["id"], ex); await asyncio.sleep(3 * (attempt + 1))
        else:
            raise SystemExit("TTS failed: " + sc["id"])
        d = subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",mp3]).decode().strip()
        sc["audio_dur"] = float(d)
        print(sc["id"], sc["audio_dur"], len(sc["words"]))
        json.dump([c for c in scenes if "words" in c], open(cache_path, "w"), ensure_ascii=False, indent=1)
    json.dump(scenes, open(cache_path, "w"), ensure_ascii=False, indent=1)

asyncio.run(main(sys.argv[1], sys.argv[2]))
