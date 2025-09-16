import { z } from 'zod';

// File validation utilities
export const validateVideoFile = (file: File): boolean => {
  const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'];
  const maxSize = 500 * 1024 * 1024; // 500MB
  
  return allowedTypes.includes(file.type) && file.size <= maxSize;
};

export const validateSrtFile = (file: File): boolean => {
  const allowedTypes = ['text/plain', 'application/x-subrip'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  return (allowedTypes.includes(file.type) || file.name.endsWith('.srt')) && file.size <= maxSize;
};

// Generic validation helper
export const validateWithSchema = <T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; error?: string } => {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      };
    }
    return { success: false, error: 'Validation failed' };
  }
};