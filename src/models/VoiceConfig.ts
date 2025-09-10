export interface VoiceConfig {
  languageCode: string;
  voiceName: string;
  gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  speakingRate: number;
  pitch: number;
  volumeGainDb: number;
}

export interface LocalVoiceConfig extends VoiceConfig {
  modelPath?: string;
  customSettings?: Record<string, any>;
}

export class VoiceConfigImpl implements VoiceConfig {
  constructor(
    public languageCode: string,
    public voiceName: string,
    public gender: 'MALE' | 'FEMALE' | 'NEUTRAL',
    public speakingRate: number = 1.0,
    public pitch: number = 0.0,
    public volumeGainDb: number = 0.0
  ) {}

  validate(): boolean {
    return !!(
      this.languageCode && 
      this.voiceName && 
      this.gender &&
      this.speakingRate > 0 &&
      this.speakingRate <= 4.0
    );
  }
}