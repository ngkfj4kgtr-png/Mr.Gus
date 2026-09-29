import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port");
}

export const config = {
  telegramBotToken: token,
  port,
} as const;
