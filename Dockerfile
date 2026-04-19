FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 python3-pip git && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp + PO Token plugins
RUN pip3 install --break-system-packages --upgrade yt-dlp bgutil-ytdlp-pot-provider

# Clone and setup bgutil server (generates PO tokens automatically)
RUN cd /opt && \
    git clone https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git && \
    cd bgutil-ytdlp-pot-provider/server && \
    npm install

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p tmp

EXPOSE 3000

# Start the bgutil PO token server in background, then start our app
CMD ["/bin/sh", "-c", "cd /opt/bgutil-ytdlp-pot-provider/server && node src/main.js &  sleep 3 && echo 'PO Token server started' && cd /app && node server.js"]
