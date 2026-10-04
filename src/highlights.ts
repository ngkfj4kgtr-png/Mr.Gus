import type { TranscriptSegment } from "./whisper.js";

export type Highlight = {
  start: number;
  end: number;
  duration: number;
  text: string;
  score: number;
};

const MIN_DURATION = 8;
const TARGET_DURATION = 30;
const MAX_DURATION = 60;
const MAX_RESULTS = 3;

const HOOK_WORDS = ["почему", "зачем", "как", "смотрите", "представьте", "оказалось", "самое", "главное", "никогда", "никто", "всегда", "секрет", "реально", "серьезно", "в итоге", "вот что", "вот почему", "неожиданно", "прикиньте", "жесть", "капец", "интересно"];
const PAYOFF_WORDS = ["поэтому", "в итоге", "оказалось", "получается", "вот и всё", "вот почему", "вот что", "на самом деле", "короче", "итак"];
const FILLER_STARTS = ["ну", "ээ", "эм", "короче говоря", "как бы", "в общем", "значит"];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[«»"“”]/g, "").replace(/\s+/g, " ").trim();
}

function countMatches(text: string, words: string[]): number {
  return words.reduce((count, word) => {
    const normalizedWord = normalize(word);
    return count + (text.includes(normalizedWord) ? 1 : 0);
  }, 0);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function candidateScore(text: string, duration: number, firstSegment: TranscriptSegment, lastSegment: TranscriptSegment, videoDuration: number): number {
  const normalized = normalize(text);
  const words = wordCount(normalized);
  if (!words) return 0;

  const speechDensity = words / Math.max(1, duration);
  const densityScore = speechDensity >= 1.8 && speechDensity <= 3.8 ? 22 : speechDensity >= 1.2 && speechDensity <= 4.5 ? 12 : 4;
  const hookCount = countMatches(normalized, HOOK_WORDS);
  const payoffCount = countMatches(normalized, PAYOFF_WORDS);
  const questions = (text.match(/[?]/g) ?? []).length;
  const emotion = (text.match(/[!]/g) ?? []).length;

  let score = densityScore;
  score += Math.min(24, hookCount * 8);
  score += Math.min(12, questions * 4);
  score += Math.min(18, payoffCount * 6);
  score += Math.min(8, emotion * 2);

  const distanceFromTarget = Math.abs(duration - TARGET_DURATION);
  score += Math.max(0, 18 - Math.round(distanceFromTarget * 0.6));
  if (duration < MIN_DURATION) score -= 30;
  if (duration > 50) score -= Math.round((duration - 50) * 0.5);

  const firstText = normalize(firstSegment.text);
  if (FILLER_STARTS.some((word) => firstText === word || firstText.startsWith(word + " "))) score -= 8;

  const trailingWords = wordCount(normalize(lastSegment.text));
  if (trailingWords <= 2 && lastSegment.end < videoDuration - 2) score -= 6;

  const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
  score += Math.min(10, Math.max(0, sentenceCount - 1) * 2);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function findBestMoments(segments: TranscriptSegment[], videoDuration: number): Highlight[] {
  if (!segments.length || videoDuration <= 0) return [];

  const candidates: Highlight[] = [];

  for (let i = 0; i < segments.length; i++) {
    const start = Math.max(0, segments[i].start - 2);

    for (const targetDuration of [20, 30, 40, 50]) {
      let end = Math.min(videoDuration, start + targetDuration);
      let last = i;

      while (last + 1 < segments.length && segments[last + 1].start <= end) last++;
      end = Math.min(videoDuration, Math.max(end, segments[last].end));
      if (end - start < Math.min(MIN_DURATION, videoDuration)) continue;

      const text = segments.slice(i, last + 1).map((s) => s.text).join(" ").trim();
      if (!text) continue;

      candidates.push({
        start,
        end,
        duration: end - start,
        text,
        score: candidateScore(text, end - start, segments[i], segments[last], videoDuration),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected: Highlight[] = [];
  for (const candidate of candidates) {
    if (selected.some((x) => Math.max(x.start, candidate.start) < Math.min(x.end, candidate.end))) continue;
    selected.push(candidate);
    if (selected.length === MAX_RESULTS) break;
  }

  return selected.sort((a, b) => a.start - b.start);
}