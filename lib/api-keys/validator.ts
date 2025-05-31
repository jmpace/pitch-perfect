/**
 * API Key Validator
 * Comprehensive validation for API keys from various providers
 */

import { 
  ApiProvider, 
  SecurityLevel, 
  ProviderConfig, 
  KeyValidationResult, 
  ApiKeyPermissions,
  ApiKeyOperationResult 
} from './types';
import { calculateEntropy, containsPII, sanitizeKeyForLogging } from './encryption';

// Provider-specific configurations
export const PROVIDER_CONFIGS: Record<ApiProvider, ProviderConfig> = {
  [ApiProvider.OPENAI]: {
    provider: ApiProvider.OPENAI,
    envVarName: 'OPENAI_API_KEY',
    keyFormat: /^sk-[a-zA-Z0-9]{20,}$/,
    minLength: 20,
    maxLength: 200,
    prefix: 'sk-',
    testEndpoint: 'https://api.openai.com/v1/models',
    defaultPermissions: {
      read: true,
      write: true,
      delete: false,
      admin: false,
      scopes: ['models', 'completions', 'chat', 'embeddings', 'images'],
      rateLimit: {
        requestsPerMinute: 500,
        requestsPerHour: 10000,
        requestsPerDay: 100000
      }
    },
    securityLevel: SecurityLevel.HIGH,
    rotationSupported: true,
    encryptionRequired: true
  },

  [ApiProvider.ANTHROPIC]: {
    provider: ApiProvider.ANTHROPIC,
    envVarName: 'ANTHROPIC_API_KEY',
    keyFormat: /^sk-ant-[a-zA-Z0-9\-_]{20,}$/,
    minLength: 25,
    maxLength: 200,
    prefix: 'sk-ant-',
    testEndpoint: 'https://api.anthropic.com/v1/models',
    defaultPermissions: {
      read: true,
      write: true,
      delete: false,
      admin: false,
      scopes: ['messages', 'models'],
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        requestsPerDay: 20000
      }
    },
    securityLevel: SecurityLevel.HIGH,
    rotationSupported: true,
    encryptionRequired: true
  },

  [ApiProvider.PERPLEXITY]: {
    provider: ApiProvider.PERPLEXITY,
    envVarName: 'PERPLEXITY_API_KEY',
    keyFormat: /^pplx-[a-zA-Z0-9]{20,}$/,
    minLength: 25,
    maxLength: 200,
    prefix: 'pplx-',
    testEndpoint: 'https://api.perplexity.ai/models',
    defaultPermissions: {
      read: true,
      write: true,
      delete: false,
      admin: false,
      scopes: ['chat', 'completions'],
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      }
    },
    securityLevel: SecurityLevel.MEDIUM,
    rotationSupported: true,
    encryptionRequired: true
  },

  [ApiProvider.VERCEL_BLOB]: {
    provider: ApiProvider.VERCEL_BLOB,
    envVarName: 'BLOB_READ_WRITE_TOKEN',
    keyFormat: /^vercel_blob_rw_[a-zA-Z0-9]{16}_[a-zA-Z0-9]{32}$/,
    minLength: 50,
    maxLength: 200,
    prefix: 'vercel_blob_rw_',
    defaultPermissions: {
      read: true,
      write: true,
      delete: true,
      admin: false,
      scopes: ['blob-storage', 'file-upload'],
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 5000,
        requestsPerDay: 50000
      }
    },
    securityLevel: SecurityLevel.HIGH,
    rotationSupported: false,
    encryptionRequired: true
  },

  [ApiProvider.GOOGLE]: {
    provider: ApiProvider.GOOGLE,
    envVarName: 'GOOGLE_API_KEY',
    keyFormat: /^AIza[0-9A-Za-z\-_]{35}$/,
    minLength: 39,
    maxLength: 39,
    prefix: 'AIza',
    testEndpoint: 'https://generativelanguage.googleapis.com/v1/models',
    defaultPermissions: {
      read: true,
      write: true,
      delete: false,
      admin: false,
      scopes: ['generative-ai', 'models'],
      rateLimit: {
        requestsPerMinute: 300,
        requestsPerHour: 5000,
        requestsPerDay: 50000
      }
    },
    securityLevel: SecurityLevel.MEDIUM,
    rotationSupported: true,
    encryptionRequired: true
  },

  [ApiProvider.MISTRAL]: {
    provider: ApiProvider.MISTRAL,
    envVarName: 'MISTRAL_API_KEY',
    keyFormat: /^[a-zA-Z0-9]{32}$/,
    minLength: 32,
    maxLength: 32,
    defaultPermissions: {
      read: true,
      write: true,
      delete: false,
      admin: false,
      scopes: ['chat', 'completions', 'embeddings'],
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        requestsPerDay: 20000
      }
    },
    securityLevel: SecurityLevel.MEDIUM,
    rotationSupported: true,
    encryptionRequired: true
  },

  [ApiProvider.AZURE_OPENAI]: {
    provider: ApiProvider.AZURE_OPENAI,
    envVarName: 'AZURE_OPENAI_API_KEY',
    keyFormat: /^[a-f0-9]{32}$/,
    minLength: 32,
    maxLength: 32,
    defaultPermissions: {
      read: true,
      write: true,
      delete: false,
      admin: false,
      scopes: ['openai', 'cognitive-services'],
      rateLimit: {
        requestsPerMinute: 300,
        requestsPerHour: 10000,
        requestsPerDay: 100000
      }
    },
    securityLevel: SecurityLevel.HIGH,
    rotationSupported: true,
    encryptionRequired: true
  },

  [ApiProvider.OPENROUTER]: {
    provider: ApiProvider.OPENROUTER,
    envVarName: 'OPENROUTER_API_KEY',
    keyFormat: /^sk-or-[a-zA-Z0-9\-_]{20,}$/,
    minLength: 25,
    maxLength: 200,
    prefix: 'sk-or-',
    testEndpoint: 'https://openrouter.ai/api/v1/models',
    defaultPermissions: {
      read: true,
      write: true,
      delete: false,
      admin: false,
      scopes: ['models', 'chat', 'completions'],
      rateLimit: {
        requestsPerMinute: 200,
        requestsPerHour: 5000,
        requestsPerDay: 50000
      }
    },
    securityLevel: SecurityLevel.MEDIUM,
    rotationSupported: true,
    encryptionRequired: true
  },

  [ApiProvider.XAI]: {
    provider: ApiProvider.XAI,
    envVarName: 'XAI_API_KEY',
    keyFormat: /^xai-[a-zA-Z0-9]{20,}$/,
    minLength: 24,
    maxLength: 200,
    prefix: 'xai-',
    defaultPermissions: {
      read: true,
      write: true,
      delete: false,
      admin: false,
      scopes: ['chat', 'completions'],
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        requestsPerDay: 20000
      }
    },
    securityLevel: SecurityLevel.MEDIUM,
    rotationSupported: true,
    encryptionRequired: true
  },

  [ApiProvider.OLLAMA]: {
    provider: ApiProvider.OLLAMA,
    envVarName: 'OLLAMA_API_KEY',
    keyFormat: /^[a-zA-Z0-9\-_]{8,}$/,
    minLength: 8,
    maxLength: 100,
    defaultPermissions: {
      read: true,
      write: true,
      delete: false,
      admin: false,
      scopes: ['models', 'chat', 'generate'],
      rateLimit: {
        requestsPerMinute: 1000,
        requestsPerHour: 10000,
        requestsPerDay: 100000
      }
    },
    securityLevel: SecurityLevel.LOW,
    rotationSupported: false,
    encryptionRequired: false
  },

  [ApiProvider.CUSTOM]: {
    provider: ApiProvider.CUSTOM,
    envVarName: 'CUSTOM_API_KEY',
    keyFormat: /^.{8,}$/,
    minLength: 8,
    maxLength: 500,
    defaultPermissions: {
      read: true,
      write: false,
      delete: false,
      admin: false,
      scopes: ['custom'],
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      }
    },
    securityLevel: SecurityLevel.LOW,
    rotationSupported: false,
    encryptionRequired: false
  }
};

/**
 * Detect the API provider from an API key
 */
export function detectProvider(apiKey: string): ApiProvider {
  if (!apiKey || typeof apiKey !== 'string') {
    return ApiProvider.CUSTOM;
  }

  // Check each provider's pattern
  for (const [provider, config] of Object.entries(PROVIDER_CONFIGS)) {
    if (config.keyFormat.test(apiKey)) {
      return provider as ApiProvider;
    }
  }

  return ApiProvider.CUSTOM;
}

/**
 * Validate API key format and security
 */
export function validateApiKey(
  apiKey: string,
  provider?: ApiProvider,
  securityLevel: SecurityLevel = SecurityLevel.MEDIUM
): KeyValidationResult {
  const result: KeyValidationResult = {
    isValid: false,
    provider: provider || detectProvider(apiKey),
    issues: [],
    warnings: [],
    recommendations: [],
    securityScore: 0,
    metadata: {
      format: false,
      length: false,
      checksum: false,
      prefix: false,
      entropy: 0,
      containsPersonalInfo: false,
      isRevoked: false,
      isExpired: false
    }
  };

  try {
    // Basic input validation
    if (!apiKey || typeof apiKey !== 'string') {
      result.issues.push('API key is required and must be a string');
      return result;
    }

    if (apiKey.trim() !== apiKey) {
      result.issues.push('API key contains leading or trailing whitespace');
      result.recommendations.push('Remove whitespace from API key');
    }

    // Get provider configuration
    const config = PROVIDER_CONFIGS[result.provider];
    if (!config) {
      result.issues.push(`Unknown provider: ${result.provider}`);
      return result;
    }

    // Format validation
    const formatValid = config.keyFormat.test(apiKey);
    result.metadata!.format = formatValid;
    if (!formatValid) {
      result.issues.push(`API key format is invalid for ${result.provider}`);
      result.recommendations.push(`Expected format: ${config.keyFormat.source}`);
    }

    // Length validation
    const lengthValid = apiKey.length >= config.minLength && apiKey.length <= config.maxLength;
    result.metadata!.length = lengthValid;
    if (!lengthValid) {
      result.issues.push(`API key length (${apiKey.length}) is outside valid range (${config.minLength}-${config.maxLength})`);
      result.recommendations.push(`Use a key with ${config.minLength}-${config.maxLength} characters`);
    }

    // Prefix validation
    if (config.prefix) {
      const prefixValid = apiKey.startsWith(config.prefix);
      result.metadata!.prefix = prefixValid;
      if (!prefixValid) {
        result.issues.push(`API key must start with '${config.prefix}'`);
        result.recommendations.push(`Ensure key starts with ${config.prefix}`);
      }
    } else {
      result.metadata!.prefix = true;
    }

    // Security-level specific checks
    if (securityLevel >= SecurityLevel.MEDIUM) {
      // Entropy analysis
      const entropy = calculateEntropy(apiKey);
      result.metadata!.entropy = entropy;
      if (entropy < 3.0) {
        result.warnings.push('API key has low entropy (may be predictable)');
        result.recommendations.push('Use a key with higher randomness');
      }

      // PII detection
      const hasPII = containsPII(apiKey);
      result.metadata!.containsPersonalInfo = hasPII;
      if (hasPII) {
        result.issues.push('API key appears to contain personal information');
        result.recommendations.push('Generate a new API key without personal data');
      }
    }

    if (securityLevel >= SecurityLevel.HIGH) {
      // Common weak patterns
      if (/(.)\1{3,}/.test(apiKey)) {
        result.warnings.push('API key contains repeated characters');
        result.recommendations.push('Use a key with better character distribution');
      }

      if (/123|abc|password|test|demo/i.test(apiKey)) {
        result.issues.push('API key contains common weak patterns');
        result.recommendations.push('Generate a secure API key');
      }
    }

    if (securityLevel >= SecurityLevel.CRITICAL) {
      // Additional security checks for critical level
      if (apiKey.length < 32) {
        result.warnings.push('API key is shorter than recommended for critical security level');
        result.recommendations.push('Use a key with at least 32 characters for critical applications');
      }
    }

    // Calculate security score (0-100)
    let score = 0;
    if (result.metadata!.format) score += 25;
    if (result.metadata!.length) score += 25;
    if (result.metadata!.prefix) score += 15;
    if (result.metadata!.entropy > 3.0) score += 15;
    if (!result.metadata!.containsPersonalInfo) score += 10;
    if (result.issues.length === 0) score += 10;

    result.securityScore = Math.min(100, score);

    // Determine if key is valid
    result.isValid = result.issues.length === 0 && formatValid && lengthValid;

    // Add provider-specific recommendations
    if (!result.isValid) {
      result.recommendations.push(`Visit the ${result.provider} documentation for API key generation`);
      result.recommendations.push(`Store the key in environment variable: ${config.envVarName}`);
    }

  } catch (error) {
    result.issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Validate multiple API keys
 */
export function validateMultipleKeys(
  keys: { key: string; provider?: ApiProvider; name?: string }[],
  securityLevel: SecurityLevel = SecurityLevel.MEDIUM
): Record<string, KeyValidationResult> {
  const results: Record<string, KeyValidationResult> = {};

  keys.forEach((keyInfo, index) => {
    const keyName = keyInfo.name || `key_${index}`;
    results[keyName] = validateApiKey(keyInfo.key, keyInfo.provider, securityLevel);
  });

  return results;
}

/**
 * Get environment variable API keys and validate them
 */
export function validateEnvironmentKeys(
  securityLevel: SecurityLevel = SecurityLevel.MEDIUM
): Record<string, KeyValidationResult> {
  const results: Record<string, KeyValidationResult> = {};

  // Check each configured provider
  Object.values(PROVIDER_CONFIGS).forEach(config => {
    const envValue = process.env[config.envVarName];
    if (envValue) {
      results[config.envVarName] = validateApiKey(envValue, config.provider, securityLevel);
    }
  });

  return results;
}

/**
 * Check if an API key is potentially compromised
 */
export function checkKeyCompromised(apiKey: string): {
  isCompromised: boolean;
  reasons: string[];
  recommendations: string[];
} {
  const reasons: string[] = [];
  const recommendations: string[] = [];

  // Check common compromise patterns
  if (apiKey.includes('example') || apiKey.includes('demo') || apiKey.includes('test')) {
    reasons.push('Key contains demo/test/example patterns');
    recommendations.push('Generate a new production API key');
  }

  if (apiKey.length < 20) {
    reasons.push('Key is unusually short');
    recommendations.push('Use a longer, more secure API key');
  }

  if (/^[a-zA-Z0-9]{8,20}$/.test(apiKey) && !/[A-Z]/.test(apiKey)) {
    reasons.push('Key lacks uppercase letters (potential weak generation)');
    recommendations.push('Generate a new key with mixed case');
  }

  // Check for sequential patterns
  if (/012|123|234|345|456|567|678|789|abc|def/i.test(apiKey)) {
    reasons.push('Key contains sequential patterns');
    recommendations.push('Generate a new random API key');
  }

  return {
    isCompromised: reasons.length > 0,
    reasons,
    recommendations
  };
}

/**
 * Get comprehensive validation report for all configured keys
 */
export function getValidationReport(): {
  summary: {
    totalKeys: number;
    validKeys: number;
    invalidKeys: number;
    warningsCount: number;
    averageSecurityScore: number;
  };
  details: Record<string, KeyValidationResult>;
  recommendations: string[];
} {
  const details = validateEnvironmentKeys(SecurityLevel.HIGH);
  const validKeys = Object.values(details).filter(result => result.isValid);
  const invalidKeys = Object.values(details).filter(result => !result.isValid);
  const totalWarnings = Object.values(details).reduce((sum, result) => sum + result.warnings.length, 0);
  const averageScore = Object.values(details).length > 0 
    ? Object.values(details).reduce((sum, result) => sum + result.securityScore, 0) / Object.values(details).length 
    : 0;

  const recommendations: string[] = [];
  if (invalidKeys.length > 0) {
    recommendations.push(`Fix ${invalidKeys.length} invalid API keys`);
  }
  if (totalWarnings > 0) {
    recommendations.push(`Address ${totalWarnings} security warnings`);
  }
  if (averageScore < 80) {
    recommendations.push('Improve API key security (current average score: ' + Math.round(averageScore) + '/100)');
  }

  return {
    summary: {
      totalKeys: Object.keys(details).length,
      validKeys: validKeys.length,
      invalidKeys: invalidKeys.length,
      warningsCount: totalWarnings,
      averageSecurityScore: Math.round(averageScore)
    },
    details,
    recommendations
  };
}

export default {
  PROVIDER_CONFIGS,
  detectProvider,
  validateApiKey,
  validateMultipleKeys,
  validateEnvironmentKeys,
  checkKeyCompromised,
  getValidationReport
}; 