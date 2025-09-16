import { FileStorageService, FileValidationResult } from '../services/FileStorageService';
import { FileManager } from '../utils/fileManager';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  storage: {
    from: jest.fn().mockReturnThis(),
    upload: jest.fn(),
    download: jest.fn(),
    createSignedUrl: jest.fn(),
    remove: jest.fn()
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  single: jest.fn(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis()
} as any;

// Mock FileManager
const mockFileManager = {
  createTempFile: jest.fn(),
  deleteFile: jest.fn(),
  fileExists: jest.fn(),
  getFileSize: jest.fn()
} as any;

describe('FileStorageService', () => {
  let fileStorageService: FileStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    fileStorageService = new FileStorageService(mockSupabase, mockFileManager);
  });

  describe('validateFile', () => {
    it('should validate a valid video file', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'video',
        originalname: 'test-video.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: 50 * 1024 * 1024, // 50MB
        buffer: Buffer.alloc(1024),
        destination: '',
        filename: '',
        path: '',
        stream: null as any
      };

      const result: FileValidationResult = await fileStorageService.validateFile(mockFile);

      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe('video');
      expect(result.errors).toHaveLength(0);
      expect(result.estimatedProcessingTime).toBeGreaterThan(0);
    });

    it('should reject file that is too large', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'video',
        originalname: 'large-video.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: 600 * 1024 * 1024, // 600MB (exceeds 500MB limit)
        buffer: Buffer.alloc(1024),
        destination: '',
        filename: '',
        path: '',
        stream: null as any
      };

      const result: FileValidationResult = await fileStorageService.validateFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('exceeds maximum allowed size'));
    });

    it('should validate SRT file content', async () => {
      const validSRTContent = `1
00:00:01,000 --> 00:00:05,000
This is a test subtitle

2
00:00:06,000 --> 00:00:10,000
This is another subtitle`;

      const mockFile: Express.Multer.File = {
        fieldname: 'srt',
        originalname: 'test-subtitles.srt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: validSRTContent.length,
        buffer: Buffer.from(validSRTContent),
        destination: '',
        filename: '',
        path: '',
        stream: null as any
      };

      const result: FileValidationResult = await fileStorageService.validateFile(mockFile);

      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe('srt');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid SRT file content', async () => {
      const invalidSRTContent = `This is not a valid SRT file
Just some random text`;

      const mockFile: Express.Multer.File = {
        fieldname: 'srt',
        originalname: 'invalid.srt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: invalidSRTContent.length,
        buffer: Buffer.from(invalidSRTContent),
        destination: '',
        filename: '',
        path: '',
        stream: null as any
      };

      const result: FileValidationResult = await fileStorageService.validateFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid SRT file format');
    });

    it('should reject unsupported file types', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.alloc(1024),
        destination: '',
        filename: '',
        path: '',
        stream: null as any
      };

      const result: FileValidationResult = await fileStorageService.validateFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Unsupported file type'));
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'video',
        originalname: 'test-video.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: 50 * 1024 * 1024,
        buffer: Buffer.alloc(1024),
        destination: '',
        filename: '',
        path: '',
        stream: null as any
      };

      const userId = 'test-user-id';
      const mockFileRecord = {
        id: 'file-id',
        user_id: userId,
        filename: mockFile.originalname,
        file_size: mockFile.size,
        mime_type: mockFile.mimetype,
        storage_path: 'upload/test-user-id/video/2024-01-01/unique-id.mp4',
        file_type: 'video',
        file_category: 'upload',
        metadata: {},
        is_temporary: false,
        expires_at: null,
        created_at: new Date().toISOString()
      };

      // Mock successful upload
      mockSupabase.storage.upload.mockResolvedValue({
        data: { path: mockFileRecord.storage_path },
        error: null
      });

      // Mock successful database insert
      mockSupabase.single.mockResolvedValue({
        data: mockFileRecord,
        error: null
      });

      // Mock signed URL generation
      mockSupabase.storage.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null
      });

      const result = await fileStorageService.uploadFile(mockFile, userId);

      expect(result.id).toBe(mockFileRecord.id);
      expect(result.filename).toBe(mockFile.originalname);
      expect(result.fileType).toBe('video');
      expect(result.downloadUrl).toBe('https://example.com/signed-url');
      expect(mockSupabase.storage.upload).toHaveBeenCalled();
    });

    it('should handle upload failure and cleanup', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'video',
        originalname: 'test-video.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: 50 * 1024 * 1024,
        buffer: Buffer.alloc(1024),
        destination: '',
        filename: '',
        path: '',
        stream: null as any
      };

      const userId = 'test-user-id';

      // Mock upload success but database failure
      mockSupabase.storage.upload.mockResolvedValue({
        data: { path: 'some-path' },
        error: null
      });

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      mockSupabase.storage.remove.mockResolvedValue({
        data: null,
        error: null
      });

      await expect(fileStorageService.uploadFile(mockFile, userId)).rejects.toThrow('Database insert failed');
      expect(mockSupabase.storage.remove).toHaveBeenCalled(); // Cleanup should be called
    });
  });

  describe('listUserFiles', () => {
    it('should list user files with pagination', async () => {
      const userId = 'test-user-id';
      const mockFiles = [
        {
          id: 'file-1',
          user_id: userId,
          filename: 'video1.mp4',
          file_size: 1024,
          mime_type: 'video/mp4',
          storage_path: 'path1',
          file_type: 'video',
          file_category: 'upload',
          metadata: {},
          is_temporary: false,
          expires_at: null,
          created_at: new Date().toISOString()
        }
      ];

      mockSupabase.single.mockResolvedValue({
        data: mockFiles,
        error: null,
        count: 1
      });

      mockSupabase.storage.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null
      });

      const result = await fileStorageService.listUserFiles(userId, {
        page: 1,
        limit: 20
      });

      expect(result.files).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.files[0].downloadUrl).toBe('https://example.com/signed-url');
    });
  });

  describe('deleteFile', () => {
    it('should delete file from both storage and database', async () => {
      const fileId = 'test-file-id';
      const userId = 'test-user-id';
      const mockFile = {
        id: fileId,
        user_id: userId,
        storage_path: 'test-path'
      };

      // Mock file fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: mockFile,
        error: null
      });

      // Mock storage deletion
      mockSupabase.storage.remove.mockResolvedValue({
        data: null,
        error: null
      });

      // Mock database deletion
      mockSupabase.delete().eq().eq.mockResolvedValue({
        data: null,
        error: null
      });

      await fileStorageService.deleteFile(fileId, userId);

      expect(mockSupabase.storage.remove).toHaveBeenCalledWith(['test-path']);
    });

    it('should throw error if file not found', async () => {
      const fileId = 'non-existent-file';
      const userId = 'test-user-id';

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      await expect(fileStorageService.deleteFile(fileId, userId)).rejects.toThrow('File not found');
    });
  });

  describe('getUserStorageStats', () => {
    it('should calculate storage statistics correctly', async () => {
      const userId = 'test-user-id';
      const mockFiles = [
        { file_type: 'video', file_category: 'upload', file_size: 1000 },
        { file_type: 'video', file_category: 'upload', file_size: 2000 },
        { file_type: 'srt', file_category: 'upload', file_size: 100 }
      ];

      mockSupabase.select().eq().eq.mockResolvedValue({
        data: mockFiles,
        error: null
      });

      const stats = await fileStorageService.getUserStorageStats(userId);

      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSize).toBe(3100);
      expect(stats.byType['video'].count).toBe(2);
      expect(stats.byType['video'].size).toBe(3000);
      expect(stats.byType['srt'].count).toBe(1);
      expect(stats.byType['srt'].size).toBe(100);
    });
  });
});