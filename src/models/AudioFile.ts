export interface AudioFile {
  id: string;
  filename: string;
  path: string;
  format: string;
  duration: number;
  sampleRate: number;
  channels: number;
}

export class AudioFileImpl implements AudioFile {
  constructor(
    public id: string,
    public filename: string,
    public path: string,
    public format: string,
    public duration: number,
    public sampleRate: number,
    public channels: number
  ) {}

  validate(): boolean {
    return !!(
      this.id && 
      this.filename && 
      this.path && 
      this.format && 
      this.duration > 0 && 
      this.sampleRate > 0 && 
      this.channels > 0
    );
  }
}