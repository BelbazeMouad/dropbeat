FROM node:20-slim

# Install ffmpeg + python (needed by yt-dlp)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 curl && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p tmp

EXPOSE 3000

CMD ["node", "server.js"]
