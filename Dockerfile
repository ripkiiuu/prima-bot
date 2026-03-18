FROM node:20-slim

# Install Chromium dan dependencies-nya (Wajib untuk whatsapp-web.js)
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Beritahu puppeteer untuk tidak usah download Chrome lagi secara lokal,
# gunakan bawaan instalasi apt-get di atas.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

# Membuat folder session agar bot WhatsApp aman
RUN mkdir -p .wwebjs_auth && chown -R node:node /usr/src/app

USER node

CMD ["node", "index.js"]
