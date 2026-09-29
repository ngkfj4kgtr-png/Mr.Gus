import { TelegramClient, type TelegramUpdate } from "./telegram.js";
import { VideoStorage } from "./video.js";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 10 * 60;

export class ShortsBot {
  private offset = 0;
  private running = true;

  constructor(
    private readonly telegram: TelegramClient,
    private readonly videoStorage: VideoStorage,
  ) {}

  stop() {
    this.running = false;
  }

  async start() {
    const me = await this.telegram.getMe();
    console.log(`Telegram bot connected: @${me.username ?? me.first_name}`);

    while (this.running) {
      try {
        const updates = await this.telegram.getUpdates(this.offset, 50);

        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (error) {
        console.error("Telegram polling error:", error);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate) {
    const message = update.message;
    if (!message) return;

    if (message.text?.trim() === "/start") {
      await this.telegram.sendMessage(
        message.chat.id,
        "🎬 Привет! Я AI Shorts.\n\nОтправь мне видео — я найду лучшие моменты и подготовлю Shorts с субтитрами.",
      );
      return;
    }

    const video = message.video;
    const document = message.document?.mime_type?.startsWith("video/")
      ? message.document
      : undefined;

    if (video || document) {
      const fileId = video?.file_id ?? document!.file_id;
      const duration = video?.duration ?? 0;
      const size = video?.file_size ?? document?.file_size;

      await this.handleVideo(message.chat.id, fileId, duration, size);
      return;
    }

    await this.telegram.sendMessage(
      message.chat.id,
      "🎥 Пришли видеофайл. Я пока работаю только с видео.",
    );
  }

  private async handleVideo(
    chatId: number,
    fileId: string,
    durationSeconds: number,
    sizeBytes?: number,
  ) {
    if (sizeBytes && sizeBytes > MAX_VIDEO_BYTES) {
      await this.telegram.sendMessage(
        chatId,
        "Видео слишком большое. Максимальный размер — 100 МБ.",
      );
      return;
    }

    if (durationSeconds > MAX_VIDEO_SECONDS) {
      await this.telegram.sendMessage(
        chatId,
        "Видео слишком длинное. Максимальная длительность — 10 минут.",
      );
      return;
    }

    await this.telegram.sendMessage(chatId, "📥 Видео получено. Скачиваю файл...");

    let filePath: string | undefined;

    try {
      filePath = await this.videoStorage.download(fileId);
      console.log(`Video downloaded: ${filePath}`);

      await this.telegram.sendMessage(
        chatId,
        "✅ Видео скачано. Следующий этап — FFmpeg и распознавание речи.",
      );
    } catch (error) {
      console.error("Video processing error:", error);
      await this.telegram.sendMessage(
        chatId,
        "Не удалось получить видео. Попробуй отправить его ещё раз.",
      );
    } finally {
      if (filePath) {
        await this.videoStorage.remove(filePath).catch((error) => {
          console.error("Temporary video cleanup failed:", error);
        });
      }
    }
  }
}
