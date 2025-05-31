/**
 * API Key Management System - Main Export
 * Comprehensive API key security, validation, and management utilities
 */

// Core types and interfaces
export * from './types';

// Encryption utilities
export {
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
  validateEncryptionConfig
} from './encryption';

export { default as encryptionConfig } from './encryption';

// Validation utilities
export {
  PROVIDER_CONFIGS,
  detectProvider,
  validateApiKey,
  validateMultipleKeys,
  validateEnvironmentKeys,
  checkKeyCompromised,
  getValidationReport
} from './validator';

// Central manager
export {
  ApiKeyManager,
  getApiKeyManager
} from './manager';

// Middleware
export {
  ApiKeyMiddleware,
  createApiKeyMiddleware,
  withApiKeyValidation
} from './middleware';

// Environment management
export {
  EnvironmentManager,
  getEnvironmentManager
} from './env-manager';

// Client-side utilities
export {
  CLIENT_CONFIG,
  validateApiKeyFormat,
  detectProviderFromKey,
  useApiKeyValidation,
  useApiKeySecurity,
  useDebouncedApiKeyValidation,
  sanitizeApiKeyForDisplay,
  getProviderInfo,
  isBrowser,
  storage
} from './client-utils';

// Import the required functions for the default export
import { getApiKeyManager } from './manager';
import { getEnvironmentManager } from './env-manager';
import { createApiKeyMiddleware, withApiKeyValidation } from './middleware';
import { getValidationReport } from './validator';

// Main initialization function
export function initializeApiKeyManagement(config?: {
  encryptionEnabled?: boolean;
  auditLoggingEnabled?: boolean;
  rotationEnabled?: boolean;
  defaultRotationDays?: number;
  validationCacheTime?: number;
  securityAlertsEnabled?: boolean;
  rateLimitingEnabled?: boolean;
  environments?: ('development' | 'staging' | 'production')[];
}) {
  const manager = getApiKeyManager(config);
  const envManager = getEnvironmentManager();
  
  return {
    manager,
    envManager,
    validateEnvironment: () => envManager.validateEnvironment(),
    getSecurityReport: () => manager.getSecurityReport(),
    validateAllKeys: () => getValidationReport()
  };
}

// Default export for easy importing
export default {
  initializeApiKeyManagement,
  getApiKeyManager,
  getEnvironmentManager,
  createApiKeyMiddleware,
  withApiKeyValidation
}; 