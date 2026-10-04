FROM debian:bookworm-slim AS telegram-api-build

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential cmake git gperf libssl-dev zlib1g-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN git clone --recursive --depth 1 https://github.com/tdlib/telegram-bot-api.git /src/telegram-bot-api \
  && cmake -S /src/telegram-bot-api -B /src/telegram-bot-api/build -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr/local \
  && cmake --build /src/telegram-bot-api/build --target install -j2

FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY --from=telegram-api-build /usr/local/bin/telegram-bot-api /usr/local/bin/telegram-bot-api

RUN python3 -m venv /opt/whisper-venv \
  && /opt/whisper-venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/whisper-venv/bin/pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch \
  && /opt/whisper-venv/bin/pip install --no-cache-dir openai-whisper \
  && /opt/whisper-venv/bin/python -c "import whisper; whisper.load_model(\"small\")" \
  && ln -s /opt/whisper-venv/bin/whisper /usr/local/bin/whisper

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
COPY .env.example ./.env.example
COPY start.sh ./start.sh
RUN chmod +x ./start.sh
RUN npm run build

ENV NODE_ENV=production \
    WHISPER_MODEL=small \
    WHISPER_LANGUAGE=ru \
    OMP_NUM_THREADS=2 \
    MKL_NUM_THREADS=2 \
    TELEGRAM_API_BASE_URL=http://127.0.0.1:8081

CMD ["./start.sh"]
