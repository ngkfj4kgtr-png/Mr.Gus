FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
COPY .env.example ./.env.example

RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
