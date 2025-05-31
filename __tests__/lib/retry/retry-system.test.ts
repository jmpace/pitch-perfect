/**
 * Unit Tests for Retry Logic System
 * 
 * Tests the intelligent retry mechanisms including:
 * - Retry policy configuration
 * - Backoff strategies (exponential, linear, fixed)
 * - Circuit breaker functionality
 * - Retry conditions and error categorization
 * - Performance and resource management
 */

import { RetryEngine, RetryPolicyManager, CircuitBreaker } from '@/lib/retry/retry-engine';
import { createPolicyTemplate, ServicePolicies, PolicyTemplates } from '@/lib/retry/policies';
import type { 
  RetryPolicy, 
  RetryContext, 
  RetryResult, 
  CircuitBreakerState,
  JitterType 
} from '@/lib/retry/types';
import { ErrorSimulator, MockFactory, TestHelpers, TestScenarioBuilder } from '../errors/test-utilities';

describe('RetryEngine', () => {
  let retryEngine: RetryEngine;

  beforeEach(() => {
    retryEngine = new RetryEngine();
  });

  describe('Backoff Strategies', () => {
    test('should calculate exponential backoff correctly', () => {
      const policy = MockFactory.createRetryPolicy({
        strategy: 'exponential',
        baseDelay: 1000,
        maxDelay: 10000,
        jitter: 'none'
      });

      const delay1 = retryEngine.calculateDelay(1, policy);
      const delay2 = retryEngine.calculateDelay(2, policy);
      const delay3 = retryEngine.calculateDelay(3, policy);

      expect(delay1).toBe(1000); // 1000 * 2^0
      expect(delay2).toBe(2000); // 1000 * 2^1
      expect(delay3).toBe(4000); // 1000 * 2^2
    });

    test('should respect maximum delay in exponential backoff', () => {
      const policy = MockFactory.createRetryPolicy({
        strategy: 'exponential',
        baseDelay: 1000,
        maxDelay: 5000,
        jitter: 'none'
      });

      const delay5 = retryEngine.calculateDelay(5, policy);
      expect(delay5).toBe(5000); // Should be capped at maxDelay
    });

    test('should calculate linear backoff correctly', () => {
      const policy = MockFactory.createRetryPolicy({
        strategy: 'linear',
        baseDelay: 1000,
        jitter: 'none'
      });

      const delay1 = retryEngine.calculateDelay(1, policy);
      const delay2 = retryEngine.calculateDelay(2, policy);
      const delay3 = retryEngine.calculateDelay(3, policy);

      expect(delay1).toBe(1000); // 1000 * 1
      expect(delay2).toBe(2000); // 1000 * 2
      expect(delay3).toBe(3000); // 1000 * 3
    });

    test('should calculate fixed delay correctly', () => {
      const policy = MockFactory.createRetryPolicy({
        strategy: 'fixed',
        baseDelay: 1500,
        jitter: 'none'
      });

      const delay1 = retryEngine.calculateDelay(1, policy);
      const delay2 = retryEngine.calculateDelay(2, policy);
      const delay3 = retryEngine.calculateDelay(3, policy);

      expect(delay1).toBe(1500);
      expect(delay2).toBe(1500);
      expect(delay3).toBe(1500);
    });

    test('should apply jitter to delays', () => {
      const policy = MockFactory.createRetryPolicy({
        strategy: 'exponential',
        baseDelay: 1000,
        jitter: 'full'
      });

      // Run multiple times to test jitter randomness
      const delays = Array.from({ length: 10 }, () => 
        retryEngine.calculateDelay(2, policy)
      );

      // With full jitter, delays should vary between 0 and calculated delay
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1); // Should have some variation
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(2000); // 1000 * 2^1
      });
    });
  });

  describe('Retry Conditions', () => {
    test('should retry on configured error codes', async () => {
      const policy = MockFactory.createRetryPolicy({
        maxAttempts: 3,
        retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR']
      });

      const operation = TestScenarioBuilder.buildRetryScenario(2, 3);
      const result = await retryEngine.executeWithRetry(operation, policy);

      expect(result.success).toBe(true);
      expect(result.totalAttempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should not retry on non-retryable error codes', async () => {
      const policy = MockFactory.createRetryPolicy({
        maxAttempts: 3,
        retryableErrors: ['NETWORK_ERROR'],
        nonRetryableErrors: ['AUTHENTICATION_ERROR']
      });

      const operation = jest.fn().mockRejectedValue(
        ErrorSimulator.createAuthenticationError()
      );

      const result = await retryEngine.executeWithRetry(operation, policy);

      expect(result.success).toBe(false);
      expect(result.totalAttempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should retry based on error categories', async () => {
      const policy = MockFactory.createRetryPolicy({
        maxAttempts: 3,
        retryableCategories: ['network', 'external_service']
      });

      const operation = TestScenarioBuilder.buildRetryScenario(2, 3);
      const result = await retryEngine.executeWithRetry(operation, policy);

      expect(result.success).toBe(true);
      expect(result.totalAttempts).toBe(3);
    });

    test('should respect custom retry conditions', async () => {
      let customConditionCalled = false;
      const policy = MockFactory.createRetryPolicy({
        maxAttempts: 3,
        retryCondition: (error, attempt, context) => {
          customConditionCalled = true;
          return attempt < 2; // Only retry once
        }
      });

      const operation = TestScenarioBuilder.buildRetryScenario(3);
      const result = await retryEngine.executeWithRetry(operation, policy);

      expect(customConditionCalled).toBe(true);
      expect(result.success).toBe(false);
      expect(result.totalAttempts).toBe(2); // Should stop after 2 attempts
    });
  });

  describe('Timeout Handling', () => {
    test('should respect per-attempt timeout', async () => {
      const policy = MockFactory.createRetryPolicy({
        maxAttempts: 3,
        timeoutPerAttempt: 100
      });

      const operation = jest.fn().mockImplementation(() => 
        TestHelpers.createAsyncSuccess('result', 200) // Takes longer than timeout
      );

      const result = await retryEngine.executeWithRetry(operation, policy);

      expect(result.success).toBe(false);
      expect(result.timeoutExceeded).toBe(true);
    });

    test('should handle abort signals', async () => {
      const controller = new AbortController();
      const policy = MockFactory.createRetryPolicy({
        maxAttempts: 5,
        abortSignal: controller.signal
      });

      const operation = TestScenarioBuilder.buildRetryScenario(10);

      // Abort after a short delay
      setTimeout(() => controller.abort(), 50);

      const result = await retryEngine.executeWithRetry(operation, policy);

      expect(result.success).toBe(false);
      expect(result.wasAborted).toBe(true);
    });
  });

  describe('Resource Management', () => {
    test('should track retry budget usage', async () => {
      const policy = MockFactory.createRetryPolicy({
        maxAttempts: 5,
        budget: {
          maxTotalAttempts: 3,
          windowMs: 60000
        }
      });

      const operation = TestScenarioBuilder.buildRetryScenario(10);
      const result = await retryEngine.executeWithRetry(operation, policy);

      expect(result.success).toBe(false);
      expect(result.budgetExhausted).toBe(true);
      expect(result.totalAttempts).toBeLessThanOrEqual(3);
    });

    test('should track execution metrics', async () => {
      const policy = MockFactory.createRetryPolicy({
        maxAttempts: 3,
        enableMetrics: true
      });

      const operation = TestScenarioBuilder.buildRetryScenario(2, 3);
      const result = await retryEngine.executeWithRetry(operation, policy);

      expect(result.context.totalElapsed).toBeGreaterThan(0);
      expect(result.context.totalDelayTime).toBeGreaterThan(0);
      expect(result.attempts).toHaveLength(3);
      expect(result.attempts[0].success).toBe(false);
      expect(result.attempts[2].success).toBe(true);
    });
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      monitorWindow: 5000
    });
  });

  test('should start in closed state', () => {
    expect(circuitBreaker.getState()).toBe('closed');
  });

  test('should open after failure threshold', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Test error'));

    // Trigger failures to reach threshold
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe('open');
  });

  test('should move to half-open after timeout', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Test error'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe('open');

    // Wait for timeout (using shorter timeout for test)
    circuitBreaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 50,
      monitorWindow: 5000
    });

    // Force failures to open
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
    }

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 60));

    // Next call should move to half-open
    try {
      await circuitBreaker.execute(operation);
    } catch (error) {
      // Expected to fail but state should change
    }

    expect(circuitBreaker.getState()).toBe('half-open');
  });

  test('should close from half-open after successful operations', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('Test error'))
      .mockRejectedValueOnce(new Error('Test error'))
      .mockRejectedValueOnce(new Error('Test error'))
      .mockResolvedValue('success');

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe('open');

    // Wait for timeout and succeed enough times
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Execute successful operations to close circuit
    for (let i = 0; i < 2; i++) {
      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('success');
    }

    expect(circuitBreaker.getState()).toBe('closed');
  });

  test('should reject fast when open', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Test error'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
    }

    const startTime = Date.now();
    
    try {
      await circuitBreaker.execute(operation);
    } catch (error) {
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(10); // Should fail fast
      expect(error.message).toContain('Circuit breaker is open');
    }
  });
});

describe('RetryPolicyManager', () => {
  let policyManager: RetryPolicyManager;

  beforeEach(() => {
    policyManager = new RetryPolicyManager();
  });

  test('should register and retrieve policies', () => {
    const policy = MockFactory.createRetryPolicy({
      maxAttempts: 5,
      baseDelay: 2000
    });

    policyManager.registerPolicy('test-policy', policy);
    const retrieved = policyManager.getPolicy('test-policy');

    expect(retrieved).toEqual(policy);
  });

  test('should provide default policy for unknown names', () => {
    const defaultPolicy = policyManager.getPolicy('unknown-policy');
    
    expect(defaultPolicy).toBeDefined();
    expect(defaultPolicy.maxAttempts).toBeGreaterThan(0);
    expect(defaultPolicy.baseDelay).toBeGreaterThan(0);
  });

  test('should create policies from templates', () => {
    const policy = policyManager.createFromTemplate('aggressive');
    
    expect(policy.maxAttempts).toBeGreaterThan(3);
    expect(policy.baseDelay).toBeLessThan(1000);
  });

  test('should provide service-specific policies', () => {
    const openaiPolicy = policyManager.getServicePolicy('openai');
    const storagePolicy = policyManager.getServicePolicy('storage');
    
    expect(openaiPolicy).toBeDefined();
    expect(storagePolicy).toBeDefined();
    expect(openaiPolicy.retryableErrors).toContain('RATE_LIMIT_ERROR');
  });

  test('should collect and report metrics', async () => {
    const policy = MockFactory.createRetryPolicy({ enableMetrics: true });
    policyManager.registerPolicy('metrics-test', policy);

    // Simulate some retry operations
    const operation = TestScenarioBuilder.buildRetryScenario(2, 3);
    const retryEngine = new RetryEngine();
    
    await retryEngine.executeWithRetry(operation, policy);

    const metrics = policyManager.getMetrics('metrics-test');
    expect(metrics).toBeDefined();
  });
});

describe('Integration Tests', () => {
  test('should handle complete retry workflow with circuit breaker', async () => {
    const retryEngine = new RetryEngine();
    const policy = MockFactory.createRetryPolicy({
      maxAttempts: 5,
      baseDelay: 100,
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 500,
        monitorWindow: 5000
      }
    });

    // First, cause circuit breaker to open
    const failingOperation = jest.fn().mockRejectedValue(new Error('Service down'));
    
    for (let i = 0; i < 3; i++) {
      try {
        await retryEngine.executeWithRetry(failingOperation, policy);
      } catch (error) {
        // Expected failures
      }
    }

    // Circuit should be open now, next operation should fail fast
    const fastFailStart = Date.now();
    try {
      await retryEngine.executeWithRetry(failingOperation, policy);
    } catch (error) {
      const fastFailEnd = Date.now();
      expect(fastFailEnd - fastFailStart).toBeLessThan(50); // Should fail very quickly
    }
  });

  test('should handle resource pressure gracefully', async () => {
    const retryEngine = new RetryEngine();
    const policy = MockFactory.createRetryPolicy({
      maxAttempts: 10,
      budget: {
        maxTotalAttempts: 20,
        maxTotalTime: 5000,
        windowMs: 10000
      }
    });

    // Create memory pressure
    const memoryPressure = Array.from({ length: 100 }, () => 
      new Array(1000).fill('memory-pressure')
    );

    const operation = TestScenarioBuilder.buildRetryScenario(5, 6);
    const result = await retryEngine.executeWithRetry(operation, policy);

    expect(result.success).toBe(true);
    expect(result.context.budgetUsed).toBeDefined();
    
    // Clean up memory
    memoryPressure.length = 0;
  });

  test('should handle concurrent retry operations', async () => {
    const retryEngine = new RetryEngine();
    const policy = MockFactory.createRetryPolicy({
      maxAttempts: 3,
      baseDelay: 50
    });

    const operations = Array.from({ length: 10 }, () => 
      TestScenarioBuilder.buildRetryScenario(2, 3)
    );

    const results = await Promise.all(
      operations.map(op => retryEngine.executeWithRetry(op, policy))
    );

    results.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.totalAttempts).toBe(3);
    });
  });
});

describe('Performance Tests', () => {
  test('retry calculation should be performant', async () => {
    const retryEngine = new RetryEngine();
    const policy = MockFactory.createRetryPolicy({
      strategy: 'exponential',
      jitter: 'decorrelated'
    });

    const { duration } = await TestHelpers.measureExecutionTime(async () => {
      return Array.from({ length: 10000 }, (_, i) => 
        retryEngine.calculateDelay(i % 10, policy)
      );
    });

    // Should calculate 10000 delays in under 50ms
    expect(duration).toBeLessThan(50);
  });

  test('should handle high-frequency retry operations', async () => {
    const retryEngine = new RetryEngine();
    const policy = MockFactory.createRetryPolicy({
      maxAttempts: 2,
      baseDelay: 1
    });

    const operations = Array.from({ length: 100 }, () => 
      jest.fn().mockResolvedValue('success')
    );

    const { duration, result } = await TestHelpers.measureExecutionTime(async () => {
      return Promise.all(
        operations.map(op => retryEngine.executeWithRetry(op, policy))
      );
    });

    expect(result).toHaveLength(100);
    result.forEach(res => expect(res.success).toBe(true));
    
    // Should handle 100 operations quickly
    expect(duration).toBeLessThan(100);
  });
}); 