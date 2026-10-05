import http from "node:http";
import { config } from "./config.js";
import { ShortsBot } from "./bot.js";
import { TelegramClient, type TelegramUpdate } from "./telegram.js";
import { VideoStorage } from "./video.js";
import { FfmpegService } from "./ffmpeg.js";
import { WhisperService } from "./whisper.js";
import { VisualAnalyzer } from "./visual.js";

const telegram = new TelegramClient(config.telegramBotToken, config.telegramApiBaseUrl);
const bot = new ShortsBot(
  telegram,
  new VideoStorage(config.telegramBotToken, "./tmp/videos", config.telegramApiBaseUrl),
  new FfmpegService(),
  new WhisperService(),
  new VisualAnalyzer(),
);

const server = http.createServer((request, response) => {
  if (request.url === "/health" && request.method === "GET") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, service: "ai-shorts" }));
    return;
  }

  if (request.url === "/telegram/webhook" && request.method === "POST") {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      try {
        const update = JSON.parse(Buffer.concat(chunks).toString("utf8")) as TelegramUpdate;
        console.log("Telegram webhook update received:", {
          updateId: update.update_id,
          messageId: update.message?.message_id ?? null,
          hasText: Boolean(update.message?.text),
          hasVideo: Boolean(update.message?.video),
          hasDocument: Boolean(update.message?.document),
        });
        void bot.handleUpdate(update).catch((error) => console.error("Telegram webhook update failed:", error));
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true }));
      } catch {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: false }));
      }
    });
    return;
  }

  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(config.port, "0.0.0.0", () => console.log(`HTTP server listening on :${config.port}`));

const shutdown = () => {
  bot.stop();
  server.close(() => process.exit(0));
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

void bot.start(config.telegramWebhookUrl).catch((error) => {
  console.error("Fatal bot error:", error);
  process.exit(1);
});
