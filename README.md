# AI Shorts

Telegram-бот, который принимает видео и постепенно превращает его в готовые Shorts.

## Сейчас реализовано

- TypeScript + Node.js 20+
- Telegram Bot API через long polling
- /start
- приём видео
- проверки 100 МБ и 10 минут
- HTTP /health для Railway
- строгая структура для дальнейшего worker-модуля

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

## Следующий модуль

Worker будет отвечать за скачивание видео, FFmpeg, распознавание речи с таймкодами, поиск лучших фрагментов и рендер 9:16.
