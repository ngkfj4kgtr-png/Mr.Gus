import { TelegramClient, type TelegramUpdate } from "./telegram.js";
import { VideoStorage } from "./video.js";
import { FfmpegService } from "./ffmpeg.js";
import { WhisperService } from "./whisper.js";
import { findBestMoments } from "./highlights.js";

const MAX_TELEGRAM_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 10 * 60;

export class ShortsBot {
  private offset = 0;
  private running = true;

  constructor(
    private readonly telegram: TelegramClient,
    private readonly videoStorage: VideoStorage,
    private readonly ffmpeg: FfmpegService,
    private readonly whisper: WhisperService,
  ) {}

  stop() { this.running = false; }

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
      await this.telegram.sendMessage(message.chat.id,
        "🎬 Привет! Я AI Shorts.\n\nОтправь мне видео — я найду лучшие моменты и подготовлю Shorts с субтитрами.");
      return;
    }

    const video = message.video;
    const document = message.document?.mime_type?.startsWith("video/") ? message.document : undefined;

    if (video || document) {
      const fileId = video?.file_id ?? document!.file_id;
      const size = video?.file_size ?? document?.file_size;
      await this.handleVideo(message.chat.id, fileId, size);
      return;
    }

    await this.telegram.sendMessage(message.chat.id, "🎥 Пришли видеофайл. Я пока работаю только с видео.");
  }

  private async handleVideo(chatId: number, fileId: string, sizeBytes?: number) {
    if (sizeBytes && sizeBytes > MAX_TELEGRAM_DOWNLOAD_BYTES) {
      await this.telegram.sendMessage(chatId,
        "Видео слишком большое для стандартного Telegram Bot API. Максимум сейчас — 20 МБ.");
      return;
    }

    await this.telegram.sendMessage(chatId, "📥 Видео получено. Скачиваю файл...");

    let filePath: string | undefined;
    let audioPath: string | undefined;
    const renderedPaths: string[] = [];

    try {
      filePath = await this.videoStorage.download(fileId);
      const info = await this.ffmpeg.probe(filePath);
      console.log("Video probe:", info);

      if (info.durationSeconds > MAX_VIDEO_SECONDS) {
        await this.telegram.sendMessage(chatId, "Видео слишком длинное. Максимальная длительность — 10 минут.");
        return;
      }

      await this.telegram.sendMessage(chatId,
        `🔎 Видео проверено: ${Math.round(info.durationSeconds)} сек, ${info.width}×${info.height}, аудио: ${info.hasAudio ? "есть" : "нет"}.`);

      if (!info.hasAudio) {
        await this.telegram.sendMessage(chatId, "⚠️ В видео нет аудиодорожки. Для распознавания речи нужен звук.");
        return;
      }

      audioPath = await this.ffmpeg.extractAudio(filePath);
      console.log(`Audio extracted: ${audioPath}`);
      await this.telegram.sendMessage(chatId, "🧠 Распознаю речь и получаю таймкоды...");
      const transcript = await this.whisper.transcribe(audioPath);
      console.log("Whisper transcript:", transcript);
      await this.telegram.sendMessage(chatId,
        `📝 Распознавание готово: ${transcript.segments.length} сегментов речи.`);
      const highlights = findBestMoments(transcript.segments, info.durationSeconds);
      if (!highlights.length) {
        await this.telegram.sendMessage(chatId, "⚠️ Не удалось найти подходящие фрагменты для Shorts.");
        return;
      }
      await this.telegram.sendMessage(chatId,
        `🎯 Нашёл ${highlights.length} лучших момента(ов):\n\n${highlights.map((h, i) => `${i + 1}. ${Math.round(h.start)}–${Math.round(h.end)} сек.\n${h.text.slice(0, 180)}`).join("\n\n")}`);
      await this.telegram.sendMessage(chatId, "🎬 Рендерю вертикальные Shorts 9:16...");
      for (let i = 0; i < highlights.length; i++) {
        const h = highlights[i];
        renderedPaths.push(await this.ffmpeg.renderVertical(filePath, h.start, h.duration, i + 1));
      }

      await this.telegram.sendMessage(chatId, `📤 Отправляю ${renderedPaths.length} готовых Shorts...`);
      for (let i = 0; i < renderedPaths.length; i++) {
        await this.telegram.sendVideo(chatId, renderedPaths[i], `🎬 Short ${i + 1}/${renderedPaths.length}`);
      }
      await this.telegram.sendMessage(chatId, `✅ Готово: ${renderedPaths.length} Shorts отправлены.`);
    } catch (error) {
      console.error("Video processing error:", error);
      await this.telegram.sendMessage(chatId, "Не удалось обработать видео. Попробуй отправить его ещё раз.");
    } finally {
      for (const renderedPath of renderedPaths) await this.ffmpeg.cleanup(renderedPath).catch((error) => console.error("Rendered video cleanup failed:", error));
      if (audioPath) await this.ffmpeg.cleanup(audioPath).catch((error) => console.error("Temporary audio cleanup failed:", error));
      if (filePath) await this.videoStorage.remove(filePath).catch((error) => console.error("Temporary video cleanup failed:", error));
    }
  }
}