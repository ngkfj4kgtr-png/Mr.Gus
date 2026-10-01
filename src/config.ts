import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port");
}

const domain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL?.trim() ||
  (domain ? ["https:", "", domain, "telegram", "webhook"].join("/") : "");

if (!webhookUrl) {
  throw new Error("Telegram webhook URL is required");
}

export const config = {
  telegramBotToken: token,
  telegramWebhookUrl: webhookUrl,
  port,
} as const;
