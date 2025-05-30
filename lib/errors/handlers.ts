// Error handling utilities for storage system

import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { 
  BaseStorageError, 
  isStorageError,
  isNetworkError,
  BlobAccessError,
  NetworkError,
  TimeoutError,
  ConfigurationError,
  InternalServerError,
  createBlobTokenError
} from './types';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
    timestamp: string;
  };
}

export interface SuccessResponse<T = Record<string, unknown>> {
  success: true;
  data: T;
  requestId: string;
  timestamp: string;
}

// Generate unique request ID for tracking
export function generateRequestId(): string {
  return nanoid(10);
}

// Convert any error to a storage error with proper context
export function normalizeError(error: unknown, requestId: string): BaseStorageError {
  if (isStorageError(error)) {
    // Already a properly formatted storage error
    return error;
  }

  if (error instanceof Error) {
    // Check for specific error patterns from Vercel Blob SDK
    if (error.message.includes('token') || error.message.includes('unauthorized')) {
      return createBlobTokenError(requestId);
    }

    if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
      return new TimeoutError(
        'Operation timed out - please try again',
        { originalError: error.message },
        requestId
      );
    }

    if (error.message.includes('network') || error.message.includes('fetch')) {
      return new NetworkError(
        'Network connectivity issue',
        { originalError: error.message },
        requestId
      );
    }

    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      return new NetworkError(
        'Unable to connect to storage service',
        { originalError: error.message },
        requestId
      );
    }

    // Generic error fallback
    return new InternalServerError(
      error.message || 'An unexpected error occurred',
      { originalError: error.message, stack: error.stack },
      requestId
    );
  }

  // Non-Error objects
  return new InternalServerError(
    'An unknown error occurred',
    { originalError: String(error) },
    requestId
  );
}

// Create standardized error response
export function createErrorResponse(error: BaseStorageError): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      requestId: error.requestId || generateRequestId(),
      timestamp: error.timestamp,
    },
  };

  return NextResponse.json(response, { status: error.statusCode });
}

// Create standardized success response
export function createSuccessResponse<T>(data: T, requestId: string): NextResponse<SuccessResponse<T>> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response);
}

// Enhanced error logging with context
export function logError(error: BaseStorageError, context?: Record<string, unknown>): void {
  const logData = {
    level: 'error',
    timestamp: error.timestamp,
    requestId: error.requestId,
    errorCode: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    context,
    stack: error.stack,
  };

  // In production, you'd send this to your logging service
  console.error('Storage Error:', JSON.stringify(logData, null, 2));
}

// Handle blob SDK specific errors
export function handleBlobSDKError(error: unknown, requestId: string): BaseStorageError {
  if (error instanceof Error) {
    // Check for specific Vercel Blob SDK error patterns
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid token')) {
      return new BlobAccessError(
        'Blob storage authentication failed',
        { 
          suggestion: 'Verify BLOB_READ_WRITE_TOKEN is valid and has proper permissions',
          originalError: error.message 
        },
        requestId
      );
    }

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return new BlobAccessError(
        'Blob not found or access denied',
        { originalError: error.message },
        requestId
      );
    }

    if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      return new InternalServerError(
        'Storage quota exceeded',
        { 
          suggestion: 'Contact administrator to increase storage quota',
          originalError: error.message 
        },
        requestId
      );
    }

    if (errorMessage.includes('rate limit')) {
      return new InternalServerError(
        'Storage API rate limit exceeded',
        { 
          suggestion: 'Please wait before trying again',
          originalError: error.message 
        },
        requestId
      );
    }
  }

  return normalizeError(error, requestId);
}

// Validate environment configuration
export function validateStorageConfig(): ConfigurationError | null {
  const requiredEnvVars = ['BLOB_READ_WRITE_TOKEN'];
  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    return new ConfigurationError(
      `Missing required environment variables: ${missing.join(', ')}`,
      { missingVariables: missing }
    );
  }

  return null;
}

// Enhanced error handling wrapper with timeout and retry logic
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  requestId: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    logError(normalizedError, { context });
    throw normalizedError;
  }
}

// Timeout wrapper for operations
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = 30000,
  requestId: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(
        `Operation timed out after ${timeoutMs}ms`,
        { timeoutMs },
        requestId
      ));
    }, timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]);
}

// Rate limiting helper
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000,
  requestId: string
): void {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Get existing timestamps for this identifier
  const timestamps = rateLimitMap.get(identifier) || [];
  
  // Remove old timestamps outside the window
  const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
  
  // Check if limit exceeded
  if (validTimestamps.length >= limit) {
    throw new InternalServerError(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      { 
        identifier,
        limit,
        windowMs,
        currentCount: validTimestamps.length 
      },
      requestId
    );
  }
  
  // Add current timestamp
  validTimestamps.push(now);
  rateLimitMap.set(identifier, validTimestamps);
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance
    for (const [key, times] of rateLimitMap.entries()) {
      const filtered = times.filter(time => time > windowStart);
      if (filtered.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, filtered);
      }
    }
  }
}

// Retry logic with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  requestId: string
): Promise<T> {
  let lastError: BaseStorageError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = normalizeError(error, requestId);
      
      // Don't retry on validation errors or client errors
      if (lastError.statusCode >= 400 && lastError.statusCode < 500) {
        throw lastError;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      logError(lastError, { 
        context: 'Retry attempt',
        attempt: attempt + 1,
        maxRetries,
        nextDelay: attempt < maxRetries ? baseDelayMs * Math.pow(2, attempt + 1) : null
      });
    }
  }
  
  throw lastError!;
}

// Error aggregator for batch operations
export class ErrorAggregator {
  private errors: BaseStorageError[] = [];
  private readonly requestId: string;

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  add(error: unknown, context?: string): void {
    const normalizedError = normalizeError(error, this.requestId);
    if (context) {
      normalizedError.details = { ...normalizedError.details, context };
    }
    this.errors.push(normalizedError);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): BaseStorageError[] {
    return [...this.errors];
  }

  throwIfAny(): void {
    if (this.hasErrors()) {
      throw new InternalServerError(
        `Multiple errors occurred: ${this.errors.map(e => e.message).join(', ')}`,
        { 
          errors: this.errors.map(e => e.toJSON()),
          count: this.errors.length 
        },
        this.requestId
      );
    }
  }

  getSummary(): { total: number; byCode: Record<string, number> } {
    const byCode: Record<string, number> = {};
    for (const error of this.errors) {
      byCode[error.code] = (byCode[error.code] || 0) + 1;
    }
    return { total: this.errors.length, byCode };
  }
} 