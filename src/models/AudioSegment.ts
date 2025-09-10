import { VoiceConfig } from './VoiceConfig';

export interface AudioSegment {
  id: string;
  text: string;
  audioBuffer: Buffer;
  startTime: number;
  endTime: number;
  voiceConfig: VoiceConfig;
}

export class AudioSegmentImpl implements AudioSegment {
  constructor(
    public id: string,
    public text: string,
    public audioBuffer: Buffer,
    public startTime: number,
    public endTime: number,
    public voiceConfig: VoiceConfig
  ) {}

  validate(): boolean {
    return !!(
      this.id && 
      this.text && 
      this.audioBuffer && 
      this.startTime >= 0 && 
      this.endTime > this.startTime &&
      this.voiceConfig
    );
  }

  getDuration(): number {
    return this.endTime - this.startTime;
  }
}