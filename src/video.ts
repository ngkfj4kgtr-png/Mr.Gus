import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { pipeline } from "node:stream/promises";

type TelegramFileResponse = {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
};

export class VideoStorage {
  constructor(
    private readonly token: string,
    private readonly rootDir = "./tmp/videos",
    private readonly apiBaseUrl = "https://api.telegram.org",
  ) {}

  async download(fileId: string, maxBytes = 50 * 1024 * 1024): Promise<string> {
    const file = await this.getFile(fileId);

    if (!file.file_path) {
      throw new Error("Telegram did not return file_path");
    }

    const extension = extname(file.file_path).toLowerCase();
    const safeExtension = /^\.(mp4|mov|m4v|webm|mkv|avi|mpeg|mpg|3gp)$/.test(extension)
      ? extension
      : ".mp4";
    const target = `${this.rootDir}/${file.file_unique_id}${safeExtension}`;
    await mkdir(dirname(target), { recursive: true });

    const response = await fetch(
      `${this.apiBaseUrl}/file/bot${this.token}/${file.file_path}`,
    );

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes) {
      throw new Error(`Video exceeds ${maxBytes} byte download limit`);
    }

    if (!response.ok || !response.body) {
      throw new Error(`Video download failed: ${response.status} ${response.statusText}`);
    }

    let downloaded = 0;
    const limitedBody = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        downloaded += chunk.byteLength;
        if (downloaded > maxBytes) {
          controller.error(new Error(`Video exceeds ${maxBytes} byte download limit`));
          return;
        }
        controller.enqueue(chunk);
      },
    }));

    try {
      await pipeline(limitedBody, createWriteStream(target));
    } catch (error) {
      await rm(target, { force: true });
      throw error;
    }
    return target;
  }

  async remove(filePath: string) {
    await rm(filePath, { force: true });
  }

  private async getFile(fileId: string): Promise<TelegramFileResponse> {
    const response = await fetch(
      `${this.apiBaseUrl}/bot${this.token}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );

    const data = (await response.json()) as {
      ok: boolean;
      result?: TelegramFileResponse;
      description?: string;
    };

    if (!response.ok || !data.ok || !data.result) {
      throw new Error(
        `Telegram getFile failed: ${data.description ?? response.statusText}`,
      );
    }

    return data.result;
  }
}
