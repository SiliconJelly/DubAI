import { FileValidator, validateSingleFile, validateFileList } from '../FileValidator';

describe('FileValidator', () => {
  let validator: FileValidator;

  beforeEach(() => {
    validator = new FileValidator();
  });

  describe('validateFile', () => {
    it('should validate MP4 video files correctly', () => {
      const file = new File(['test content'], 'test.mp4', { type: 'video/mp4' });
      const result = validator.validateFile(file);

      expect(result.isValid).toBe(true);
      expect(result.type).toBe('video');
    });

    it('should validate SRT files correctly', () => {
      const file = new File(['test content'], 'test.srt', { type: 'text/plain' });
      const result = validator.validateFile(file);

      expect(result.isValid).toBe(true);
      expect(result.type).toBe('srt');
    });

    it('should reject files that are too large', () => {
      // Create a mock file with large size without actually creating large content
      const file = new File(['test'], 'large.mp4', { type: 'video/mp4' });
      // Override the size property
      Object.defineProperty(file, 'size', { value: 600 * 1024 * 1024 }); // 600MB
      
      const result = validator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File size must be less than');
    });

    it('should reject empty files', () => {
      const file = new File([], 'empty.mp4', { type: 'video/mp4' });
      const result = validator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('File cannot be empty');
    });

    it('should reject unsupported file types', () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const result = validator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('should validate video files by extension when MIME type is not recognized', () => {
      const file = new File(['test content'], 'test.mov', { type: 'application/octet-stream' });
      const result = validator.validateFile(file);

      expect(result.isValid).toBe(true);
      expect(result.type).toBe('video');
    });
  });

  describe('validateMultipleFiles', () => {
    it('should validate multiple valid files', () => {
      const videoFile = new File(['video content'], 'video.mp4', { type: 'video/mp4' });
      const srtFile = new File(['srt content'], 'subtitles.srt', { type: 'text/plain' });
      
      const result = validator.validateMultipleFiles([videoFile, srtFile]);

      expect(result.validFiles).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.validFiles[0].type).toBe('video');
      expect(result.validFiles[1].type).toBe('srt');
    });

    it('should reject duplicate file types', () => {
      const videoFile1 = new File(['video content 1'], 'video1.mp4', { type: 'video/mp4' });
      const videoFile2 = new File(['video content 2'], 'video2.mp4', { type: 'video/mp4' });
      
      const result = validator.validateMultipleFiles([videoFile1, videoFile2]);

      expect(result.validFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Only one video file is allowed');
    });

    it('should consider existing files when checking for duplicates', () => {
      const videoFile = new File(['video content'], 'video.mp4', { type: 'video/mp4' });
      const existingFiles = [{
        file: new File(['existing video'], 'existing.mp4', { type: 'video/mp4' }),
        id: 'existing-1',
        type: 'video' as const,
        progress: 100,
        status: 'completed' as const
      }];
      
      const result = validator.validateMultipleFiles([videoFile], existingFiles);

      expect(result.validFiles).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Only one video file is allowed');
    });
  });
});

describe('validateSingleFile utility', () => {
  it('should validate a single file correctly', () => {
    const file = new File(['test content'], 'test.mp4', { type: 'video/mp4' });
    const result = validateSingleFile(file);

    expect(result.isValid).toBe(true);
    expect(result.type).toBe('video');
  });
});

describe('validateFileList utility', () => {
  it('should validate a list of files correctly', () => {
    const videoFile = new File(['video content'], 'video.mp4', { type: 'video/mp4' });
    const srtFile = new File(['srt content'], 'subtitles.srt', { type: 'text/plain' });
    
    const result = validateFileList([videoFile, srtFile]);

    expect(result.validFiles).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });
});