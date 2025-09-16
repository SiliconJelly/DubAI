import { VideoFile } from '../models';
import { AudioTrack } from './AudioAssemblyService';

// Re-export AudioTrack for convenience
export { AudioTrack };

export interface VideoAssemblyService {
  combineVideoAudio(videoFile: VideoFile, audioTrack: AudioTrack): Promise<VideoFile>;
  preserveVideoQuality(inputVideo: VideoFile, outputVideo: VideoFile): Promise<void>;
  addMetadata(video: VideoFile, metadata: Record<string, any>): Promise<VideoFile>;
}

export interface VideoAssemblyConfig {
  outputFormat: string;
  preserveOriginalQuality: boolean;
  hardwareAcceleration: boolean;
  tempDirectory: string;
}