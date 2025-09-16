import { FileUploadItem } from './FileUploader';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  type?: 'video' | 'srt';
}

export interface FileValidationConfig {
  maxFileSize: number;
  allowedVideoTypes: string[];
  allowedVideoExtensions: string[];
  allowedSrtExtensions: string[];
}

export const DEFAULT_VALIDATION_CONFIG: FileValidationConfig = {
  maxFileSize: 500 * 1024 * 1024, // 500MB
  allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
  allowedVideoExtensions: ['.mp4', '.mov', '.avi', '.webm'],
  allowedSrtExtensions: ['.srt']
};

export class FileValidator {
  private config: FileValidationConfig;

  constructor(config: FileValidationConfig = DEFAULT_VALIDATION_CONFIG) {
    this.config = config;
  }

  validateFile(file: File): ValidationResult {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      return {
        isValid: false,
        error: `File size must be less than ${this.formatFileSize(this.config.maxFileSize)}`
      };
    }

    // Check if file is empty
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'File cannot be empty'
      };
    }

    // Determine file type and validate
    const fileExtension = this.getFileExtension(file.name);
    
    // Check if it's a video file
    if (this.isVideoFile(file, fileExtension)) {
      return { isValid: true, type: 'video' };
    }

    // Check if it's an SRT file
    if (this.isSrtFile(file, fileExtension)) {
      return { isValid: true, type: 'srt' };
    }

    return {
      isValid: false,
      error: `Unsupported file type. Allowed: ${this.getAllowedTypesString()}`
    };
  }

  validateMultipleFiles(files: File[], existingFiles: FileUploadItem[] = []): {
    validFiles: { file: File; type: 'video' | 'srt' }[];
    errors: string[];
  } {
    const validFiles: { file: File; type: 'video' | 'srt' }[] = [];
    const errors: string[] = [];
    const typeCount = { video: 0, srt: 0 };

    // Count existing files
    existingFiles.forEach(existing => {
      typeCount[existing.type]++;
    });

    files.forEach(file => {
      const validation = this.validateFile(file);

      if (!validation.isValid) {
        errors.push(`${file.name}: ${validation.error}`);
        return;
      }

      const fileType = validation.type!;

      // Check for duplicate file types (only one video and one SRT allowed)
      if (typeCount[fileType] > 0) {
        errors.push(`${file.name}: Only one ${fileType} file is allowed`);
        return;
      }

      typeCount[fileType]++;
      validFiles.push({ file, type: fileType });
    });

    return { validFiles, errors };
  }

  private isVideoFile(file: File, extension: string): boolean {
    return (
      this.config.allowedVideoTypes.includes(file.type) ||
      this.config.allowedVideoExtensions.includes(extension.toLowerCase())
    );
  }

  private isSrtFile(file: File, extension: string): boolean {
    return this.config.allowedSrtExtensions.includes(extension.toLowerCase());
  }

  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size)}${units[unitIndex]}`;
  }

  private getAllowedTypesString(): string {
    const videoExts = this.config.allowedVideoExtensions.join(', ');
    const srtExts = this.config.allowedSrtExtensions.join(', ');
    return `Video: ${videoExts} • Subtitles: ${srtExts}`;
  }
}

// Utility functions for common validation scenarios
export const validateSingleFile = (file: File): ValidationResult => {
  const validator = new FileValidator();
  return validator.validateFile(file);
};

export const validateFileList = (
  files: File[], 
  existingFiles: FileUploadItem[] = []
): { validFiles: { file: File; type: 'video' | 'srt' }[]; errors: string[] } => {
  const validator = new FileValidator();
  return validator.validateMultipleFiles(files, existingFiles);
};

// SRT file content validation
export const validateSrtContent = async (file: File): Promise<{ isValid: boolean; error?: string }> => {
  try {
    const content = await file.text();
    
    // Basic SRT format validation
    const srtPattern = /^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}\s*\n[\s\S]*?\n\s*$/m;
    
    if (!srtPattern.test(content)) {
      return {
        isValid: false,
        error: 'Invalid SRT format. Please ensure the file follows standard SRT subtitle format.'
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Unable to read SRT file content'
    };
  }
};