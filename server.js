import express from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const TMP_DIR = path.join(__dirname, "tmp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

const COOKIES_PATH = path.join(__dirname, "cookies.txt");

// Clean old files every 10 minutes
setInterval(() => {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(TMP_DIR)) {
      const fp = path.join(TMP_DIR, f);
      if (now - fs.statSync(fp).mtimeMs > 15 * 60 * 1000) fs.unlinkSync(fp);
    }
  } catch {}
}, 10 * 60 * 1000);

app.get("/api/info", async (req, res) => {
  const { id } = req.query;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: "Invalid video ID" });
  }
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    if (!r.ok) throw new Error();
    const d = await r.json();
    res.json({ id, title: d.title, author: d.author_name, thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg` });
  } catch {
    res.json({ id, title: id, author: "Unknown", thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg` });
  }
});

app.get("/api/convert", async (req, res) => {
  const { id } = req.query;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: "Invalid video ID" });
  }

  const filename = `${id}_${crypto.randomBytes(4).toString("hex")}`;
  const outputTemplate = path.join(TMP_DIR, `${filename}.%(ext)s`);

  try {
    await new Promise((resolve, reject) => {
      const args = [
        "--cookies", COOKIES_PATH,
        "-f", "bestaudio/best",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--no-playlist",
        "--no-part",
        "--no-check-certificates",
        "--geo-bypass",
        "--add-metadata",
        "--postprocessor-args", "-b:a 320k",
        "--sleep-requests", "1",
        "-o", outputTemplate,
        `https://www.youtube.com/watch?v=${id}`,
      ];

      console.log(`Converting ${id}...`);
      const proc = spawn("yt-dlp", args, { timeout: 180000 });

      let stderr = "";
      proc.stderr.on("data", (d) => { stderr += d.toString(); console.error(d.toString()); });
      proc.stdout.on("data", (d) => { console.log(d.toString()); });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.slice(-500) || `exit code ${code}`));
      });
      proc.on("error", reject);
    });

    const candidates = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(filename));
    const mp3File = candidates.find((f) => f.endsWith(".mp3"));
    if (!mp3File) throw new Error("MP3 file not created");

    console.log(`Done: ${mp3File}`);
    res.json({ url: `/api/download/${mp3File}` });
  } catch (err) {
    console.error("Convert error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

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
  console.log(`Cookies: ${fs.existsSync(COOKIES_PATH) ? "LOADED" : "NOT FOUND"}`);
});
