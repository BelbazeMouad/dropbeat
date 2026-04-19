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

// yt-dlp args that bypass auth issues
const YT_DLP_BASE = [
  "--extractor-args", "youtube:player_client=mediaconnect",
  "--no-check-certificates",
  "--geo-bypass",
  "--no-playlist",
  "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

// Clean old files every 10 minutes
setInterval(() => {
  const now = Date.now();
  try {
    for (const f of fs.readdirSync(TMP_DIR)) {
      const fp = path.join(TMP_DIR, f);
      const age = now - fs.statSync(fp).mtimeMs;
      if (age > 15 * 60 * 1000) fs.unlinkSync(fp);
    }
  } catch {}
}, 10 * 60 * 1000);

// ── GET /api/info?id=VIDEO_ID ──────────────────────────────────────────────
app.get("/api/info", async (req, res) => {
  const { id } = req.query;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: "Invalid video ID" });
  }

  // Always use oEmbed for info — fast, no auth needed
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
    });
  } catch {
    res.json({
      id,
      title: id,
      author: "Unknown",
      thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    });
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
    await new Promise((resolve, reject) => {
      const args = [
        ...YT_DLP_BASE,
        "-x",                          // extract audio only
        "--audio-format", "mp3",       // convert to mp3
        "--audio-quality", "0",        // best quality (V0 ~245kbps VBR, or 320 CBR)
        "--no-part",
        "--embed-thumbnail",           // embed cover art
        "--add-metadata",              // embed title/artist
        "--postprocessor-args", "-b:a 320k", // force 320kbps
        "-o", outputPath.replace(".mp3", ".%(ext)s"),
        `https://www.youtube.com/watch?v=${id}`,
      ];

      const proc = spawn("yt-dlp", args, { timeout: 120000 });

      let stderr = "";
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.stdout.on("data", () => {}); // drain stdout
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.slice(-500) || `exit code ${code}`));
      });
      proc.on("error", reject);
    });

    // Find the mp3 output
    const candidates = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(id));
    const mp3File = candidates.find((f) => f.endsWith(".mp3"));

    if (!mp3File) {
      throw new Error("MP3 file not created");
    }

    res.json({ url: `/api/download/${mp3File}` });
  } catch (err) {
    try { fs.unlinkSync(outputPath); } catch {}
    console.error("Convert error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/download/:filename ────────────────────────────────────────────
app.get("/api/download/:filename", (req, res) => {
  const { filename } = req.params;

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

app.listen(PORT, () => {
  console.log(`DROPBEAT running on port ${PORT}`);
});
