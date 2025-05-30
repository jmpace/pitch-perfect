// API sanitization middleware
import { NextRequest, NextResponse } from 'next/server';
import { sanitize, DEFAULT_SANITIZATION_OPTIONS, type StringSanitizationOptions } from './index';
import { ValidationError } from '@/lib/errors/types';

/**
 * Configuration for sanitization middleware
 */
export interface SanitizationMiddlewareConfig {
  /** Sanitize query parameters */
  sanitizeQuery?: boolean;
  /** Sanitize request body */
  sanitizeBody?: boolean;
  /** Sanitize headers (specific ones) */
  sanitizeHeaders?: string[];
  /** Custom sanitization options */
  options?: StringSanitizationOptions;
  /** Block requests with dangerous content */
  blockDangerous?: boolean;
  /** Maximum request body size to process (in bytes) */
  maxBodySize?: number;
  /** Request ID for logging */
  requestId?: string;
}

/**
 * Default middleware configuration
 */
export const DEFAULT_MIDDLEWARE_CONFIG: Required<SanitizationMiddlewareConfig> = {
  sanitizeQuery: true,
  sanitizeBody: true,
  sanitizeHeaders: ['user-agent', 'referer'],
  options: DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT,
  blockDangerous: true,
  maxBodySize: 10 * 1024 * 1024, // 10MB
  requestId: '',
};

/**
 * Sanitize query parameters from URL
 */
export function sanitizeQueryParams(
  searchParams: URLSearchParams,
  options: StringSanitizationOptions = DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    const sanitizedKey = sanitize.textInput(key);
    const sanitizedValue = sanitize.string(value, options);
    
    if (sanitizedKey && sanitizedValue !== null) {
      sanitized[sanitizedKey] = sanitizedValue;
    }
  }

  return sanitized;
}

/**
 * Sanitize request headers (only specific ones for security)
 */
export function sanitizeHeaders(
  headers: Headers,
  headersToSanitize: string[] = ['user-agent', 'referer'],
  options: StringSanitizationOptions = DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const headerName of headersToSanitize) {
    const value = headers.get(headerName);
    if (value) {
      const sanitizedValue = sanitize.string(value, options);
      if (sanitizedValue) {
        sanitized[headerName] = sanitizedValue;
      }
    }
  }

  return sanitized;
}

/**
 * Sanitize request body (JSON or FormData)
 */
export async function sanitizeRequestBody(
  request: NextRequest,
  options: StringSanitizationOptions = DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT,
  maxSize: number = DEFAULT_MIDDLEWARE_CONFIG.maxBodySize
): Promise<any> {
  const contentType = request.headers.get('content-type') || '';
  
  // Check content length
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSize) {
    throw new ValidationError(
      `Request body too large. Maximum size: ${maxSize} bytes`,
      { contentLength: parseInt(contentLength), maxSize }
    );
  }

  try {
    if (contentType.includes('application/json')) {
      // Handle JSON body
      const text = await request.text();
      
      if (text.length > maxSize) {
        throw new ValidationError(
          `Request body too large. Maximum size: ${maxSize} bytes`,
          { actualSize: text.length, maxSize }
        );
      }

      return sanitize.json(text, options);
    } 
    else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      // Handle FormData
      const formData = await request.formData();
      const sanitized: Record<string, any> = {};

      for (const [key, value] of formData.entries()) {
        const sanitizedKey = sanitize.textInput(key);
        
        if (value instanceof File) {
          // For files, sanitize the filename but keep the file object
          const sanitizedFilename = sanitize.filename(value.name);
          sanitized[sanitizedKey] = new File([value], sanitizedFilename, {
            type: value.type,
            lastModified: value.lastModified,
          });
        } else {
          // For text values, sanitize the content
          sanitized[sanitizedKey] = sanitize.string(value.toString(), options);
        }
      }

      return sanitized;
    }
    else {
      // Handle plain text
      const text = await request.text();
      
      if (text.length > maxSize) {
        throw new ValidationError(
          `Request body too large. Maximum size: ${maxSize} bytes`,
          { actualSize: text.length, maxSize }
        );
      }

      return sanitize.string(text, options);
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    
    throw new ValidationError(
      'Failed to parse and sanitize request body',
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Check if request contains dangerous content
 */
export function checkForDangerousContent(
  query: Record<string, string>,
  body: any,
  headers: Record<string, string>
): { isDangerous: boolean; reason?: string; location?: string } {
  // Check query parameters
  for (const [key, value] of Object.entries(query)) {
    if (sanitize.isDangerous(key) || sanitize.isDangerous(value)) {
      return {
        isDangerous: true,
        reason: 'Dangerous content detected in query parameters',
        location: 'query',
      };
    }
  }

  // Check headers
  for (const [key, value] of Object.entries(headers)) {
    if (sanitize.isDangerous(key) || sanitize.isDangerous(value)) {
      return {
        isDangerous: true,
        reason: 'Dangerous content detected in headers',
        location: 'headers',
      };
    }
  }

  // Check body (if it's a string or object with string values)
  if (typeof body === 'string') {
    if (sanitize.isDangerous(body)) {
      return {
        isDangerous: true,
        reason: 'Dangerous content detected in request body',
        location: 'body',
      };
    }
  } else if (body && typeof body === 'object') {
    const checkObject = (obj: any, path: string = 'body'): boolean => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && sanitize.isDangerous(value)) {
          return true;
        } else if (typeof value === 'object' && value !== null) {
          if (checkObject(value, `${path}.${key}`)) {
            return true;
          }
        }
      }
      return false;
    };

    if (checkObject(body)) {
      return {
        isDangerous: true,
        reason: 'Dangerous content detected in request body',
        location: 'body',
      };
    }
  }

  return { isDangerous: false };
}

/**
 * Sanitized request data interface
 */
export interface SanitizedRequestData {
  query: Record<string, string>;
  body: any;
  headers: Record<string, string>;
}

/**
 * Main sanitization middleware function
 */
export async function withSanitization(
  request: NextRequest,
  handler: (request: NextRequest, sanitizedData: SanitizedRequestData) => Promise<NextResponse>,
  config: Partial<SanitizationMiddlewareConfig> = {}
): Promise<NextResponse> {
  const finalConfig = { ...DEFAULT_MIDDLEWARE_CONFIG, ...config };
  
  try {
    const sanitizedData: SanitizedRequestData = {
      query: {},
      body: null,
      headers: {},
    };

    // Sanitize query parameters
    if (finalConfig.sanitizeQuery) {
      const url = new URL(request.url);
      sanitizedData.query = sanitizeQueryParams(url.searchParams, finalConfig.options);
    }

    // Sanitize headers
    if (finalConfig.sanitizeHeaders.length > 0) {
      sanitizedData.headers = sanitizeHeaders(
        request.headers,
        finalConfig.sanitizeHeaders,
        finalConfig.options
      );
    }

    // Sanitize body
    if (finalConfig.sanitizeBody && (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH')) {
      // Clone the request since body can only be read once
      const clonedRequest = request.clone() as NextRequest;
      sanitizedData.body = await sanitizeRequestBody(
        clonedRequest,
        finalConfig.options,
        finalConfig.maxBodySize
      );
    }

    // Check for dangerous content if enabled
    if (finalConfig.blockDangerous) {
      const dangerCheck = checkForDangerousContent(
        sanitizedData.query,
        sanitizedData.body,
        sanitizedData.headers
      );

      if (dangerCheck.isDangerous) {
        return NextResponse.json(
          {
            error: 'Dangerous content detected',
            message: dangerCheck.reason,
            location: dangerCheck.location,
          },
          { status: 400 }
        );
      }
    }

    // Call the original handler with sanitized data
    return await handler(request, sanitizedData);
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: 'Input validation failed',
          message: error.message,
          details: error.details,
        },
        { status: error.statusCode }
      );
    }

    // For other errors, return a generic error response
    return NextResponse.json(
      {
        error: 'Request processing failed',
        message: 'Unable to process request due to invalid input',
      },
      { status: 400 }
    );
  }
}

/**
 * Convenience wrapper for API routes with sanitization
 */
export function createSanitizedHandler(
  handler: (request: NextRequest, sanitizedData: SanitizedRequestData) => Promise<NextResponse>,
  config: Partial<SanitizationMiddlewareConfig> = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    return withSanitization(request, handler, config);
  };
}

/**
 * Simple sanitization decorator for quick application
 */
export function sanitized(config: Partial<SanitizationMiddlewareConfig> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(request: NextRequest) => Promise<NextResponse>>
  ) {
    const originalMethod = descriptor.value;
    if (!originalMethod) return;

    descriptor.value = async function (request: NextRequest): Promise<NextResponse> {
      return withSanitization(
        request,
        async (req, sanitizedData) => {
          // Call original method with sanitized data attached to request
          (req as any).sanitized = sanitizedData;
          return originalMethod.call(this, req);
        },
        config
      );
    };

    return descriptor;
  };
}

/**
 * Type guard to check if request has been sanitized
 */
export function hasSanitizedData(request: any): request is NextRequest & { sanitized: SanitizedRequestData } {
  return request && typeof request === 'object' && 'sanitized' in request;
}

/**
 * Export common configurations
 */
export const SANITIZATION_CONFIGS = {
  // Strict sanitization for sensitive endpoints
  STRICT: {
    blockDangerous: true,
    options: DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT,
    maxBodySize: 1024 * 1024, // 1MB
  },
  
  // Standard sanitization for most APIs
  STANDARD: {
    blockDangerous: true,
    options: DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT,
    maxBodySize: 10 * 1024 * 1024, // 10MB
  },
  
  // Permissive sanitization for content APIs
  PERMISSIVE: {
    blockDangerous: false,
    options: DEFAULT_SANITIZATION_OPTIONS.CONTENT_INPUT,
    maxBodySize: 50 * 1024 * 1024, // 50MB
  },

  // File upload sanitization
  UPLOAD: {
    sanitizeQuery: true,
    sanitizeBody: false, // Don't sanitize file content
    sanitizeHeaders: ['user-agent'],
    blockDangerous: true,
    maxBodySize: 100 * 1024 * 1024, // 100MB
  },
} as const; 