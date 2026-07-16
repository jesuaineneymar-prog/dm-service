# MBA Playwright Service v3 - Railway Deploy
# Capsolver CAPTCHA + IG (2FA) + FB + TikTok

FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm install --production

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY . .

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "server.js"]