import http from "node:http";
import { config } from "./config.js";
import { ShortsBot } from "./bot.js";
import { TelegramClient } from "./telegram.js";
import { VideoStorage } from "./video.js";
import { FfmpegService } from "./ffmpeg.js";

const server = http.createServer((request, response) => {
  if (request.url === "/health" && request.method === "GET") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, service: "ai-shorts" }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(config.port, "0.0.0.0", () => console.log(`HTTP server listening on :${config.port}`));

const telegram = new TelegramClient(config.telegramBotToken);
const videoStorage = new VideoStorage(config.telegramBotToken);
const ffmpeg = new FfmpegService();
const bot = new ShortsBot(telegram, videoStorage, ffmpeg);

const shutdown = () => {
  bot.stop();
  server.close(() => process.exit(0));
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

void bot.start().catch((error) => {
  console.error("Fatal bot error:", error);
  process.exit(1);
});
