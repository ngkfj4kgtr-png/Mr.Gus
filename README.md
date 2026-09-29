# AI Shorts

Telegram-бот, который принимает видео и превращает его в готовые Shorts.

## Сейчас реализовано

- TypeScript + Node.js 20+
- Telegram Bot API через long polling
- /start
- приём видео
- проверки 20 МБ и 10 минут
- HTTP /health для Railway
- скачивание видео с сохранением расширения
- FFmpeg probe, audio extraction и vertical 9:16 rendering
- Whisper transcription с таймкодами
- поиск до 3 лучших моментов
- SRT-субтитры
- отправка готовых Shorts обратно в Telegram

## Запуск

1. Скопировать .env.example в .env.
2. Заполнить TELEGRAM_BOT_TOKEN.
3. Установить зависимости:
   npm install
4. Запустить разработку:
   npm run dev

Для production:

npm run build
npm start

## Текущий deploy

Railway использует репозиторий ngkfj4kgtr-png/Mr.Gus, ветку main и endpoint /health.
