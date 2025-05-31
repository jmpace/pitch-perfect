/**
 * Unit Tests for Error Categorization System
 * 
 * Tests the comprehensive error categorization schema including:
 * - Error severity determination
 * - Error category classification
 * - Recovery strategy generation
 * - User action recommendations
 * - Enhanced error information
 */

import { 
  ErrorCategorizer, 
  EnhancedError, 
  type ErrorSeverity, 
  type ErrorCategory,
  type ErrorContext,
  type UserActionRecommendation,
  type ErrorRecoveryStrategy
} from '@/lib/errors/error-categorization';
import { 
  BlobAccessError, 
  NetworkError, 
  RateLimitError, 
  ValidationError,
  BaseStorageError 
} from '@/lib/errors/types';
import { ErrorSimulator, MockFactory, TestHelpers } from './test-utilities';

describe('ErrorCategorizer', () => {
  describe('determineSeverity', () => {
    test('should classify critical errors correctly', () => {
      expect(ErrorCategorizer.determineSeverity(500, 'internal_system')).toBe('critical');
      expect(ErrorCategorizer.determineSeverity(503, 'infrastructure')).toBe('critical');
      expect(ErrorCategorizer.determineSeverity(507, 'storage')).toBe('critical');
    });

    test('should classify high severity errors correctly', () => {
      expect(ErrorCategorizer.determineSeverity(401, 'authentication')).toBe('high');
      expect(ErrorCategorizer.determineSeverity(403, 'authorization')).toBe('high');
      expect(ErrorCategorizer.determineSeverity(429, 'rate_limiting')).toBe('high');
    });

    test('should classify medium severity errors correctly', () => {
      expect(ErrorCategorizer.determineSeverity(400, 'validation')).toBe('medium');
      expect(ErrorCategorizer.determineSeverity(404, 'user_input')).toBe('medium');
      expect(ErrorCategorizer.determineSeverity(408, 'network')).toBe('medium');
    });

    test('should classify low severity errors correctly', () => {
      expect(ErrorCategorizer.determineSeverity(409, 'business_logic')).toBe('low');
      expect(ErrorCategorizer.determineSeverity(422, 'validation')).toBe('low');
    });

    test('should handle unknown status codes with defaults', () => {
      expect(ErrorCategorizer.determineSeverity(999, 'external_service')).toBe('medium');
      expect(ErrorCategorizer.determineSeverity(123, 'processing')).toBe('medium');
    });
  });

  describe('categorizeError', () => {
    test('should categorize blob access errors', () => {
      const error = new BlobAccessError('Invalid token');
      expect(ErrorCategorizer.categorizeError(error)).toBe('authentication');
    });

    test('should categorize network errors', () => {
      const error = new NetworkError('Connection failed');
      expect(ErrorCategorizer.categorizeError(error)).toBe('network');
    });

    test('should categorize rate limit errors', () => {
      const error = new RateLimitError('Rate limit exceeded');
      expect(ErrorCategorizer.categorizeError(error)).toBe('rate_limiting');
    });

    test('should categorize validation errors', () => {
      const error = new ValidationError('Invalid input');
      expect(ErrorCategorizer.categorizeError(error)).toBe('validation');
    });

    test('should handle unknown error codes', () => {
      const error = new ValidationError('Unknown error', {}, 'test-id');
      (error as any).code = 'UNKNOWN_ERROR';
      expect(ErrorCategorizer.categorizeError(error)).toBe('internal_system');
    });

    test('should categorize errors by status code when code is unknown', () => {
      const error = new ValidationError('Auth failed', {}, 'test-id');
      (error as any).code = 'CUSTOM_AUTH_ERROR';
      (error as any).statusCode = 401;
      expect(ErrorCategorizer.categorizeError(error)).toBe('authentication');
    });
  });

  describe('generateRecoveryStrategy', () => {
    test('should generate retry strategy for network errors', () => {
      const strategy = ErrorCategorizer.generateRecoveryStrategy('network', 'medium', 503);
      
      expect(strategy.retryable).toBe(true);
      expect(strategy.maxRetries).toBeGreaterThan(0);
      expect(strategy.retryDelay).toBeGreaterThan(0);
      expect(strategy.fallbackAvailable).toBe(true);
    });

    test('should generate non-retry strategy for authentication errors', () => {
      const strategy = ErrorCategorizer.generateRecoveryStrategy('authentication', 'high', 401);
      
      expect(strategy.retryable).toBe(false);
      expect(strategy.fallbackAvailable).toBe(false);
    });

    test('should generate circuit breaker trigger for critical errors', () => {
      const strategy = ErrorCategorizer.generateRecoveryStrategy('infrastructure', 'critical', 500);
      
      expect(strategy.circuitBreakerTriggered).toBe(true);
    });

    test('should generate appropriate retry delays based on severity', () => {
      const lowSeverity = ErrorCategorizer.generateRecoveryStrategy('network', 'low', 408);
      const highSeverity = ErrorCategorizer.generateRecoveryStrategy('external_service', 'high', 502);
      
      expect(lowSeverity.retryDelay).toBeLessThan(highSeverity.retryDelay!);
    });
  });

  describe('generateUserActions', () => {
    test('should generate appropriate actions for authentication errors', () => {
      const actions = ErrorCategorizer.generateUserActions('authentication', 'high');
      
      expect(actions.primary).toContain('sign in');
      expect(actions.escalation).toContain('support');
    });

    test('should generate retry actions for network errors', () => {
      const actions = ErrorCategorizer.generateUserActions('network', 'medium');
      
      expect(actions.primary.toLowerCase()).toContain('try again');
      expect(actions.preventive).toContain('Check your internet connection');
    });

    test('should generate validation-specific actions', () => {
      const actions = ErrorCategorizer.generateUserActions('validation', 'medium');
      
      expect(actions.primary.toLowerCase()).toContain('correct');
      expect(actions.alternatives).toContain('Check the format of your input');
    });

    test('should generate escalation for critical errors', () => {
      const actions = ErrorCategorizer.generateUserActions('infrastructure', 'critical');
      
      expect(actions.escalation).toContain('immediately');
    });
  });
});

describe('EnhancedError', () => {
  class TestEnhancedError extends EnhancedError {
    readonly code = 'TEST_ERROR';
    readonly statusCode = 500;
  }

  test('should create enhanced error with all properties', () => {
    const context = MockFactory.createErrorContext();
    const recovery = MockFactory.createErrorRecoveryStrategy();
    const userActions = MockFactory.createUserActionRecommendation();

    const error = new TestEnhancedError(
      'Technical message',
      'User-friendly message',
      'network',
      'medium',
      recovery,
      userActions,
      context,
      { detail: 'test' },
      ['test-tag'],
      'correlation-123'
    );

    expect(error.message).toBe('Technical message');
    expect(error.userMessage).toBe('User-friendly message');
    expect(error.category).toBe('network');
    expect(error.severity).toBe('medium');
    expect(error.enhancedContext).toEqual(context);
    expect(error.recovery).toEqual(recovery);
    expect(error.userActions).toEqual(userActions);
    expect(error.tags).toContain('test-tag');
    expect(error.correlationId).toBe('correlation-123');
  });

  test('should generate enhanced info correctly', () => {
    const context = MockFactory.createErrorContext();
    const recovery = MockFactory.createErrorRecoveryStrategy();
    const userActions = MockFactory.createUserActionRecommendation();

    const error = new TestEnhancedError(
      'Technical message',
      'User message',
      'storage',
      'high',
      recovery,
      userActions,
      context
    );

    const info = error.getEnhancedInfo();

    expect(info.code).toBe('TEST_ERROR');
    expect(info.category).toBe('storage');
    expect(info.severity).toBe('high');
    expect(info.message).toBe('Technical message');
    expect(info.userMessage).toBe('User message');
    expect(info.statusCode).toBe(500);
    expect(info.context).toEqual(context);
    expect(info.recovery).toEqual(recovery);
    expect(info.userActions).toEqual(userActions);
  });

  test('should determine circuit breaker trigger correctly', () => {
    const recovery = MockFactory.createErrorRecoveryStrategy({ circuitBreakerTriggered: true });
    const userActions = MockFactory.createUserActionRecommendation();

    const error = new TestEnhancedError(
      'Test',
      'Test',
      'infrastructure',
      'critical',
      recovery,
      userActions
    );

    expect(error.shouldTriggerCircuitBreaker()).toBe(true);
  });

  test('should provide retry information', () => {
    const recovery = MockFactory.createErrorRecoveryStrategy({
      retryable: true,
      retryDelay: 2000,
      maxRetries: 5
    });
    const userActions = MockFactory.createUserActionRecommendation();

    const error = new TestEnhancedError(
      'Test',
      'Test',
      'external_service',
      'medium',
      recovery,
      userActions
    );

    const retryInfo = error.getRetryInfo();
    expect(retryInfo.canRetry).toBe(true);
    expect(retryInfo.delay).toBe(2000);
    expect(retryInfo.maxAttempts).toBe(5);
  });

  test('should check fallback availability', () => {
    const recoveryWithFallback = MockFactory.createErrorRecoveryStrategy({ fallbackAvailable: true });
    const recoveryWithoutFallback = MockFactory.createErrorRecoveryStrategy({ fallbackAvailable: false });
    const userActions = MockFactory.createUserActionRecommendation();

    const errorWithFallback = new TestEnhancedError(
      'Test', 'Test', 'processing', 'medium', recoveryWithFallback, userActions
    );

    const errorWithoutFallback = new TestEnhancedError(
      'Test', 'Test', 'authentication', 'high', recoveryWithoutFallback, userActions
    );

    expect(errorWithFallback.hasFallback()).toBe(true);
    expect(errorWithoutFallback.hasFallback()).toBe(false);
  });

  test('should serialize to JSON correctly', () => {
    const context = MockFactory.createErrorContext();
    const recovery = MockFactory.createErrorRecoveryStrategy();
    const userActions = MockFactory.createUserActionRecommendation();

    const error = new TestEnhancedError(
      'Technical',
      'User',
      'validation',
      'low',
      recovery,
      userActions,
      context
    );

    const json = error.toJSON();
    
    expect(json.code).toBe('TEST_ERROR');
    expect(json.category).toBe('validation');
    expect(json.severity).toBe('low');
    expect(json.message).toBe('Technical');
    expect(json.userMessage).toBe('User');
    expect(json.statusCode).toBe(500);
  });
});

describe('Error Integration Tests', () => {
  test('should handle complete error lifecycle', () => {
    // Simulate a real error scenario
    const networkError = ErrorSimulator.createNetworkError(503, 'Service unavailable');
    
    // Categorize the error
    const category = ErrorCategorizer.categorizeError(networkError as BaseStorageError);
    const severity = ErrorCategorizer.determineSeverity(503, category);
    const recovery = ErrorCategorizer.generateRecoveryStrategy(category, severity, 503);
    const userActions = ErrorCategorizer.generateUserActions(category, severity);

    expect(category).toBe('network');
    expect(severity).toBe('critical');
    expect(recovery.retryable).toBe(true);
    expect(recovery.fallbackAvailable).toBe(true);
    expect(userActions.primary).toContain('Try again');
  });

  test('should handle authentication error workflow', () => {
    const authError = ErrorSimulator.createAuthenticationError();
    
    const category = ErrorCategorizer.categorizeError(authError as BaseStorageError);
    const severity = ErrorCategorizer.determineSeverity(401, category);
    const recovery = ErrorCategorizer.generateRecoveryStrategy(category, severity, 401);
    const userActions = ErrorCategorizer.generateUserActions(category, severity);

    expect(category).toBe('authentication');
    expect(severity).toBe('high');
    expect(recovery.retryable).toBe(false);
    expect(recovery.fallbackAvailable).toBe(false);
    expect(userActions.primary).toContain('sign in');
  });

  test('should handle validation error workflow', () => {
    const validationError = ErrorSimulator.createValidationError('email', 'invalid-email');
    
    const category = ErrorCategorizer.categorizeError(validationError as BaseStorageError);
    const severity = ErrorCategorizer.determineSeverity(400, category);
    const recovery = ErrorCategorizer.generateRecoveryStrategy(category, severity, 400);
    const userActions = ErrorCategorizer.generateUserActions(category, severity);

    expect(category).toBe('validation');
    expect(severity).toBe('medium');
    expect(recovery.retryable).toBe(false);
    expect(recovery.fallbackAvailable).toBe(false);
    expect(userActions.primary).toContain('correct');
  });
});

describe('Error Context Handling', () => {
  test('should preserve error context through categorization', () => {
    const context = MockFactory.createErrorContext({
      requestId: 'test-request-456',
      operation: 'file-upload',
      component: 'blob-manager'
    });

    TestHelpers.expectValidErrorContext(context);
    expect(context.requestId).toBe('test-request-456');
    expect(context.operation).toBe('file-upload');
    expect(context.component).toBe('blob-manager');
  });

  test('should handle context metadata correctly', () => {
    const context = MockFactory.createErrorContext({
      metadata: {
        fileSize: 1024,
        fileType: 'video/mp4',
        userTier: 'premium'
      }
    });

    expect(context.metadata).toHaveProperty('fileSize', 1024);
    expect(context.metadata).toHaveProperty('fileType', 'video/mp4');
    expect(context.metadata).toHaveProperty('userTier', 'premium');
  });
});

describe('Performance Tests', () => {
  test('error categorization should be performant', async () => {
    const errors = Array.from({ length: 1000 }, () => 
      ErrorSimulator.createNetworkError(Math.floor(Math.random() * 500) + 500)
    );

    const { duration } = await TestHelpers.measureExecutionTime(async () => {
      return errors.map(error => {
        const category = ErrorCategorizer.categorizeError(error as BaseStorageError);
        const severity = ErrorCategorizer.determineSeverity((error as any).status || 500, category);
        return { category, severity };
      });
    });

    // Should categorize 1000 errors in under 100ms
    expect(duration).toBeLessThan(100);
  });

  test('enhanced error creation should be efficient', async () => {
    class TestError extends EnhancedError {
      readonly code = 'PERF_TEST_ERROR';
      readonly statusCode = 500;
    }

    const { duration } = await TestHelpers.measureExecutionTime(async () => {
      return Array.from({ length: 100 }, () => {
        const context = MockFactory.createErrorContext();
        const recovery = MockFactory.createErrorRecoveryStrategy();
        const userActions = MockFactory.createUserActionRecommendation();

        return new TestError(
          'Performance test error',
          'Test error for performance',
          'testing' as ErrorCategory,
          'medium',
          recovery,
          userActions,
          context
        );
      });
    });

    // Should create 100 enhanced errors in under 50ms
    expect(duration).toBeLessThan(50);
  });
}); 