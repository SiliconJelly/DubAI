import { FileStorageService } from '../services/FileStorageService';
import { FileManager } from '../utils/fileManager';

// Simple integration test to verify the file upload system works
describe('File Upload Integration', () => {
  it('should be able to import FileStorageService', () => {
    expect(FileStorageService).toBeDefined();
    expect(typeof FileStorageService).toBe('function');
  });

  it('should be able to import FileManager', () => {
    expect(FileManager).toBeDefined();
    expect(typeof FileManager).toBe('function');
  });

  it('should validate file types correctly', async () => {
    // Mock Supabase and FileManager
    const mockSupabase = {} as any;
    const mockFileManager = {} as any;
    
    const service = new FileStorageService(mockSupabase, mockFileManager);
    
    const mockVideoFile: Express.Multer.File = {
      fieldname: 'video',
      originalname: 'test.mp4',
      encoding: '7bit',
      mimetype: 'video/mp4',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.alloc(1024),
      destination: '',
      filename: '',
      path: '',
      stream: null as any
    };

    const result = await service.validateFile(mockVideoFile);
    expect(result.isValid).toBe(true);
    expect(result.fileType).toBe('video');
  });
});