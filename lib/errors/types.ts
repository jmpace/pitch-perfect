// Comprehensive error types for file storage system

export interface ErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
  statusCode: number;
}

// Base error class for all storage-related errors
export abstract class BaseStorageError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: string;
  readonly requestId?: string;
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>, requestId?: string) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.details = details;
    this.requestId = requestId;
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      requestId: this.requestId,
      timestamp: this.timestamp,
      statusCode: this.statusCode,
    };
  }
}

// Authentication and authorization errors
export class BlobAccessError extends BaseStorageError {
  readonly code = 'BLOB_ACCESS_ERROR';
  readonly statusCode = 401;

  constructor(message = 'Invalid or missing blob storage token', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class AuthenticationError extends BaseStorageError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly statusCode = 401;

  constructor(message = 'Authentication failed', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

// File validation errors
export class FileTypeError extends BaseStorageError {
  readonly code = 'INVALID_FILE_TYPE';
  readonly statusCode = 400;

  constructor(message = 'Unsupported file type', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class FileSizeError extends BaseStorageError {
  readonly code = 'FILE_SIZE_ERROR';
  readonly statusCode = 413;

  constructor(message = 'File size exceeds limit', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class FileValidationError extends BaseStorageError {
  readonly code = 'FILE_VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message = 'File validation failed', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

// Storage-specific errors
export class StorageQuotaError extends BaseStorageError {
  readonly code = 'STORAGE_QUOTA_EXCEEDED';
  readonly statusCode = 507;

  constructor(message = 'Storage quota exceeded', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class BlobNotFoundError extends BaseStorageError {
  readonly code = 'BLOB_NOT_FOUND';
  readonly statusCode = 404;

  constructor(message = 'Blob not found', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class BlobOperationError extends BaseStorageError {
  readonly code = 'BLOB_OPERATION_ERROR';
  readonly statusCode = 500;

  constructor(message = 'Blob operation failed', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

// Network and connectivity errors
export class NetworkError extends BaseStorageError {
  readonly code = 'NETWORK_ERROR';
  readonly statusCode = 503;

  constructor(message = 'Network connectivity issue', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class TimeoutError extends BaseStorageError {
  readonly code = 'TIMEOUT_ERROR';
  readonly statusCode = 408;

  constructor(message = 'Operation timed out', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

// Rate limiting and abuse prevention
export class RateLimitError extends BaseStorageError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;

  constructor(message = 'Rate limit exceeded', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

// Input validation errors
export class ValidationError extends BaseStorageError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message = 'Invalid input parameters', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class MissingParameterError extends BaseStorageError {
  readonly code = 'MISSING_PARAMETER';
  readonly statusCode = 400;

  constructor(message = 'Required parameter missing', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

// Processing and upload errors
export class UploadError extends BaseStorageError {
  readonly code = 'UPLOAD_ERROR';
  readonly statusCode = 500;

  constructor(message = 'Upload operation failed', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class ProcessingError extends BaseStorageError {
  readonly code = 'PROCESSING_ERROR';
  readonly statusCode = 500;

  constructor(message = 'File processing failed', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

// Configuration and setup errors
export class ConfigurationError extends BaseStorageError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;

  constructor(message = 'System configuration error', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

// Generic internal server error
export class InternalServerError extends BaseStorageError {
  readonly code = 'INTERNAL_SERVER_ERROR';
  readonly statusCode = 500;

  constructor(message = 'Internal server error', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

// Video processing specific errors
export class VideoProcessingError extends BaseStorageError {
  readonly code = 'VIDEO_PROCESSING_ERROR';
  readonly statusCode = 500;

  constructor(message = 'Video processing failed', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class VideoFormatError extends BaseStorageError {
  readonly code = 'UNSUPPORTED_VIDEO_FORMAT';
  readonly statusCode = 400;

  constructor(message = 'Unsupported video format', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class VideoCorruptedError extends BaseStorageError {
  readonly code = 'VIDEO_CORRUPTED';
  readonly statusCode = 400;

  constructor(message = 'Video file is corrupted or unreadable', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class FFmpegError extends BaseStorageError {
  readonly code = 'FFMPEG_ERROR';
  readonly statusCode = 500;

  constructor(message = 'FFmpeg processing error', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class FrameExtractionError extends BaseStorageError {
  readonly code = 'FRAME_EXTRACTION_ERROR';
  readonly statusCode = 500;

  constructor(message = 'Frame extraction failed', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class AudioExtractionError extends BaseStorageError {
  readonly code = 'AUDIO_EXTRACTION_ERROR';
  readonly statusCode = 500;

  constructor(message = 'Audio extraction failed', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class VideoProcessingTimeoutError extends BaseStorageError {
  readonly code = 'VIDEO_PROCESSING_TIMEOUT';
  readonly statusCode = 408;

  constructor(message = 'Video processing timed out', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

export class ProcessingJobNotFoundError extends BaseStorageError {
  readonly code = 'PROCESSING_JOB_NOT_FOUND';
  readonly statusCode = 404;

  constructor(message = 'Processing job not found', details?: Record<string, unknown>, requestId?: string) {
    super(message, details, requestId);
  }
}

// Type guards for error checking
export function isStorageError(error: unknown): error is BaseStorageError {
  return error instanceof BaseStorageError;
}

export function isBlobError(error: unknown): boolean {
  return isStorageError(error) && 
    ['BLOB_ACCESS_ERROR', 'BLOB_NOT_FOUND', 'BLOB_OPERATION_ERROR'].includes(error.code);
}

export function isValidationError(error: unknown): boolean {
  return isStorageError(error) && 
    ['VALIDATION_ERROR', 'MISSING_PARAMETER', 'INVALID_FILE_TYPE', 'FILE_SIZE_ERROR'].includes(error.code);
}

export function isNetworkError(error: unknown): boolean {
  return isStorageError(error) && 
    ['NETWORK_ERROR', 'TIMEOUT_ERROR'].includes(error.code);
}

// Helper functions for common errors
export function createBlobTokenError(requestId?: string): BlobAccessError {
  return new BlobAccessError(
    'Blob storage token is invalid or missing',
    { suggestion: 'Check BLOB_READ_WRITE_TOKEN environment variable' },
    requestId
  );
}

export function createFileTooLargeError(size: number, limit: number, requestId?: string): FileSizeError {
  return new FileSizeError(
    `File size ${formatBytes(size)} exceeds limit of ${formatBytes(limit)}`,
    { actualSize: size, limitSize: limit },
    requestId
  );
}

export function createUnsupportedFileError(type: string, allowed: string[], requestId?: string): FileTypeError {
  return new FileTypeError(
    `File type '${type}' is not supported. Allowed types: ${allowed.join(', ')}`,
    { providedType: type, allowedTypes: allowed },
    requestId
  );
}

export function createMissingFileError(requestId?: string): MissingParameterError {
  return new MissingParameterError(
    'No file provided in request',
    { field: 'file', suggestion: 'Include a file in the form data' },
    requestId
  );
}

// Utility function for formatting bytes
function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
} 