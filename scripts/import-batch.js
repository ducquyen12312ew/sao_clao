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
  await execFileAsync(YTDLP_PATH, args, { maxBuffer: 200 * 1024 * 1024, encoding: "utf8" });

  const mp3 = ["mp3", "m4a", "webm", "wav"].map(e => `${outPrefix}.${e}`).find(f => fs.existsSync(f));
  const thumb = ["jpg", "jpeg", "png", "webp"].map(e => `${outPrefix}.${e}`).find(f => fs.existsSync(f));
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
  
  if (maxDuration) {
    args.push("--postprocessor-args", `ffmpeg:-t ${maxDuration}`);
  }
  
  await execFileAsync(YTDLP_PATH, args, { maxBuffer: 500 * 1024 * 1024, encoding: "utf8" });

  const video = `${outPrefix}.mp4`;
  const thumb = ["jpg", "jpeg", "png", "webp"].map(e => `${outPrefix}.${e}`).find(f => fs.existsSync(f));
  if (!fs.existsSync(video)) throw new Error("Video file not found");
  return { video, thumb };
}

async function uploadToCloudinary(filePath, resourceType) {
  const folder = resourceType === "video" ? "musiccloud/videos" : 
                 resourceType === "audio" ? "musiccloud/audio" : "musiccloud/covers";
  
  console.log("  └─ Uploading:", path.basename(filePath));
  const res = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: resourceType === "image" ? "image" : "video",
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

async function processTrack(url, username, user, tracks, type = "audio", maxDuration = 180) {
  const stamp = Date.now() + Math.random().toString(36).substring(7);
  const outPrefix = path.join(TMP_DIR, `${username}_${stamp}`);
  
  try {
    let audioUrl = "";
    let videoUrl = "";
    let coverUrl = "";
    let thumb = null;

    if (type === "video") {
      console.log(`  ├─ Downloading video (max ${maxDuration}s)...`);
      const result = await downloadVideo(url, outPrefix, maxDuration);
      videoUrl = await uploadToCloudinary(result.video, "video");
      thumb = result.thumb;
      console.log("  ├─ Video uploaded successfully");
    } else {
      console.log("  ├─ Downloading audio...");
      const result = await downloadAudio(url, outPrefix);
      audioUrl = await uploadToCloudinary(result.mp3, "audio");
      thumb = result.thumb;
      console.log("  ├─ Audio uploaded successfully");
    }

    coverUrl = thumb
      ? await uploadToCloudinary(thumb, "image")
      : process.env.CLOUDINARY_DEFAULT_COVER_URL || "";

    const rawTitle = await getTitle(url);
    const parsed = parseTitle(rawTitle, user.name, username);

    const trackDoc = {
      title: parsed.title,
      artist: parsed.artist,
      featuring: parsed.featuring || "",
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

    const r = await tracks.insertOne(trackDoc);
    
    console.log("  ├─ Title:", parsed.title);
    console.log("  ├─ Artist:", parsed.artist);
    if (parsed.featuring) console.log("  ├─ Featuring:", parsed.featuring);
    console.log("  ├─ Track ID:", r.insertedId.toString());
    if (audioUrl) console.log("  ├─ Audio:", audioUrl.substring(0, 60) + "...");
    if (videoUrl) console.log("  ├─ Video:", videoUrl.substring(0, 60) + "...");
    console.log("  └─ Status: SUCCESS\n");
    
    return { success: true, trackId: r.insertedId };
  } catch (err) {
    console.error("  └─ Error:", err.message || err);
    return { success: false, error: err.message };
  } finally {
    for (const ext of ["mp3", "m4a", "webm", "wav", "mp4", "jpg", "jpeg", "png", "webp"]) {
      rmIfExists(`${outPrefix}.${ext}`);
    }
  }
}

async function main() {
  const INPUT_FILE = process.argv[2];
  const USERNAME = process.argv[3];
  const TYPE = process.argv[4] || "audio";
  const MAX_DURATION = process.argv[5] ? parseInt(process.argv[5]) : 180;
  
  if (!INPUT_FILE || !USERNAME) {
    console.log('Usage: node scripts/import-batch.js <urls_file.txt> <username> [audio|video] [max_duration_seconds]');
    console.log('\nFile format (urls_file.txt):');
    console.log('https://youtube.com/watch?v=...');
    console.log('https://youtube.com/watch?v=...');
    console.log('https://youtube.com/watch?v=...');
    console.log('\nExamples:');
    console.log('  node scripts/import-batch.js urls.txt quynhchi audio');
    console.log('  node scripts/import-batch.js urls.txt quynhchi video 90');
    process.exit(1);
  }

  if (!fs.existsSync(INPUT_FILE)) {
    console.error("File not found:", INPUT_FILE);
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

  const urls = fs.readFileSync(INPUT_FILE, "utf8")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line && line.startsWith("http"));

  console.log(`\nFound ${urls.length} URLs to process\n`);
  console.log(`⚙️  Mode: ${TYPE.toUpperCase()}`);
  if (TYPE === "video") console.log(`⏱️  Max duration: ${MAX_DURATION}s`);
  console.log(`User: ${USERNAME}\n`);
  console.log("=" .repeat(60) + "\n");

  const results = {
    success: 0,
    failed: 0,
    total: urls.length
  };

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] Processing: ${url}`);
    
    const result = await processTrack(url, USERNAME, user, tracks, TYPE, MAX_DURATION);
    
    if (result.success) {
      results.success++;
    } else {
      results.failed++;
    }
  }

  console.log("=" .repeat(60));
  console.log("\nBATCH IMPORT SUMMARY");
  console.log("─".repeat(60));
  console.log(`Total URLs:      ${results.total}`);
  console.log(`Successful:    ${results.success}`);
  console.log(`Failed:        ${results.failed}`);
  console.log(`Success Rate:    ${((results.success / results.total) * 100).toFixed(1)}%`);
  console.log("─".repeat(60) + "\n");

  await client.close();
  console.log("✨ Batch import completed!");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});