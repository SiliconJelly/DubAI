import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { FileManager } from '../utils/fileManager';

export interface FileMetadata {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  fileType: 'video' | 'audio' | 'srt' | 'image' | 'document';
  fileCategory: 'upload' | 'processing' | 'output';
  metadata: Record<string, any>;
  isTemporary: boolean;
  expiresAt: string | undefined;
  downloadUrl: string | undefined;
  createdAt: string;
}

export interface FileUploadOptions {
  category?: 'upload' | 'processing' | 'output';
  isTemporary?: boolean;
  expiresInHours?: number;
  metadata?: Record<string, any>;
  generateThumbnail?: boolean;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  fileType: string;
  estimatedProcessingTime: number | undefined;
}

export class FileStorageService {
  private readonly STORAGE_BUCKET = 'user-files';
  private readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  private readonly ALLOWED_VIDEO_TYPES = [
    'video/mp4', 'video/avi', 'video/mov', 'video/quicktime', 'video/x-msvideo'
  ];
  private readonly ALLOWED_SRT_TYPES = [
    'application/x-subrip', 'text/plain', 'text/srt'
  ];
  private readonly ALLOWED_AUDIO_TYPES = [
    'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'
  ];

  constructor(
    private supabase: SupabaseClient,
    private fileManager: FileManager
  ) {}

  /**
   * Validates uploaded file against business rules
   */
  async validateFile(file: Express.Multer.File): Promise<FileValidationResult> {
    const errors: string[] = [];
    let fileType = 'other';

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Determine and validate file type
    const mimeType = file.mimetype.toLowerCase();
    const filename = file.originalname.toLowerCase();

    if (this.ALLOWED_VIDEO_TYPES.includes(mimeType)) {
      fileType = 'video';
      // Additional video validation
      if (file.size < 1024 * 1024) { // Less than 1MB
        errors.push('Video file seems too small to be valid');
      }
    } else if (this.ALLOWED_AUDIO_TYPES.includes(mimeType)) {
      fileType = 'audio';
    } else if (this.ALLOWED_SRT_TYPES.includes(mimeType) || filename.endsWith('.srt')) {
      fileType = 'srt';
      // Validate SRT content if it's text
      if (mimeType.startsWith('text/')) {
        const content = file.buffer.toString('utf-8');
        if (!this.validateSRTContent(content)) {
          errors.push('Invalid SRT file format');
        }
      }
    } else {
      errors.push(`Unsupported file type: ${mimeType}. Supported types: video (MP4, AVI, MOV), audio (MP3, WAV), subtitles (SRT)`);
    }

    // Check filename
    if (!file.originalname || file.originalname.trim().length === 0) {
      errors.push('Filename cannot be empty');
    }

    // Estimate processing time based on file size and type
    let estimatedProcessingTime: number | undefined;
    if (fileType === 'video' && errors.length === 0) {
      // Rough estimate: 1 minute of processing per 10MB of video
      estimatedProcessingTime = Math.ceil((file.size / (10 * 1024 * 1024)) * 60);
    }

    return {
      isValid: errors.length === 0,
      errors,
      fileType,
      estimatedProcessingTime
    };
  }

  /**
   * Validates SRT file content format
   */
  private validateSRTContent(content: string): boolean {
    // Basic SRT format validation
    const lines = content.trim().split('\n');
    if (lines.length < 3) return false;

    // Check for basic SRT structure (number, timestamp, text)
    const srtPattern = /^\d+$/;
    const timePattern = /^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/;

    let i = 0;
    while (i < lines.length) {
      // Skip empty lines
      if (lines[i].trim() === '') {
        i++;
        continue;
      }

      // Check sequence number
      if (!srtPattern.test(lines[i].trim())) {
        return false;
      }
      i++;

      // Check timestamp
      if (i >= lines.length || !timePattern.test(lines[i].trim())) {
        return false;
      }
      i++;

      // Skip subtitle text (at least one line required)
      if (i >= lines.length || lines[i].trim() === '') {
        return false;
      }
      
      // Skip to next subtitle block
      while (i < lines.length && lines[i].trim() !== '') {
        i++;
      }
    }

    return true;
  }

  /**
   * Generates organized storage path for files
   */
  private generateStoragePath(
    userId: string, 
    filename: string, 
    fileType: string, 
    category: string = 'upload'
  ): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fileExtension = path.extname(filename);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    
    return `${category}/${userId}/${fileType}/${timestamp}/${uniqueFilename}`;
  }  /**

   * Uploads file to Supabase Storage with metadata tracking
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    options: FileUploadOptions = {}
  ): Promise<FileMetadata> {
    // Validate file first
    const validation = await this.validateFile(file);
    if (!validation.isValid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    const {
      category = 'upload',
      isTemporary = false,
      expiresInHours,
      metadata = {},
      generateThumbnail = false
    } = options;

    // Generate storage path
    const storagePath = this.generateStoragePath(userId, file.originalname, validation.fileType, category);

    try {
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(this.STORAGE_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          duplex: 'half',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Calculate expiration time
      let expiresAt: string | undefined;
      if (isTemporary && expiresInHours) {
        const expiration = new Date();
        expiration.setHours(expiration.getHours() + expiresInHours);
        expiresAt = expiration.toISOString();
      }

      // Enhanced metadata
      const enhancedMetadata = {
        ...metadata,
        originalSize: file.size,
        uploadTimestamp: new Date().toISOString(),
        validation: {
          fileType: validation.fileType,
          estimatedProcessingTime: validation.estimatedProcessingTime
        },
        ...(file.mimetype.startsWith('video/') && {
          videoMetadata: {
            // Placeholder for future video analysis
            needsAnalysis: true
          }
        })
      };

      // Save file metadata to database
      const { data: fileRecord, error: dbError } = await this.supabase
        .from('storage_files')
        .insert({
          user_id: userId,
          filename: file.originalname,
          file_size: file.size,
          mime_type: file.mimetype,
          storage_path: storagePath,
          file_type: validation.fileType,
          file_category: category,
          metadata: enhancedMetadata,
          is_temporary: isTemporary,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await this.supabase.storage
          .from(this.STORAGE_BUCKET)
          .remove([storagePath]);
        
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      // Generate signed URL for immediate access
      const { data: signedUrlData } = await this.supabase.storage
        .from(this.STORAGE_BUCKET)
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      return {
        id: fileRecord.id,
        userId: fileRecord.user_id,
        filename: fileRecord.filename,
        originalName: file.originalname,
        fileSize: fileRecord.file_size,
        mimeType: fileRecord.mime_type,
        storagePath: fileRecord.storage_path,
        fileType: fileRecord.file_type as any,
        fileCategory: fileRecord.file_category as any,
        metadata: fileRecord.metadata || {},
        isTemporary: fileRecord.is_temporary,
        expiresAt: fileRecord.expires_at,
        downloadUrl: signedUrlData?.signedUrl,
        createdAt: fileRecord.created_at
      };

    } catch (error) {
      throw new Error(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieves file metadata with fresh download URL
   */
  async getFileMetadata(fileId: string, userId: string): Promise<FileMetadata | null> {
    const { data: file, error } = await this.supabase
      .from('storage_files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // File not found
      }
      throw new Error(`Failed to fetch file metadata: ${error.message}`);
    }

    // Generate fresh signed URL
    const { data: signedUrlData } = await this.supabase.storage
      .from(this.STORAGE_BUCKET)
      .createSignedUrl(file.storage_path, 3600);

    return {
      id: file.id,
      userId: file.user_id,
      filename: file.filename,
      originalName: file.filename, // In this case, they're the same
      fileSize: file.file_size,
      mimeType: file.mime_type,
      storagePath: file.storage_path,
      fileType: file.file_type,
      fileCategory: file.file_category,
      metadata: file.metadata || {},
      isTemporary: file.is_temporary,
      expiresAt: file.expires_at,
      downloadUrl: signedUrlData?.signedUrl,
      createdAt: file.created_at
    };
  }

  /**
   * Lists user files with filtering and pagination
   */
  async listUserFiles(
    userId: string,
    options: {
      fileType?: string;
      category?: string;
      includeTemporary?: boolean;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ files: FileMetadata[]; totalCount: number }> {
    const {
      fileType,
      category,
      includeTemporary = false,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('storage_files')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    if (category) {
      query = query.eq('file_category', category);
    }

    if (!includeTemporary) {
      query = query.eq('is_temporary', false);
    }

    const { data: files, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    // Generate signed URLs for all files
    const filesWithUrls = await Promise.all(
      (files || []).map(async (file: any) => {
        const { data: signedUrlData } = await this.supabase.storage
          .from(this.STORAGE_BUCKET)
          .createSignedUrl(file.storage_path, 3600);

        return {
          id: file.id,
          userId: file.user_id,
          filename: file.filename,
          originalName: file.filename,
          fileSize: file.file_size,
          mimeType: file.mime_type,
          storagePath: file.storage_path,
          fileType: file.file_type,
          fileCategory: file.file_category,
          metadata: file.metadata || {},
          isTemporary: file.is_temporary,
          expiresAt: file.expires_at,
          downloadUrl: signedUrlData?.signedUrl,
          createdAt: file.created_at
        };
      })
    );

    return {
      files: filesWithUrls,
      totalCount: count || 0
    };
  }

  /**
   * Deletes file from both storage and database
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    // Get file metadata first
    const { data: file, error: fetchError } = await this.supabase
      .from('storage_files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error('File not found');
      }
      throw new Error(`Failed to fetch file: ${fetchError.message}`);
    }

    // Delete from storage
    const { error: storageError } = await this.supabase.storage
      .from(this.STORAGE_BUCKET)
      .remove([file.storage_path]);

    if (storageError) {
      console.warn(`Failed to delete file from storage: ${storageError.message}`);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: dbError } = await this.supabase
      .from('storage_files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', userId);

    if (dbError) {
      throw new Error(`Failed to delete file from database: ${dbError.message}`);
    }
  }

  /**
   * Cleans up expired temporary files
   */
  async cleanupExpiredFiles(): Promise<{ deletedCount: number; errors: string[] }> {
    const now = new Date().toISOString();
    const errors: string[] = [];
    let deletedCount = 0;

    try {
      // Find expired files
      const { data: expiredFiles, error } = await this.supabase
        .from('storage_files')
        .select('*')
        .eq('is_temporary', true)
        .lt('expires_at', now);

      if (error) {
        throw new Error(`Failed to fetch expired files: ${error.message}`);
      }

      // Delete each expired file
      for (const file of expiredFiles || []) {
        try {
          await this.deleteFile(file.id, file.user_id);
          deletedCount++;
        } catch (error) {
          errors.push(`Failed to delete file ${file.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { deletedCount, errors };
    } catch (error) {
      return { 
        deletedCount, 
        errors: [`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Gets storage usage statistics for a user
   */
  async getUserStorageStats(userId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
    byCategory: Record<string, { count: number; size: number }>;
  }> {
    const { data: files, error } = await this.supabase
      .from('storage_files')
      .select('file_type, file_category, file_size')
      .eq('user_id', userId)
      .eq('is_temporary', false);

    if (error) {
      throw new Error(`Failed to fetch storage stats: ${error.message}`);
    }

    const stats = {
      totalFiles: files?.length || 0,
      totalSize: 0,
      byType: {} as Record<string, { count: number; size: number }>,
      byCategory: {} as Record<string, { count: number; size: number }>
    };

    for (const file of files || []) {
      stats.totalSize += file.file_size;

      // By type
      if (!stats.byType[file.file_type]) {
        stats.byType[file.file_type] = { count: 0, size: 0 };
      }
      stats.byType[file.file_type].count++;
      stats.byType[file.file_type].size += file.file_size;

      // By category
      if (!stats.byCategory[file.file_category]) {
        stats.byCategory[file.file_category] = { count: 0, size: 0 };
      }
      stats.byCategory[file.file_category].count++;
      stats.byCategory[file.file_category].size += file.file_size;
    }

    return stats;
  }
}