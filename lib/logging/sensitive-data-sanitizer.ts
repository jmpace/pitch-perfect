// Sensitive Data Sanitizer for Log Entries
// Handles removal, masking, or hashing of sensitive information

import { LogEntry, SensitiveDataConfig } from './types';
import { createHash } from 'crypto';

/**
 * Default sensitive field patterns to detect and sanitize
 */
export const DEFAULT_SENSITIVE_FIELDS = [
  // Authentication & Authorization
  'password', 'passwd', 'secret', 'token', 'key', 'auth', 'authorization',
  'bearer', 'jwt', 'session', 'cookie', 'csrf',
  
  // Personal Information
  'email', 'phone', 'ssn', 'social', 'credit', 'card', 'cvv', 'pin',
  'address', 'zip', 'postal', 'dob', 'birthday',
  
  // API Keys & Credentials
  'api_key', 'apikey', 'client_secret', 'private_key', 'access_token',
  'refresh_token', 'webhook_secret', 'signing_key',
  
  // Database & Connection Strings
  'connection_string', 'database_url', 'db_password', 'username',
  'connection', 'dsn'
];

/**
 * Sensitive data sanitizer class
 */
export class SensitiveDataSanitizer {
  private config: SensitiveDataConfig;
  private sensitivePatterns: RegExp[];

  constructor(config: SensitiveDataConfig) {
    this.config = config;
    this.sensitivePatterns = this.buildSensitivePatterns();
  }

  /**
   * Sanitize a complete log entry
   */
  sanitize(entry: LogEntry): LogEntry {
    if (!this.config.enabled) {
      return entry;
    }

    // Create a deep copy to avoid mutating the original
    const sanitizedEntry = JSON.parse(JSON.stringify(entry));

    // Sanitize various parts of the log entry
    sanitizedEntry.message = this.sanitizeString(sanitizedEntry.message);
    
    if (sanitizedEntry.data) {
      sanitizedEntry.data = this.sanitizeObject(sanitizedEntry.data);
    }

    if (sanitizedEntry.error?.enhancedInfo?.details) {
      sanitizedEntry.error.enhancedInfo.details = this.sanitizeObject(
        sanitizedEntry.error.enhancedInfo.details
      );
    }

    if (sanitizedEntry.error?.enhancedInfo?.context?.metadata) {
      sanitizedEntry.error.enhancedInfo.context.metadata = this.sanitizeObject(
        sanitizedEntry.error.enhancedInfo.context.metadata
      );
    }

    return sanitizedEntry;
  }

  /**
   * Sanitize an object recursively
   */
  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if this field should be sanitized
      if (this.isSensitiveField(lowerKey)) {
        sanitized[key] = this.sanitizeValue(value, key);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          sanitized[key] = value.map(item => 
            typeof item === 'object' && item !== null 
              ? this.sanitizeObject(item as Record<string, unknown>)
              : this.sanitizeString(String(item))
          );
        } else {
          sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
        }
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize a string value by looking for sensitive patterns
   */
  private sanitizeString(str: string): string {
    let sanitized = str;

    // Apply pattern-based sanitization
    for (const pattern of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, (match) => this.maskString(match));
    }

    return sanitized;
  }

  /**
   * Sanitize a specific value based on the sanitization method
   */
  private sanitizeValue(value: unknown, fieldName: string): unknown {
    // Check for custom sanitizer first
    if (this.config.customSanitizers?.[fieldName]) {
      return this.config.customSanitizers[fieldName](value);
    }

    const stringValue = String(value);

    switch (this.config.sanitizationMethod) {
      case 'remove':
        return '[REMOVED]';
      
      case 'hash':
        return this.hashString(stringValue);
      
      case 'mask':
      default:
        return this.maskString(stringValue);
    }
  }

  /**
   * Check if a field name indicates sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const allSensitiveFields = [
      ...DEFAULT_SENSITIVE_FIELDS,
      ...this.config.sensitiveFields
    ];

    return allSensitiveFields.some(sensitiveField => 
      fieldName.includes(sensitiveField.toLowerCase())
    );
  }

  /**
   * Build regex patterns for detecting sensitive data in strings
   */
  private buildSensitivePatterns(): RegExp[] {
    const patterns: RegExp[] = [];

    // Common patterns for sensitive data
    const sensitivePatterns = [
      // API Keys and tokens (typically long alphanumeric strings)
      /\b[A-Za-z0-9]{32,}\b/g,
      
      // JWT tokens
      /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
      
      // Bearer tokens
      /Bearer\s+[A-Za-z0-9-._~+/]+=*/gi,
      
      // Basic auth
      /Basic\s+[A-Za-z0-9+/=]+/gi,
      
      // Credit card numbers (simplified pattern)
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      
      // Email addresses
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      
      // Phone numbers (US format)
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      
      // SSN pattern
      /\b\d{3}-?\d{2}-?\d{4}\b/g,
      
      // Connection strings
      /[a-zA-Z]+:\/\/[^:\s]+:[^@\s]+@[^\s]+/g
    ];

    // Add custom patterns based on sensitive field names
    const allSensitiveFields = [
      ...DEFAULT_SENSITIVE_FIELDS,
      ...this.config.sensitiveFields
    ];

    for (const field of allSensitiveFields) {
      // Pattern to match field=value or field: value
      patterns.push(new RegExp(`${field}\\s*[:=]\\s*[^\\s,}\\]]+`, 'gi'));
    }

    return [...patterns, ...sensitivePatterns];
  }

  /**
   * Mask a string value
   */
  private maskString(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    
    // Show first 2 and last 2 characters, mask the middle
    const masked = value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
    return masked;
  }

  /**
   * Hash a string value using SHA-256
   */
  private hashString(value: string): string {
    const hash = createHash('sha256');
    hash.update(value);
    return `[HASH:${hash.digest('hex').substring(0, 16)}]`;
  }

  /**
   * Update sanitizer configuration
   */
  updateConfig(newConfig: Partial<SensitiveDataConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.sensitivePatterns = this.buildSensitivePatterns();
  }

  /**
   * Get current configuration
   */
  getConfig(): SensitiveDataConfig {
    return { ...this.config };
  }

  /**
   * Test if sanitizer would modify a given object
   */
  wouldSanitize(obj: Record<string, unknown>): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const testSanitized = this.sanitizeObject(obj);
    return JSON.stringify(obj) !== JSON.stringify(testSanitized);
  }
} 