FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages yt-dlp

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p tmp

EXPOSE 3000

CMD ["node", "server.js"]
