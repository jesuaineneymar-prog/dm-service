FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
