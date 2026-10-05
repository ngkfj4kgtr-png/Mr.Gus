import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { TelegramClient, type TelegramUpdate } from "./telegram.js";
import { VideoStorage } from "./video.js";
import { FfmpegService } from "./ffmpeg.js";
import { WhisperService } from "./whisper.js";
import { findBestMoments } from "./highlights.js";
import { createMontageSrt } from "./subtitles.js";

const MAX_TELEGRAM_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 10 * 60;

export class ShortsBot {
  private running = true;
  private readonly seenUpdateIds = new Set<number>();
  private readonly seenMessageKeys = new Set<string>();
  private readonly activeFileIds = new Set<string>();

  constructor(
    private readonly telegram: TelegramClient,
    private readonly videoStorage: VideoStorage,
    private readonly ffmpeg: FfmpegService,
    private readonly whisper: WhisperService,
  ) {}

  stop() { this.running = false; }

  async start(webhookUrl: string) {
    const me = await this.telegram.getMe();
    console.log(`Telegram bot connected: @${me.username ?? me.first_name}`);
    await this.telegram.setWebhook(webhookUrl);
    console.log(`Telegram webhook configured: ${webhookUrl}`);
    const webhook = await this.telegram.getWebhookInfo();
    console.log("Telegram webhook status:", {
      url: webhook.url,
      pendingUpdateCount: webhook.pending_update_count,
      allowedUpdates: webhook.allowed_updates ?? [],
      hasCustomCertificate: webhook.has_custom_certificate,
      lastErrorMessage: webhook.last_error_message ?? null,
    });
  }

  async handleUpdate(update: TelegramUpdate) {
    if (!this.running) return;

    const updateLockRoot = "./tmp/update-locks";
    const updateLockDir = join(updateLockRoot, String(update.update_id));
    await mkdir(updateLockRoot, { recursive: true });
    try {
      await mkdir(updateLockDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        console.log("Duplicate webhook update ignored:", update.update_id);
        return;
      }
      throw error;
    }

    try {
      if (this.seenUpdateIds.has(update.update_id)) return;
      this.seenUpdateIds.add(update.update_id);
      if (this.seenUpdateIds.size > 2000) {
        const oldest = this.seenUpdateIds.values().next().value as number | undefined;
        if (oldest !== undefined) this.seenUpdateIds.delete(oldest);
      }

      const message = update.message;
      if (!message) return;

      const messageKey = message.chat.id + ":" + message.message_id;
      if (this.seenMessageKeys.has(messageKey)) {
        console.log("Duplicate Telegram message ignored:", messageKey);
        return;
      }
      this.seenMessageKeys.add(messageKey);
      if (this.seenMessageKeys.size > 2000) {
        const oldest = this.seenMessageKeys.values().next().value as string | undefined;
        if (oldest !== undefined) this.seenMessageKeys.delete(oldest);
      }

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
        if (this.activeFileIds.has(fileId)) {
          console.log("Duplicate video processing ignored:", fileId);
          return;
        }
        this.activeFileIds.add(fileId);
        try {
          await this.handleVideo(message.chat.id, fileId, size);
        } finally {
          this.activeFileIds.delete(fileId);
        }
        return;
      }

      await this.telegram.sendMessage(message.chat.id, "🎥 Пришли видеофайл. Я пока работаю только с видео.");
    } finally {
      await rm(updateLockDir, { recursive: true, force: true });
    }
  }

  private async handleVideo(chatId: number, fileId: string, sizeBytes?: number) {
    const lockRoot = "./tmp/locks";
    const lockDir = join(lockRoot, encodeURIComponent(fileId));

    await mkdir(lockRoot, { recursive: true });
    try {
      await mkdir(lockDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        console.log("Duplicate video processing ignored by filesystem lock:", fileId);
        return;
      }
      throw error;
    }

    try {
      if (sizeBytes && sizeBytes > MAX_TELEGRAM_DOWNLOAD_BYTES) {
        await this.telegram.sendMessage(chatId,
          "Видео слишком большое для стандартного Telegram Bot API. Максимум сейчас — 50 МБ.");
        return;
      }

      await this.telegram.sendMessage(chatId, "📥 Видео получено. Скачиваю файл...");

      let filePath: string | undefined;
      let audioPath: string | undefined;
      const renderedPaths: string[] = [];
      const subtitlePaths: string[] = [];

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
        console.log("Whisper transcript ready:", { segments: transcript.segments.length, textLength: transcript.text.length });
        await this.telegram.sendMessage(chatId,
          `📝 Распознавание готово: ${transcript.segments.length} сегментов речи.`);

        const highlights = findBestMoments(transcript.segments, info.durationSeconds);
        if (!highlights.length) {
          await this.telegram.sendMessage(chatId, "⚠️ Не удалось найти подходящие фрагменты для Shorts.");
          return;
        }

        await this.telegram.sendMessage(chatId,
          `🎯 Нашёл ${highlights.length} лучших момента(ов):\\n\\n${highlights.map((h, i) => `${i + 1}. склейка: ${h.parts.map((p) => Math.round(p.start) + "–" + Math.round(p.end) + " сек.").join(" + ")}\\n${h.text.slice(0, 180)}`).join("\\n\\n")}`);
        await this.telegram.sendMessage(chatId, "🎬 Рендерю вертикальные Shorts 9:16...");

        for (let i = 0; i < highlights.length; i++) {
          const h = highlights[i];
          const subtitlePath = `./tmp/work/subtitles-${Date.now()}-${i + 1}.srt`;
          await createMontageSrt(transcript.segments, h.parts, subtitlePath);
          subtitlePaths.push(subtitlePath);
          console.log("Rendering Short:", { index: i + 1, start: h.start, duration: h.duration, subtitlePath });
          const renderedPath = await this.ffmpeg.renderMontage(filePath, h.parts, i + 1, subtitlePath);
          console.log("Rendered Short:", { index: i + 1, renderedPath });
          renderedPaths.push(renderedPath);
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
        for (const renderedPath of renderedPaths) {
          await this.ffmpeg.cleanup(renderedPath).catch((error) => console.error("Rendered video cleanup failed:", error));
        }
        for (const subtitlePath of subtitlePaths) {
          await this.ffmpeg.cleanup(subtitlePath).catch((error) => console.error("Subtitle cleanup failed:", error));
        }
        if (audioPath) {
          await this.ffmpeg.cleanup(audioPath).catch((error) => console.error("Temporary audio cleanup failed:", error));
        }
        if (filePath) {
          await this.videoStorage.remove(filePath).catch((error) => console.error("Temporary video cleanup failed:", error));
        }
      }
    } finally {
      await rm(lockDir, { recursive: true, force: true });
    }
  }
}
