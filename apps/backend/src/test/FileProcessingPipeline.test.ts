import { FileProcessingPipeline, VideoAnalysisResult, SRTAnalysisResult } from '../services/FileProcessingPipeline';
import { FileStorageService, FileMetadata } from '../services/FileStorageService';
import { FileManager } from '../utils/fileManager';

// Mock dependencies
const mockSupabase = {
  storage: {
    from: jest.fn().mockReturnThis(),
    download: jest.fn()
  }
} as any;

const mockFileStorageService = {
  uploadFile: jest.fn(),
  getFileMetadata: jest.fn(),
  deleteFile: jest.fn()
} as any;

const mockFileManager = {
  createTempFile: jest.fn(),
  deleteFile: jest.fn(),
  saveUploadedFile: jest.fn()
} as any;

describe('FileProcessingPipeline', () => {
  let pipeline: FileProcessingPipeline;

  beforeEach(() => {
    jest.clearAllMocks();
    pipeline = new FileProcessingPipeline(mockSupabase, mockFileStorageService, mockFileManager);
  });

  describe('analyzeSRTFile', () => {
    it('should analyze valid SRT file correctly', async () => {
      const validSRTContent = `1
00:00:01,000 --> 00:00:05,000
This is the first subtitle

2
00:00:06,000 --> 00:00:10,000
This is the second subtitle

3
00:00:11,000 --> 00:00:15,000
This is the third subtitle`;

      const mockFileMetadata: FileMetadata = {
        id: 'srt-file-id',
        userId: 'user-id',
        filename: 'test.srt',
        originalName: 'test.srt',
        fileSize: validSRTContent.length,
        mimeType: 'text/plain',
        storagePath: 'path/to/file.srt',
        fileType: 'srt',
        fileCategory: 'upload',
        metadata: {},
        isTemporary: false,
        createdAt: new Date().toISOString()
      };

      // Mock file download
      mockSupabase.storage.download.mockResolvedValue({
        data: {
          text: () => Promise.resolve(validSRTContent)
        },
        error: null
      });

      const result: SRTAnalysisResult = await pipeline.analyzeSRTFile(mockFileMetadata);

      expect(result.isValid).toBe(true);
      expect(result.subtitleCount).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.encoding).toBe('UTF-8');
    });

    it('should detect invalid SRT format', async () => {
      const invalidSRTContent = `This is not a valid SRT file
Just some random text without proper formatting`;

      const mockFileMetadata: FileMetadata = {
        id: 'srt-file-id',
        userId: 'user-id',
        filename: 'invalid.srt',
        originalName: 'invalid.srt',
        fileSize: invalidSRTContent.length,
        mimeType: 'text/plain',
        storagePath: 'path/to/invalid.srt',
        fileType: 'srt',
        fileCategory: 'upload',
        metadata: {},
        isTemporary: false,
        createdAt: new Date().toISOString()
      };

      mockSupabase.storage.download.mockResolvedValue({
        data: {
          text: () => Promise.resolve(invalidSRTContent)
        },
        error: null
      });

      const result: SRTAnalysisResult = await pipeline.analyzeSRTFile(mockFileMetadata);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.subtitleCount).toBe(0);
    });

    it('should handle malformed timestamps', async () => {
      const malformedSRTContent = `1
00:00:01 --> 00:00:05,000
This has a malformed timestamp

2
invalid timestamp format
This also has issues`;

      const mockFileMetadata: FileMetadata = {
        id: 'srt-file-id',
        userId: 'user-id',
        filename: 'malformed.srt',
        originalName: 'malformed.srt',
        fileSize: malformedSRTContent.length,
        mimeType: 'text/plain',
        storagePath: 'path/to/malformed.srt',
        fileType: 'srt',
        fileCategory: 'upload',
        metadata: {},
        isTemporary: false,
        createdAt: new Date().toISOString()
      };

      mockSupabase.storage.download.mockResolvedValue({
        data: {
          text: () => Promise.resolve(malformedSRTContent)
        },
        error: null
      });

      const result: SRTAnalysisResult = await pipeline.analyzeSRTFile(mockFileMetadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Invalid timestamp format'));
    });
  });

  describe('validateFilesForDubbing', () => {
    it('should validate compatible video and SRT files', async () => {
      const mockVideoFile: FileMetadata = {
        id: 'video-file-id',
        userId: 'user-id',
        filename: 'video.mp4',
        originalName: 'video.mp4',
        fileSize: 50 * 1024 * 1024,
        mimeType: 'video/mp4',
        storagePath: 'path/to/video.mp4',
        fileType: 'video',
        fileCategory: 'upload',
        metadata: {},
        isTemporary: false,
        createdAt: new Date().toISOString()
      };

      const mockSRTFile: FileMetadata = {
        id: 'srt-file-id',
        userId: 'user-id',
        filename: 'subtitles.srt',
        originalName: 'subtitles.srt',
        fileSize: 1024,
        mimeType: 'text/plain',
        storagePath: 'path/to/subtitles.srt',
        fileType: 'srt',
        fileCategory: 'upload',
        metadata: {},
        isTemporary: false,
        createdAt: new Date().toISOString()
      };

      // Mock video analysis
      jest.spyOn(pipeline, 'analyzeVideoFile').mockResolvedValue({
        duration: 120, // 2 minutes
        resolution: { width: 1920, height: 1080 },
        frameRate: 30,
        bitrate: 2000000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44100,
        estimatedProcessingTime: 300
      });

      // Mock SRT analysis
      jest.spyOn(pipeline, 'analyzeSRTFile').mockResolvedValue({
        subtitleCount: 10,
        totalDuration: 115, // Close to video duration
        languages: ['en'],
        encoding: 'UTF-8',
        isValid: true,
        errors: []
      });

      const result = await pipeline.validateFilesForDubbing(mockVideoFile, mockSRTFile);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should detect duration mismatch between video and SRT', async () => {
      const mockVideoFile: FileMetadata = {
        id: 'video-file-id',
        userId: 'user-id',
        filename: 'video.mp4',
        originalName: 'video.mp4',
        fileSize: 50 * 1024 * 1024,
        mimeType: 'video/mp4',
        storagePath: 'path/to/video.mp4',
        fileType: 'video',
        fileCategory: 'upload',
        metadata: {},
        isTemporary: false,
        createdAt: new Date().toISOString()
      };

      const mockSRTFile: FileMetadata = {
        id: 'srt-file-id',
        userId: 'user-id',
        filename: 'subtitles.srt',
        originalName: 'subtitles.srt',
        fileSize: 1024,
        mimeType: 'text/plain',
        storagePath: 'path/to/subtitles.srt',
        fileType: 'srt',
        fileCategory: 'upload',
        metadata: {},
        isTemporary: false,
        createdAt: new Date().toISOString()
      };

      // Mock video analysis
      jest.spyOn(pipeline, 'analyzeVideoFile').mockResolvedValue({
        duration: 120, // 2 minutes
        resolution: { width: 1920, height: 1080 },
        frameRate: 30,
        bitrate: 2000000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44100,
        estimatedProcessingTime: 300
      });

      // Mock SRT analysis with significantly different duration
      jest.spyOn(pipeline, 'analyzeSRTFile').mockResolvedValue({
        subtitleCount: 10,
        totalDuration: 60, // 1 minute - significant difference
        languages: ['en'],
        encoding: 'UTF-8',
        isValid: true,
        errors: []
      });

      const result = await pipeline.validateFilesForDubbing(mockVideoFile, mockSRTFile);

      expect(result.isValid).toBe(true); // Still valid but with warnings
      expect(result.warnings).toContain(expect.stringContaining('duration'));
    });

    it('should reject invalid file types', async () => {
      const mockInvalidFile: FileMetadata = {
        id: 'invalid-file-id',
        userId: 'user-id',
        filename: 'document.pdf',
        originalName: 'document.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storagePath: 'path/to/document.pdf',
        fileType: 'document',
        fileCategory: 'upload',
        metadata: {},
        isTemporary: false,
        createdAt: new Date().toISOString()
      };

      const result = await pipeline.validateFilesForDubbing(mockInvalidFile as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Primary file must be a video file');
    });

    it('should provide recommendations when no SRT file is provided', async () => {
      const mockVideoFile: FileMetadata = {
        id: 'video-file-id',
        userId: 'user-id',
        filename: 'video.mp4',
        originalName: 'video.mp4',
        fileSize: 50 * 1024 * 1024,
        mimeType: 'video/mp4',
        storagePath: 'path/to/video.mp4',
        fileType: 'video',
        fileCategory: 'upload',
        metadata: {},
        isTemporary: false,
        createdAt: new Date().toISOString()
      };

      // Mock video analysis
      jest.spyOn(pipeline, 'analyzeVideoFile').mockResolvedValue({
        duration: 120,
        resolution: { width: 1920, height: 1080 },
        frameRate: 30,
        bitrate: 2000000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44100,
        estimatedProcessingTime: 300
      });

      const result = await pipeline.validateFilesForDubbing(mockVideoFile);

      expect(result.isValid).toBe(true);
      expect(result.recommendations).toContain(expect.stringContaining('SRT subtitles'));
    });
  });

  describe('createJobWorkspace', () => {
    it('should create organized folder structure', async () => {
      const jobId = 'test-job-id';
      const userId = 'test-user-id';

      const workspace = await pipeline.createJobWorkspace(jobId, userId);

      expect(workspace.inputPath).toBe(`jobs/${userId}/${jobId}/input`);
      expect(workspace.processingPath).toBe(`jobs/${userId}/${jobId}/processing`);
      expect(workspace.outputPath).toBe(`jobs/${userId}/${jobId}/output`);
    });
  });
});