import { readFile } from "node:fs/promises";

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
    video?: { file_id: string; file_unique_id: string; width: number; height: number; duration: number; file_size?: number };
    document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
  };
};

type TelegramResponse<T> = { ok: boolean; result: T; description?: string };

export class TelegramClient {
  constructor(private readonly token: string) {}

  private async call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}),
    });
    const data = await response.json() as TelegramResponse<T>;
    if (!response.ok || !data.ok) throw new Error(`Telegram API ${method} failed: ${data.description ?? response.statusText}`);
    return data.result;
  }

  getMe() {
    return this.call<{ id: number; is_bot: boolean; first_name: string; username?: string }>("getMe");
  }

  getUpdates(offset: number, timeoutSeconds: number) {
    return this.call<TelegramUpdate[]>("getUpdates", { offset, timeout: timeoutSeconds, allowed_updates: ["message"] });
  }

  async sendVideo(chatId: number, filePath: string, caption?: string) {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("video", new Blob([await readFile(filePath)]), "short.mp4");
    if (caption) form.append("caption", caption);
    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendVideo`, { method: "POST", body: form });
    const data = await response.json() as TelegramResponse<unknown>;
    if (!response.ok || !data.ok) throw new Error(`Telegram API sendVideo failed: ${data.description ?? response.statusText}`);
    return data.result;
  }

  sendMessage(chatId: number, text: string) {
    return this.call("sendMessage", { chat_id: chatId, text });
  }
}
