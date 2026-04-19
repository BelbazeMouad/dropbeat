# DROPBEAT — Bulk YouTube → MP3 (320kbps)

Real conversion using **yt-dlp + ffmpeg** — not some flaky third-party API.

## Deploy Free on Railway

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your `dropbeat` repo
4. Railway auto-detects the Dockerfile and builds it
5. Once deployed, go to **Settings → Networking → Generate Domain**
6. Click the generated URL — your app is live

That's it. Railway's free tier gives you 500 hours/month which is plenty.

## What's inside

- **yt-dlp** — the real YouTube downloader, not a wrapper API
- **ffmpeg** — converts to 320kbps MP3 with embedded thumbnails + metadata
- **Express** server serves the frontend + handles conversion
- **Auto-cleanup** — temp files deleted after 15 minutes

## Run locally

```bash
# You need yt-dlp and ffmpeg installed
brew install yt-dlp ffmpeg   # macOS
sudo apt install ffmpeg && pip install yt-dlp   # Linux

npm install
npm start
# → http://localhost:3000
```
