import { SUPPORTED_VIDEO_FORMATS, SUPPORTED_AUDIO_FORMATS, FILE_SIZE_LIMITS } from './constants';
import { ValidationResult } from '../types/common';

import { MulterFile } from '../types/express';

export function validateVideoFile(file: MulterFile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size
  if (file.size > FILE_SIZE_LIMITS.MAX_VIDEO_SIZE) {
    errors.push(`File size ${file.size} exceeds maximum allowed size of ${FILE_SIZE_LIMITS.MAX_VIDEO_SIZE} bytes`);
  }

  // Check file extension
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  if (!extension || !SUPPORTED_VIDEO_FORMATS.includes(extension)) {
    errors.push(`Unsupported video format: ${extension}. Supported formats: ${SUPPORTED_VIDEO_FORMATS.join(', ')}`);
  }

  // Check MIME type
  if (!file.mimetype.startsWith('video/')) {
    errors.push(`Invalid MIME type: ${file.mimetype}. Expected video/* type`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateAudioFile(file: MulterFile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size
  if (file.size > FILE_SIZE_LIMITS.MAX_AUDIO_SIZE) {
    errors.push(`File size ${file.size} exceeds maximum allowed size of ${FILE_SIZE_LIMITS.MAX_AUDIO_SIZE} bytes`);
  }

  // Check file extension
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  if (!extension || !SUPPORTED_AUDIO_FORMATS.includes(extension)) {
    errors.push(`Unsupported audio format: ${extension}. Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`);
  }

  // Check MIME type
  if (!file.mimetype.startsWith('audio/')) {
    errors.push(`Invalid MIME type: ${file.mimetype}. Expected audio/* type`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateLanguageCode(languageCode: string): boolean {
  // Basic validation for language codes (ISO 639-1 or BCP 47)
  const languageCodeRegex = /^[a-z]{2}(-[A-Z]{2})?$/;
  return languageCodeRegex.test(languageCode);
}

export function validateSpeakingRate(rate: number): boolean {
  return rate >= 0.25 && rate <= 4.0;
}

export function validatePitch(pitch: number): boolean {
  return pitch >= -20.0 && pitch <= 20.0;
}

export function validateVolumeGain(gain: number): boolean {
  return gain >= -96.0 && gain <= 16.0;
}