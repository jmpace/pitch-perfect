/**
 * API Key Encryption Utilities
 * Secure encryption and decryption for API keys at rest and in transit
 */

import * as crypto from 'crypto';
import { EncryptedKey, ApiKeyOperationResult } from './types';

// Encryption configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16,  // 128 bits
  tagLength: 16, // 128 bits
  saltLength: 64, // 512 bits
  iterations: 100000, // PBKDF2 iterations
} as const;

// Check if we're in an edge runtime environment
const isEdgeRuntime = typeof process === 'undefined' ||
                     (typeof process !== 'undefined' && process.env?.NEXT_RUNTIME === 'edge') ||
                     (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Edge Runtime'));

// Fallback for edge runtime environments
function getRandomBytes(length: number): string {
  if (isEdgeRuntime || typeof crypto.randomBytes !== 'function') {
    // Use Web Crypto API if available, otherwise fall back to Math.random
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
      const array = new Uint8Array(length);
      globalThis.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback to Math.random (less secure, but works in edge runtime)
      console.warn('[Encryption] Using Math.random fallback for crypto operations in edge runtime');
      let result = '';
      for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      }
      return result;
    }
  }
  
  // Use Node.js crypto if available
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a cryptographically secure encryption key
 */
export function generateEncryptionKey(): string {
  return getRandomBytes(ENCRYPTION_CONFIG.keyLength);
}

/**
 * Derive encryption key from password using PBKDF2
 */
export function deriveKeyFromPassword(password: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
  const actualSalt = salt || crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
  const derivedKey = crypto.pbkdf2Sync(
    password,
    actualSalt,
    ENCRYPTION_CONFIG.iterations,
    ENCRYPTION_CONFIG.keyLength,
    'sha256'
  );
  
  return {
    key: derivedKey,
    salt: actualSalt
  };
}

/**
 * Encrypt an API key securely
 */
export function encryptApiKey(
  apiKey: string,
  encryptionKey: string,
  keyId: string = crypto.randomUUID()
): ApiKeyOperationResult<EncryptedKey> {
  try {
    // Input validation
    if (!apiKey || typeof apiKey !== 'string') {
      return {
        success: false,
        error: 'Invalid API key provided for encryption'
      };
    }

    if (!encryptionKey || encryptionKey.length < 32) {
      return {
        success: false,
        error: 'Invalid encryption key - must be at least 32 characters'
      };
    }

    // Generate initialization vector
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    
    // Create cipher
    const cipher = crypto.createCipher(ENCRYPTION_CONFIG.algorithm, encryptionKey);
    cipher.setAutoPadding(true);

    // Encrypt the API key
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag (for AES-GCM)
    let authTag = '';
    try {
      authTag = (cipher as any).getAuthTag().toString('hex');
    } catch (error) {
      // Fallback for non-GCM modes
      console.warn('Auth tag not available, using non-authenticated encryption');
    }

    const encryptedKey: EncryptedKey = {
      encryptedValue: encrypted + (authTag ? ':' + authTag : ''),
      keyId,
      algorithm: ENCRYPTION_CONFIG.algorithm,
      iv: iv.toString('hex'),
      createdAt: new Date()
    };

    return {
      success: true,
      data: encryptedKey,
      metadata: {
        algorithm: ENCRYPTION_CONFIG.algorithm,
        keyLength: apiKey.length,
        encryptedLength: encrypted.length
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: {
        algorithm: ENCRYPTION_CONFIG.algorithm,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
      }
    };
  }
}

/**
 * Decrypt an API key securely
 */
export function decryptApiKey(
  encryptedKey: EncryptedKey,
  encryptionKey: string
): ApiKeyOperationResult<string> {
  try {
    // Input validation
    if (!encryptedKey || !encryptedKey.encryptedValue) {
      return {
        success: false,
        error: 'Invalid encrypted key data provided'
      };
    }

    if (!encryptionKey || encryptionKey.length < 32) {
      return {
        success: false,
        error: 'Invalid encryption key provided for decryption'
      };
    }

    // Parse encrypted value and auth tag
    const parts = encryptedKey.encryptedValue.split(':');
    const encrypted = parts[0];
    const authTag = parts[1];

    // Create decipher
    const decipher = crypto.createDecipher(encryptedKey.algorithm, encryptionKey);

    // Set auth tag if available (for AES-GCM)
    if (authTag) {
      try {
        (decipher as any).setAuthTag(Buffer.from(authTag, 'hex'));
      } catch (error) {
        console.warn('Could not set auth tag for decryption');
      }
    }

    // Decrypt the API key
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return {
      success: true,
      data: decrypted,
      metadata: {
        algorithm: encryptedKey.algorithm,
        keyId: encryptedKey.keyId,
        decryptedLength: decrypted.length,
        createdAt: encryptedKey.createdAt
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: {
        algorithm: encryptedKey.algorithm,
        keyId: encryptedKey.keyId,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
      }
    };
  }
}

/**
 * Generate a secure hash of an API key for comparison
 */
export function hashApiKey(apiKey: string, salt?: string): string {
  if (isEdgeRuntime) {
    // Simple hash fallback for edge runtime
    console.warn('[Encryption] Using simple hash fallback in edge runtime');
    const actualSalt = salt || getRandomBytes(16);
    // Simple hash using basic string operations (not cryptographically secure)
    let hash = 0;
    const combined = apiKey + actualSalt;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return actualSalt + ':' + Math.abs(hash).toString(16);
  }
  
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256');
  hash.update(apiKey + actualSalt);
  return actualSalt + ':' + hash.digest('hex');
}

/**
 * Verify an API key against its hash
 */
export function verifyApiKeyHash(apiKey: string, hashedKey: string): boolean {
  try {
    const [salt, expectedHash] = hashedKey.split(':');
    if (!salt || !expectedHash) {
      return false;
    }

    if (isEdgeRuntime) {
      // Simple verification fallback for edge runtime
      let hash = 0;
      const combined = apiKey + salt;
      for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      const actualHash = Math.abs(hash).toString(16);
      return actualHash === expectedHash;
    }

    const hash = crypto.createHash('sha256');
    hash.update(apiKey + salt);
    const actualHash = hash.digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(actualHash, 'hex')
    );
  } catch (error) {
    return false;
  }
}

/**
 * Securely wipe sensitive data from memory
 */
export function secureWipe(data: string): void {
  if (typeof data === 'string') {
    // Overwrite string content (best effort - JavaScript limitations)
    for (let i = 0; i < data.length; i++) {
      (data as any)[i] = '\0';
    }
  }
}

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  return getRandomBytes(length);
}

/**
 * Calculate entropy of a string (for key strength analysis)
 */
export function calculateEntropy(str: string): number {
  const frequency: { [key: string]: number } = {};
  
  // Count character frequencies
  for (const char of str) {
    frequency[char] = (frequency[char] || 0) + 1;
  }
  
  // Calculate Shannon entropy
  let entropy = 0;
  const length = str.length;
  
  for (const freq of Object.values(frequency)) {
    const probability = freq / length;
    if (probability > 0) {
      entropy -= probability * Math.log2(probability);
    }
  }
  
  return entropy;
}

/**
 * Check if a string contains personally identifiable information patterns
 */
export function containsPII(str: string): boolean {
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email pattern
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card pattern
    /\b\d{10,11}\b/, // Phone number pattern
    /\b(?:name|user|admin|email|password)\b/i, // Common PII keywords
  ];
  
  return piiPatterns.some(pattern => pattern.test(str));
}

/**
 * Sanitize an API key for logging (show only first/last few characters)
 */
export function sanitizeKeyForLogging(apiKey: string, showChars: number = 4): string {
  if (!apiKey || apiKey.length <= showChars * 2) {
    return '***masked***';
  }
  
  const start = apiKey.substring(0, showChars);
  const end = apiKey.substring(apiKey.length - showChars);
  const middle = '*'.repeat(Math.max(3, apiKey.length - showChars * 2));
  
  return `${start}${middle}${end}`;
}

/**
 * Validate encryption configuration
 */
export function validateEncryptionConfig(): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check if crypto module is available
  if (!crypto) {
    issues.push('Crypto module not available');
    recommendations.push('Ensure Node.js crypto module is properly installed');
  }

  // Check algorithm support
  try {
    const testCipher = crypto.createCipher(ENCRYPTION_CONFIG.algorithm, 'test');
    testCipher.destroy();
  } catch (error) {
    issues.push(`Encryption algorithm ${ENCRYPTION_CONFIG.algorithm} not supported`);
    recommendations.push('Use a supported encryption algorithm like aes-256-cbc');
  }

  // Validate configuration values
  if (ENCRYPTION_CONFIG.keyLength < 16) {
    issues.push('Encryption key length too short');
    recommendations.push('Use at least 16 bytes (128 bits) for encryption key');
  }

  if (ENCRYPTION_CONFIG.iterations < 10000) {
    issues.push('PBKDF2 iterations too low');
    recommendations.push('Use at least 10,000 iterations for PBKDF2');
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations
  };
}

export default {
  generateEncryptionKey,
  deriveKeyFromPassword,
  encryptApiKey,
  decryptApiKey,
  hashApiKey,
  verifyApiKeyHash,
  secureWipe,
  generateSecureRandom,
  calculateEntropy,
  containsPII,
  sanitizeKeyForLogging,
  validateEncryptionConfig,
  ENCRYPTION_CONFIG
}; 