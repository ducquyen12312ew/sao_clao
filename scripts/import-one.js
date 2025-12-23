const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const { MongoClient } = require("mongodb");
const { v2: cloudinary } = require("cloudinary");
require("dotenv").config();

const isWin = process.platform === "win32";

// YTDLP_PATH with existence fallback
let YTDLP_PATH = process.env.YTDLP_PATH || (isWin ? "D:\\yt-dlp\\yt-dlp.exe" : "yt-dlp");
if (!fs.existsSync(YTDLP_PATH)) {
  // fallback to PATH binary if provided path is missing
  YTDLP_PATH = "yt-dlp";
}

// FFMPEG_BIN_DIR (optional):
// - Trên macOS/Linux: /opt/homebrew/bin
// - Trên Windows: D:\ffmpeg-8.0-essentials_build\ffmpeg-8.0-essentials_build\bin
const FFMPEG_BIN_DIR = process.env.FFMPEG_BIN_DIR || (isWin
  ? "D:\\ffmpeg-8.0-essentials_build\\ffmpeg-8.0-essentials_build\\bin"
  : ""
);

// Thêm ffmpeg bin vào PATH (dùng path.delimiter cho cross-platform)
if (FFMPEG_BIN_DIR) {
  process.env.PATH += path.delimiter + FFMPEG_BIN_DIR;
}

const TMP_DIR = path.join(__dirname, "tmp_one");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// === Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function rmIfExists(p) { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { } }

// ================= yt-dlp helpers =================
async function downloadAudio(url, outPrefix) {
  const args = [
    url,
    "--no-playlist",
    "--extract-audio",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "--write-thumbnail",
    "--output", `${outPrefix}.%(ext)s`,
  ];
  try {
    await execFileAsync(YTDLP_PATH, args, { maxBuffer: 200 * 1024 * 1024 });
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`yt-dlp not found. Install yt-dlp and ensure it's in PATH, or set YTDLP_PATH. Current YTDLP_PATH=${YTDLP_PATH}`);
    }
    throw err;
  }
  const audio = ["mp3", "m4a", "webm", "wav"].map(e => `${outPrefix}.${e}`).find(fs.existsSync);
  const thumb = ["jpg", "jpeg", "png", "webp"].map(e => `${outPrefix}.${e}`).find(fs.existsSync);
  if (!audio) throw new Error("Audio file not found");
  return { audio, thumb };
}

async function downloadVideo(url, outPrefix, maxDuration = 180) {
  const args = [
    url,
    "--no-playlist",
    "--format", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
    "--merge-output-format", "mp4",
    "--write-thumbnail",
    "--output", `${outPrefix}.%(ext)s`,
  ];
  if (maxDuration) args.push("--postprocessor-args", `ffmpeg:-t ${maxDuration}`);
  try {
    await execFileAsync(YTDLP_PATH, args, { maxBuffer: 500 * 1024 * 1024 });
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`yt-dlp not found. Install yt-dlp and ensure it's in PATH, or set YTDLP_PATH. Current YTDLP_PATH=${YTDLP_PATH}`);
    }
    throw err;
  }

  const video = `${outPrefix}.mp4`;
  const thumb = ["jpg", "jpeg", "png", "webp"].map(e => `${outPrefix}.${e}`).find(fs.existsSync);
  if (!fs.existsSync(video)) throw new Error("Video file not found");
  return { video, thumb };
}

async function extractAudioFromVideo(videoPath, outPrefix) {
  const outMp3 = `${outPrefix}.mp3`;
  try {
    await execFileAsync("ffmpeg", ["-y", "-i", videoPath, "-vn", "-acodec", "libmp3lame", "-q:a", "0", outMp3], { maxBuffer: 500 * 1024 * 1024 });
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error("ffmpeg not found. Install ffmpeg and ensure it's in PATH, or set FFMPEG_BIN_DIR.");
    }
    throw err;
  }
  if (!fs.existsSync(outMp3)) throw new Error("Failed to extract audio");
  return outMp3;
}

async function uploadToCloudinary(filePath, type) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary credentials missing (.env CLOUDINARY_*).");
  }
  const folder =
    type === "video" ? "musiccloud/videos" :
    type === "audio" ? "musiccloud/audio" : "musiccloud/covers";

  const res = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: type === "image" ? "image" : "video",
    use_filename: true,
    unique_filename: true,
  });
  return res.secure_url;
}

// --------- Lấy metadata nhanh từ yt-dlp -J ----------
async function getMeta(url) {
  try {
    const { stdout } = await execFileAsync(YTDLP_PATH, ["-J", url], { maxBuffer: 30 * 1024 * 1024, encoding: "buffer" });
    const meta = JSON.parse(stdout.toString("utf8"));
    return {
      title: (meta.title || "").toString(),
      uploader: (meta.artist || meta.uploader || meta.channel || "").toString()
    };
  } catch {
    return { title: "", uploader: "" };
  }
}

function parseTitle(meta, defaultArtist, username) {
  const rawTitle = (meta.title || "").trim();
  const artist = (meta.uploader || defaultArtist || username || "").trim();
  const title = rawTitle || "Không rõ tiêu đề";
  return { artist, title };
}

// ================== Subtitles -> LRC ==================
function vttToLRC(vttText) {
  const lines = vttText.split(/\r?\n/);
  const out = [];
  const rx = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;

  const hmsToSec = (h, m, s, ms) => (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
  const secToTag = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const cs = Math.floor((sec - Math.floor(sec)) * 100);
    return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}]`;
  };

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].match(rx);
    if (!t) continue;

    // gom text đến khi gặp dòng trống
    let j = i + 1, text = [];
    while (j < lines.length && lines[j].trim() !== "") {
      text.push(lines[j].replace(/<\/?[^>]+>/g, "").trim());
      j++;
    }

    const start = hmsToSec(t[1], t[2], t[3], t[4]);
    const oneLine = text.join(" ").replace(/\s+/g, " ").trim();
    if (oneLine) out.push(`${secToTag(start)} ${oneLine}`);
    i = j;
  }
  return out.join("\n");
}

async function downloadSubtitles(url, outPrefix) {
  // Thử lấy phụ đề vi → en; chấp nhận auto-caption
  const args = [
    url,
    "--skip-download",
    "--write-subs", "--write-auto-subs",
    "--sub-lang", "vi,en",
    "--convert-subs", "vtt",
    "--output", `${outPrefix}.%(ext)s`,
  ];

  try {
    await execFileAsync(YTDLP_PATH, args, { maxBuffer: 200 * 1024 * 1024 });

    const vi = `${outPrefix}.vi.vtt`;
    const en = `${outPrefix}.en.vtt`;
    const pick = fs.existsSync(vi) ? vi : (fs.existsSync(en) ? en : null);
    if (!pick) return { lrc: "", text: "" };

    const vtt = fs.readFileSync(pick, "utf8");
    const lrc = vttToLRC(vtt);

    // plain text (không timestamp) để fallback
    const text = vtt
      .split(/\r?\n/)
      .filter(l => !/^\d+$/.test(l) && !/-->/i.test(l) && !/^(WEBVTT|Kind:|Language:)/i.test(l))
      .map(l => l.replace(/<\/?[^>]+>/g, "").trim())
      .filter(Boolean)
      .join("\n");

    return { lrc, text };
  } catch (e) {
    return { lrc: "", text: "" };
  } finally {
    // dọn phụ đề tạm
    rmIfExists(`${outPrefix}.vi.vtt`);
    rmIfExists(`${outPrefix}.en.vtt`);
  }
}

// ================== Quy trình chính cho 1 track ==================
async function processTrack(url, username, user, tracks, type = "audio", maxDuration = 180) {
  const stamp = Date.now() + Math.random().toString(36).slice(2);
  const outPrefix = path.join(TMP_DIR, `${username}_${stamp}`);

  try {
    let audioUrl = "";
    let videoUrl = "";
    let coverUrl = "";
    let thumb = null;

    if (type === "video") {
      const result = await downloadVideo(url, outPrefix, maxDuration);
      videoUrl = await uploadToCloudinary(result.video, "video");
      thumb = result.thumb;
      const mp3 = await extractAudioFromVideo(result.video, outPrefix);
      audioUrl = await uploadToCloudinary(mp3, "audio");
    } else {
      const result = await downloadAudio(url, outPrefix);
      audioUrl = await uploadToCloudinary(result.audio, "audio");
      thumb = result.thumb;
    }

    coverUrl = thumb
      ? await uploadToCloudinary(thumb, "image")
      : (process.env.CLOUDINARY_DEFAULT_COVER_URL || "");

    // meta & title/artist
    const meta = await getMeta(url);
    const parsed = parseTitle(meta, user.name, username);

    // === Lấy phụ đề -> LRC
    const subs = await downloadSubtitles(url, outPrefix);

    // Lưu DB
    const trackDoc = {
      title: parsed.title,
      artist: parsed.artist,
      audioUrl,
      videoUrl,
      coverUrl,
      userId: user._id,
      genres: [],
      tags: [],
      duration: 0,
      playCount: 0,
      likes: 0,
      status: "approved",
      reportCount: 0,
      lyricsLRC: subs.lrc || "",
      lyricsText: subs.text || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const r = await tracks.insertOne(trackDoc);
    console.log("Uploaded:", { audioUrl, videoUrl, coverUrl, artist: parsed.artist, title: parsed.title });
    return { success: true, id: r.insertedId };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    for (const ext of ["mp3", "mp4", "jpg", "jpeg", "png", "webp", "wav", "m4a"]) {
      rmIfExists(`${outPrefix}.${ext}`);
    }
  }
}

// ================= Entry =================
async function main() {
  const URL = process.argv[2];
  const USERNAME = process.argv[3];
  const TYPE = process.argv[4] || "audio";
  const MAX = process.argv[5] ? parseInt(process.argv[5]) : 180;

  if (!URL || !USERNAME) {
    console.log('Usage: node scripts/import-one.js "<youtube_url>" <username> [audio|video] [max_duration]');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();
  const users = db.collection("users");
  const tracks = db.collection("tracks");

  const user = await users.findOne({ username: USERNAME });
  if (!user) {
    console.error("User not found");
    await client.close();
    process.exit(1);
  }

  const r = await processTrack(URL, USERNAME, user, tracks, TYPE, MAX);
  await client.close();

  if (!r.success) {
    console.error("Error:", r.error);
    process.exit(1);
  } else {
    console.log("Imported track id:", r.id.toString());
  }
}

main().catch(e => {
  console.error("Unexpected:", e);
  process.exit(1);
});
