/**
 * Intelligent Retry System
 * 
 * Main export file for the retry system. Provides easy-to-use wrapper functions
 * and exports all core functionality for advanced use cases.
 */

// Core exports
export * from './types';
export { RetryEngine } from './retry-engine';
export {
  templatePolicies,
  servicePolicies,
  getTemplatePolicy,
  getServicePolicy,
  createCustomPolicy,
  applyEnvironmentAdjustments
} from './policies';

// Re-export for convenience
import { RetryEngine } from './retry-engine';
import { 
  templatePolicies,
  servicePolicies,
  getTemplatePolicy,
  getServicePolicy,
  applyEnvironmentAdjustments
} from './policies';
import {
  RetryPolicy,
  RetryResult,
  PolicyTemplate,
  ServicePolicy
} from './types';

/**
 * Global retry engine instance
 */
const globalRetryEngine = new RetryEngine();

/**
 * Enhanced withRetry function that replaces the basic version in handlers.ts
 * 
 * @param operation - The async operation to retry
 * @param policy - Retry policy to use (can be a policy object, template name, or service name)
 * @param operationId - Optional operation identifier for tracking
 * @returns Promise with retry result
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy | PolicyTemplate | ServicePolicy | string,
  operationId?: string
): Promise<T> {
  const resolvedPolicy = resolvePolicy(policy);
  const result = await globalRetryEngine.executeWithRetry(operation, resolvedPolicy, operationId);
  
  if (result.success) {
    return result.data!;
  } else {
    throw result.finalError;
  }
}

/**
 * Enhanced withRetry function that returns full retry result information
 * 
 * @param operation - The async operation to retry
 * @param policy - Retry policy to use
 * @param operationId - Optional operation identifier for tracking
 * @returns Promise with complete retry result including metrics and attempt history
 */
export async function withRetryResult<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy | PolicyTemplate | ServicePolicy | string,
  operationId?: string
): Promise<RetryResult<T>> {
  const resolvedPolicy = resolvePolicy(policy);
  return globalRetryEngine.executeWithRetry(operation, resolvedPolicy, operationId);
}

/**
 * Quick retry functions for common scenarios
 */

/**
 * Fast retry for transient network issues
 */
export async function withFastRetry<T>(
  operation: () => Promise<T>,
  operationId?: string
): Promise<T> {
  return withRetry(operation, 'FAST_TRANSIENT', operationId);
}

/**
 * Standard API retry with good defaults
 */
export async function withApiRetry<T>(
  operation: () => Promise<T>,
  operationId?: string
): Promise<T> {
  return withRetry(operation, 'STANDARD_API', operationId);
}

/**
 * Conservative retry for expensive operations
 */
export async function withConservativeRetry<T>(
  operation: () => Promise<T>,
  operationId?: string
): Promise<T> {
  return withRetry(operation, 'CONSERVATIVE', operationId);
}

/**
 * OpenAI-specific retry functions
 */

/**
 * Retry for OpenAI chat completions
 */
export async function withOpenAIChatRetry<T>(
  operation: () => Promise<T>,
  operationId?: string
): Promise<T> {
  return withRetry(operation, 'OPENAI_CHAT', operationId);
}

/**
 * Retry for OpenAI vision analysis
 */
export async function withOpenAIVisionRetry<T>(
  operation: () => Promise<T>,
  operationId?: string
): Promise<T> {
  return withRetry(operation, 'OPENAI_VISION', operationId);
}

/**
 * Retry for OpenAI Whisper transcription
 */
export async function withOpenAIWhisperRetry<T>(
  operation: () => Promise<T>,
  operationId?: string
): Promise<T> {
  return withRetry(operation, 'OPENAI_WHISPER', operationId);
}

/**
 * Service-specific retry functions
 */

/**
 * Retry for blob storage operations
 */
export async function withBlobStorageRetry<T>(
  operation: () => Promise<T>,
  operationId?: string
): Promise<T> {
  return withRetry(operation, 'BLOB_STORAGE', operationId);
}

/**
 * Retry for database operations
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  operationId?: string
): Promise<T> {
  return withRetry(operation, 'DATABASE', operationId);
}

/**
 * Retry for external API calls
 */
export async function withExternalApiRetry<T>(
  operation: () => Promise<T>,
  operationId?: string
): Promise<T> {
  return withRetry(operation, 'EXTERNAL_API', operationId);
}

/**
 * Retry for file processing operations
 */
export async function withFileProcessingRetry<T>(
  operation: () => Promise<T>,
  operationId?: string
): Promise<T> {
  return withRetry(operation, 'FILE_PROCESSING', operationId);
}

/**
 * Environment-aware retry function
 * Automatically applies environment-specific adjustments
 */
export async function withEnvironmentRetry<T>(
  operation: () => Promise<T>,
  basePolicy: RetryPolicy | PolicyTemplate | ServicePolicy | string,
  environment: 'development' | 'staging' | 'production' = 'production',
  operationId?: string
): Promise<T> {
  const resolvedPolicy = resolvePolicy(basePolicy);
  const adjustedPolicy = applyEnvironmentAdjustments(resolvedPolicy, environment);
  return withRetry(operation, adjustedPolicy, operationId);
}

/**
 * Get retry system health and metrics
 */
export function getRetrySystemHealth() {
  return {
    circuitBreakers: globalRetryEngine.getCircuitBreakerStatus(),
    budgetUsage: globalRetryEngine.getBudgetStatus()
  };
}

/**
 * Reset retry system state (useful for testing)
 */
export function resetRetrySystem() {
  globalRetryEngine.resetCircuitBreakers();
  globalRetryEngine.resetBudgetTrackers();
}

/**
 * Helper function to resolve policy from various input types
 */
function resolvePolicy(
  policy: RetryPolicy | PolicyTemplate | ServicePolicy | string
): RetryPolicy {
  if (typeof policy === 'object') {
    return policy;
  }

  // Try template policies first
  if (policy in templatePolicies) {
    return getTemplatePolicy(policy as PolicyTemplate);
  }

  // Try service policies
  if (policy in servicePolicies) {
    return getServicePolicy(policy as ServicePolicy);
  }

  // If it's a string that doesn't match known policies, throw an error
  throw new Error(
    `Unknown retry policy: "${policy}". ` +
    `Available templates: ${Object.keys(templatePolicies).join(', ')}. ` +
    `Available services: ${Object.keys(servicePolicies).join(', ')}.`
  );
}

/**
 * Create a retry policy builder for fluent API
 */
export class RetryPolicyBuilder {
  private policy: Partial<RetryPolicy> = {};

  static create(): RetryPolicyBuilder {
    return new RetryPolicyBuilder();
  }

  static fromTemplate(template: PolicyTemplate): RetryPolicyBuilder {
    const builder = new RetryPolicyBuilder();
    builder.policy = { ...getTemplatePolicy(template) };
    return builder;
  }

  static fromService(service: ServicePolicy): RetryPolicyBuilder {
    const builder = new RetryPolicyBuilder();
    builder.policy = { ...getServicePolicy(service) };
    return builder;
  }

  withMaxAttempts(maxAttempts: number): RetryPolicyBuilder {
    this.policy.maxAttempts = maxAttempts;
    return this;
  }

  withBaseDelay(baseDelay: number): RetryPolicyBuilder {
    this.policy.baseDelay = baseDelay;
    return this;
  }

  withMaxDelay(maxDelay: number): RetryPolicyBuilder {
    this.policy.maxDelay = maxDelay;
    return this;
  }

  withStrategy(strategy: RetryPolicy['strategy']): RetryPolicyBuilder {
    this.policy.strategy = strategy;
    return this;
  }

  withJitter(jitter: RetryPolicy['jitter']): RetryPolicyBuilder {
    this.policy.jitter = jitter;
    return this;
  }

  withTimeout(timeoutPerAttempt: number): RetryPolicyBuilder {
    this.policy.timeoutPerAttempt = timeoutPerAttempt;
    return this;
  }

  withCircuitBreaker(enabled: boolean): RetryPolicyBuilder {
    this.policy.circuitBreaker = {
      enabled,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 10000,
      monitorWindow: 60000
    };
    return this;
  }

  withRetryableErrors(errors: string[]): RetryPolicyBuilder {
    this.policy.retryableErrors = errors;
    return this;
  }

  withNonRetryableErrors(errors: string[]): RetryPolicyBuilder {
    this.policy.nonRetryableErrors = errors;
    return this;
  }

  withName(name: string): RetryPolicyBuilder {
    this.policy.name = name;
    return this;
  }

  withTags(tags: string[]): RetryPolicyBuilder {
    this.policy.tags = tags;
    return this;
  }

  build(): RetryPolicy {
    // Ensure required fields have defaults
    const finalPolicy: RetryPolicy = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      strategy: 'exponential',
      jitter: 'equal',
      enableMetrics: true,
      ...this.policy
    };

    return finalPolicy;
  }
}

/**
 * Backward compatibility - matches signature of old withRetry function
 */
export async function legacyWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  requestId?: string
): Promise<T> {
  const policy = RetryPolicyBuilder
    .create()
    .withMaxAttempts(maxRetries)
    .withBaseDelay(baseDelayMs)
    .withName('legacy-retry')
    .build();

  return withRetry(operation, policy, requestId);
} 