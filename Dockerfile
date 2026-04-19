FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 python3-pip git build-essential libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp + plugins
RUN pip3 install --break-system-packages --upgrade yt-dlp bgutil-ytdlp-pot-provider yt-dlp-ejs

# Clone bgutil server with correct version and build it properly
RUN cd /opt && \
    git clone --single-branch --branch 1.3.1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git && \
    cd bgutil-ytdlp-pot-provider/server && \
    npm ci && \
    npx tsc

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p tmp

EXPOSE 3000

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
