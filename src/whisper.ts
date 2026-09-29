import { readFile, rm, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

export type TranscriptSegment = { start: number; end: number; text: string };
export type Transcript = { text: string; segments: TranscriptSegment[] };

type WhisperJson = { text?: string; segments?: Array<{ start?: number; end?: number; text?: string }> };

export class WhisperService {
  constructor(private readonly command = "whisper", private readonly workDir = "./tmp/whisper") {}

  async transcribe(audioPath: string): Promise<Transcript> {
    await mkdir(this.workDir, { recursive: true });
    const stem = `transcript-${Date.now()}`;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(this.command, [audioPath, "--model", "base", "--output_format", "json", "--output_dir", this.workDir, "--fp16", "False"], { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      child.once("error", error => reject(new Error(`Whisper unavailable: ${error.message}`)));
      child.once("close", code => code === 0 ? resolve() : reject(new Error(`Whisper failed (${code}): ${stderr.slice(-2000)}`)));
    });
    const jsonPath = join(this.workDir, `${stem}.json`);
    const data = JSON.parse(await readFile(jsonPath, "utf8")) as WhisperJson;
    try {
      const segments = (data.segments ?? []).filter(s => Number.isFinite(s.start) && Number.isFinite(s.end) && typeof s.text === "string" && s.text.trim()).map(s => ({ start: Number(s.start), end: Number(s.end), text: s.text!.trim() }));
      return { text: typeof data.text === "string" ? data.text.trim() : segments.map(s => s.text).join(" "), segments };
    } finally { await rm(jsonPath, { force: true }); }
  }
}
