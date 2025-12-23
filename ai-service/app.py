import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

import numpy as np
import pretty_midi
import tensorflow as tf
from tensorflow import keras
from basic_pitch.inference import predict_and_save
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="SAOCLAO AI Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH_ENV = os.getenv("AI_MODEL_PATH", "./model_saved")
MODEL_PATH = Path(MODEL_PATH_ENV)
if not MODEL_PATH.is_absolute():
    MODEL_PATH = (BASE_DIR / MODEL_PATH).resolve()
TMP_ROOT = Path(os.getenv("TMP_DIR", tempfile.gettempdir()))
SOUNDFONT_PATH = Path(os.getenv("SOUNDFONT_PATH", "/usr/share/sounds/sf2/FluidR3_GM.sf2"))

MODEL = None


def cleanup_path(path: Path):
    try:
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        elif path.exists():
            path.unlink(missing_ok=True)
    except Exception:
        pass


def ensure_tools():
    if shutil.which("fluidsynth") is None:
        raise HTTPException(status_code=500, detail="fluidsynth chưa cài hoặc không nằm trong PATH")
    if shutil.which("ffmpeg") is None:
        raise HTTPException(status_code=500, detail="ffmpeg chưa cài hoặc không nằm trong PATH")
    if not SOUNDFONT_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Không tìm thấy soundfont tại {SOUNDFONT_PATH}")


def load_model():
    global MODEL
    if MODEL is not None:
        return MODEL
    if not MODEL_PATH.exists():
        raise HTTPException(status_code=400, detail=f"AI_MODEL_PATH không tồn tại: {MODEL_PATH}")
    try:
        if MODEL_PATH.is_dir() and (MODEL_PATH / "saved_model.pb").exists():
            MODEL = keras.layers.TFSMLayer(str(MODEL_PATH), call_endpoint="serving_default")
        elif MODEL_PATH.suffix in {".keras", ".h5"}:
            MODEL = keras.models.load_model(str(MODEL_PATH))
        else:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"AI_MODEL_PATH không hợp lệ: {MODEL_PATH}. "
                    "Cần thư mục SavedModel (có saved_model.pb) hoặc file .keras/.h5."
                )
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể load model: {exc}")
    return MODEL


def convert_audio_to_midi(audio_path: Path, workdir: Path) -> Path:
    output_dir = workdir / "basic_pitch"
    output_dir.mkdir(parents=True, exist_ok=True)
    predict_and_save(
        [str(audio_path)],
        output_directory=str(output_dir),
        save_midi=True,
        sonify_midi=False,
        save_notes=False
    )
    midi_files = sorted(output_dir.glob("*.mid"))
    if not midi_files:
        raise HTTPException(status_code=400, detail="Không thể chuyển audio sang MIDI (basic-pitch không tạo file).")
    return midi_files[-1]


def pick_instrument(pm: pretty_midi.PrettyMIDI):
    instruments = [inst for inst in pm.instruments if not inst.is_drum and inst.notes]
    if not instruments:
        raise HTTPException(status_code=400, detail="MIDI không có nốt nhạc hợp lệ (non-drum).")
    return max(instruments, key=lambda inst: len(inst.notes))


def notes_to_events(notes):
    events = []
    prev_start = notes[0].start if notes else 0.0
    for note in notes:
        step = max(0.0, float(note.start - prev_start))
        duration = max(0.0, float(note.end - note.start))
        events.append([int(note.pitch), step, duration])
        prev_start = note.start
    return events


def sample_logits(logits, temperature: float) -> int:
    logits = np.asarray(logits, dtype=np.float64).reshape(-1)
    if logits.size == 1:
        return int(np.clip(round(float(logits[0])), 0, 127))
    logits = logits / max(temperature, 1e-5)
    probs = tf.nn.softmax(logits).numpy()
    probs = probs / probs.sum()
    choice = np.random.choice(len(probs), p=probs)
    return int(choice)


def decode_time_head(head, clamp_min=0.0, clamp_max=4.0, base_step=0.05) -> float:
    arr = np.asarray(head).reshape(-1)
    if arr.size == 1:
        val = float(arr[0])
    else:
        idx = int(np.argmax(arr))
        val = idx * base_step
    return float(np.clip(val, clamp_min, clamp_max))


def generate_continuation(model, seed_events, target_seconds: float, temperature: float, start_time: float):
    if not seed_events:
        seed_events = [[60, 0.0, 0.5]]
    if len(seed_events) < 20:
        seed_events = (seed_events * (20 // len(seed_events) + 1))[-20:]
    else:
        seed_events = seed_events[-20:]

    generated_events = []
    current_time = start_time
    generated_duration = 0.0

    while generated_duration < target_seconds:
        model_input = np.array(seed_events[-20:], dtype=np.float32)[None, ...]
        preds = model(model_input, training=False)

        if isinstance(preds, dict):
            pitch_logits = preds.get("pitch")
            step_head = preds.get("step")
            duration_head = preds.get("duration")
        elif isinstance(preds, (list, tuple)) and len(preds) >= 3:
            pitch_logits, step_head, duration_head = preds[:3]
        else:
            raise HTTPException(status_code=500, detail="Output model không đúng định dạng (cần pitch/step/duration).")

        pitch = np.clip(sample_logits(pitch_logits[0], temperature), 0, 127)
        step = decode_time_head(step_head[0] if hasattr(step_head, "__len__") else step_head)
        duration = decode_time_head(duration_head[0] if hasattr(duration_head, "__len__") else duration_head)

        note_start = current_time + max(0.0, step)
        note_end = note_start + max(0.05, duration)
        generated_events.append([int(pitch), note_start, note_end])

        current_time = note_end
        generated_duration += step + duration

        seed_events.append([pitch, step, duration])

    return generated_events


def export_midi(base_pm: pretty_midi.PrettyMIDI, instrument, generated_events, output_path: Path):
    # clone instrument to avoid mutating original
    new_instrument = pretty_midi.Instrument(program=instrument.program, name=instrument.name, is_drum=False)
    new_instrument.notes = list(instrument.notes)
    for pitch, start, end in generated_events:
        new_instrument.notes.append(
            pretty_midi.Note(velocity=90, pitch=int(pitch), start=float(start), end=float(end))
        )
    base_pm.instruments = [new_instrument]
    base_pm.write(str(output_path))


def render_to_mp3(midi_path: Path, workdir: Path) -> Path:
    ensure_tools()
    wav_path = workdir / "render.wav"
    mp3_path = workdir / "render.mp3"

    synth_cmd = [
        "fluidsynth",
        "-ni",
        str(SOUNDFONT_PATH),
        str(midi_path),
        "-F",
        str(wav_path),
        "-r",
        "44100"
    ]
    try:
        subprocess.run(synth_cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        raise HTTPException(status_code=500, detail=f"fluidsynth lỗi: {exc.stderr.decode() if exc.stderr else exc}")

    ffmpeg_cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(wav_path),
        "-codec:a",
        "libmp3lame",
        "-qscale:a",
        "2",
        str(mp3_path)
    ]
    try:
        subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        raise HTTPException(status_code=500, detail=f"ffmpeg lỗi: {exc.stderr.decode() if exc.stderr else exc}")

    return mp3_path


@app.post("/generate")
async def generate_music(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    seconds: int = Form(30),
    temperature: float = Form(1.0)
):
    workdir = TMP_ROOT / f"ai_{uuid.uuid4().hex}"
    workdir.mkdir(parents=True, exist_ok=True)

    try:
        file_ext = Path(file.filename).suffix.lower()
        input_path = workdir / f"input{file_ext}"
        with input_path.open("wb") as f:
            f.write(await file.read())

        seconds = max(5, min(120, seconds))
        temperature = max(0.2, min(2.0, temperature))

        if file_ext in [".mid", ".midi"]:
            midi_path = input_path
        else:
            midi_path = convert_audio_to_midi(input_path, workdir)

        pm = pretty_midi.PrettyMIDI(str(midi_path))
        instrument = pick_instrument(pm)
        notes = sorted(instrument.notes, key=lambda n: n.start)
        seed_events = notes_to_events(notes)
        model = load_model()
        generated_events = generate_continuation(
            model=model,
            seed_events=seed_events,
            target_seconds=float(seconds),
            temperature=float(temperature),
            start_time=notes[-1].end if notes else 0.0
        )

        output_midi = workdir / "output.mid"
        export_midi(pm, instrument, generated_events, output_midi)

        mp3_path = render_to_mp3(output_midi, workdir)

        background_tasks.add_task(cleanup_path, workdir)
        return FileResponse(
            path=mp3_path,
            media_type="audio/mpeg",
            filename="ai_generated.mp3"
        )
    except HTTPException:
        background_tasks.add_task(cleanup_path, workdir)
        raise
    except Exception as exc:
        background_tasks.add_task(cleanup_path, workdir)
        raise HTTPException(status_code=500, detail=str(exc))
