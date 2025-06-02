/**
 * Intelligent Retry Logic System Types
 * 
 * Comprehensive type definitions for advanced retry mechanisms with
 * exponential backoff, jitter, circuit breakers, and conditional retry logic.
 */

import { ErrorCategory, ErrorSeverity } from '../errors/error-categorization';
import { BaseStorageError } from '../errors/types';

/**
 * Retry Strategy Types
 */
export type RetryStrategy = 
  | 'exponential'     // Exponential backoff (2^attempt * baseDelay)
  | 'linear'          // Linear backoff (attempt * baseDelay) 
  | 'fixed'           // Fixed delay between attempts
  | 'custom';         // Custom strategy function

/**
 * Jitter Types for reducing thundering herd problems
 */
export type JitterType =
  | 'none'            // No jitter
  | 'full'            // Random jitter [0, calculatedDelay]
  | 'equal'           // Equal jitter [calculatedDelay/2, calculatedDelay]
  | 'decorrelated';   // Decorrelated jitter (exponential growth with randomness)

/**
 * Circuit Breaker State
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Retry Condition Function
 * Determines if an error should trigger a retry attempt
 */
export type RetryConditionFn = (
  error: BaseStorageError,
  attempt: number,
  context: RetryContext
) => boolean;

/**
 * Custom Delay Strategy Function
 * Calculates custom delay based on attempt number and context
 */
export type CustomDelayFn = (
  attempt: number,
  baseDelay: number,
  context: RetryContext
) => number;

/**
 * Retry Budget Configuration
 * Limits total retry time or attempts across operations
 */
export interface RetryBudget {
  maxTotalTime?: number;           // Maximum total time across all retries (ms)
  maxTotalAttempts?: number;       // Maximum attempts across all operations
  windowMs?: number;               // Time window for budget tracking
  resetOnSuccess?: boolean;        // Reset budget on successful operation
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;        // Failures needed to open circuit
  successThreshold: number;        // Successes needed to close from half-open
  timeout: number;                 // Time to wait before half-open (ms)
  monitorWindow: number;           // Window for tracking failures (ms)
}

/**
 * Core Retry Policy Configuration
 */
export interface RetryPolicy {
  // Basic retry configuration
  maxAttempts: number;             // Maximum retry attempts
  baseDelay: number;               // Base delay in milliseconds
  maxDelay: number;                // Maximum delay cap in milliseconds
  strategy: RetryStrategy;         // Backoff strategy
  jitter: JitterType;              // Jitter type

  // Advanced configuration
  timeoutPerAttempt?: number;      // Timeout for each individual attempt
  abortSignal?: AbortSignal;       // Allow external cancellation

  // Conditional retry logic
  retryCondition?: RetryConditionFn;  // Custom retry condition
  retryableErrors?: string[];         // Specific error codes to retry
  nonRetryableErrors?: string[];      // Error codes to never retry
  retryableCategories?: ErrorCategory[];  // Error categories to retry
  retrySeverities?: ErrorSeverity[];      // Error severities to retry

  // Custom strategies
  customDelayFn?: CustomDelayFn;   // Custom delay calculation

  // Budget and resource management
  budget?: RetryBudget;            // Retry budget limits
  circuitBreaker?: CircuitBreakerConfig;  // Circuit breaker config

  // Metadata and monitoring
  name?: string;                   // Policy name for monitoring
  tags?: string[];                 // Tags for categorization
  enableMetrics?: boolean;         // Enable metrics collection
}

/**
 * Retry Context - tracks state during retry execution
 */
export interface RetryContext {
  // Identification
  operationId: string;             // Unique operation identifier
  requestId?: string;              // Request tracking ID
  policyName?: string;             // Applied policy name

  // Timing information
  startTime: number;               // Operation start timestamp
  lastAttemptTime?: number;        // Last attempt timestamp
  totalElapsed: number;            // Total elapsed time
  
  // Attempt tracking
  currentAttempt: number;          // Current attempt number (0-based)
  remainingAttempts: number;       // Attempts remaining
  previousErrors: BaseStorageError[];  // History of errors

  // Delay information
  lastDelay?: number;              // Last calculated delay
  nextDelay?: number;              // Next calculated delay
  totalDelayTime: number;          // Total time spent in delays

  // Resource tracking
  budgetUsed?: {
    attempts: number;              // Attempts used from budget
    timeMs: number;                // Time used from budget
  };

  // Circuit breaker state
  circuitBreakerState?: CircuitBreakerState;
  circuitBreakerLastFailure?: number;

  // Metadata
  metadata?: Record<string, unknown>;  // Additional context data
}

/**
 * Retry Attempt Result
 */
export interface RetryAttemptResult<T> {
  success: boolean;
  data?: T;
  error?: BaseStorageError;
  attempt: number;
  delay: number;
  timestamp: number;
}

/**
 * Final Retry Result
 */
export interface RetryResult<T = any> {
  success: boolean;
  data?: T;
  finalError?: BaseStorageError;
  totalAttempts: number;
  totalTime: number;
  totalDelayTime: number;
  attempts: RetryAttemptResult<T>[];
  policy: RetryPolicy;
  context: RetryContext;
  
  // Additional result properties
  wasAborted?: boolean;
  budgetExhausted?: boolean;
  timeoutExceeded?: boolean;
  
  // Performance and monitoring data
  circuitBreakerTriggered?: boolean;
  retryBudgetUsed?: {
    attempts: number;
    timeMs: number;
  };
}

/**
 * Retry Metrics for monitoring and analytics
 */
export interface RetryMetrics {
  // Policy identification
  policyName: string;
  operationType: string;
  
  // Success/failure rates
  successRate: number;             // Overall success rate
  immediateSuccessRate: number;    // Success on first attempt
  eventualSuccessRate: number;     // Success after retries
  
  // Timing metrics
  averageAttempts: number;         // Average attempts per operation
  averageTotalTime: number;        // Average total execution time
  averageDelayTime: number;        // Average delay time
  
  // Error analysis
  commonErrors: Record<string, number>;  // Most common error codes
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  
  // Resource usage
  budgetUtilization?: number;      // Budget usage percentage
  circuitBreakerActivations: number;  // Circuit breaker opens
  
  // Time-based statistics
  periodStart: string;             // Metrics period start
  periodEnd: string;               // Metrics period end
  totalOperations: number;         // Total operations in period
}

/**
 * Retry Manager Configuration
 */
export interface RetryManagerConfig {
  // Default policies
  defaultPolicy: RetryPolicy;
  policies: Record<string, RetryPolicy>;
  
  // Global settings
  enableMetrics: boolean;
  metricsWindowMs: number;
  
  // Circuit breaker globals
  globalCircuitBreaker?: CircuitBreakerConfig;
  
  // Resource limits
  globalBudget?: RetryBudget;
  
  // Monitoring
  onRetryAttempt?: (context: RetryContext, error: BaseStorageError) => void;
  onRetrySuccess?: (result: RetryResult<any>) => void;
  onRetryFailure?: (result: RetryResult<any>) => void;
  onCircuitBreakerStateChange?: (service: string, state: CircuitBreakerState) => void;
}

/**
 * Predefined Policy Templates
 */
export const PolicyTemplates = {
  // Quick retry for transient failures
  FAST_TRANSIENT: 'fast-transient',
  
  // Moderate retry for API calls
  STANDARD_API: 'standard-api',
  
  // Conservative retry for expensive operations
  CONSERVATIVE: 'conservative',
  
  // Aggressive retry for critical operations
  AGGRESSIVE: 'aggressive',
  
  // No retry policy
  NO_RETRY: 'no-retry'
} as const;

export type PolicyTemplate = keyof typeof PolicyTemplates;

/**
 * Service-specific policy identifiers
 */
export const ServicePolicies = {
  OPENAI_CHAT: 'openai-chat',
  OPENAI_VISION: 'openai-vision', 
  OPENAI_WHISPER: 'openai-whisper',
  BLOB_STORAGE: 'blob-storage',
  EXTERNAL_API: 'external-api',
  DATABASE: 'database',
  FILE_PROCESSING: 'file-processing'
} as const;

export type ServicePolicy = keyof typeof ServicePolicies; 