import { Resolution, VideoMetadata } from '../types/common';

export interface VideoFile {
  id: string;
  filename: string;
  path: string;
  format: string;
  duration: number;
  resolution: Resolution;
  metadata: VideoMetadata;
}

export class VideoFileImpl implements VideoFile {
  constructor(
    public id: string,
    public filename: string,
    public path: string,
    public format: string,
    public duration: number,
    public resolution: Resolution,
    public metadata: VideoMetadata
  ) {}

  validate(): boolean {
    return !!(this.id && this.filename && this.path && this.format && this.duration > 0);
  }
}