import { spawn } from "node:child_process";

export type VisualHighlight = {
  start: number;
  end: number;
  score: number;
};

const SAMPLE_FPS = 2;
const FRAME_WIDTH = 160;
const FRAME_HEIGHT = 284;
const FRAME_BYTES = FRAME_WIDTH * FRAME_HEIGHT;
const MIN_CLIP = 6;
const MAX_CLIP = 12;
const MAX_RESULTS = 3;

export class VisualAnalyzer {
  async findBestMoments(inputPath: string, durationSeconds: number): Promise<VisualHighlight[]> {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];

    const frames = await this.sampleFrames(inputPath);
    if (frames.length < 2) {
      return [{ start: 0, end: Math.min(MAX_CLIP, durationSeconds), score: 1 }];
    }

    const candidates: VisualHighlight[] = [];
    for (let i = 1; i < frames.length; i++) {
      const previous = frames[i - 1];
      const current = frames[i];
      const diff = this.frameDifference(previous, current);
      const brightnessChange = Math.abs(this.average(previous) - this.average(current)) / 255;
      const score = diff * 0.85 + brightnessChange * 0.15;
      const center = current.time;
      const start = Math.max(0, center - 4);
      const end = Math.min(durationSeconds, start + MAX_CLIP);
      if (end - start < MIN_CLIP) continue;
      candidates.push({ start, end, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    const selected: VisualHighlight[] = [];
    for (const candidate of candidates) {
      if (selected.some((x) => this.overlap(x, candidate) > 0.25)) continue;
      selected.push(candidate);
      if (selected.length >= MAX_RESULTS) break;
    }

    if (!selected.length) {
      selected.push({ start: 0, end: Math.min(MAX_CLIP, durationSeconds), score: 0 });
    }

    return selected.sort((a, b) => a.start - b.start);
  }

  private sampleFrames(inputPath: string): Promise<Array<{ time: number; data: Buffer }>> {
    return new Promise((resolve, reject) => {
      const child = spawn("ffmpeg", [
        "-v", "error",
        "-i", inputPath,
        "-vf", `fps=${SAMPLE_FPS},scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:force_original_aspect_ratio=decrease,pad=${FRAME_WIDTH}:${FRAME_HEIGHT}:(ow-iw)/2:(oh-ih)/2,format=gray`,
        "-f", "rawvideo",
        "-pix_fmt", "gray",
        "pipe:1",
      ], { stdio: ["ignore", "pipe", "pipe"] });

      const frames: Array<{ time: number; data: Buffer }> = [];
      let buffer = Buffer.alloc(0);
      let stderr = "";
      let index = 0;

      child.stdout.on("data", (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= FRAME_BYTES) {
          const data = Buffer.from(buffer.subarray(0, FRAME_BYTES));
          buffer = buffer.subarray(FRAME_BYTES);
          frames.push({ time: index / SAMPLE_FPS, data });
          index++;
        }
      });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      child.once("error", (error) => reject(new Error("Visual analysis unavailable: " + error.message)));
      child.once("close", (code) => {
        if (code === 0) resolve(frames);
        else reject(new Error("Visual analysis failed (" + code + "): " + stderr.slice(-1500)));
      });
    });
  }

  private average(frame: Buffer): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i];
    return sum / frame.length;
  }

  private frameDifference(a: Buffer, b: Buffer): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum / (a.length * 255);
  }

  private overlap(a: VisualHighlight, b: VisualHighlight): number {
    const intersection = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
    return intersection / Math.max(0.1, Math.min(a.end - a.start, b.end - b.start));
  }
}
