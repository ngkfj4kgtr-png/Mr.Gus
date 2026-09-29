import type { TranscriptSegment } from "./whisper.js";

export type Highlight = {
  start: number;
  end: number;
  duration: number;
  text: string;
  score: number;
};

const MIN_DURATION = 15;
const MAX_DURATION = 60;
const MAX_RESULTS = 3;

export function findBestMoments(segments: TranscriptSegment[], videoDuration: number): Highlight[] {
  if (!segments.length || videoDuration <= 0) return [];

  const candidates: Highlight[] = [];
  for (let i = 0; i < segments.length; i++) {
    const start = Math.max(0, segments[i].start - 3);
    let end = Math.min(videoDuration, start + MAX_DURATION);
    let last = i;
    while (last + 1 < segments.length && segments[last + 1].end <= end) last++;
    end = Math.min(videoDuration, Math.max(end, segments[last].end));

    if (end - start < MIN_DURATION) continue;

    const text = segments.slice(i, last + 1).map(s => s.text).join(" ");
    const words = text.split(/\s+/).filter(Boolean).length;
    const punctuation = (text.match(/[!?]/g) ?? []).length;
    const questionWords = (text.match(/\b(почему|как|зачем|что|когда|why|how|what|when)\b/gi) ?? []).length;
    const speechDensity = words / Math.max(1, end - start);
    const score = Math.min(100, Math.round(speechDensity * 12 + punctuation * 8 + questionWords * 5));

    candidates.push({ start, end, duration: end - start, text, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected: Highlight[] = [];
  for (const candidate of candidates) {
    if (selected.some(x => Math.max(x.start, candidate.start) < Math.min(x.end, candidate.end))) continue;
    selected.push(candidate);
    if (selected.length === MAX_RESULTS) break;
  }
  return selected.sort((a, b) => a.start - b.start);
}
