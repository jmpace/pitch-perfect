/**
 * Predefined Retry Policies
 * 
 * Service-specific and scenario-based retry policies for common use cases.
 * These policies are configured based on best practices and the specific
 * requirements of different services and operations.
 */

import {
  RetryPolicy,
  PolicyTemplate,
  ServicePolicy,
  PolicyTemplates,
  ServicePolicies
} from './types';

/**
 * Template-based Retry Policies
 * Generic policies for common retry scenarios
 */
export const templatePolicies: Record<PolicyTemplate, RetryPolicy> = {
  FAST_TRANSIENT: {
    name: 'fast-transient',
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    strategy: 'exponential',
    jitter: 'equal',
    retryableCategories: ['network', 'rate_limiting'],
    retrySeverities: ['high', 'medium'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 5000,
      monitorWindow: 30000
    },
    enableMetrics: true,
    tags: ['fast', 'transient']
  },

  STANDARD_API: {
    name: 'standard-api',
    maxAttempts: 5,
    baseDelay: 500,
    maxDelay: 8000,
    strategy: 'exponential',
    jitter: 'decorrelated',
    timeoutPerAttempt: 15000,
    retryableCategories: ['network', 'rate_limiting', 'external_service'],
    retrySeverities: ['critical', 'high', 'medium'],
    retryableErrors: ['RATE_LIMIT_EXCEEDED', 'TIMEOUT_ERROR', 'NETWORK_ERROR'],
    nonRetryableErrors: ['AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 'VALIDATION_ERROR'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 8,
      successThreshold: 3,
      timeout: 10000,
      monitorWindow: 60000
    },
    budget: {
      maxTotalTime: 45000,
      windowMs: 60000,
      resetOnSuccess: true
    },
    enableMetrics: true,
    tags: ['api', 'standard']
  },

  CONSERVATIVE: {
    name: 'conservative',
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    strategy: 'linear',
    jitter: 'equal',
    timeoutPerAttempt: 30000,
    retryableCategories: ['network', 'external_service'],
    retrySeverities: ['critical', 'high'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      monitorWindow: 120000
    },
    budget: {
      maxTotalTime: 60000,
      maxTotalAttempts: 10,
      windowMs: 300000,
      resetOnSuccess: false
    },
    enableMetrics: true,
    tags: ['conservative', 'expensive']
  },

  AGGRESSIVE: {
    name: 'aggressive',
    maxAttempts: 8,
    baseDelay: 200,
    maxDelay: 5000,
    strategy: 'exponential',
    jitter: 'full',
    timeoutPerAttempt: 10000,
    retryableCategories: ['network', 'rate_limiting', 'external_service', 'processing'],
    retrySeverities: ['critical', 'high', 'medium', 'low'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 12,
      successThreshold: 5,
      timeout: 5000,
      monitorWindow: 30000
    },
    enableMetrics: true,
    tags: ['aggressive', 'critical']
  },

  NO_RETRY: {
    name: 'no-retry',
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    strategy: 'fixed',
    jitter: 'none',
    enableMetrics: true,
    tags: ['no-retry']
  }
};

/**
 * Service-specific Retry Policies
 * Tailored policies for specific services and operations
 */
export const servicePolicies: Record<ServicePolicy, RetryPolicy> = {
  OPENAI_CHAT: {
    name: 'openai-chat',
    maxAttempts: 4,
    baseDelay: 1000,
    maxDelay: 16000,
    strategy: 'exponential',
    jitter: 'decorrelated',
    timeoutPerAttempt: 30000,
    retryableErrors: [
      'RATE_LIMIT_EXCEEDED',
      'MODEL_OVERLOADED',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR'
    ],
    nonRetryableErrors: [
      'INVALID_API_KEY',
      'INSUFFICIENT_QUOTA',
      'CONTEXT_LENGTH_EXCEEDED',
      'CONTENT_FILTER_ERROR'
    ],
    retryableCategories: ['external_service', 'rate_limiting', 'network'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 6,
      successThreshold: 3,
      timeout: 15000,
      monitorWindow: 60000
    },
    budget: {
      maxTotalTime: 120000,
      windowMs: 300000,
      resetOnSuccess: true
    },
    enableMetrics: true,
    tags: ['openai', 'chat', 'api']
  },

  OPENAI_VISION: {
    name: 'openai-vision',
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 20000,
    strategy: 'exponential',
    jitter: 'equal',
    timeoutPerAttempt: 60000,
    retryableErrors: [
      'RATE_LIMIT_EXCEEDED',
      'MODEL_OVERLOADED',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR'
    ],
    nonRetryableErrors: [
      'INVALID_API_KEY',
      'UNSUPPORTED_IMAGE_FORMAT',
      'IMAGE_TOO_LARGE',
      'CONTENT_FILTER_ERROR'
    ],
    retryableCategories: ['external_service', 'rate_limiting', 'network'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 4,
      successThreshold: 2,
      timeout: 30000,
      monitorWindow: 120000
    },
    budget: {
      maxTotalTime: 180000,
      windowMs: 600000,
      resetOnSuccess: true
    },
    enableMetrics: true,
    tags: ['openai', 'vision', 'api', 'expensive']
  },

  OPENAI_WHISPER: {
    name: 'openai-whisper',
    maxAttempts: 3,
    baseDelay: 3000,
    maxDelay: 30000,
    strategy: 'linear',
    jitter: 'equal',
    timeoutPerAttempt: 120000,
    retryableErrors: [
      'RATE_LIMIT_EXCEEDED',
      'MODEL_OVERLOADED',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR'
    ],
    nonRetryableErrors: [
      'INVALID_API_KEY',
      'UNSUPPORTED_AUDIO_FORMAT',
      'AUDIO_TOO_LARGE',
      'AUDIO_TOO_SHORT'
    ],
    retryableCategories: ['external_service', 'rate_limiting', 'network'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
      monitorWindow: 300000
    },
    budget: {
      maxTotalTime: 300000,
      windowMs: 900000,
      resetOnSuccess: true
    },
    enableMetrics: true,
    tags: ['openai', 'whisper', 'api', 'audio', 'expensive']
  },

  BLOB_STORAGE: {
    name: 'blob-storage',
    maxAttempts: 4,
    baseDelay: 500,
    maxDelay: 8000,
    strategy: 'exponential',
    jitter: 'full',
    timeoutPerAttempt: 30000,
    retryableErrors: [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'RATE_LIMIT_EXCEEDED',
      'BLOB_OPERATION_ERROR'
    ],
    nonRetryableErrors: [
      'BLOB_ACCESS_ERROR',
      'BLOB_NOT_FOUND',
      'STORAGE_QUOTA_EXCEEDED',
      'FILE_TYPE_ERROR'
    ],
    retryableCategories: ['network', 'storage', 'rate_limiting'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 10000,
      monitorWindow: 60000
    },
    budget: {
      maxTotalTime: 60000,
      windowMs: 120000,
      resetOnSuccess: true
    },
    enableMetrics: true,
    tags: ['blob', 'storage', 'vercel']
  },

  EXTERNAL_API: {
    name: 'external-api',
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    strategy: 'exponential',
    jitter: 'decorrelated',
    timeoutPerAttempt: 20000,
    retryableCategories: ['network', 'external_service', 'rate_limiting'],
    retrySeverities: ['critical', 'high', 'medium'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 20000,
      monitorWindow: 120000
    },
    enableMetrics: true,
    tags: ['external', 'api', 'third-party']
  },

  DATABASE: {
    name: 'database',
    maxAttempts: 5,
    baseDelay: 100,
    maxDelay: 2000,
    strategy: 'exponential',
    jitter: 'equal',
    timeoutPerAttempt: 10000,
    retryableErrors: [
      'CONNECTION_ERROR',
      'TIMEOUT_ERROR',
      'DEADLOCK_ERROR',
      'CONNECTION_POOL_EXHAUSTED'
    ],
    nonRetryableErrors: [
      'SYNTAX_ERROR',
      'CONSTRAINT_VIOLATION',
      'PERMISSION_DENIED'
    ],
    retryableCategories: ['network', 'infrastructure'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 8,
      successThreshold: 3,
      timeout: 5000,
      monitorWindow: 30000
    },
    budget: {
      maxTotalTime: 15000,
      windowMs: 60000,
      resetOnSuccess: true
    },
    enableMetrics: true,
    tags: ['database', 'data', 'critical']
  },

  FILE_PROCESSING: {
    name: 'file-processing',
    maxAttempts: 2,
    baseDelay: 2000,
    maxDelay: 15000,
    strategy: 'linear',
    jitter: 'equal',
    timeoutPerAttempt: 180000, // 3 minutes for file processing
    retryableErrors: [
      'PROCESSING_TIMEOUT',
      'RESOURCE_EXHAUSTED',
      'TEMPORARY_FAILURE'
    ],
    nonRetryableErrors: [
      'UNSUPPORTED_FORMAT',
      'FILE_CORRUPTED',
      'FILE_TOO_LARGE',
      'INSUFFICIENT_PERMISSIONS'
    ],
    retryableCategories: ['processing', 'infrastructure'],
    circuitBreaker: {
      enabled: true,
      failureThreshold: 3,
      successThreshold: 1,
      timeout: 60000,
      monitorWindow: 300000
    },
    budget: {
      maxTotalTime: 600000, // 10 minutes total
      windowMs: 1800000,    // 30 minute window
      resetOnSuccess: false
    },
    enableMetrics: true,
    tags: ['file', 'processing', 'expensive', 'slow']
  }
};

/**
 * Get a policy by template name
 */
export function getTemplatePolicy(template: PolicyTemplate): RetryPolicy {
  const policy = templatePolicies[template];
  if (!policy) {
    throw new Error(`Unknown policy template: ${template}`);
  }
  return { ...policy }; // Return a copy to prevent mutations
}

/**
 * Get a policy by service name
 */
export function getServicePolicy(service: ServicePolicy): RetryPolicy {
  const policy = servicePolicies[service];
  if (!policy) {
    throw new Error(`Unknown service policy: ${service}`);
  }
  return { ...policy }; // Return a copy to prevent mutations
}

/**
 * Create a custom policy based on a template with overrides
 */
export function createCustomPolicy(
  template: PolicyTemplate,
  overrides: Partial<RetryPolicy>
): RetryPolicy {
  const basePolicy = getTemplatePolicy(template);
  return {
    ...basePolicy,
    ...overrides,
    // Merge tags if both exist
    tags: [
      ...(basePolicy.tags || []),
      ...(overrides.tags || [])
    ].filter((tag, index, array) => array.indexOf(tag) === index) // Remove duplicates
  };
}

/**
 * Get environment-specific policy adjustments
 */
export function getEnvironmentAdjustments(
  env: 'development' | 'staging' | 'production'
): Partial<RetryPolicy> {
  switch (env) {
    case 'development':
      return {
        maxAttempts: 2,
        baseDelay: 500,
        enableMetrics: true,
        circuitBreaker: {
          enabled: false,
          failureThreshold: 999,
          successThreshold: 1,
          timeout: 1000,
          monitorWindow: 5000
        }
      };
    
    case 'staging':
      return {
        enableMetrics: true,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          successThreshold: 2,
          timeout: 5000,
          monitorWindow: 30000
        }
      };
    
    case 'production':
      return {
        enableMetrics: true,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          successThreshold: 3,
          timeout: 10000,
          monitorWindow: 60000
        }
      };
    
    default:
      return {};
  }
}

/**
 * Apply environment-specific adjustments to a policy
 */
export function applyEnvironmentAdjustments(
  policy: RetryPolicy,
  env: 'development' | 'staging' | 'production'
): RetryPolicy {
  const adjustments = getEnvironmentAdjustments(env);
  return {
    ...policy,
    ...adjustments,
    // Deep merge circuit breaker config
    circuitBreaker: policy.circuitBreaker ? {
      ...policy.circuitBreaker,
      ...adjustments.circuitBreaker
    } : adjustments.circuitBreaker
  };
}

/**
 * Export aliases and utility functions for backwards compatibility
 */
export const createPolicyTemplate = getTemplatePolicy;
export const ServicePoliciesMap = servicePolicies;
export const PolicyTemplatesMap = templatePolicies; 