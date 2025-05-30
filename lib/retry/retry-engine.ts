/**
 * Intelligent Retry Engine
 * 
 * Core retry logic implementation with exponential backoff, jitter,
 * circuit breakers, conditional retry logic, and comprehensive metrics.
 */

import { nanoid } from 'nanoid';
import { BaseStorageError, InternalServerError } from '../errors/types';
import { ErrorCategorizer } from '../errors/error-categorization';
import {
  RetryPolicy,
  RetryContext,
  RetryResult,
  RetryAttemptResult,
  RetryStrategy,
  JitterType,
  CircuitBreakerState,
  CircuitBreakerConfig,
  RetryBudget
} from './types';

/**
 * Circuit Breaker Error for when operations are blocked
 */
class CircuitBreakerError extends InternalServerError {
  constructor(state: CircuitBreakerState, requestId?: string) {
    super(
      'Circuit breaker is open - operation blocked',
      { circuitBreakerState: state },
      requestId
    );
  }
}

/**
 * Operation Timeout Error
 */
class OperationTimeoutError extends InternalServerError {
  constructor(timeoutMs: number, requestId?: string) {
    super(
      `Operation timed out after ${timeoutMs}ms`,
      { timeoutMs },
      requestId
    );
  }
}

/**
 * Circuit Breaker State Management
 */
class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.state = 'half-open';
        this.successes = 0;
      } else {
        throw new CircuitBreakerError(this.state);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'closed';
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'half-open') {
      this.state = 'open';
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Retry Budget Tracker
 */
class BudgetTracker {
  private usedAttempts = 0;
  private usedTime = 0;
  private windowStart = Date.now();
  private readonly config: RetryBudget;

  constructor(config: RetryBudget) {
    this.config = config;
    this.resetIfNeeded();
  }

  canRetry(proposedDelay: number): boolean {
    this.resetIfNeeded();

    if (this.config.maxTotalAttempts && this.usedAttempts >= this.config.maxTotalAttempts) {
      return false;
    }

    if (this.config.maxTotalTime && (this.usedTime + proposedDelay) > this.config.maxTotalTime) {
      return false;
    }

    return true;
  }

  recordAttempt(delay: number): void {
    this.usedAttempts++;
    this.usedTime += delay;
  }

  recordSuccess(): void {
    if (this.config.resetOnSuccess) {
      this.reset();
    }
  }

  private resetIfNeeded(): void {
    if (this.config.windowMs && (Date.now() - this.windowStart) > this.config.windowMs) {
      this.reset();
    }
  }

  private reset(): void {
    this.usedAttempts = 0;
    this.usedTime = 0;
    this.windowStart = Date.now();
  }

  getUsage() {
    return {
      attempts: this.usedAttempts,
      timeMs: this.usedTime
    };
  }
}

/**
 * Delay Calculation Utilities
 */
class DelayCalculator {
  /**
   * Calculate delay based on strategy and jitter
   */
  static calculateDelay(
    attempt: number,
    policy: RetryPolicy,
    context: RetryContext
  ): number {
    let delay = this.calculateBaseDelay(attempt, policy, context);
    delay = this.applyJitter(delay, policy.jitter, attempt);
    delay = Math.min(delay, policy.maxDelay);
    return Math.max(0, delay);
  }

  private static calculateBaseDelay(
    attempt: number,
    policy: RetryPolicy,
    context: RetryContext
  ): number {
    switch (policy.strategy) {
      case 'exponential':
        return policy.baseDelay * Math.pow(2, attempt);
      
      case 'linear':
        return policy.baseDelay * (attempt + 1);
      
      case 'fixed':
        return policy.baseDelay;
      
      case 'custom':
        if (policy.customDelayFn) {
          return policy.customDelayFn(attempt, policy.baseDelay, context);
        }
        // Fallback to exponential if no custom function
        return policy.baseDelay * Math.pow(2, attempt);
      
      default:
        return policy.baseDelay * Math.pow(2, attempt);
    }
  }

  private static applyJitter(delay: number, jitterType: JitterType, attempt: number): number {
    switch (jitterType) {
      case 'none':
        return delay;
      
      case 'full':
        return Math.random() * delay;
      
      case 'equal':
        return delay / 2 + Math.random() * (delay / 2);
      
      case 'decorrelated':
        // Decorrelated jitter with exponential growth
        const base = delay / Math.pow(2, attempt);
        return base + Math.random() * delay;
      
      default:
        return delay;
    }
  }
}

/**
 * Retry Condition Evaluator
 */
class RetryConditionEvaluator {
  static shouldRetry(error: BaseStorageError, attempt: number, policy: RetryPolicy, context: RetryContext): boolean {
    // Check custom retry condition first
    if (policy.retryCondition) {
      return policy.retryCondition(error, attempt, context);
    }

    // Check explicit non-retryable errors
    if (policy.nonRetryableErrors?.includes(error.code)) {
      return false;
    }

    // Check explicit retryable errors
    if (policy.retryableErrors?.includes(error.code)) {
      return true;
    }

    // Check error categorization
    const category = ErrorCategorizer.categorizeError(error);
    const severity = ErrorCategorizer.determineSeverity(error.statusCode, category);

    // Check retryable categories
    if (policy.retryableCategories && !policy.retryableCategories.includes(category)) {
      return false;
    }

    // Check retry severities
    if (policy.retrySeverities && !policy.retrySeverities.includes(severity)) {
      return false;
    }

    // Default retry logic based on error categorization
    return this.getDefaultRetryDecision(error, category, severity);
  }

  private static getDefaultRetryDecision(
    error: BaseStorageError,
    category: string,
    severity: string
  ): boolean {
    // Don't retry client errors (4xx) except for specific cases
    if (error.statusCode >= 400 && error.statusCode < 500) {
      // Retry these specific 4xx errors
      return ['RATE_LIMIT_EXCEEDED', 'TIMEOUT_ERROR', 'REQUEST_TIMEOUT'].includes(error.code);
    }

    // Retry server errors (5xx) and network issues
    if (error.statusCode >= 500 || category === 'network') {
      return true;
    }

    // Retry transient errors
    const transientCategories = ['network', 'rate_limiting', 'external_service'];
    return transientCategories.includes(category);
  }
}

/**
 * Main Retry Engine
 */
export class RetryEngine {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private budgetTrackers = new Map<string, BudgetTracker>();

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    policy: RetryPolicy,
    operationId?: string
  ): Promise<RetryResult<T>> {
    const context = this.createContext(policy, operationId);
    const attempts: RetryAttemptResult<T>[] = [];
    
    // Setup circuit breaker if configured
    let circuitBreaker: CircuitBreaker | undefined;
    if (policy.circuitBreaker?.enabled) {
      const circuitKey = `${policy.name || 'default'}-${operationId || 'global'}`;
      circuitBreaker = this.getOrCreateCircuitBreaker(circuitKey, policy.circuitBreaker);
    }

    // Setup budget tracker if configured
    let budgetTracker: BudgetTracker | undefined;
    if (policy.budget) {
      const budgetKey = policy.budget.windowMs ? 
        `${policy.name || 'default'}-global` : 
        `${policy.name || 'default'}-${operationId || 'instance'}`;
      budgetTracker = this.getOrCreateBudgetTracker(budgetKey, policy.budget);
    }

    let lastError: BaseStorageError | undefined;

    for (let attempt = 0; attempt <= policy.maxAttempts; attempt++) {
      context.currentAttempt = attempt;
      context.remainingAttempts = policy.maxAttempts - attempt;
      context.lastAttemptTime = Date.now();

      const attemptResult: RetryAttemptResult<T> = {
        success: false,
        attempt,
        delay: 0,
        timestamp: Date.now()
      };

      try {
        // Execute with circuit breaker if configured
        const result = circuitBreaker ? 
          await circuitBreaker.execute(operation) : 
          await this.executeWithTimeout(operation, policy.timeoutPerAttempt);

        // Success!
        attemptResult.success = true;
        attemptResult.data = result;
        attempts.push(attemptResult);

        // Record success in budget tracker
        budgetTracker?.recordSuccess();

        const totalTime = Date.now() - context.startTime;
        return {
          success: true,
          data: result,
          totalAttempts: attempt + 1,
          totalTime,
          totalDelayTime: context.totalDelayTime,
          attempts,
          policy,
          context: { ...context, totalElapsed: totalTime }
        };

      } catch (error) {
        lastError = error instanceof BaseStorageError ? 
          error : 
          new InternalServerError('Unexpected error', { originalError: error }, context.requestId);

        attemptResult.error = lastError;
        context.previousErrors.push(lastError);

        // Update circuit breaker state in context
        if (circuitBreaker) {
          context.circuitBreakerState = circuitBreaker.getState();
        }

        // Check if we should retry
        if (attempt >= policy.maxAttempts) {
          // No more attempts
          attempts.push(attemptResult);
          break;
        }

        const shouldRetry = RetryConditionEvaluator.shouldRetry(lastError, attempt, policy, context);
        if (!shouldRetry) {
          attempts.push(attemptResult);
          break;
        }

        // Calculate next delay
        const delay = DelayCalculator.calculateDelay(attempt, policy, context);
        
        // Check budget constraints
        if (budgetTracker && !budgetTracker.canRetry(delay)) {
          attempts.push(attemptResult);
          return this.createFailureResult(
            attempts, 
            lastError, 
            policy, 
            context, 
            { budgetExhausted: true }
          );
        }

        // Check abort signal
        if (policy.abortSignal?.aborted) {
          attempts.push(attemptResult);
          return this.createFailureResult(
            attempts, 
            lastError, 
            policy, 
            context, 
            { wasAborted: true }
          );
        }

        // Record delay and wait
        attemptResult.delay = delay;
        context.lastDelay = delay;
        context.nextDelay = attempt < policy.maxAttempts - 1 ? 
          DelayCalculator.calculateDelay(attempt + 1, policy, context) : 
          undefined;
        context.totalDelayTime += delay;

        // Record budget usage
        budgetTracker?.recordAttempt(delay);
        if (budgetTracker) {
          context.budgetUsed = budgetTracker.getUsage();
        }

        attempts.push(attemptResult);

        // Wait before next attempt
        if (delay > 0) {
          await this.delay(delay);
        }
      }
    }

    // All attempts exhausted - ensure we have a lastError
    const finalError = lastError || new InternalServerError(
      'All retry attempts failed with unknown error',
      { attempts: attempts.length },
      context.requestId
    );
    
    return this.createFailureResult(attempts, finalError, policy, context);
  }

  private createContext(policy: RetryPolicy, operationId?: string): RetryContext {
    return {
      operationId: operationId || nanoid(8),
      requestId: nanoid(10),
      policyName: policy.name,
      startTime: Date.now(),
      totalElapsed: 0,
      currentAttempt: 0,
      remainingAttempts: policy.maxAttempts,
      previousErrors: [],
      totalDelayTime: 0
    };
  }

  private createFailureResult<T>(
    attempts: RetryAttemptResult<T>[],
    finalError: BaseStorageError,
    policy: RetryPolicy,
    context: RetryContext,
    additionalInfo: Partial<RetryResult<T>> = {}
  ): RetryResult<T> {
    const totalTime = Date.now() - context.startTime;
    
    return {
      success: false,
      finalError,
      totalAttempts: attempts.length,
      totalTime,
      totalDelayTime: context.totalDelayTime,
      attempts,
      policy,
      context: { ...context, totalElapsed: totalTime },
      ...additionalInfo
    };
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!timeoutMs) {
      return operation();
    }

    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new OperationTimeoutError(timeoutMs));
        }, timeoutMs);
      })
    ]);
  }

  private getOrCreateCircuitBreaker(key: string, config: CircuitBreakerConfig): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker(config));
    }
    return this.circuitBreakers.get(key)!;
  }

  private getOrCreateBudgetTracker(key: string, config: RetryBudget): BudgetTracker {
    if (!this.budgetTrackers.has(key)) {
      this.budgetTrackers.set(key, new BudgetTracker(config));
    }
    return this.budgetTrackers.get(key)!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    for (const [key, breaker] of this.circuitBreakers) {
      status[key] = breaker.getMetrics();
    }
    return status;
  }

  /**
   * Get budget usage for monitoring
   */
  getBudgetStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    for (const [key, tracker] of this.budgetTrackers) {
      status[key] = tracker.getUsage();
    }
    return status;
  }

  /**
   * Reset circuit breakers (for testing or administrative purposes)
   */
  resetCircuitBreakers(): void {
    this.circuitBreakers.clear();
  }

  /**
   * Reset budget trackers (for testing or administrative purposes)
   */
  resetBudgetTrackers(): void {
    this.budgetTrackers.clear();
  }
} 