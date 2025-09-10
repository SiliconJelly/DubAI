export interface SRTSegment {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

export interface SRTFile {
  id: string;
  content: string;
  segments: SRTSegment[];
  totalDuration: number;
}

export class SRTFileImpl implements SRTFile {
  constructor(
    public id: string,
    public content: string,
    public segments: SRTSegment[],
    public totalDuration: number
  ) {}

  validate(): boolean {
    return !!(
      this.id && 
      this.content && 
      this.segments && 
      this.segments.length > 0 && 
      this.totalDuration > 0
    );
  }

  generateContent(): string {
    return this.segments
      .map(segment => 
        `${segment.index}\n${segment.startTime} --> ${segment.endTime}\n${segment.text}\n`
      )
      .join('\n');
  }

  static parseTimeString(timeStr: string): number {
    const [time, ms] = timeStr.split(',');
    const [hours, minutes, seconds] = time?.split(':').map(Number) || [0, 0, 0];
    return hours * 3600 + minutes * 60 + seconds + (parseInt(ms || '0', 10) / 1000);
  }

  static formatTimeString(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
}