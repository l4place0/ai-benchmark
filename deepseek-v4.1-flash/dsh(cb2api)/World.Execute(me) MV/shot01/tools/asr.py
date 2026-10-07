"""Word-level lyric timing via faster-whisper. Model cached INSIDE the workdir."""
import os, json, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# force all HF caches inside the workdir
os.environ["HF_HOME"] = os.path.join(BASE, "tools", "hf")
os.environ["HUGGINGFACE_HUB_CACHE"] = os.path.join(BASE, "tools", "hf", "hub")
os.environ["XDG_CACHE_HOME"] = os.path.join(BASE, "tools", "cache")
# httpx cannot parse the bracketed IPv6 literal in NO_PROXY -> strip it
for _v in ("NO_PROXY", "no_proxy"):
    os.environ[_v] = "localhost,127.0.0.1"

from faster_whisper import WhisperModel
WAV = os.path.join(BASE, "audio", "song_48k.wav")
OUT = os.path.join(BASE, "analysis"); os.makedirs(OUT, exist_ok=True)

model = WhisperModel("small.en", device="cpu", compute_type="int8",
                     download_root=os.path.join(BASE, "tools", "hf", "hub"))
segments, info = model.transcribe(WAV, word_timestamps=True, vad_filter=False,
                                  beam_size=5, condition_on_previous_text=False)
print(f"lang={info.language} prob={info.language_probability:.2f}")
out = []
for s in segments:
    words = [{"w": w.word.strip(), "s": round(w.start,3), "e": round(w.end,3),
              "p": round(float(w.probability),3)} for w in (s.words or [])]
    out.append({"start": round(s.start,3), "end": round(s.end,3),
                "text": s.text.strip(), "words": words})
    print(f"[{s.start:7.2f} - {s.end:7.2f}] {s.text.strip()}")
json.dump(out, open(os.path.join(OUT,"lyrics_asr.json"),"w"), indent=1, ensure_ascii=False)
print("\nsaved", os.path.join(OUT,"lyrics_asr.json"))
