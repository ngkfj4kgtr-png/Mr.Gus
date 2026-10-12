FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/whisper-venv \
  && /opt/whisper-venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/whisper-venv/bin/pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch \
  && /opt/whisper-venv/bin/pip install --no-cache-dir openai-whisper \
  && ln -s /opt/whisper-venv/bin/whisper /usr/local/bin/whisper

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --include=dev

COPY src ./src
RUN npm run build

ENV NODE_ENV=production \
    WHISPER_MODEL=base \
    WHISPER_LANGUAGE=ru \
    OMP_NUM_THREADS=2 \
    MKL_NUM_THREADS=2

CMD ["npm", "start"]
