import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TranscriptSegment } from "./whisper.js";

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const whole = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  const normalizedMillis = millis === 1000 ? 0 : millis;
  const normalizedWhole = millis === 1000 ? whole + 1 : whole;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${normalizedWhole.toString().padStart(2, "0")},${normalizedMillis.toString().padStart(3, "0")}`;
}

function cleanText(text: string): string {
  return text.replace(/\\s+/g, " ").trim();
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
