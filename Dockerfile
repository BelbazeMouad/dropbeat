FROM node:20-slim

# Install certs, ffmpeg, python, yt-dlp
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp via pip instead of curl
RUN python3 -m ensurepip && pip3 install --break-system-packages yt-dlp

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p tmp

EXPOSE 3000

CMD ["node", "server.js"]
