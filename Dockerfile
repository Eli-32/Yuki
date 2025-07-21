FROM node:lts-buster

RUN sed -i 's|http://deb.debian.org/debian|http://archive.debian.org/debian|g' /etc/apt/sources.list && \
    sed -i '/security.debian.org/d' /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y ffmpeg imagemagick webp && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

COPY package.json .

RUN npm install --legacy-peer-deps && npm install qrcode-terminal --legacy-peer-depsCOPY . .

EXPOSE 5000

CMD ["node", "index.js", "--server"]
