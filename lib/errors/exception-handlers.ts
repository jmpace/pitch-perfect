// Exception Handling Mechanisms for Different Application Layers
// Builds on the existing error categorization and message templates

import { NextRequest, NextResponse } from 'next/server';
import { 
  BaseStorageError, 
  isStorageError,
  InternalServerError 
} from './types';
import { 
  generateRequestId,
  createErrorResponse,
  normalizeError,
  logError,
  withErrorHandling as baseWithErrorHandling
} from './handlers';
import { 
  ErrorCategorizer,
  type ErrorCategory,
  type ErrorSeverity,
  type ErrorRecoveryStrategy,
  type UserActionRecommendation,
  type ErrorContext
} from './error-categorization';
import { MessageGenerator } from './message-templates';

// ===========================
// LAYER IDENTIFICATION
// ===========================

export enum ApplicationLayer {
  UI = 'ui',
  API = 'api', 
  BUSINESS_LOGIC = 'business_logic',
  DATA_ACCESS = 'data_access',
  EXTERNAL_SERVICE = 'external_service',
  MIDDLEWARE = 'middleware'
}

// ===========================
// EXCEPTION CONTEXT
// ===========================

export interface ExceptionContext extends Record<string, unknown> {
  layer: ApplicationLayer;
  component?: string;
  operation?: string;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

// ===========================
// API LAYER EXCEPTION HANDLING
// ===========================

/**
 * Standardized API route exception handler
 * Ensures consistent error responses across all API endpoints
 */
export function withApiExceptionHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    const requestId = generateRequestId();
    const request = args[0] as NextRequest;
    
    try {
      return await handler(...args);
    } catch (error) {
      const context: ExceptionContext = {
        layer: ApplicationLayer.API,
        requestId,
        operation: `${request.method} ${request.nextUrl.pathname}`,
        metadata: {
          userAgent: request.headers.get('user-agent'),
          origin: request.headers.get('origin'),
          contentType: request.headers.get('content-type')
        }
      };

      const processedError = processException(error, context);
      logError(processedError, context);
      
      return createErrorResponse(processedError);
    }
  };
}

/**
 * Decorator for API route handlers (Next.js App Router)
 */
export function apiExceptionHandler<T extends any[]>(
  target: any,
  propertyName: string,
  descriptor: TypedPropertyDescriptor<(...args: T) => Promise<NextResponse>>
) {
  const method = descriptor.value!;
  descriptor.value = withApiExceptionHandling(method);
  return descriptor;
}

// ===========================
// BUSINESS LOGIC LAYER EXCEPTION HANDLING
// ===========================

/**
 * Business logic exception handler
 * Catches domain-specific errors and transforms them appropriately
 */
export function withBusinessLogicExceptionHandling<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  context: Partial<ExceptionContext> = {}
) {
  return async (...args: T): Promise<R> => {
    const requestId = context.requestId || generateRequestId();
    
    try {
      return await operation(...args);
    } catch (error) {
      const fullContext: ExceptionContext = {
        layer: ApplicationLayer.BUSINESS_LOGIC,
        requestId,
        component: context.component,
        operation: context.operation,
        metadata: context.metadata
      };

      const processedError = processException(error, fullContext);
      logError(processedError, fullContext);
      
      throw processedError;
    }
  };
}

/**
 * Class decorator for business logic services
 */
export function BusinessLogicExceptionHandling(target: any) {
  const propertyNames = Object.getOwnPropertyNames(target.prototype);
  
  propertyNames.forEach(propertyName => {
    const descriptor = Object.getOwnPropertyDescriptor(target.prototype, propertyName);
    if (descriptor && typeof descriptor.value === 'function' && propertyName !== 'constructor') {
      const originalMethod = descriptor.value;
      
      descriptor.value = function (...args: any[]) {
        const context: Partial<ExceptionContext> = {
          component: target.name,
          operation: propertyName
        };
        
        if (originalMethod.constructor.name === 'AsyncFunction') {
          return withBusinessLogicExceptionHandling(originalMethod.bind(this), context)(...args);
        } else {
          try {
            return originalMethod.apply(this, args);
          } catch (error) {
            const fullContext: ExceptionContext = {
              layer: ApplicationLayer.BUSINESS_LOGIC,
              requestId: generateRequestId(),
              component: target.name,
              operation: propertyName
            };
            
            const processedError = processException(error, fullContext);
            logError(processedError, fullContext);
            throw processedError;
          }
        }
      };
      
      Object.defineProperty(target.prototype, propertyName, descriptor);
    }
  });
  
  return target;
}

// ===========================
// DATA ACCESS LAYER EXCEPTION HANDLING
// ===========================

/**
 * Data access exception handler
 * Handles database, file system, and external storage errors
 */
export function withDataAccessExceptionHandling<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  context: Partial<ExceptionContext> = {}
) {
  return async (...args: T): Promise<R> => {
    const requestId = context.requestId || generateRequestId();
    
    try {
      return await operation(...args);
    } catch (error) {
      const fullContext: ExceptionContext = {
        layer: ApplicationLayer.DATA_ACCESS,
        requestId,
        component: context.component,
        operation: context.operation,
        metadata: context.metadata
      };

      const processedError = processException(error, fullContext);
      logError(processedError, fullContext);
      
      throw processedError;
    }
  };
}

// ===========================
// EXTERNAL SERVICE EXCEPTION HANDLING  
// ===========================

/**
 * External service exception handler
 * Handles API calls, webhooks, and third-party service errors
 */
export function withExternalServiceExceptionHandling<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  serviceName: string,
  context: Partial<ExceptionContext> = {}
) {
  return async (...args: T): Promise<R> => {
    const requestId = context.requestId || generateRequestId();
    
    try {
      return await operation(...args);
    } catch (error) {
      const fullContext: ExceptionContext = {
        layer: ApplicationLayer.EXTERNAL_SERVICE,
        requestId,
        component: serviceName,
        operation: context.operation,
        metadata: {
          ...context.metadata,
          serviceName
        }
      };

      const processedError = processException(error, fullContext);
      logError(processedError, fullContext);
      
      throw processedError;
    }
  };
}

// ===========================
// MIDDLEWARE EXCEPTION HANDLING
// ===========================

/**
 * Middleware exception handler
 * Handles authentication, validation, and request processing errors
 */
export function withMiddlewareExceptionHandling<T extends any[], R>(
  middleware: (...args: T) => Promise<R>,
  middlewareName: string,
  context: Partial<ExceptionContext> = {}
) {
  return async (...args: T): Promise<R> => {
    const requestId = context.requestId || generateRequestId();
    
    try {
      return await middleware(...args);
    } catch (error) {
      const fullContext: ExceptionContext = {
        layer: ApplicationLayer.MIDDLEWARE,
        requestId,
        component: middlewareName,
        operation: context.operation,
        metadata: context.metadata
      };

      const processedError = processException(error, fullContext);
      logError(processedError, fullContext);
      
      throw processedError;
    }
  };
}

// ===========================
// CORE EXCEPTION PROCESSING
// ===========================

/**
 * Process and enhance exceptions with context and categorization
 */
export function processException(error: unknown, context: ExceptionContext): BaseStorageError {
  // Normalize to BaseStorageError
  let processedError = isStorageError(error) 
    ? error 
    : normalizeError(error, context.requestId || generateRequestId());

  // Enhance with layer-specific context
  const enhancedDetails = {
    ...processedError.details,
    layer: context.layer,
    component: context.component,
    operation: context.operation,
    metadata: context.metadata
  };

  // Apply error categorization using static methods
  const category = ErrorCategorizer.categorizeError(processedError);
  const severity = ErrorCategorizer.determineSeverity(processedError.statusCode, category);
  const recovery = ErrorCategorizer.generateRecoveryStrategy(category, severity, processedError.statusCode);
  const userActions = ErrorCategorizer.generateUserActions(category, severity);

  // Create enhanced error with categorization
  const enhancedError = new (processedError.constructor as any)(
    processedError.message,
    {
      ...enhancedDetails,
      category,
      severity,
      recovery,
      userActions,
      layer: context.layer
    },
    context.requestId
  );

  return enhancedError;
}

// ===========================
// ERROR BOUNDARY HELPERS (for React components)
// ===========================

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: {
    componentStack: string;
  };
  errorId?: string;
}

export function processUIError(error: Error, errorInfo: any): {
  processedError: BaseStorageError;
  errorId: string;
} {
  const errorId = generateRequestId();
  
  const context: ExceptionContext = {
    layer: ApplicationLayer.UI,
    requestId: errorId,
    component: 'ErrorBoundary',
    operation: 'componentDidCatch',
    metadata: {
      componentStack: errorInfo?.componentStack,
      errorBoundary: true
    }
  };

  const processedError = processException(error, context);
  logError(processedError, context);

  return { processedError, errorId };
}

/**
 * Generate user-friendly error message for UI display
 */
export function generateUIErrorMessage(error: BaseStorageError): {
  title: string;
  message: string;
  actions: Array<{ label: string; action: string }>;
} {
  const messageGenerator = new MessageGenerator();
  
  // Safely extract properties with proper type checking
  const details = error.details || {};
  
  // Validate and cast category
  const validCategories: ErrorCategory[] = [
    'authentication', 'authorization', 'validation', 'network', 'storage', 
    'processing', 'rate_limiting', 'configuration', 'user_input', 'external_service',
    'internal_system', 'security', 'business_logic', 'infrastructure'
  ];
  const category: ErrorCategory = (typeof details.category === 'string' && validCategories.includes(details.category as ErrorCategory)) 
    ? details.category as ErrorCategory 
    : 'internal_system';
  
  // Validate and cast severity
  const validSeverities: ErrorSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const severity: ErrorSeverity = (typeof details.severity === 'string' && validSeverities.includes(details.severity as ErrorSeverity))
    ? details.severity as ErrorSeverity
    : 'medium';
    
  const userMessage = (typeof details.userMessage === 'string' && details.userMessage) || error.message;
  const recovery = (typeof details.recovery === 'object' && details.recovery) || { 
    retryable: false, 
    fallbackAvailable: false 
  };
  const userActions = (typeof details.userActions === 'object' && details.userActions) || { primary: 'Please try again' };
  
  // Create EnhancedErrorInfo structure for message generation
  const errorInfo = {
    code: error.code,
    category,
    severity,
    message: error.message,
    userMessage,
    context: (details.metadata as Record<string, unknown>) || {},
    details,
    timestamp: error.timestamp,
    statusCode: error.statusCode,
    recovery: recovery as ErrorRecoveryStrategy,
    userActions: userActions as UserActionRecommendation,
    tags: [],
    correlationId: error.requestId
  };

  const errorMessage = messageGenerator.generateMessage(errorInfo, {
    // Extract relevant context for message generation
    fileName: details.fileName as string,
    operation: details.operation as string,
    component: details.component as string
  });

  return {
    title: errorMessage.title,
    message: errorMessage.description,
    actions: [
      { label: 'Refresh Page', action: 'refresh' },
      { label: 'Go Home', action: 'home' },
      ...(errorMessage.ui.showRetry ? [{ label: 'Try Again', action: 'retry' }] : [])
    ]
  };
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

/**
 * Create a safe error object for client-side consumption
 */
export function createSafeErrorObject(error: BaseStorageError): {
  code: string;
  message: string;
  userMessage: string;
  actions: string[];
  retryable: boolean;
  requestId: string;
} {
  const details = error.details || {};
  const userActions = details.userActions;
  const recovery = details.recovery;
  
  // Safely extract alternatives array
  let actions: string[] = [];
  if (userActions && typeof userActions === 'object' && 'alternatives' in userActions) {
    const alternatives = (userActions as any).alternatives;
    if (Array.isArray(alternatives)) {
      actions = alternatives.filter(item => typeof item === 'string');
    }
  }
  
  // Safely extract retryable boolean
  let retryable = false;
  if (recovery && typeof recovery === 'object' && 'retryable' in recovery) {
    retryable = Boolean((recovery as any).retryable);
  }
  
  return {
    code: error.code,
    message: error.message,
    userMessage: (typeof details.userMessage === 'string' && details.userMessage) || error.message,
    actions,
    retryable,
    requestId: error.requestId || generateRequestId()
  };
}

/**
 * Enhanced error logging with layer context
 */
export function logLayerError(error: BaseStorageError, context: ExceptionContext): void {
  const logData = {
    level: 'error',
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
    layer: context.layer,
    component: context.component,
    operation: context.operation,
    errorCode: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    metadata: context.metadata,
    stack: error.stack
  };

  console.error(`[${context.layer.toUpperCase()} Layer] Exception:`, JSON.stringify(logData, null, 2));
  
  // In production, send to logging service
  // await sendToLoggingService(logData);
} 