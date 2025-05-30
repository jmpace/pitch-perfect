// Validation utilities for file uploads and API requests

import { 
  FileTypeError, 
  FileSizeError, 
  MissingParameterError,
  ValidationError,
  createUnsupportedFileError,
  createFileTooLargeError,
  createMissingFileError
} from '@/lib/errors/types';

// File validation configuration
export const FILE_VALIDATION_CONFIG = {
  ALLOWED_TYPES: ['video/mp4', 'video/mov', 'video/webm', 'video/quicktime'],
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB in bytes
  MIN_FILE_SIZE: 1024, // 1KB minimum
  MAX_FILENAME_LENGTH: 255,
} as const;

// Interface for file validation result
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    size: number;
    type: string;
    name: string;
  };
}

// Validate uploaded file
export function validateFile(file: File | null, requestId: string): void {
  if (!file) {
    throw createMissingFileError(requestId);
  }

  // Validate file type
  if (!FILE_VALIDATION_CONFIG.ALLOWED_TYPES.includes(file.type as any)) {
    throw createUnsupportedFileError(
      file.type, 
      [...FILE_VALIDATION_CONFIG.ALLOWED_TYPES],
      requestId
    );
  }

  // Validate file size
  if (file.size > FILE_VALIDATION_CONFIG.MAX_FILE_SIZE) {
    throw createFileTooLargeError(
      file.size,
      FILE_VALIDATION_CONFIG.MAX_FILE_SIZE,
      requestId
    );
  }

  if (file.size < FILE_VALIDATION_CONFIG.MIN_FILE_SIZE) {
    throw new FileSizeError(
      `File too small. Minimum size is ${formatBytes(FILE_VALIDATION_CONFIG.MIN_FILE_SIZE)}`,
      { 
        actualSize: file.size, 
        minSize: FILE_VALIDATION_CONFIG.MIN_FILE_SIZE 
      },
      requestId
    );
  }

  // Validate filename
  if (file.name.length > FILE_VALIDATION_CONFIG.MAX_FILENAME_LENGTH) {
    throw new ValidationError(
      `Filename too long. Maximum length is ${FILE_VALIDATION_CONFIG.MAX_FILENAME_LENGTH} characters`,
      { 
        actualLength: file.name.length, 
        maxLength: FILE_VALIDATION_CONFIG.MAX_FILENAME_LENGTH 
      },
      requestId
    );
  }

  // Check for potentially malicious filenames
  if (containsSuspiciousPatterns(file.name)) {
    throw new ValidationError(
      'Filename contains invalid characters or patterns',
      { filename: file.name },
      requestId
    );
  }
}

// Comprehensive file validation with detailed results
export function validateFileDetailed(file: File | null): FileValidationResult {
  const result: FileValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (!file) {
    result.isValid = false;
    result.errors.push('No file provided');
    return result;
  }

  result.metadata = {
    size: file.size,
    type: file.type,
    name: file.name,
  };

  // Check file type
  if (!FILE_VALIDATION_CONFIG.ALLOWED_TYPES.includes(file.type as any)) {
    result.isValid = false;
    result.errors.push(
      `Unsupported file type '${file.type}'. Allowed types: ${FILE_VALIDATION_CONFIG.ALLOWED_TYPES.join(', ')}`
    );
  }

  // Check file size
  if (file.size > FILE_VALIDATION_CONFIG.MAX_FILE_SIZE) {
    result.isValid = false;
    result.errors.push(
      `File size ${formatBytes(file.size)} exceeds limit of ${formatBytes(FILE_VALIDATION_CONFIG.MAX_FILE_SIZE)}`
    );
  }

  if (file.size < FILE_VALIDATION_CONFIG.MIN_FILE_SIZE) {
    result.isValid = false;
    result.errors.push(
      `File too small. Minimum size is ${formatBytes(FILE_VALIDATION_CONFIG.MIN_FILE_SIZE)}`
    );
  }

  // Check filename length
  if (file.name.length > FILE_VALIDATION_CONFIG.MAX_FILENAME_LENGTH) {
    result.isValid = false;
    result.errors.push(
      `Filename too long. Maximum ${FILE_VALIDATION_CONFIG.MAX_FILENAME_LENGTH} characters`
    );
  }

  // Check for suspicious patterns
  if (containsSuspiciousPatterns(file.name)) {
    result.isValid = false;
    result.errors.push('Filename contains invalid characters or patterns');
  }

  // Add warnings for edge cases
  if (file.size > FILE_VALIDATION_CONFIG.MAX_FILE_SIZE * 0.8) {
    result.warnings.push('File is very large and may take longer to upload');
  }

  if (file.type === 'video/quicktime') {
    result.warnings.push('QuickTime files may not be compatible with all browsers');
  }

  return result;
}

// Validate request parameters
export function validateRequestParams(
  params: Record<string, any>,
  required: string[],
  requestId: string
): void {
  for (const field of required) {
    if (!(field in params) || params[field] === undefined || params[field] === null) {
      throw new MissingParameterError(
        `Required parameter '${field}' is missing`,
        { parameter: field, required: true },
        requestId
      );
    }
  }
}

// Validate boolean parameters
export function validateBooleanParam(
  value: any,
  paramName: string,
  requestId: string
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }

  throw new ValidationError(
    `Parameter '${paramName}' must be a boolean value`,
    { 
      parameter: paramName, 
      receivedValue: value, 
      expectedType: 'boolean' 
    },
    requestId
  );
}

// Validate numeric parameters with range checking
export function validateNumericParam(
  value: any,
  paramName: string,
  min?: number,
  max?: number,
  requestId?: string
): number {
  const num = Number(value);

  if (isNaN(num)) {
    throw new ValidationError(
      `Parameter '${paramName}' must be a valid number`,
      { 
        parameter: paramName, 
        receivedValue: value, 
        expectedType: 'number' 
      },
      requestId
    );
  }

  if (min !== undefined && num < min) {
    throw new ValidationError(
      `Parameter '${paramName}' must be at least ${min}`,
      { 
        parameter: paramName, 
        receivedValue: num, 
        minimum: min 
      },
      requestId
    );
  }

  if (max !== undefined && num > max) {
    throw new ValidationError(
      `Parameter '${paramName}' must be at most ${max}`,
      { 
        parameter: paramName, 
        receivedValue: num, 
        maximum: max 
      },
      requestId
    );
  }

  return num;
}

// Validate string parameters
export function validateStringParam(
  value: any,
  paramName: string,
  minLength?: number,
  maxLength?: number,
  pattern?: RegExp,
  requestId?: string
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `Parameter '${paramName}' must be a string`,
      { 
        parameter: paramName, 
        receivedValue: value, 
        expectedType: 'string' 
      },
      requestId
    );
  }

  if (minLength !== undefined && value.length < minLength) {
    throw new ValidationError(
      `Parameter '${paramName}' must be at least ${minLength} characters`,
      { 
        parameter: paramName, 
        receivedLength: value.length, 
        minLength 
      },
      requestId
    );
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(
      `Parameter '${paramName}' must be at most ${maxLength} characters`,
      { 
        parameter: paramName, 
        receivedLength: value.length, 
        maxLength 
      },
      requestId
    );
  }

  if (pattern && !pattern.test(value)) {
    throw new ValidationError(
      `Parameter '${paramName}' format is invalid`,
      { 
        parameter: paramName, 
        receivedValue: value, 
        expectedPattern: pattern.toString() 
      },
      requestId
    );
  }

  return value;
}

// Validate enum parameters
export function validateEnumParam<T extends string>(
  value: any,
  paramName: string,
  allowedValues: readonly T[],
  requestId?: string
): T {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `Parameter '${paramName}' must be one of: ${allowedValues.join(', ')}`,
      { 
        parameter: paramName, 
        receivedValue: value, 
        allowedValues: allowedValues 
      },
      requestId
    );
  }

  return value;
}

// Check for suspicious filename patterns
function containsSuspiciousPatterns(filename: string): boolean {
  const suspiciousPatterns = [
    /\.\./,           // Directory traversal
    /[<>:"|?*]/,      // Windows invalid characters
    /[\x00-\x1f]/,    // Control characters
    /^\.+$/,          // Only dots
    /\.(exe|bat|cmd|scr|vbs|js|jar)$/i, // Executable extensions
  ];

  return suspiciousPatterns.some(pattern => pattern.test(filename));
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Sanitize filename for safe storage
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"|?*]/g, '_')     // Replace invalid characters
    .replace(/\.\./g, '_')          // Replace directory traversal
    .replace(/[\x00-\x1f]/g, '')    // Remove control characters
    .substring(0, FILE_VALIDATION_CONFIG.MAX_FILENAME_LENGTH) // Truncate if too long
    .trim();
} 