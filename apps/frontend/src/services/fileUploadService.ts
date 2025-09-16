import { FileUploadRequest, FileUploadResponse, ApiResponse } from '@dubai/shared';
import { getAccessToken } from '@/utils/sessionManager';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export interface UploadProgressCallback {
  (progress: number): void;
}

export interface FileUploadOptions {
  onProgress?: UploadProgressCallback;
  signal?: AbortSignal;
}

class FileUploadService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get a signed upload URL for a file
   */
  async getUploadUrl(fileInfo: FileUploadRequest): Promise<{ uploadUrl: string; fileId: string }> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${this.baseUrl}/files/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(fileInfo)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result: FileUploadResponse = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get upload URL');
    }

    return result.data;
  }

  /**
   * Upload a file using the signed URL
   */
  async uploadFile(
    file: File, 
    uploadUrl: string, 
    options: FileUploadOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Handle progress updates
      if (options.onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            options.onProgress!(progress);
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });

      // Handle abort
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was cancelled'));
      });

      // Handle abort signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          xhr.abort();
        });
      }

      // Start upload
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }

  /**
   * Complete file upload and register it with the backend
   */
  async completeUpload(fileId: string): Promise<void> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${this.baseUrl}/files/${fileId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
  }

  /**
   * Upload a file with progress tracking (combines all steps)
   */
  async uploadFileComplete(
    file: File,
    options: FileUploadOptions = {}
  ): Promise<string> {
    try {
      // Step 1: Get upload URL
      const fileInfo: FileUploadRequest = {
        filename: file.name,
        mimeType: file.type,
        size: file.size
      };

      const { uploadUrl, fileId } = await this.getUploadUrl(fileInfo);

      // Step 2: Upload file
      await this.uploadFile(file, uploadUrl, options);

      // Step 3: Complete upload
      await this.completeUpload(fileId);

      return fileId;
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files with progress tracking
   */
  async uploadMultipleFiles(
    files: File[],
    onFileProgress?: (fileIndex: number, progress: number) => void,
    signal?: AbortSignal
  ): Promise<string[]> {
    const uploadPromises = files.map((file, index) => {
      return this.uploadFileComplete(file, {
        onProgress: (progress) => {
          if (onFileProgress) {
            onFileProgress(index, progress);
          }
        },
        signal
      });
    });

    return Promise.all(uploadPromises);
  }

  /**
   * Get download URL for a file
   */
  async getDownloadUrl(fileId: string): Promise<string> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${this.baseUrl}/files/${fileId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.data?.downloadUrl) {
      throw new Error(result.error || 'Failed to get download URL');
    }

    return result.data.downloadUrl;
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
  }
}

export const fileUploadService = new FileUploadService();
export default fileUploadService;