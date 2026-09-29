export type TranscriptSegment = { start: number; end: number; text: string };

export type Transcript = { text: string; segments: TranscriptSegment[] };

export class WhisperService {
  constructor(private readonly command = "whisper") {}

  async transcribe(audioPath: string): Promise<Transcript> {
    throw new Error(`Whisper integration pending: ${this.command} ${audioPath}`);
  }
}
