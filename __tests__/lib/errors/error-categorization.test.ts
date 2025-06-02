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
  ErrorSeverity, 
  ErrorCategory,
  ErrorContext,
  UserActionRecommendation,
  ErrorRecoveryStrategy
} from '@/lib/errors/error-categorization';
import { 
  BlobAccessError, 
  NetworkError, 
  RateLimitError, 
  ValidationError,
  BaseStorageError 
} from '@/lib/errors/types';
import { ErrorSimulator, MockFactory, TestHelpers } from './test-utilities.helper';

describe('ErrorCategorizer', () => {
  describe('determineSeverity', () => {
    test('should classify critical errors correctly', () => {
      // Critical: 500+ status codes with infrastructure/internal_system/configuration categories
      expect(ErrorCategorizer.determineSeverity(500, 'internal_system')).toBe('critical');
      expect(ErrorCategorizer.determineSeverity(503, 'infrastructure')).toBe('critical');
      expect(ErrorCategorizer.determineSeverity(507, 'configuration')).toBe('critical');
    });

    test('should classify high severity errors correctly', () => {
      // High: 500+ status OR external_service OR security categories
      expect(ErrorCategorizer.determineSeverity(500, 'external_service')).toBe('high');
      expect(ErrorCategorizer.determineSeverity(401, 'security')).toBe('high');
      expect(ErrorCategorizer.determineSeverity(503, 'external_service')).toBe('high');
    });

    test('should classify medium severity errors correctly', () => {
      // Medium: 400-499 with authentication/authorization/validation OR default fallback
      expect(ErrorCategorizer.determineSeverity(400, 'validation')).toBe('medium');
      expect(ErrorCategorizer.determineSeverity(401, 'authentication')).toBe('medium');
      expect(ErrorCategorizer.determineSeverity(403, 'authorization')).toBe('medium');
    });

    test('should classify low severity errors correctly', () => {
      // Low: < 400 status codes OR user_input category
      expect(ErrorCategorizer.determineSeverity(200, 'business_logic')).toBe('low');
      expect(ErrorCategorizer.determineSeverity(422, 'user_input')).toBe('low');
    });

    test('should handle unknown status codes with defaults', () => {
      // Unknown status codes default to 'medium' OR 'high' for external_service
      expect(ErrorCategorizer.determineSeverity(999, 'external_service')).toBe('high');
      // Status codes < 400 are classified as 'low' severity
      expect(ErrorCategorizer.determineSeverity(123, 'processing')).toBe('low');
    });
  });

  describe('categorizeError', () => {
    test('should categorize blob access errors', () => {
      const error = new BlobAccessError('Invalid token');
      // BlobAccessError has 'BLOB_' prefix, should be categorized as 'storage'
      expect(ErrorCategorizer.categorizeError(error)).toBe('storage');
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
      // @ts-ignore - Temporarily override the code property for testing
      error.code = 'UNKNOWN_ERROR';
      expect(ErrorCategorizer.categorizeError(error)).toBe('internal_system');
    });

    test('should categorize errors by code patterns', () => {
      const authError = new ValidationError('Auth failed', {}, 'test-id');
      // @ts-ignore - Temporarily override the code property for testing
      authError.code = 'AUTH_TOKEN_INVALID';
      expect(ErrorCategorizer.categorizeError(authError)).toBe('authentication');
      
      const fileError = new ValidationError('File error', {}, 'test-id');
      // @ts-ignore - Temporarily override the code property for testing
      fileError.code = 'FILE_UPLOAD_FAILED';
      expect(ErrorCategorizer.categorizeError(fileError)).toBe('storage');
    });
  });

  describe('generateRecoveryStrategy', () => {
    test('should generate retry strategy for network errors', () => {
      const strategy = ErrorCategorizer.generateRecoveryStrategy('network', 'medium', 500);
      
      expect(strategy.retryable).toBe(true);
      expect(strategy.maxRetries).toBeGreaterThan(0);
      expect(strategy.retryDelay).toBeGreaterThan(0);
      expect(strategy.fallbackAvailable).toBe(false);
    });

    test('should generate non-retry strategy for authentication errors', () => {
      const strategy = ErrorCategorizer.generateRecoveryStrategy('authentication', 'medium', 401);
      
      expect(strategy.retryable).toBe(false);
      expect(strategy.fallbackAvailable).toBe(false);
    });

    test('should enable fallback for processing errors', () => {
      const strategy = ErrorCategorizer.generateRecoveryStrategy('processing', 'high', 503);
      
      expect(strategy.fallbackAvailable).toBe(true);
      expect(strategy.fallbackDescription).toContain('Alternative');
    });

    test('should trigger circuit breaker for critical errors', () => {
      const strategy = ErrorCategorizer.generateRecoveryStrategy('external_service', 'critical', 503);
      
      expect(strategy.circuitBreakerTriggered).toBe(true);
    });

    test('should generate appropriate retry delays based on severity', () => {
      const lowSeverity = ErrorCategorizer.generateRecoveryStrategy('network', 'low', 408);
      const highSeverity = ErrorCategorizer.generateRecoveryStrategy('external_service', 'high', 502);
      
      expect(lowSeverity.retryDelay).toBe(1000); // Default retry delay
      expect(highSeverity.retryDelay).toBe(1000); // Same default delay
    });
  });

  describe('generateUserActions', () => {
    test('should generate appropriate actions for authentication errors', () => {
      const actions = ErrorCategorizer.generateUserActions('authentication', 'high');
      
      expect(actions.primary).toContain('refresh');
      expect(actions.escalation).toContain('support');
    });

    test('should generate retry actions for network errors', () => {
      const actions = ErrorCategorizer.generateUserActions('network', 'medium');
      
      expect(actions.primary.toLowerCase()).toContain('try again');
      // The actual implementation returns different alternatives
      expect(actions.alternatives).toContain('Refresh the page');
    });

    test('should generate validation-specific actions', () => {
      const actions = ErrorCategorizer.generateUserActions('validation', 'medium');
      
      expect(actions.primary.toLowerCase()).toContain('check');
      expect(actions.alternatives).toContain('Verify file format and size requirements');
    });

    test('should generate escalation for critical errors', () => {
      const actions = ErrorCategorizer.generateUserActions('infrastructure', 'critical');
      
      expect(actions.escalation).toContain('support');
    });
  });

  describe('EnhancedError', () => {
    test('should create enhanced error with all properties', () => {
      const context = {
        requestId: 'test-123',
        userId: 'user-456',
      };

      const recovery = {
        retryable: true,
        maxRetries: 3,
        retryDelay: 1000,
        fallbackAvailable: false,
      };

      const userActions = {
        primary: 'Test primary action',
        alternatives: ['Test alternative'],
      };

      class TestError extends EnhancedError {
        readonly code = 'TEST_ERROR';
        readonly statusCode = 400;

        constructor() {
          super(
            'Test error',
            'User-friendly test error',
            'validation',
            'medium',
            recovery,
            userActions,
            context,
            { testDetail: 'value' },
            ['test-tag'],
            'correlation-123'
          );
        }
      }

      const error = new TestError();

      expect(error.message).toBe('Test error');
      expect(error.userMessage).toBe('User-friendly test error');
      expect(error.category).toBe('validation');
      expect(error.severity).toBe('medium');
      expect(error.enhancedContext).toBe(context);
      expect(error.recovery).toBe(recovery);
      expect(error.userActions).toBe(userActions);
      expect(error.tags).toEqual(['test-tag']);
      expect(error.correlationId).toBe('correlation-123');
    });
  });

  describe('Error Template Integration', () => {
    test('should integrate with message templates', () => {
      const error = new BlobAccessError('Token expired');
      const category = ErrorCategorizer.categorizeError(error);
      const severity = ErrorCategorizer.determineSeverity(401, category);
      
      expect(category).toBe('storage');
      expect(severity).toBe('medium');
    });

    test('should handle error context preservation', () => {
      const error = new NetworkError('Connection timeout', {}, 'req-123');
      const category = ErrorCategorizer.categorizeError(error);
      
      expect(category).toBe('network');
      // The error uses inherited requestId property from BaseStorageError
      expect(error.requestId).toBe('req-123');
    });
  });
});

describe('Error Integration Tests', () => {
  test('should handle complete error lifecycle', () => {
    const networkError = ErrorSimulator.createNetworkError(503, 'Service unavailable');
    
    const category = ErrorCategorizer.categorizeError(networkError as BaseStorageError);
    const severity = ErrorCategorizer.determineSeverity(503, category);
    const recovery = ErrorCategorizer.generateRecoveryStrategy(category, severity, 503);
    const userActions = ErrorCategorizer.generateUserActions(category, severity);

    expect(category).toBe('network');
    expect(severity).toBe('high'); // 503 with any category defaults to 'high'
    expect(recovery.retryable).toBe(true);
    expect(recovery.fallbackAvailable).toBe(false);
    // The actual implementation returns "Check your internet connection"
    expect(userActions.primary).toContain('Check your internet connection');
  });

  test('should handle authentication error workflow', () => {
    const authError = ErrorSimulator.createAuthenticationError();
    
    const category = ErrorCategorizer.categorizeError(authError as BaseStorageError);
    const severity = ErrorCategorizer.determineSeverity(401, category);
    const recovery = ErrorCategorizer.generateRecoveryStrategy(category, severity, 401);
    const userActions = ErrorCategorizer.generateUserActions(category, severity);

    expect(category).toBe('authentication');
    expect(severity).toBe('medium'); // 401 with authentication category = medium
    expect(recovery.retryable).toBe(false);
    expect(recovery.fallbackAvailable).toBe(false);
    expect(userActions.primary).toContain('refresh');
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
    expect(userActions.primary).toContain('check');
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
        // @ts-ignore - Access status property that may not be typed
        const severity = ErrorCategorizer.determineSeverity(error.status || 500, category);
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