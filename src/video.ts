import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
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
  ) {}

  async download(fileId: string): Promise<string> {
    const file = await this.getFile(fileId);

    if (!file.file_path) {
      throw new Error("Telegram did not return file_path");
    }

    const target = `${this.rootDir}/${file.file_unique_id}.mp4`;
    await mkdir(dirname(target), { recursive: true });

    const response = await fetch(
      `https://api.telegram.org/file/bot${this.token}/${file.file_path}`,
    );

    if (!response.ok || !response.body) {
      throw new Error(`Video download failed: ${response.status} ${response.statusText}`);
    }

    await pipeline(response.body, createWriteStream(target));
    return target;
  }

  async remove(filePath: string) {
    await rm(filePath, { force: true });
  }

  private async getFile(fileId: string): Promise<TelegramFileResponse> {
    const response = await fetch(
      `https://api.telegram.org/bot${this.token}/getFile?file_id=${encodeURIComponent(fileId)}`,
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
