const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const { MongoClient } = require("mongodb");
const { v2: cloudinary } = require("cloudinary");
require("dotenv").config();

const YTDLP_PATH = "D:\\yt-dlp\\yt-dlp.exe";
const FFMPEG_BIN_DIR = "D:\\ffmpeg-8.0-essentials_build\\ffmpeg-8.0-essentials_build\\bin";
process.env.PATH += `;${FFMPEG_BIN_DIR}`;

const TMP_DIR = path.join(__dirname, "tmp_one");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function downloadWithYtDlp(url, outPrefix) {
  const args = [
    url,
    "--no-playlist",
    "--extract-audio",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "--write-thumbnail",
    "--output", `${outPrefix}.%(ext)s`,
  ];
  console.log("Running:", YTDLP_PATH, args.join(" "));
  await execFileAsync(YTDLP_PATH, args, { maxBuffer: 200 * 1024 * 1024, encoding: "utf8" });

  const mp3 = ["mp3", "m4a", "webm", "wav"].map(e => `${outPrefix}.${e}`).find(f => fs.existsSync(f));
  const thumb = ["jpg", "jpeg", "png", "webp"].map(e => `${outPrefix}.${e}`).find(f => fs.existsSync(f));
  if (!mp3) throw new Error("Audio file not found after yt-dlp download");
  return { mp3, thumb };
}

async function uploadToCloudinary(filePath, isAudio) {
  const folder = isAudio ? "musiccloud/audio" : "musiccloud/covers";
  const resource_type = isAudio ? "video" : "image";
  console.log("Uploading:", path.basename(filePath));
  const res = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type,
    use_filename: true,
    unique_filename: true,
  });
  return res.secure_url;
}

async function getTitle(url) {
  try {
    const { stdout } = await execFileAsync(YTDLP_PATH, [
      "--get-title",
      "--encoding", "utf-8",
      url
    ], {
      maxBuffer: 10 * 1024 * 1024,
      encoding: "buffer",
    });
    return stdout.toString("utf8").trim() || "Không rõ tiêu đề";
  } catch {
    return "Không rõ tiêu đề";
  }
}

function rmIfExists(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

function parseTitle(rawTitle, defaultArtist, username) {
  let artist = defaultArtist || username;
  let title = rawTitle;

  const parts = rawTitle.split(/[-–—]/);
  if (parts.length >= 2) {
    const possibleArtist = parts[0].trim();
    const possibleTitle = parts[1].split("|")[0].trim();
    if (!/official|video/i.test(possibleArtist)) artist = possibleArtist;
    title = possibleTitle;
  }

  title = title
    .replace(/\(.*Official.*\)/i, "")
    .replace(/\|.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const featMatch = rawTitle.match(/\(feat\. (.*?)\)/i);
  const featuring = featMatch ? featMatch[1].trim() : "";
  return { artist, title, featuring };
}

async function main() {
  const YT_URL = process.argv[2];
  const USERNAME = process.argv[3];
  if (!YT_URL || !USERNAME) {
    console.log('Usage: node scripts/import-one.js "<YouTube_URL>" <username>');
    process.exit(1);
  }

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error("Missing MONGO_URI in .env");

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const users = db.collection("users");
  const tracks = db.collection("tracks");

  console.log("Finding user:", USERNAME);
  const user = await users.findOne({ username: USERNAME });
  if (!user) {
    console.error("User not found:", USERNAME);
    await client.close();
    return;
  }

  const stamp = Date.now();
  const outPrefix = path.join(TMP_DIR, `${USERNAME}_${stamp}`);

  try {
    console.log("Downloading from YouTube...");
    const { mp3, thumb } = await downloadWithYtDlp(YT_URL, outPrefix);

    const audioUrl = await uploadToCloudinary(mp3, true);
    const coverUrl = thumb
      ? await uploadToCloudinary(thumb, false)
      : process.env.CLOUDINARY_DEFAULT_COVER_URL || "";

    const rawTitle = await getTitle(YT_URL);
    const parsed = parseTitle(rawTitle, user.name, USERNAME);

    const trackDoc = {
      title: parsed.title,
      artist: parsed.artist,
      featuring: parsed.featuring || "",
      audioUrl,
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

    const r = await tracks.insertOne(trackDoc);
    console.log("Added:", parsed.title);
    console.log("Artist:", parsed.artist);
    if (parsed.featuring) console.log("Featuring:", parsed.featuring);
    console.log("Track ID:", r.insertedId.toString());
    console.log("Audio URL:", audioUrl);
    console.log("Cover URL:", coverUrl);
  } catch (err) {
    console.error("Error:", err.message || err);
  } finally {
    for (const ext of ["mp3", "m4a", "webm", "wav", "jpg", "jpeg", "png", "webp"]) {
      rmIfExists(`${outPrefix}.${ext}`);
    }
    await client.close();
    console.log("Cleaned up and closed MongoDB connection.");
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});