import { describe, it, expect } from 'vitest';
import { FileValidator } from '../FileValidator';

// Simple test to verify the FileValidator works
describe('FileUploader Integration', () => {
  it('should export FileUploader component', async () => {
    const { FileUploader } = await import('../FileUploader');
    expect(FileUploader).toBeDefined();
    expect(typeof FileUploader).toBe('function');
  });

  it('should validate file types correctly', () => {
    const validator = new FileValidator();
    
    // Test video file
    const videoFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
    const videoResult = validator.validateFile(videoFile);
    expect(videoResult.isValid).toBe(true);
    expect(videoResult.type).toBe('video');

    // Test SRT file
    const srtFile = new File(['test'], 'test.srt', { type: 'text/plain' });
    const srtResult = validator.validateFile(srtFile);
    expect(srtResult.isValid).toBe(true);
    expect(srtResult.type).toBe('srt');

    // Test invalid file
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const invalidResult = validator.validateFile(invalidFile);
    expect(invalidResult.isValid).toBe(false);
  });
});