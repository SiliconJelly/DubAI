import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { ApiResponse } from '@dubai/shared';
import { asyncHandler } from '../middleware/errorHandler';
import { validateSchema, validateFileUpload, commonSchemas } from '../middleware/validationMiddleware';
import { uploadRateLimit } from '../middleware/rateLimitMiddleware';
import { initializeServices } from '../services/serviceFactory';

const router = Router();


// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    // Allow video files, audio files, and SRT files
    const allowedMimeTypes = [
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/quicktime',
      'video/x-msvideo',
      'audio/mpeg',
      'audio/wav',
      'audio/mp3',
      'audio/x-wav',
      'application/x-subrip',
      'text/plain',
      'text/srt'
    ];
    
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.mp3', '.wav', '.srt'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`));
    }
  }
});

// Upload files endpoint with enhanced validation and processing
router.post('/upload',
  uploadRateLimit,
  upload.array('files', 5),
  validateFileUpload({
    maxSize: 500 * 1024 * 1024, // 500MB
    allowedMimeTypes: [
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/quicktime',
      'video/x-msvideo',
      'audio/mpeg',
      'audio/wav',
      'audio/mp3',
      'audio/x-wav',
      'application/x-subrip',
      'text/plain',
      'text/srt'
    ],
    required: true
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    if (!files || files.length === 0) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'NO_FILES',
        message: 'No files provided for upload'
      };
      res.status(400).json(response);
      return;
    }

    try {
      // Initialize services
      const { fileStorageService, processingPipeline } = initializeServices(req.supabase);
      
      const uploadResults = [];
      const validationResults = [];

      for (const file of files) {
        // Upload file with enhanced validation
        const fileMetadata = await fileStorageService.uploadFile(file, req.user.id, {
          category: 'upload',
          metadata: {
            uploadedVia: 'web-interface',
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip
          }
        });

        uploadResults.push({
          id: fileMetadata.id,
          filename: fileMetadata.filename,
          size: fileMetadata.fileSize,
          mimeType: fileMetadata.mimeType,
          fileType: fileMetadata.fileType,
          storagePath: fileMetadata.storagePath,
          downloadUrl: fileMetadata.downloadUrl,
          uploadedAt: fileMetadata.createdAt,
          metadata: fileMetadata.metadata
        });

        // Perform initial file analysis for supported types
        if (fileMetadata.fileType === 'video') {
          try {
            const videoAnalysis = await processingPipeline.analyzeVideoFile(fileMetadata);
            validationResults.push({
              fileId: fileMetadata.id,
              type: 'video_analysis',
              result: videoAnalysis
            });
          } catch (error) {
            validationResults.push({
              fileId: fileMetadata.id,
              type: 'video_analysis',
              error: error instanceof Error ? error.message : 'Analysis failed'
            });
          }
        } else if (fileMetadata.fileType === 'srt') {
          try {
            const srtAnalysis = await processingPipeline.analyzeSRTFile(fileMetadata);
            validationResults.push({
              fileId: fileMetadata.id,
              type: 'srt_analysis',
              result: srtAnalysis
            });
          } catch (error) {
            validationResults.push({
              fileId: fileMetadata.id,
              type: 'srt_analysis',
              error: error instanceof Error ? error.message : 'Analysis failed'
            });
          }
        }
      }

      const response: ApiResponse<any> = {
        success: true,
        data: {
          files: uploadResults,
          totalFiles: uploadResults.length,
          totalSize: uploadResults.reduce((sum, file) => sum + file.size, 0),
          analysis: validationResults
        },
        message: `Successfully uploaded ${uploadResults.length} file(s) with enhanced validation`
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Get file metadata
router.get('/:id',
  validateSchema(z.object({
    id: commonSchemas.uuid
  }), 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      const { fileStorageService } = initializeServices(req.supabase);
      const fileMetadata = await fileStorageService.getFileMetadata(id, req.user.id);

      if (!fileMetadata) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'NOT_FOUND',
          message: 'File not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<any> = {
        success: true,
        data: {
          id: fileMetadata.id,
          filename: fileMetadata.filename,
          size: fileMetadata.fileSize,
          mimeType: fileMetadata.mimeType,
          fileType: fileMetadata.fileType,
          storagePath: fileMetadata.storagePath,
          downloadUrl: fileMetadata.downloadUrl,
          uploadedAt: fileMetadata.createdAt
        }
      };

      res.json(response);
    } catch (error) {
      throw new Error(`Failed to fetch file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Get download URL for a file
router.get('/:id/download',
  validateSchema(z.object({
    id: commonSchemas.uuid
  }), 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      const { fileStorageService } = initializeServices(req.supabase);
      const fileMetadata = await fileStorageService.getFileMetadata(id, req.user.id);

      if (!fileMetadata) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'NOT_FOUND',
          message: 'File not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<any> = {
        success: true,
        data: {
          downloadUrl: fileMetadata.downloadUrl,
          filename: fileMetadata.filename,
          size: fileMetadata.fileSize,
          mimeType: fileMetadata.mimeType,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour from now
        }
      };

      res.json(response);
    } catch (error) {
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// List user's files with enhanced filtering
router.get('/',
  validateSchema(z.object({
    ...commonSchemas.pagination.shape,
    fileType: z.enum(['video', 'audio', 'srt', 'image', 'document']).optional(),
    category: z.enum(['upload', 'processing', 'output']).optional(),
    includeTemporary: z.coerce.boolean().default(false),
    sortBy: z.enum(['created_at', 'filename', 'file_size']).default('created_at'),
    sortOrder: commonSchemas.sortOrder
  }), 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, fileType, category, includeTemporary, sortBy, sortOrder } = req.query as any;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      const { fileStorageService } = initializeServices(req.supabase);
      
      const result = await fileStorageService.listUserFiles(req.user.id, {
        fileType,
        category,
        includeTemporary,
        page,
        limit,
        sortBy,
        sortOrder
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          files: result.files,
          totalFiles: result.totalCount,
          totalSize: result.files.reduce((sum, file) => sum + file.fileSize, 0)
        }
      };

      // Add pagination headers
      res.setHeader('X-Total-Count', result.totalCount);
      res.setHeader('X-Page', page);
      res.setHeader('X-Per-Page', limit);
      res.setHeader('X-Total-Pages', Math.ceil(result.totalCount / limit));

      res.json(response);
    } catch (error) {
      throw new Error(`Failed to fetch files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Delete a file
router.delete('/:id',
  validateSchema(z.object({
    id: commonSchemas.uuid
  }), 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!req.supabase || !req.user) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      };
      res.status(401).json(response);
      return;
    }

    try {
      const { fileStorageService } = initializeServices(req.supabase);
      await fileStorageService.deleteFile(id, req.user.id);

      const response: ApiResponse<any> = {
        success: true,
        message: 'File deleted successfully'
      };

      res.json(response);
    } catch (error) {
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

export { router as fileRoutes };