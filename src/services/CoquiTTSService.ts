import { LocalVoiceConfig } from '../models';
import { ModelInfo } from '../types/common';

export interface CoquiTTSService {
  loadModel(modelPath: string): Promise<void>;
  synthesizeSpeech(text: string, voiceConfig: LocalVoiceConfig): Promise<Buffer>;
  getModelInfo(): Promise<ModelInfo>;
  isModelLoaded(): boolean;
  unloadModel(): Promise<void>;
}

export interface CoquiTTSConfig {
  pythonPath: string;
  modelCachePath: string;
  maxConcurrentRequests: number;
  modelLoadTimeoutMs: number;
  synthesisTimeoutMs: number;
  defaultModelPath: string;
  banglaModelPath: string;
}

export interface CoquiModelConfig {
  modelPath: string;
  configPath?: string;
  speakerWav?: string;
  language: string;
  useGpu: boolean;
}