import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TranscriptSegment } from "./whisper.js";

function formatTime(seconds: number): string {
  const totalMillis = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMillis / 3_600_000);
  const minutes = Math.floor((totalMillis % 3_600_000) / 60_000);
  const whole = Math.floor((totalMillis % 60_000) / 1000);
  const millis = totalMillis % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${whole.toString().padStart(2, "0")},${millis.toString().padStart(3, "0")}`;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function createSrt(
  segments: TranscriptSegment[],
  start: number,
  end: number,
  outputPath: string,
): Promise<string> {
  const entries: string[] = [];
  let number = 1;

  for (const segment of segments) {
    const segmentStart = Math.max(segment.start, start);
    const segmentEnd = Math.min(segment.end, end);
    const text = cleanText(segment.text);

    if (!text || segmentEnd <= segmentStart) continue;

    entries.push(
      `${number++}\n${formatTime(segmentStart - start)} --> ${formatTime(segmentEnd - start)}\n${text}\n`,
    );
  }

  if (!entries.length) {
    throw new Error("No subtitle segments overlap the selected highlight");
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, entries.join("\n"), "utf8");
  return outputPath;
}
