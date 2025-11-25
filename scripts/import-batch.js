const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const { MongoClient } = require("mongodb");
const { v2: cloudinary } = require("cloudinary");
require("dotenv").config();

const isWin = process.platform === "win32";

// YTDLP_PATH:
// - Trên macOS/Linux: chỉ cần đặt trong .env = /opt/homebrew/bin/yt-dlp
// - Trên Windows: có thể để trong .env = D:\yt-dlp\yt-dlp.exe
const YTDLP_PATH = process.env.YTDLP_PATH || (isWin ? "D:\\yt-dlp\\yt-dlp.exe" : "yt-dlp");

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

const TMP_DIR = path.join(__dirname, "tmp_batch");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
  await execFileAsync(YTDLP_PATH, args, { maxBuffer: 200 * 1024 * 1024 });
  const mp3 = ["mp3", "m4a", "webm", "wav"].map(e => `${outPrefix}.${e}`).find(fs.existsSync);
  const thumb = ["jpg", "jpeg", "png", "webp"].map(e => `${outPrefix}.${e}`).find(fs.existsSync);
  if (!mp3) throw new Error("Audio file not found");
  return { mp3, thumb };
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
  await execFileAsync(YTDLP_PATH, args, { maxBuffer: 500 * 1024 * 1024 });
  const video = `${outPrefix}.mp4`;
  const thumb = ["jpg", "jpeg", "png", "webp"].map(e => `${outPrefix}.${e}`).find(fs.existsSync);
  if (!fs.existsSync(video)) throw new Error("Video file not found");
  return { video, thumb };
}

async function extractAudioFromVideo(videoPath, outPrefix) {
  const outMp3 = `${outPrefix}.mp3`;
  await execFileAsync("ffmpeg", ["-y", "-i", videoPath, "-vn", "-acodec", "libmp3lame", "-q:a", "0", outMp3], { maxBuffer: 500 * 1024 * 1024 });
  if (!fs.existsSync(outMp3)) throw new Error("Failed to extract audio");
  return outMp3;
}

async function uploadToCloudinary(filePath, type) {
  const folder = type === "video" ? "musiccloud/videos" : type === "audio" ? "musiccloud/audio" : "musiccloud/covers";
  const res = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: type === "image" ? "image" : "video",
    use_filename: true,
    unique_filename: true,
  });
  return res.secure_url;
}

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

function rmIfExists(p) {
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
}

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
      audioUrl = await uploadToCloudinary(result.mp3, "audio");
      thumb = result.thumb;
    }

    coverUrl = thumb ? await uploadToCloudinary(thumb, "image") : process.env.CLOUDINARY_DEFAULT_COVER_URL || "";

    const meta = await getMeta(url);
    const parsed = parseTitle(meta, user.name, username);

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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await tracks.insertOne(trackDoc);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    for (const ext of ["mp3", "mp4", "jpg", "jpeg", "png", "webp", "wav", "m4a"]) {
      rmIfExists(`${outPrefix}.${ext}`);
    }
  }
}

async function main() {
  const FILE = process.argv[2];
  const USERNAME = process.argv[3];
  const TYPE = process.argv[4] || "audio";
  const MAX = process.argv[5] ? parseInt(process.argv[5]) : 180;
  if (!FILE || !USERNAME) {
    console.log("Usage: node scripts/import-batch.js <urls.txt> <username> [audio|video] [max_duration]");
    process.exit(1);
  }

  const urls = fs.readFileSync(FILE, "utf8").split("\n").map(s => s.trim()).filter(Boolean);
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();
  const users = db.collection("users");
  const tracks = db.collection("tracks");
  const user = await users.findOne({ username: USERNAME });
  if (!user) {
    await client.close();
    return;
  }

  for (const url of urls) {
    await processTrack(url, USERNAME, user, tracks, TYPE, MAX);
  }

  await client.close();
}

main().catch(e => {
  console.error("Unexpected:", e);
  process.exit(1);
});
