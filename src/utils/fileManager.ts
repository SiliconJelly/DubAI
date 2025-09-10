import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FILE_SIZE_LIMITS } from './constants';
import { MulterFile } from '../types/express';

export interface FileManagerConfig {
  tempDirectory: string;
  outputDirectory: string;
  cleanupIntervalHours: number;
}

export class FileManager {
  constructor(private config: FileManagerConfig) {}

  async createTempFile(extension: string, sessionId?: string): Promise<string> {
    const filename = `${sessionId || uuidv4()}_${Date.now()}.${extension}`;
    const filepath = path.join(this.config.tempDirectory, filename);
    
    // Ensure temp directory exists
    await fs.mkdir(this.config.tempDirectory, { recursive: true });
    
    return filepath;
  }

  async createOutputFile(originalName: string, suffix: string = '_dubbed'): Promise<string> {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const filename = `${name}${suffix}${ext}`;
    const filepath = path.join(this.config.outputDirectory, filename);
    
    // Ensure output directory exists
    await fs.mkdir(this.config.outputDirectory, { recursive: true });
    
    return filepath;
  }

  async saveUploadedFile(file: MulterFile, sessionId: string): Promise<string> {
    const ext = path.extname(file.originalname);
    const filepath = await this.createTempFile(ext.slice(1), sessionId);
    
    await fs.writeFile(filepath, file.buffer);
    return filepath;
  }

  async cleanupTempFiles(sessionId?: string): Promise<void> {
    try {
      const files = await fs.readdir(this.config.tempDirectory);
      const now = Date.now();
      const maxAge = FILE_SIZE_LIMITS.TEMP_FILE_CLEANUP_HOURS * 60 * 60 * 1000;

      for (const file of files) {
        const filepath = path.join(this.config.tempDirectory, file);
        
        // If sessionId is provided, only clean files for that session
        if (sessionId && !file.includes(sessionId)) {
          continue;
        }

        try {
          const stats = await fs.stat(filepath);
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filepath);
          }
        } catch (error) {
          // File might have been deleted already, ignore
          console.warn(`Failed to clean up file ${filepath}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileSize(filepath: string): Promise<number> {
    const stats = await fs.stat(filepath);
    return stats.size;
  }

  async deleteFile(filepath: string): Promise<void> {
    try {
      await fs.unlink(filepath);
    } catch (error) {
      console.warn(`Failed to delete file ${filepath}:`, error);
    }
  }
}