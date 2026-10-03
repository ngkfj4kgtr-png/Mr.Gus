#!/bin/sh
set -eu

: "${TELEGRAM_API_ID:?TELEGRAM_API_ID is required}"
: "${TELEGRAM_API_HASH:?TELEGRAM_API_HASH is required}"
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is required}"

mkdir -p /var/lib/telegram-bot-api /tmp/telegram-bot-api

telegram-bot-api \
  --api-id="${TELEGRAM_API_ID}" \
  --api-hash="${TELEGRAM_API_HASH}" \
  --local \
  --http-port=8081 \
  --dir=/var/lib/telegram-bot-api \
  --temp-dir=/tmp/telegram-bot-api \
  > /tmp/telegram-bot-api.log 2>&1 &

API_PID=$!

cleanup() {
  kill "$API_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

i=0
while ! python3 -c 'import socket; s=socket.create_connection(("127.0.0.1",8081),0.5); s.close()' 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "Local Telegram Bot API did not start"
    cat /tmp/telegram-bot-api.log || true
    exit 1
  fi
  sleep 1
done

exec node dist/index.js
