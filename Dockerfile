FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg python3 python3-pip git \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --upgrade yt-dlp bgutil-ytdlp-pot-provider

RUN cd /opt && \
    git clone --single-branch --branch 1.3.1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git && \
    cd bgutil-ytdlp-pot-provider/server && \
    npm ci --ignore-scripts && \
    npx tsc || true

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p tmp

EXPOSE 3000

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
