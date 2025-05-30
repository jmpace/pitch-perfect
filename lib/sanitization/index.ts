// Input sanitization utilities for security
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

/**
 * Configuration for different sanitization levels
 */
export const SANITIZATION_CONFIG = {
  // Strict mode - removes all HTML/scripts, only allows plain text
  STRICT: {
    ALLOWED_TAGS: [] as string[],
    ALLOWED_ATTR: [] as string[],
  },
  
  // Basic mode - allows basic formatting but removes scripts
  BASIC: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'] as string[],
    ALLOWED_ATTR: [] as string[],
  },
  
  // Permissive mode - allows more tags but still removes dangerous content
  PERMISSIVE: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'a', 'ul', 'ol', 'li', 'blockquote'] as string[],
    ALLOWED_ATTR: ['href', 'title'] as string[],
  }
} as const;

/**
 * Sanitization mode type
 */
export type SanitizationMode = keyof typeof SANITIZATION_CONFIG;

/**
 * Comprehensive string sanitization options
 */
export interface StringSanitizationOptions {
  /** Remove HTML tags */
  stripHtml?: boolean;
  /** Escape HTML entities */
  escapeHtml?: boolean;
  /** Trim whitespace */
  trim?: boolean;
  /** Remove null bytes */
  removeNullBytes?: boolean;
  /** Remove control characters */
  removeControlChars?: boolean;
  /** Maximum length (truncate if longer) */
  maxLength?: number;
  /** Custom character replacement map */
  replaceChars?: Record<string, string>;
  /** DOMPurify sanitization mode */
  domPurifyMode?: SanitizationMode;
}

/**
 * Default sanitization options for different contexts
 */
export const DEFAULT_SANITIZATION_OPTIONS = {
  // For general text inputs (names, titles, etc.)
  TEXT_INPUT: {
    stripHtml: true,
    escapeHtml: true,
    trim: true,
    removeNullBytes: true,
    removeControlChars: true,
    domPurifyMode: 'STRICT' as SanitizationMode,
  },
  
  // For user descriptions or content that might contain basic formatting
  CONTENT_INPUT: {
    stripHtml: false,
    escapeHtml: false,
    trim: true,
    removeNullBytes: true,
    removeControlChars: true,
    domPurifyMode: 'BASIC' as SanitizationMode,
  },
  
  // For URLs and links
  URL_INPUT: {
    stripHtml: true,
    escapeHtml: true,
    trim: true,
    removeNullBytes: true,
    removeControlChars: true,
    domPurifyMode: 'STRICT' as SanitizationMode,
  },
  
  // For filenames
  FILENAME_INPUT: {
    stripHtml: true,
    escapeHtml: true,
    trim: true,
    removeNullBytes: true,
    removeControlChars: true,
    maxLength: 255,
    replaceChars: {
      '<': '_',
      '>': '_',
      ':': '_',
      '"': '_',
      '|': '_',
      '?': '_',
      '*': '_',
      '\\': '_',
      '/': '_',
    },
    domPurifyMode: 'STRICT' as SanitizationMode,
  },
} as const;

/**
 * Sanitize HTML content using DOMPurify
 */
export function sanitizeHtml(
  input: string,
  mode: SanitizationMode = 'STRICT'
): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const config = SANITIZATION_CONFIG[mode];
  
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [...config.ALLOWED_TAGS],
    ALLOWED_ATTR: [...config.ALLOWED_ATTR],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe', 'meta', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
  });
}

/**
 * Comprehensive string sanitization
 */
export function sanitizeString(
  input: string,
  options: StringSanitizationOptions = DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT
): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Apply DOMPurify sanitization first if specified
  if (options.domPurifyMode) {
    sanitized = sanitizeHtml(sanitized, options.domPurifyMode);
  }

  // Strip HTML tags if requested
  if (options.stripHtml) {
    sanitized = validator.stripLow(sanitized, true);
    // Remove any remaining HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // Escape HTML entities if requested
  if (options.escapeHtml) {
    sanitized = validator.escape(sanitized);
  }

  // Remove null bytes
  if (options.removeNullBytes) {
    sanitized = sanitized.replace(/\0/g, '');
  }

  // Remove control characters (except newlines and tabs)
  if (options.removeControlChars) {
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  // Apply custom character replacements
  if (options.replaceChars) {
    for (const [from, to] of Object.entries(options.replaceChars)) {
      sanitized = sanitized.replace(new RegExp(validator.escape(from), 'g'), to);
    }
  }

  // Trim whitespace if requested
  if (options.trim) {
    sanitized = sanitized.trim();
  }

  // Truncate if max length specified
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  return sanitized;
}

/**
 * Sanitize filename for safe storage and display
 */
export function sanitizeFilename(filename: string): string {
  return sanitizeString(filename, DEFAULT_SANITIZATION_OPTIONS.FILENAME_INPUT);
}

/**
 * Sanitize URL for safe usage
 */
export function sanitizeUrl(url: string): string {
  const sanitized = sanitizeString(url, DEFAULT_SANITIZATION_OPTIONS.URL_INPUT);
  
  // Additional URL validation
  if (!validator.isURL(sanitized, { 
    protocols: ['http', 'https'],
    require_protocol: true,
    allow_underscores: true,
  })) {
    return ''; // Return empty string for invalid URLs
  }
  
  return sanitized;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeString(email, DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT);
  
  // Validate email format
  if (!validator.isEmail(sanitized)) {
    return ''; // Return empty string for invalid emails
  }
  
  return sanitized;
}

/**
 * Sanitize user text input (names, titles, etc.)
 */
export function sanitizeTextInput(input: string): string {
  return sanitizeString(input, DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT);
}

/**
 * Sanitize user content that may contain basic formatting
 */
export function sanitizeContentInput(input: string): string {
  return sanitizeString(input, DEFAULT_SANITIZATION_OPTIONS.CONTENT_INPUT);
}

/**
 * Sanitize an object's string properties recursively
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: StringSanitizationOptions = DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT
): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = { ...obj };

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      (sanitized as any)[key] = sanitizeString(value, options);
    } else if (Array.isArray(value)) {
      (sanitized as any)[key] = value.map(item => 
        typeof item === 'string' 
          ? sanitizeString(item, options)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item, options)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      (sanitized as any)[key] = sanitizeObject(value, options);
    }
  }

  return sanitized;
}

/**
 * Validate and sanitize JSON input
 */
export function sanitizeJsonInput<T = any>(
  input: string,
  options: StringSanitizationOptions = DEFAULT_SANITIZATION_OPTIONS.TEXT_INPUT
): T | null {
  try {
    // First sanitize the JSON string itself
    const sanitizedJson = sanitizeString(input, {
      ...options,
      stripHtml: false, // Don't strip HTML from JSON structure
      escapeHtml: false, // Don't escape HTML in JSON structure
    });

    // Parse the JSON
    const parsed = JSON.parse(sanitizedJson);

    // Sanitize string values within the parsed object
    return sanitizeObject(parsed, options);
  } catch (error) {
    console.error('Invalid JSON input:', error);
    return null;
  }
}

/**
 * Check if a string contains potentially dangerous content
 */
export function containsDangerousContent(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  const dangerousPatterns = [
    // Script tags and javascript
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    
    // Event handlers
    /on\w+\s*=/gi,
    
    // HTML entities that could be used for obfuscation
    /&#x?[0-9a-f]+;/gi,
    
    // SQL injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    
    // File system paths
    /\.\.[\/\\]/gi,
    
    // Null bytes and control characters
    /\0/g,
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
  ];

  return dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Enhanced filename sanitization with comprehensive security patterns
 */
export function sanitizeFilenameEnhanced(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'file';
  }

  let sanitized = filename;

  // Remove directory traversal patterns
  sanitized = sanitized.replace(/\.\.[\/\\]/g, '_');
  
  // Remove or replace dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f\x7f]/g, '_');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\.\s]+|[\.\s]+$/g, '');
  
  // Replace multiple consecutive dots
  sanitized = sanitized.replace(/\.{2,}/g, '.');
  
  // Remove dangerous file extensions by replacing with .txt
  const dangerousExtensions = /\.(exe|bat|cmd|scr|vbs|js|jar|com|pif|application|gadget|msi|msp|ps1|ps2|reg|lnk)$/i;
  if (dangerousExtensions.test(sanitized)) {
    sanitized = sanitized.replace(dangerousExtensions, '.txt');
  }
  
  // Ensure filename isn't too long
  if (sanitized.length > 255) {
    const extension = sanitized.substring(sanitized.lastIndexOf('.'));
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
    sanitized = nameWithoutExt.substring(0, 255 - extension.length) + extension;
  }
  
  // Fallback for empty filenames
  if (!sanitized || sanitized === '.' || sanitized === '_') {
    sanitized = 'file.txt';
  }

  return sanitized;
}

/**
 * Rate limiting helper for input sanitization
 */
export function createSanitizationLimiter() {
  const attempts = new Map<string, number>();
  const windowMs = 60000; // 1 minute
  const maxAttempts = 100; // Max 100 sanitization attempts per minute per IP

  return function checkSanitizationRate(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [key, timestamp] of attempts.entries()) {
      if (timestamp < windowStart) {
        attempts.delete(key);
      }
    }
    
    const currentCount = attempts.get(identifier) || 0;
    
    if (currentCount >= maxAttempts) {
      return false; // Rate limit exceeded
    }
    
    attempts.set(identifier, currentCount + 1);
    return true; // Within rate limit
  };
}

/**
 * Export common sanitization functions for easy access
 */
export const sanitize = {
  html: sanitizeHtml,
  string: sanitizeString,
  filename: sanitizeFilenameEnhanced,
  url: sanitizeUrl,
  email: sanitizeEmail,
  textInput: sanitizeTextInput,
  contentInput: sanitizeContentInput,
  object: sanitizeObject,
  json: sanitizeJsonInput,
  isDangerous: containsDangerousContent,
};

/**
 * Default export for common usage
 */
export default sanitize; 