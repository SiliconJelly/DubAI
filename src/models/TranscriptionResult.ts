export interface TranscriptionSegment {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscriptionResult {
  id: string;
  segments: TranscriptionSegment[];
  language: string;
  confidence: number;
}

export class TranscriptionResultImpl implements TranscriptionResult {
  constructor(
    public id: string,
    public segments: TranscriptionSegment[],
    public language: string,
    public confidence: number
  ) {}

  validate(): boolean {
    return !!(
      this.id && 
      this.segments && 
      this.segments.length > 0 && 
      this.language &&
      this.confidence >= 0 && 
      this.confidence <= 1
    );
  }

  getTotalDuration(): number {
    if (this.segments.length === 0) return 0;
    const lastSegment = this.segments[this.segments.length - 1];
    return lastSegment?.endTime || 0;
  }
}