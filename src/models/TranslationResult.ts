export interface TranslationSegment {
  originalText: string;
  translatedText: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranslationResult {
  id: string;
  originalText: string;
  translatedText: string;
  segments: TranslationSegment[];
  targetLanguage: string;
}

export class TranslationResultImpl implements TranslationResult {
  constructor(
    public id: string,
    public originalText: string,
    public translatedText: string,
    public segments: TranslationSegment[],
    public targetLanguage: string
  ) {}

  validate(): boolean {
    return !!(
      this.id && 
      this.originalText && 
      this.translatedText && 
      this.segments && 
      this.segments.length > 0 && 
      this.targetLanguage
    );
  }

  getTotalDuration(): number {
    if (this.segments.length === 0) return 0;
    const lastSegment = this.segments[this.segments.length - 1];
    return lastSegment?.endTime || 0;
  }
}