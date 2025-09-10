import { spawn } from 'child_process';

export interface FFmpegConfig {
  ffmpegPath: string;
  ffprobePath: string;
  timeout: number;
}

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  frameRate: number;
  hasAudio: boolean;
}

export interface AudioInfo {
  duration: number;
  sampleRate: number;
  channels: number;
  codec: string;
  bitrate: number;
}

export class FFmpegWrapper {
  constructor(private config: FFmpegConfig) {}

  async extractAudio(videoPath: string, outputPath: string): Promise<void> {
    const args = [
      '-i', videoPath,
      '-vn', // No video
      '-acodec', 'pcm_s16le', // PCM 16-bit little-endian
      '-ar', '44100', // Sample rate
      '-ac', '2', // Stereo
      '-y', // Overwrite output file
      outputPath
    ];

    await this.runFFmpeg(args);
  }

  async getVideoInfo(videoPath: string): Promise<VideoInfo> {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath
    ];

    const output = await this.runFFprobe(args);
    const data = JSON.parse(output);

    const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
    const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio');

    if (!videoStream) {
      throw new Error('No video stream found');
    }

    return {
      duration: parseFloat(data.format?.duration || '0'),
      width: videoStream.width || 0,
      height: videoStream.height || 0,
      codec: videoStream.codec_name || 'unknown',
      bitrate: parseInt(data.format?.bit_rate || '0', 10) || 0,
      frameRate: this.parseFrameRate(videoStream.r_frame_rate),
      hasAudio: !!audioStream
    };
  }

  async getAudioInfo(audioPath: string): Promise<AudioInfo> {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      audioPath
    ];

    const output = await this.runFFprobe(args);
    const data = JSON.parse(output);

    const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio');

    if (!audioStream) {
      throw new Error('No audio stream found');
    }

    return {
      duration: parseFloat(data.format?.duration || '0'),
      sampleRate: parseInt(audioStream.sample_rate || '0', 10),
      channels: audioStream.channels || 0,
      codec: audioStream.codec_name || 'unknown',
      bitrate: parseInt(audioStream.bit_rate || '0', 10) || 0
    };
  }

  async combineVideoAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    const args = [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy', // Copy video stream without re-encoding
      '-c:a', 'aac', // Encode audio as AAC
      '-map', '0:v:0', // Map video from first input
      '-map', '1:a:0', // Map audio from second input
      '-shortest', // Finish when shortest input ends
      '-y', // Overwrite output file
      outputPath
    ];

    await this.runFFmpeg(args);
  }

  async combineAudioSegments(inputFiles: string[], outputPath: string, filterComplex?: string): Promise<void> {
    const args = [
      // Input files
      ...inputFiles.flatMap(file => ['-i', file]),
    ];

    if (filterComplex) {
      args.push('-filter_complex', filterComplex);
    } else {
      // Simple concatenation if no filter complex provided
      args.push('-filter_complex', `concat=n=${inputFiles.length}:v=0:a=1[out]`);
      args.push('-map', '[out]');
    }

    args.push(
      '-y', // Overwrite output file
      outputPath
    );

    await this.runFFmpeg(args);
  }

  async normalizeAudio(inputPath: string, outputPath: string, targetLUFS: number = -16): Promise<void> {
    const args = [
      '-i', inputPath,
      '-af', `loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11`,
      '-y',
      outputPath
    ];

    await this.runFFmpeg(args);
  }

  async addSilencePadding(inputPath: string, outputPath: string, startPaddingMs: number, endPaddingMs: number = 0): Promise<void> {
    const startPadding = startPaddingMs / 1000; // Convert to seconds
    const endPadding = endPaddingMs / 1000;

    const args = [
      '-i', inputPath,
      '-af', `apad=pad_dur=${endPadding},adelay=${Math.floor(startPaddingMs)}|${Math.floor(startPaddingMs)}`,
      '-y',
      outputPath
    ];

    await this.runFFmpeg(args);
  }

  async runCustomFFmpegCommand(args: string[]): Promise<string> {
    return await this.runFFmpeg(args);
  }

  private async runFFmpeg(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.ffmpegPath, args);
      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        process.kill('SIGKILL');
        reject(new Error(`FFmpeg process timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async runFFprobe(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.ffprobePath, args);
      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        process.kill('SIGKILL');
        reject(new Error(`FFprobe process timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`FFprobe process exited with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private parseFrameRate(frameRateStr: string): number {
    if (frameRateStr?.includes('/')) {
      const parts = frameRateStr.split('/').map(Number);
      const [num, den] = parts;
      return (num && den) ? num / den : 0;
    }
    return parseFloat(frameRateStr || '0');
  }
}