FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --include=optional

COPY prisma ./prisma
COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "node node_modules/prisma/build/index.js generate && node node_modules/prisma/build/index.js db push --accept-data-loss && node src/seed.js && node src/server.js"]
