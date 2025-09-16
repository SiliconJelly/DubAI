import { AudioSegment } from '../models';

export interface AudioTrack {
  id: string;
  segments: AudioSegment[];
  totalDuration: number;
  sampleRate: number;
  channels: number;
  format: string;
}

export interface Timestamp {
  startTime: number;
  endTime: number;
  segmentId: string;
}

export interface AudioAssemblyService {
  assembleAudioTrack(segments: AudioSegment[]): Promise<AudioTrack>;
  synchronizeWithTimestamps(audio: AudioTrack, timestamps: Timestamp[]): Promise<AudioTrack>;
  normalizeAudio(audio: AudioTrack): Promise<AudioTrack>;
}

export interface AudioAssemblyConfig {
  outputFormat: string;
  sampleRate: number;
  channels: number;
  normalizationEnabled: boolean;
  silencePaddingMs: number;
}