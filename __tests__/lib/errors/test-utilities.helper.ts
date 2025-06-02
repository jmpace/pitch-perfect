/**
 * Comprehensive Test Utilities for Error Handling Testing
 * 
 * Provides utilities for:
 * - Error simulation and generation
 * - Mock factories for error scenarios
 * - Testing helpers for verification
 * - Performance testing utilities
 */

import type { 
  ErrorContext, 
  ErrorSeverity, 
  ErrorCategory, 
  UserActionRecommendation,
  ErrorRecoveryStrategy,
  EnhancedErrorInfo
} from '@/lib/errors/error-categorization';
import type { LogEntry, LogLevel } from '@/lib/logging/types';
import type { RetryPolicy, JitterType } from '@/lib/retry/types';
import type { FallbackStrategy } from '@/lib/fallback/types';

// Simple test to satisfy Jest requirement
describe('Test Utilities', () => {
  test('should export ErrorSimulator', () => {
    expect(ErrorSimulator).toBeDefined();
  });

  test('should export MockFactory', () => {
    expect(MockFactory).toBeDefined();
  });

  test('should export TestHelpers', () => {
    expect(TestHelpers).toBeDefined();
  });
});

// Error simulation utilities
export class ErrorSimulator {
  static createNetworkError(statusCode: number = 500, message: string = 'Network request failed'): Error {
    const error = new Error(message);
    (error as any).status = statusCode;
    (error as any).code = 'NETWORK_ERROR';
    return error;
  }

  static createTimeoutError(timeout: number = 5000): Error {
    const error = new Error(`Request timed out after ${timeout}ms`);
    (error as any).code = 'TIMEOUT_ERROR';
    (error as any).timeout = timeout;
    return error;
  }

  static createValidationError(field: string, value: any): Error {
    const error = new Error(`Validation failed for field '${field}' with value '${value}'`);
    (error as any).code = 'VALIDATION_ERROR';
    (error as any).field = field;
    (error as any).value = value;
    return error;
  }

  static createRateLimitError(limit: number = 100, remaining: number = 0): Error {
    const error = new Error(`Rate limit exceeded. Limit: ${limit}, Remaining: ${remaining}`);
    (error as any).code = 'RATE_LIMIT_ERROR';
    (error as any).limit = limit;
    (error as any).remaining = remaining;
    return error;
  }

  static createDatabaseError(operation: string = 'query'): Error {
    const error = new Error(`Database ${operation} failed`);
    (error as any).code = 'DATABASE_ERROR';
    (error as any).operation = operation;
    return error;
  }

  static createAuthenticationError(): Error {
    const error = new Error('Authentication failed');
    (error as any).code = 'AUTHENTICATION_ERROR';
    (error as any).status = 401;
    return error;
  }

  static createAuthorizationError(): Error {
    const error = new Error('Access denied');
    (error as any).code = 'AUTHORIZATION_ERROR';
    (error as any).status = 403;
    return error;
  }

  static createStorageError(operation: string = 'read'): Error {
    const error = new Error(`Storage ${operation} operation failed`);
    (error as any).code = 'STORAGE_ERROR';
    (error as any).operation = operation;
    return error;
  }
}

// Mock factories for testing
export class MockFactory {
  static createErrorContext(overrides: Partial<ErrorContext> = {}): ErrorContext {
    return {
      requestId: 'test-request-123',
      sessionId: 'test-session-456',
      userId: 'test-user-123',
      component: 'test-component',
      operation: 'test-operation',
      endpoint: '/test',
      method: 'GET',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      retryCount: 0,
      previousErrors: [],
      fallbackUsed: false,
      recoveryStrategy: 'retry',
      metadata: {
        source: 'test',
        category: 'testing'
      },
      ...overrides
    };
  }

  static createUserActionRecommendation(overrides: Partial<UserActionRecommendation> = {}): UserActionRecommendation {
    return {
      primary: 'Try again',
      alternatives: ['Contact support', 'Use offline mode'],
      preventive: ['Check your internet connection'],
      escalation: 'Contact support if problem persists',
      ...overrides
    };
  }

  static createErrorRecoveryStrategy(overrides: Partial<ErrorRecoveryStrategy> = {}): ErrorRecoveryStrategy {
    return {
      retryable: true,
      retryDelay: 1000,
      maxRetries: 3,
      fallbackAvailable: true,
      fallbackDescription: 'Use cached data',
      circuitBreakerTriggered: false,
      ...overrides
    };
  }

  static createLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: 'error' as LogLevel,
      message: 'Test error message',
      component: 'test-component',
      operation: 'test-operation',
      requestId: 'test-request-123',
      duration: 100,
      memoryUsage: 1024,
      ...overrides
    };
  }

  static createRetryPolicy(overrides: Partial<RetryPolicy> = {}): RetryPolicy {
    return {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 5000,
      strategy: 'exponential',
      jitter: 'none' as JitterType,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR'],
      retryableCategories: ['network', 'external_service'],
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 30000,
        monitorWindow: 60000
      },
      ...overrides
    };
  }
}

// Testing helper utilities
export class TestHelpers {
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static createAsyncError(delay: number = 100): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(ErrorSimulator.createNetworkError());
      }, delay);
    });
  }

  static createAsyncSuccess<T>(value: T, delay: number = 50): Promise<T> {
    return new Promise(resolve => {
      setTimeout(() => resolve(value), delay);
    });
  }

  static measureExecutionTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    
    const executeAndMeasure = async () => {
      const result = await fn();
      const duration = performance.now() - start;
      return { result, duration };
    };

    return executeAndMeasure();
  }

  static createMockConsole(): jest.SpyInstance[] {
    return [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'debug').mockImplementation(() => {})
    ];
  }

  static restoreConsole(spies: jest.SpyInstance[]): void {
    spies.forEach(spy => spy.mockRestore());
  }

  static expectErrorWithCode(error: any, expectedCode: string): void {
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(expectedCode);
  }

  static expectErrorWithStatus(error: any, expectedStatus: number): void {
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(expectedStatus);
  }

  static expectValidErrorContext(context: ErrorContext): void {
    expect(context).toHaveProperty('requestId');
    expect(context).toHaveProperty('operation');
    expect(context).toHaveProperty('component');
    expect(typeof context.requestId).toBe('string');
  }

  static async measureMemoryUsage<T>(operation: () => Promise<T>): Promise<{ result: T; memoryDelta: number }> {
    return PerformanceTestUtils.measureMemoryUsage(operation);
  }
}

// Performance testing utilities
export class PerformanceTestUtils {
  static async runLoadTest(
    operation: () => Promise<any>,
    options: {
      iterations: number;
      concurrency: number;
      timeout?: number;
    }
  ): Promise<{
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    successCount: number;
    errorCount: number;
    errors: Error[];
  }> {
    const { iterations, concurrency, timeout = 30000 } = options;
    const results: Array<{ success: boolean; duration: number; error?: Error }> = [];
    const startTime = performance.now();

    // Run tests in batches based on concurrency
    for (let i = 0; i < iterations; i += concurrency) {
      const batch = Array.from({ length: Math.min(concurrency, iterations - i) }, async () => {
        const operationStart = performance.now();
        try {
          await Promise.race([
            operation(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Operation timeout')), timeout)
            )
          ]);
          return {
            success: true,
            duration: performance.now() - operationStart
          };
        } catch (error) {
          return {
            success: false,
            duration: performance.now() - operationStart,
            error: error as Error
          };
        }
      });

      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    const totalTime = performance.now() - startTime;
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    const durations = successfulResults.map(r => r.duration);

    return {
      totalTime,
      averageTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minTime: durations.length > 0 ? Math.min(...durations) : 0,
      maxTime: durations.length > 0 ? Math.max(...durations) : 0,
      successCount: successfulResults.length,
      errorCount: failedResults.length,
      errors: failedResults.map(r => r.error!).filter(Boolean)
    };
  }

  static createMemoryPressure(size: number = 100 * 1024 * 1024): ArrayBuffer {
    return new ArrayBuffer(size);
  }

  static async measureMemoryUsage<T>(operation: () => Promise<T>): Promise<{ result: T; memoryDelta: number }> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const beforeMemory = process.memoryUsage().heapUsed;
    const result = await operation();
    const afterMemory = process.memoryUsage().heapUsed;

    return {
      result,
      memoryDelta: afterMemory - beforeMemory
    };
  }
}

// Mock external services
export class MockExternalServices {
  static createMockOpenAI() {
    return {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock response' } }],
            usage: { total_tokens: 100 }
          })
        }
      }
    };
  }

  static createMockDatabase() {
    return {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      transaction: jest.fn().mockImplementation(async (callback) => {
        return await callback({
          query: jest.fn().mockResolvedValue({ rows: [] })
        });
      })
    };
  }

  static createMockBlobStorage() {
    return {
      put: jest.fn().mockResolvedValue({
        url: 'https://test-blob.com/file',
        pathname: '/file'
      }),
      del: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue({ blobs: [] })
    };
  }

  static createFailingService(errorType: 'network' | 'timeout' | 'auth' = 'network') {
    const errorMap = {
      network: () => ErrorSimulator.createNetworkError(),
      timeout: () => ErrorSimulator.createTimeoutError(),
      auth: () => ErrorSimulator.createAuthenticationError()
    };

    return {
      operation: jest.fn().mockRejectedValue(errorMap[errorType]())
    };
  }
}

// Test scenario builders
export class TestScenarioBuilder {
  static buildRetryScenario(attempts: number, succeedOnAttempt?: number) {
    let callCount = 0;
    return jest.fn().mockImplementation(() => {
      callCount++;
      if (succeedOnAttempt && callCount === succeedOnAttempt) {
        return Promise.resolve({ success: true, attempt: callCount });
      }
      if (callCount <= attempts) {
        return Promise.reject(ErrorSimulator.createNetworkError());
      }
      return Promise.resolve({ success: true, attempt: callCount });
    });
  }

  static buildCircuitBreakerScenario(failureCount: number) {
    let callCount = 0;
    return jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= failureCount) {
        return Promise.reject(ErrorSimulator.createNetworkError());
      }
      return Promise.resolve({ success: true });
    });
  }

  static buildFallbackScenario(primaryFails: boolean = true, fallbackFails: boolean = false) {
    return {
      primary: jest.fn().mockImplementation(() => {
        if (primaryFails) {
          return Promise.reject(ErrorSimulator.createNetworkError());
        }
        return Promise.resolve({ source: 'primary' });
      }),
      fallback: jest.fn().mockImplementation(() => {
        if (fallbackFails) {
          return Promise.reject(ErrorSimulator.createNetworkError());
        }
        return Promise.resolve({ source: 'fallback' });
      })
    };
  }
} 