FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp + PO Token provider plugin (auto-generates tokens)
RUN pip3 install --break-system-packages --upgrade yt-dlp bgutil-ytdlp-pot-provider

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p tmp

# bgutil PO token provider needs node available
ENV NODE_PATH=/usr/local/lib/node_modules

EXPOSE 3000

CMD ["/bin/sh", "-c", "yt-dlp -U; node server.js"]
