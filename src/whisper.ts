import { readFile, rm, mkdir, mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, extname, join } from "node:path";

export type TranscriptSegment = { start: number; end: number; text: string };
export type Transcript = { text: string; segments: TranscriptSegment[] };

type WhisperJson = {
  text?: string;
  segments?: Array<{ start?: number; end?: number; text?: string }>;
};

export class WhisperService {
  constructor(
    private readonly command = "whisper",
    private readonly workDir = "./tmp/whisper",
  ) {}

  async transcribe(audioPath: string): Promise<Transcript> {
    await mkdir(this.workDir, { recursive: true });

    const inputStem = basename(audioPath, extname(audioPath));
    const runDir = await mkdtemp(join(this.workDir, "run-"));
    const generatedPath = join(runDir, inputStem + ".json");

    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(this.command, [
          audioPath,
          "--model", process.env.WHISPER_MODEL ?? "tiny",
          "--output_format", "json",
          "--output_dir", runDir,
          "--fp16", "False",
        ], { stdio: ["ignore", "ignore", "pipe"] });

        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
        child.once("error", (error) => {
          reject(new Error("Whisper unavailable: " + error.message));
        });

        const timeout = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error("Whisper timeout after 120 seconds"));
        }, 120_000);
        child.once("close", () => clearTimeout(timeout));
        child.once("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error("Whisper failed (" + code + "): " + stderr.slice(-2000)));
        });
      });

      const raw = await readFile(generatedPath, "utf8");
      const data = JSON.parse(raw) as WhisperJson;
      const segments = (data.segments ?? [])
        .filter(
          (s) =>
            Number.isFinite(s.start) &&
            Number.isFinite(s.end) &&
            typeof s.text === "string" &&
            s.text.trim(),
        )
        .map((s) => ({
          start: Number(s.start),
          end: Number(s.end),
          text: s.text!.trim(),
        }));

      return {
        text:
          typeof data.text === "string"
            ? data.text.trim()
            : segments.map((s) => s.text).join(" "),
        segments,
      };
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  }
}
