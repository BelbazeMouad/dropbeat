import express from "express";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// Temp directory for converted files
const TMP_DIR = path.join(__dirname, "tmp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

// Clean old files every 10 minutes (keep tmp small)
setInterval(() => {
  const now = Date.now();
  for (const f of fs.readdirSync(TMP_DIR)) {
    const fp = path.join(TMP_DIR, f);
    const age = now - fs.statSync(fp).mtimeMs;
    if (age > 15 * 60 * 1000) fs.unlinkSync(fp); // 15 min
  }
}, 10 * 60 * 1000);

// ── GET /api/info?id=VIDEO_ID ──────────────────────────────────────────────
app.get("/api/info", async (req, res) => {
  const { id } = req.query;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: "Invalid video ID" });
  }

  try {
    const { stdout } = await execFileAsync("yt-dlp", [
      "--dump-json",
      "--no-download",
      "--no-playlist",
      `https://www.youtube.com/watch?v=${id}`,
    ], { timeout: 15000 });

    const info = JSON.parse(stdout);
    res.json({
      id,
      title: info.title || id,
      author: info.uploader || info.channel || "Unknown",
      thumbnail: info.thumbnail || `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
      duration: info.duration || 0,
    });
  } catch (err) {
    // Fallback to oEmbed if yt-dlp info fails
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
      );
      if (!oembedRes.ok) throw new Error("oembed failed");
      const data = await oembedRes.json();
      res.json({
        id,
        title: data.title,
        author: data.author_name,
        thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
        duration: 0,
      });
    } catch {
      res.status(500).json({ error: "Could not fetch video info" });
    }
  }
});

// ── GET /api/convert?id=VIDEO_ID ───────────────────────────────────────────
app.get("/api/convert", async (req, res) => {
  const { id } = req.query;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: "Invalid video ID" });
  }

  const filename = `${id}_${crypto.randomBytes(4).toString("hex")}.mp3`;
  const outputPath = path.join(TMP_DIR, filename);

  try {
    // yt-dlp: download best audio → ffmpeg converts to 320kbps MP3
    await new Promise((resolve, reject) => {
      const proc = spawn("yt-dlp", [
        "-x",                          // extract audio
        "--audio-format", "mp3",       // convert to mp3
        "--audio-quality", "0",        // best quality (VBR ~320kbps)
        "--no-playlist",
        "--no-part",
        "--embed-thumbnail",           // embed cover art in mp3
        "--add-metadata",              // add title/artist metadata
        "-o", outputPath.replace(".mp3", ".%(ext)s"),
        `https://www.youtube.com/watch?v=${id}`,
      ], { timeout: 120000 });

      let stderr = "";
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(-300)}`));
      });
      proc.on("error", reject);
    });

    // Find the output file (yt-dlp may name it slightly differently)
    const candidates = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(id));
    const mp3File = candidates.find((f) => f.endsWith(".mp3"));

    if (!mp3File) {
      throw new Error("MP3 file not created — yt-dlp may have failed silently");
    }

    const finalPath = path.join(TMP_DIR, mp3File);
    res.json({ url: `/api/download/${mp3File}` });
  } catch (err) {
    // Cleanup on error
    try { fs.unlinkSync(outputPath); } catch {}
    console.error("Convert error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/download/:filename ────────────────────────────────────────────
app.get("/api/download/:filename", (req, res) => {
  const { filename } = req.params;

  // Security: only allow expected filenames
  if (!/^[A-Za-z0-9_-]+\.mp3$/.test(filename)) {
    return res.status(400).json({ error: "Invalid filename" });
  }

  const filePath = path.join(TMP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found or expired" });
  }

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "audio/mpeg");
  fs.createReadStream(filePath).pipe(res);
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`DROPBEAT running on port ${PORT}`);
});
