import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, parse } from "node:path";

type ProbeStream = { codec_type?: string; width?: number; height?: number; duration?: string };
type ProbeResult = { format?: { duration?: string }; streams?: ProbeStream[] };

export type VideoInfo = { durationSeconds: number; width: number; height: number; hasAudio: boolean };

export class FfmpegService {
  constructor(private readonly workDir = "./tmp/work") {}

  async probe(inputPath: string): Promise<VideoInfo> {
    const output = await this.run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_type,width,height,duration",
      "-of", "json", inputPath,
    ]);
    let data: ProbeResult;
    try { data = JSON.parse(output) as ProbeResult; } catch { throw new Error("ffprobe returned invalid JSON"); }

    const video = data.streams?.find((stream) => stream.codec_type === "video");
    if (!video || !video.width || !video.height) throw new Error("No valid video stream found");

    const duration = Number(data.format?.duration ?? video.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Unable to determine video duration");

    return {
      durationSeconds: duration,
      width: video.width,
      height: video.height,
      hasAudio: Boolean(data.streams?.some((stream) => stream.codec_type === "audio")),
    };
  }

  async extractAudio(inputPath: string): Promise<string> {
    const outputPath = join(this.workDir, `${parse(inputPath).name}.wav`);
    await mkdir(dirname(outputPath), { recursive: true });
    await this.run("ffmpeg", [
      "-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", outputPath,
    ]);
    return outputPath;
  }

  async cleanup(filePath: string) { await rm(filePath, { force: true }); }

  private run(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      child.once("error", (error) => reject(new Error(`${command} is unavailable: ${error.message}`)));
      child.once("close", (code) => code === 0
        ? resolve(stdout)
        : reject(new Error(`${command} failed with code ${code}: ${stderr.slice(-2000)}`)));
    });
  }
}
