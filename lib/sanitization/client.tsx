"use client";

// Client-side sanitization utilities for React components
import React, { useCallback, useMemo } from 'react';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Basic sanitization configurations for client-side use
 */
export const CLIENT_SANITIZATION_CONFIG = {
  // Strict mode - removes all HTML/scripts, only allows plain text
  STRICT: {
    ALLOWED_TAGS: [] as string[],
    ALLOWED_ATTR: [] as string[],
    KEEP_CONTENT: true,
  },
  
  // Input mode - for form inputs, removes dangerous content but preserves text
  INPUT: {
    ALLOWED_TAGS: [] as string[],
    ALLOWED_ATTR: [] as string[],
    KEEP_CONTENT: true,
  },
  
  // Display mode - allows basic formatting for display purposes
  DISPLAY: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'] as string[],
    ALLOWED_ATTR: [] as string[],
    KEEP_CONTENT: true,
  },
} as const;

export type ClientSanitizationMode = keyof typeof CLIENT_SANITIZATION_CONFIG;

/**
 * Client-side sanitization options
 */
export interface ClientSanitizationOptions {
  /** Remove HTML tags */
  stripHtml?: boolean;
  /** Trim whitespace */
  trim?: boolean;
  /** Remove null bytes */
  removeNullBytes?: boolean;
  /** Remove control characters */
  removeControlChars?: boolean;
  /** Maximum length (truncate if longer) */
  maxLength?: number;
  /** DOMPurify sanitization mode */
  mode?: ClientSanitizationMode;
  /** Block dangerous content entirely */
  blockDangerous?: boolean;
}

/**
 * Default sanitization options for different client-side contexts
 */
export const DEFAULT_CLIENT_OPTIONS = {
  // For form text inputs
  TEXT_INPUT: {
    stripHtml: true,
    trim: true,
    removeNullBytes: true,
    removeControlChars: true,
    mode: 'INPUT' as ClientSanitizationMode,
    blockDangerous: true,
  },
  
  // For display content
  DISPLAY_CONTENT: {
    stripHtml: false,
    trim: true,
    removeNullBytes: true,
    removeControlChars: true,
    mode: 'DISPLAY' as ClientSanitizationMode,
    blockDangerous: true,
  },
  
  // For filenames
  FILENAME: {
    stripHtml: true,
    trim: true,
    removeNullBytes: true,
    removeControlChars: true,
    maxLength: 255,
    mode: 'STRICT' as ClientSanitizationMode,
    blockDangerous: true,
  },
} as const;

/**
 * Check if a string contains potentially dangerous content (client-side patterns)
 */
export function containsDangerousClientContent(input: string): boolean {
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
    
    // Null bytes and control characters
    /\0/g,
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
  ];

  return dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize HTML content using DOMPurify (client-side)
 */
export function sanitizeHtmlClient(
  input: string,
  mode: ClientSanitizationMode = 'STRICT'
): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const config = CLIENT_SANITIZATION_CONFIG[mode];
  
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [...config.ALLOWED_TAGS],
    ALLOWED_ATTR: [...config.ALLOWED_ATTR],
    KEEP_CONTENT: config.KEEP_CONTENT,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe', 'meta', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
  });
}

/**
 * Comprehensive client-side string sanitization
 */
export function sanitizeStringClient(
  input: string,
  options: ClientSanitizationOptions = DEFAULT_CLIENT_OPTIONS.TEXT_INPUT
): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Block dangerous content if requested
  if (options.blockDangerous && containsDangerousClientContent(input)) {
    console.warn('Dangerous content detected and blocked:', input.substring(0, 50) + '...');
    return '';
  }

  let sanitized = input;

  // Apply DOMPurify sanitization first if specified
  if (options.mode) {
    sanitized = sanitizeHtmlClient(sanitized, options.mode);
  }

  // Strip HTML tags if requested
  if (options.stripHtml) {
    // Remove any remaining HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // Remove null bytes
  if (options.removeNullBytes) {
    sanitized = sanitized.replace(/\0/g, '');
  }

  // Remove control characters (except newlines and tabs)
  if (options.removeControlChars) {
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
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
 * Sanitize filename for client-side display
 */
export function sanitizeFilenameClient(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'file';
  }

  let sanitized = sanitizeStringClient(filename, DEFAULT_CLIENT_OPTIONS.FILENAME);

  // Additional filename-specific sanitization
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f\x7f]/g, '_');
  sanitized = sanitized.replace(/\.\.[\/\\]/g, '_');
  sanitized = sanitized.replace(/^[\.\s]+|[\.\s]+$/g, '');
  sanitized = sanitized.replace(/\.{2,}/g, '.');

  // Fallback for empty filenames
  if (!sanitized || sanitized === '.' || sanitized === '_') {
    sanitized = 'file';
  }

  return sanitized;
}

/**
 * Hook for sanitized input handling
 */
export function useSanitizedInput(
  initialValue: string = '',
  options: ClientSanitizationOptions = DEFAULT_CLIENT_OPTIONS.TEXT_INPUT
) {
  const sanitizedOptions = useMemo(() => ({
    ...DEFAULT_CLIENT_OPTIONS.TEXT_INPUT,
    ...options,
  }), [options]);

  const sanitizeValue = useCallback((value: string) => {
    return sanitizeStringClient(value, sanitizedOptions);
  }, [sanitizedOptions]);

  const handleChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const rawValue = event.target.value;
    const sanitizedValue = sanitizeValue(rawValue);
    
    // If the sanitized value is different, update the input
    if (sanitizedValue !== rawValue) {
      event.target.value = sanitizedValue;
    }
    
    return sanitizedValue;
  }, [sanitizeValue]);

  return {
    sanitizeValue,
    handleChange,
    isDangerous: useCallback((value: string) => containsDangerousClientContent(value), []),
  };
}

/**
 * Hook for sanitized file handling
 */
export function useSanitizedFile() {
  const sanitizeFileName = useCallback((filename: string) => {
    return sanitizeFilenameClient(filename);
  }, []);

  const createSanitizedFile = useCallback((file: File): File => {
    const sanitizedName = sanitizeFileName(file.name);
    
    if (sanitizedName === file.name) {
      return file; // No changes needed
    }
    
    // Create a new File object with sanitized name
    return new File([file], sanitizedName, {
      type: file.type,
      lastModified: file.lastModified,
    });
  }, [sanitizeFileName]);

  return {
    sanitizeFileName,
    createSanitizedFile,
    isDangerousFilename: useCallback((filename: string) => containsDangerousClientContent(filename), []),
  };
}

/**
 * Component wrapper for sanitized input
 */
export interface SanitizedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  sanitizationOptions?: ClientSanitizationOptions;
  onDangerousContent?: (value: string) => void;
}

export function SanitizedInput({
  onChange,
  sanitizationOptions,
  onDangerousContent,
  ...props
}: SanitizedInputProps) {
  const { handleChange, isDangerous } = useSanitizedInput('', sanitizationOptions);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const originalValue = event.target.value;
    
    // Check for dangerous content before sanitization
    if (isDangerous(originalValue)) {
      onDangerousContent?.(originalValue);
    }
    
    const sanitizedValue = handleChange(event);
    onChange?.(sanitizedValue, event);
  }, [handleChange, isDangerous, onChange, onDangerousContent]);

  return (
    <input
      {...props}
      onChange={handleInputChange}
    />
  );
}

/**
 * Export client-side sanitization utilities
 */
export const clientSanitize = {
  string: sanitizeStringClient,
  html: sanitizeHtmlClient,
  filename: sanitizeFilenameClient,
  isDangerous: containsDangerousClientContent,
}; 