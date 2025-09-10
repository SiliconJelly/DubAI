"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILE_SIZE_LIMITS = exports.PROCESSING_TIMEOUTS = exports.QUALITY_THRESHOLDS = exports.WHISPER_CONFIG = exports.GOOGLE_TTS_LIMITS = exports.DEFAULT_VOICE_CONFIG = exports.SUPPORTED_AUDIO_FORMATS = exports.SUPPORTED_VIDEO_FORMATS = void 0;
exports.SUPPORTED_VIDEO_FORMATS = [
    'mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'
];
exports.SUPPORTED_AUDIO_FORMATS = [
    'wav', 'mp3', 'aac', 'flac', 'ogg'
];
exports.DEFAULT_VOICE_CONFIG = {
    languageCode: 'bn-IN',
    voiceName: 'bn-IN-Standard-A',
    gender: 'FEMALE',
    speakingRate: 1.0,
    pitch: 0.0,
    volumeGainDb: 0.0
};
exports.GOOGLE_TTS_LIMITS = {
    FREE_TIER_CHARACTERS: 4000000,
    RATE_LIMIT_PER_MINUTE: 300,
    MAX_TEXT_LENGTH: 5000
};
exports.WHISPER_CONFIG = {
    DEFAULT_MODEL: 'large-v3',
    SUPPORTED_MODELS: ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'],
    DEFAULT_TEMPERATURE: 0.0,
    MAX_RETRIES: 3
};
exports.QUALITY_THRESHOLDS = {
    AUDIO_QUALITY_MIN: 0.7,
    SYNCHRONIZATION_ACCURACY_MIN: 0.8,
    OVERALL_SCORE_MIN: 0.75
};
exports.PROCESSING_TIMEOUTS = {
    VIDEO_EXTRACTION: 300000, // 5 minutes
    TRANSCRIPTION: 600000, // 10 minutes
    TTS_GENERATION: 300000, // 5 minutes
    ASSEMBLY: 600000, // 10 minutes
    TOTAL_JOB: 1800000 // 30 minutes
};
exports.FILE_SIZE_LIMITS = {
    MAX_VIDEO_SIZE: 500 * 1024 * 1024, // 500MB
    MAX_AUDIO_SIZE: 100 * 1024 * 1024, // 100MB
    TEMP_FILE_CLEANUP_HOURS: 24
};
