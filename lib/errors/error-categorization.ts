// Comprehensive Error Categorization Schema for Pitch Perfect Application
// Extends existing BaseStorageError and OpenAIError patterns

import { BaseStorageError } from './types';
import { OpenAIError } from '../openai-errors';

/**
 * Error Severity Levels
 * 
 * CRITICAL: System failure, complete service unavailability
 * HIGH: Major functionality broken, user experience severely impacted  
 * MEDIUM: Partial functionality issues, degraded user experience
 * LOW: Minor issues, warnings, or informational messages
 * INFO: Informational messages, not actual errors
 */
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Error Categories
 * 
 * Categorizes errors by their origin and nature for better handling
 */
export type ErrorCategory = 
  | 'authentication'      // API keys, auth tokens, permissions
  | 'authorization'       // Access control, role-based permissions
  | 'validation'          // Input validation, data format errors
  | 'network'            // Connectivity, timeouts, DNS issues
  | 'storage'            // File operations, blob storage, quota
  | 'processing'         // AI processing, video/audio conversion
  | 'rate_limiting'      // Rate limits, quota exceeded
  | 'configuration'      // System config, environment setup
  | 'user_input'         // User-caused errors (bad input, file type)
  | 'external_service'   // Third-party API failures (OpenAI, etc.)
  | 'internal_system'    // Internal bugs, unexpected conditions
  | 'security'           // Security violations, suspicious activity
  | 'business_logic'     // Application rule violations
  | 'infrastructure';    // Server, deployment, hosting issues

/**
 * Error Context
 * 
 * Additional context information for error analysis and debugging
 */
export interface ErrorContext {
  // Request identification
  requestId?: string;
  sessionId?: string;
  userId?: string;
  
  // Technical context
  component?: string;
  operation?: string;
  endpoint?: string;
  method?: string;
  
  // User context
  userAgent?: string;
  ipAddress?: string;
  
  // Application state
  retryCount?: number;
  previousErrors?: string[];
  
  // Recovery information
  fallbackUsed?: boolean;
  recoveryStrategy?: string;
  
  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * User Action Recommendation
 * 
 * Specific actions users can take to resolve or work around errors
 */
export interface UserActionRecommendation {
  primary: string;           // Main suggested action
  alternatives?: string[];   // Alternative actions user can try
  preventive?: string[];     // Actions to prevent future occurrences
  escalation?: string;       // When to contact support
}

/**
 * Error Recovery Strategy
 * 
 * Technical recovery options for the system
 */
export interface ErrorRecoveryStrategy {
  retryable: boolean;           // Can this error be retried?
  retryDelay?: number;          // Suggested retry delay in ms
  maxRetries?: number;          // Maximum retry attempts
  fallbackAvailable: boolean;   // Is there a fallback option?
  fallbackDescription?: string; // Description of fallback
  circuitBreakerTriggered?: boolean; // Should circuit breaker activate?
}

/**
 * Enhanced Error Information
 * 
 * Comprehensive error details that combine technical and user-facing information
 */
export interface EnhancedErrorInfo {
  // Core identification
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  
  // Messages
  message: string;           // Technical message for developers
  userMessage: string;       // User-friendly message
  
  // Context and details
  context: ErrorContext;
  details?: Record<string, unknown>;
  
  // Timestamps and tracking
  timestamp: string;
  statusCode: number;
  
  // Recovery and actions
  recovery: ErrorRecoveryStrategy;
  userActions: UserActionRecommendation;
  
  // Monitoring and analytics
  tags?: string[];           // For categorization and filtering
  correlationId?: string;    // For tracking related errors
}

/**
 * Base Enhanced Error Class
 * 
 * Extended error class that implements the comprehensive categorization schema
 */
export abstract class EnhancedError extends BaseStorageError {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly userMessage: string;
  public readonly enhancedContext: ErrorContext;
  public readonly recovery: ErrorRecoveryStrategy;
  public readonly userActions: UserActionRecommendation;
  public readonly tags: string[];
  public readonly correlationId?: string;

  constructor(
    message: string,
    userMessage: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    recovery: ErrorRecoveryStrategy,
    userActions: UserActionRecommendation,
    context: ErrorContext = {},
    details?: Record<string, unknown>,
    tags: string[] = [],
    correlationId?: string
  ) {
    super(message, details, context.requestId);
    
    this.userMessage = userMessage;
    this.category = category;
    this.severity = severity;
    this.enhancedContext = context;
    this.recovery = recovery;
    this.userActions = userActions;
    this.tags = tags;
    this.correlationId = correlationId;
  }

  /**
   * Get comprehensive error information
   */
  getEnhancedInfo(): EnhancedErrorInfo {
    return {
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      context: this.enhancedContext,
      details: this.details,
      timestamp: this.timestamp,
      statusCode: this.statusCode,
      recovery: this.recovery,
      userActions: this.userActions,
      tags: this.tags,
      correlationId: this.correlationId
    };
  }

  /**
   * Check if error should trigger circuit breaker
   */
  shouldTriggerCircuitBreaker(): boolean {
    return this.recovery.circuitBreakerTriggered === true;
  }

  /**
   * Get retry information
   */
  getRetryInfo(): { canRetry: boolean; delay?: number; maxAttempts?: number } {
    return {
      canRetry: this.recovery.retryable,
      delay: this.recovery.retryDelay,
      maxAttempts: this.recovery.maxRetries
    };
  }

  /**
   * Check if fallback is available
   */
  hasFallback(): boolean {
    return this.recovery.fallbackAvailable;
  }

  /**
   * Extended JSON representation
   */
  toJSON(): EnhancedErrorInfo {
    return this.getEnhancedInfo();
  }
}

/**
 * Error Categorization Utilities
 */
export class ErrorCategorizer {
  /**
   * Determine severity based on status code and category
   */
  static determineSeverity(statusCode: number, category: ErrorCategory): ErrorSeverity {
    // Critical errors - system failures
    if (statusCode >= 500 && ['infrastructure', 'internal_system', 'configuration'].includes(category)) {
      return 'critical';
    }
    
    // High severity - major functionality broken
    if (statusCode >= 500 || category === 'external_service' || category === 'security') {
      return 'high';
    }
    
    // Medium severity - partial functionality issues
    if (statusCode >= 400 && statusCode < 500) {
      if (['authentication', 'authorization', 'validation'].includes(category)) {
        return 'medium';
      }
    }
    
    // Low severity - minor issues
    if (statusCode < 400 || category === 'user_input') {
      return 'low';
    }
    
    // Default to medium
    return 'medium';
  }

  /**
   * Categorize error based on existing error types
   */
  static categorizeError(error: BaseStorageError | OpenAIError): ErrorCategory {
    const code = error.code;
    
    // Authentication/Authorization
    if (code.includes('AUTH') || code.includes('API_KEY') || code.includes('TOKEN')) {
      return 'authentication';
    }
    
    // Validation
    if (code.includes('VALIDATION') || code.includes('INVALID') || code.includes('MISSING_PARAMETER')) {
      return 'validation';
    }
    
    // Network
    if (code.includes('NETWORK') || code.includes('TIMEOUT') || code.includes('CONNECTION')) {
      return 'network';
    }
    
    // Storage
    if (code.includes('BLOB') || code.includes('STORAGE') || code.includes('UPLOAD') || code.includes('FILE')) {
      return 'storage';
    }
    
    // Processing
    if (code.includes('PROCESSING') || code.includes('OPENAI') || code.includes('MODEL')) {
      return 'processing';
    }
    
    // Rate limiting
    if (code.includes('RATE_LIMIT') || code.includes('QUOTA')) {
      return 'rate_limiting';
    }
    
    // Configuration
    if (code.includes('CONFIGURATION') || code.includes('CONFIG')) {
      return 'configuration';
    }
    
    // Security
    if (code.includes('SECURITY') || code.includes('SUSPICIOUS')) {
      return 'security';
    }
    
    // Default to internal system
    return 'internal_system';
  }

  /**
   * Generate default recovery strategy based on category and severity
   */
  static generateRecoveryStrategy(
    category: ErrorCategory, 
    severity: ErrorSeverity,
    statusCode: number
  ): ErrorRecoveryStrategy {
    const baseStrategy: ErrorRecoveryStrategy = {
      retryable: false,
      fallbackAvailable: false,
    };

    // Retryable errors
    if (['network', 'external_service', 'rate_limiting'].includes(category)) {
      baseStrategy.retryable = true;
      baseStrategy.retryDelay = category === 'rate_limiting' ? 60000 : 1000;
      baseStrategy.maxRetries = 3;
    }

    // Fallback availability
    if (['processing', 'external_service'].includes(category)) {
      baseStrategy.fallbackAvailable = true;
      baseStrategy.fallbackDescription = 'Alternative processing method available';
    }

    // Circuit breaker triggers
    if (severity === 'critical' || (severity === 'high' && category === 'external_service')) {
      baseStrategy.circuitBreakerTriggered = true;
    }

    return baseStrategy;
  }

  /**
   * Generate user action recommendations
   */
  static generateUserActions(
    category: ErrorCategory,
    severity: ErrorSeverity
  ): UserActionRecommendation {
    const actions: UserActionRecommendation = {
      primary: 'Please try again later'
    };

    switch (category) {
      case 'user_input':
      case 'validation':
        actions.primary = 'Please check your input and try again';
        actions.alternatives = ['Verify file format and size requirements'];
        actions.preventive = ['Review upload guidelines before submitting'];
        break;

      case 'network':
        actions.primary = 'Check your internet connection and try again';
        actions.alternatives = ['Refresh the page', 'Try again in a few minutes'];
        break;

      case 'rate_limiting':
        actions.primary = 'Please wait a moment before trying again';
        actions.alternatives = ['Reduce the frequency of requests'];
        break;

      case 'authentication':
        actions.primary = 'Please refresh the page and try again';
        actions.escalation = 'Contact support if the problem persists';
        break;

      case 'external_service':
      case 'processing':
        actions.primary = 'Please try again in a few minutes';
        actions.alternatives = ['Try with a different file or smaller size'];
        break;

      case 'security':
        actions.primary = 'This action has been blocked for security reasons';
        actions.escalation = 'Contact support if you believe this is an error';
        break;

      default:
        if (severity === 'critical') {
          actions.primary = 'Service is temporarily unavailable';
          actions.escalation = 'Please contact support';
        }
    }

    return actions;
  }
}

/**
 * Error Classification Presets
 * 
 * Pre-defined error classifications for common scenarios
 */
export const ERROR_CLASSIFICATIONS = {
  // Authentication errors
  INVALID_API_KEY: {
    category: 'authentication' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    recovery: {
      retryable: false,
      fallbackAvailable: false,
    },
    userActions: {
      primary: 'Authentication failed - please refresh and try again',
      escalation: 'Contact support if the problem persists'
    }
  },

  // File validation errors
  INVALID_FILE_TYPE: {
    category: 'user_input' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
    recovery: {
      retryable: false,
      fallbackAvailable: false,
    },
    userActions: {
      primary: 'Please select a supported file type',
      alternatives: ['Check the list of supported formats'],
      preventive: ['Review file requirements before uploading']
    }
  },

  // Network errors
  NETWORK_TIMEOUT: {
    category: 'network' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    recovery: {
      retryable: true,
      retryDelay: 2000,
      maxRetries: 3,
      fallbackAvailable: false,
    },
    userActions: {
      primary: 'Connection timed out - please try again',
      alternatives: ['Check your internet connection', 'Try again in a few minutes']
    }
  },

  // Processing errors
  AI_SERVICE_UNAVAILABLE: {
    category: 'external_service' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    recovery: {
      retryable: true,
      retryDelay: 5000,
      maxRetries: 2,
      fallbackAvailable: true,
      fallbackDescription: 'Basic analysis available',
      circuitBreakerTriggered: true,
    },
    userActions: {
      primary: 'AI service is temporarily unavailable',
      alternatives: ['Try with basic analysis mode', 'Try again in a few minutes']
    }
  },

  // Rate limiting
  RATE_LIMIT_EXCEEDED: {
    category: 'rate_limiting' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    recovery: {
      retryable: true,
      retryDelay: 60000,
      maxRetries: 1,
      fallbackAvailable: false,
    },
    userActions: {
      primary: 'Too many requests - please wait before trying again',
      preventive: ['Space out your requests to avoid rate limiting']
    }
  }
} as const;

export default ErrorCategorizer; 