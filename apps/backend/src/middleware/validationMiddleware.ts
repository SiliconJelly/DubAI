import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ApiResponse } from '@dubai/shared';
import { ValidationError } from '../types/errors';

// Generic validation middleware factory
export function validateSchema(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        
        throw new ValidationError('Request validation failed', errors, 400);
      }

      // Replace the original data with the validated and transformed data
      req[source] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Content-Type validation middleware
export function validateContentType(expectedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.get('Content-Type');
    
    if (!contentType) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'INVALID_CONTENT_TYPE',
        message: 'Content-Type header is required'
      };
      res.status(400).json(response);
      return;
    }

    const isValidType = expectedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!isValidType) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'INVALID_CONTENT_TYPE',
        message: `Content-Type must be one of: ${expectedTypes.join(', ')}`
      };
      res.status(400).json(response);
      return;
    }

    next();
  };
}

// File upload validation middleware
export function validateFileUpload(options: {
  maxSize?: number;
  allowedMimeTypes?: string[];
  required?: boolean;
} = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const files = req.files as Express.Multer.File[] | undefined;
    const file = req.file as Express.Multer.File | undefined;
    
    const uploadedFiles = files || (file ? [file] : []);

    if (options.required && uploadedFiles.length === 0) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'FILE_REQUIRED',
        message: 'File upload is required'
      };
      res.status(400).json(response);
      return;
    }

    for (const uploadedFile of uploadedFiles) {
      // Check file size
      if (options.maxSize && uploadedFile.size > options.maxSize) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'FILE_TOO_LARGE',
          message: `File size exceeds maximum allowed size of ${options.maxSize} bytes`
        };
        res.status(400).json(response);
        return;
      }

      // Check MIME type
      if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(uploadedFile.mimetype)) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'INVALID_FILE_TYPE',
          message: `File type ${uploadedFile.mimetype} is not allowed. Allowed types: ${options.allowedMimeTypes.join(', ')}`
        };
        res.status(400).json(response);
        return;
      }
    }

    next();
  };
}

// Request size validation middleware
export function validateRequestSize(maxSize: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      const response: ApiResponse<any> = {
        success: false,
        error: 'REQUEST_TOO_LARGE',
        message: `Request size exceeds maximum allowed size of ${maxSize} bytes`
      };
      res.status(413).json(response);
      return;
    }

    next();
  };
}

// General validation middleware setup
export function validationMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Add validation utilities to request
    req.validate = {
      schema: (schema: ZodSchema, data: any) => {
        const result = schema.safeParse(data);
        if (!result.success) {
          const errors = result.error.errors.map(err => 
            `${err.path.join('.')}: ${err.message}`
          );
          throw new ValidationError('Validation failed', errors, 400);
        }
        return result.data;
      }
    };

    next();
  };
}



// Common validation schemas
export const commonSchemas = {
  uuid: z.string().uuid(),
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20)
  }),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
};