import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { ApiResponse } from '@dubai/shared';
import { DubbingWorkflowError, ValidationError, ProcessingError } from '../types/errors';

export function errorHandler(logger: winston.Logger) {
  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    // Log the error
    logger.error('Request error:', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });

    // Default error response
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = undefined;

    // Handle specific error types
    if (error instanceof DubbingWorkflowError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
    } else if (error instanceof ValidationError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
      details = { validationErrors: error.details };
    } else if (error instanceof ProcessingError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
      details = { 
        stage: error.stage, 
        recoverable: error.recoverable 
      };
    } else if (error.name === 'ValidationError') {
      // Handle Joi/Zod validation errors
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      message = 'Request validation failed';
      details = { validationError: error.message };
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      errorCode = 'UNAUTHORIZED';
      message = 'Authentication required';
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
      message = 'Access denied';
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
      message = 'Resource not found';
    }

    // Don't expose internal error details in production
    if (process.env['NODE_ENV'] === 'production' && statusCode === 500) {
      message = 'Internal server error';
      details = undefined;
    }

    const response: ApiResponse<any> = {
      success: false,
      error: errorCode,
      message,
      ...(details && { data: details })
    };

    res.status(statusCode).json(response);
  };
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Not found handler
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse<any> = {
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`
  };
  res.status(404).json(response);
}