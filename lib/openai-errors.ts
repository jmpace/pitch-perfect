import { BaseStorageError } from './errors/types';

export interface OpenAIErrorContext extends Record<string, unknown> {
  model?: string;
  endpoint?: string;
  retryCount?: number;
  originalRequest?: Record<string, unknown>;
  originalError?: any;
  rateLimitInfo?: {
    remainingRequests?: number;
    remainingTokens?: number;
    resetTime?: Date;
  };
}

export type OpenAIErrorCode = 
  | 'INVALID_API_KEY'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MODEL_DEPRECATED'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_OVERLOADED'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'INVALID_REQUEST_FORMAT'
  | 'CONTENT_POLICY_VIOLATION'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_OPENAI_ERROR';

export abstract class OpenAIError extends BaseStorageError {
  abstract readonly code: OpenAIErrorCode;
  abstract readonly statusCode: number;
  public readonly context: OpenAIErrorContext;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly suggestedAction: string;

  constructor(
    message: string,
    userMessage: string,
    suggestedAction: string,
    context: OpenAIErrorContext = {},
    retryable: boolean = false,
    requestId?: string
  ) {
    super(message, context, requestId);
    this.context = context;
    this.retryable = retryable;
    this.userMessage = userMessage;
    this.suggestedAction = suggestedAction;
  }

  static fromOpenAIResponse(error: any, requestId?: string): OpenAIError {
    const errorMessage = error?.message || error?.error?.message || 'Unknown OpenAI error';
    const errorCode = error?.code || error?.error?.code;
    const status = error?.status || error?.statusCode || 500;

    // Detect specific error patterns
    if (errorMessage.includes('deprecated')) {
      return new ModelDeprecatedError(errorMessage, {
        model: extractModelFromError(errorMessage),
        originalRequest: error?.request,
        originalError: error
      }, requestId);
    }

    if (errorMessage.includes('rate limit') || status === 429) {
      return new RateLimitExceededError(errorMessage, {
        rateLimitInfo: extractRateLimitInfo(error),
        originalError: error
      }, requestId);
    }

    if (errorMessage.includes('quota') || errorMessage.includes('insufficient_quota')) {
      return new QuotaExceededError(errorMessage, { originalError: error }, requestId);
    }

    if (errorMessage.includes('model') && errorMessage.includes('not found')) {
      return new ModelNotFoundError(errorMessage, {
        model: extractModelFromError(errorMessage),
        originalError: error
      }, requestId);
    }

    if (errorMessage.includes('overloaded') || errorMessage.includes('server_error')) {
      return new ModelOverloadedError(errorMessage, {
        model: extractModelFromError(errorMessage),
        originalError: error
      }, requestId);
    }

    if (errorMessage.includes('context length') || errorMessage.includes('maximum context')) {
      return new ContextLengthExceededError(errorMessage, { originalError: error }, requestId);
    }

    if (errorMessage.includes('api key') || errorMessage.includes('authentication') || status === 401) {
      return new InvalidAPIKeyError(errorMessage, { originalError: error }, requestId);
    }

    if (errorMessage.includes('content policy') || errorMessage.includes('unsafe')) {
      return new ContentPolicyViolationError(errorMessage, { originalError: error }, requestId);
    }

    if (status >= 500) {
      return new ServiceUnavailableError(errorMessage, { originalError: error }, requestId);
    }

    // Fallback for unknown errors
    return new UnknownOpenAIError(errorMessage, { originalError: error }, requestId);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      context: this.context,
      retryable: this.retryable,
      userMessage: this.userMessage,
      suggestedAction: this.suggestedAction
    };
  }
}

// Specific OpenAI Error Classes
export class ModelDeprecatedError extends OpenAIError {
  readonly code = 'MODEL_DEPRECATED';
  readonly statusCode = 400;

  constructor(message: string, context: OpenAIErrorContext = {}, requestId?: string) {
    super(
      message,
      'The AI model being used is no longer supported. We\'re automatically switching to a newer version.',
      'The system will retry with an updated model. No action needed.',
      context,
      true, // retryable with model fallback
      requestId
    );
  }
}

export class RateLimitExceededError extends OpenAIError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;

  constructor(message: string, context: OpenAIErrorContext = {}, requestId?: string) {
    super(
      message,
      'We\'re processing a high volume of requests. Your request will be processed shortly.',
      'Please wait a moment and try again. The system will automatically retry.',
      context,
      true, // retryable with backoff
      requestId
    );
  }
}

export class QuotaExceededError extends OpenAIError {
  readonly code = 'QUOTA_EXCEEDED';
  readonly statusCode = 402;

  constructor(message: string, context: OpenAIErrorContext = {}, requestId?: string) {
    super(
      message,
      'The AI service has reached its usage limit for this billing period.',
      'Please contact support to increase your service quota or try again later.',
      context,
      false, // not retryable without manual intervention
      requestId
    );
  }
}

export class ModelNotFoundError extends OpenAIError {
  readonly code = 'MODEL_NOT_FOUND';
  readonly statusCode = 404;

  constructor(message: string, context: OpenAIErrorContext = {}, requestId?: string) {
    super(
      message,
      'The requested AI model is not available. We\'re switching to an alternative.',
      'The system will automatically use a compatible model.',
      context,
      true, // retryable with different model
      requestId
    );
  }
}

export class ModelOverloadedError extends OpenAIError {
  readonly code = 'MODEL_OVERLOADED';
  readonly statusCode = 503;

  constructor(message: string, context: OpenAIErrorContext = {}, requestId?: string) {
    super(
      message,
      'The AI service is currently experiencing high demand. Retrying automatically.',
      'Please wait while we process your request. The system will retry automatically.',
      context,
      true, // retryable after delay
      requestId
    );
  }
}

export class ContextLengthExceededError extends OpenAIError {
  readonly code = 'CONTEXT_LENGTH_EXCEEDED';
  readonly statusCode = 400;

  constructor(message: string, context: OpenAIErrorContext = {}, requestId?: string) {
    super(
      message,
      'The content is too large to process in a single request.',
      'Try breaking down your content into smaller sections or reducing the input size.',
      context,
      false, // not retryable without content modification
      requestId
    );
  }
}

export class InvalidAPIKeyError extends OpenAIError {
  readonly code = 'INVALID_API_KEY';
  readonly statusCode = 401;

  constructor(message: string, context: OpenAIErrorContext = {}, requestId?: string) {
    super(
      message,
      'Authentication with the AI service failed.',
      'Please check your API configuration or contact support.',
      context,
      false, // not retryable without fixing auth
      requestId
    );
  }
}

export class ContentPolicyViolationError extends OpenAIError {
  readonly code = 'CONTENT_POLICY_VIOLATION';
  readonly statusCode = 400;

  constructor(message: string, context: OpenAIErrorContext = {}, requestId?: string) {
    super(
      message,
      'The content doesn\'t meet the AI service\'s usage policies.',
      'Please modify your content to comply with the service guidelines.',
      context,
      false, // not retryable without content modification
      requestId
    );
  }
}

export class ServiceUnavailableError extends OpenAIError {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly statusCode = 503;

  constructor(message: string, context: OpenAIErrorContext = {}, requestId?: string) {
    super(
      message,
      'The AI service is temporarily unavailable.',
      'Please try again in a few minutes. The system will retry automatically.',
      context,
      true, // retryable after delay
      requestId
    );
  }
}

export class UnknownOpenAIError extends OpenAIError {
  readonly code = 'UNKNOWN_OPENAI_ERROR';
  readonly statusCode = 500;

  constructor(message: string, context: OpenAIErrorContext = {}, requestId?: string) {
    super(
      message,
      'An unexpected error occurred while processing your request.',
      'Please try again. If the problem persists, contact support.',
      context,
      true, // retryable but may fail again
      requestId
    );
  }
}

// Utility functions for error parsing
function extractModelFromError(errorMessage: string): string | undefined {
  const modelMatch = errorMessage.match(/model[:\s]+[`'"]?([^`'".\s]+)[`'"]?/i);
  return modelMatch?.[1];
}

function extractRateLimitInfo(error: any): { remainingRequests?: number; remainingTokens?: number; resetTime?: Date } {
  const headers = error?.headers || error?.response?.headers || {};
  
  return {
    remainingRequests: headers['x-ratelimit-remaining-requests'] ? 
      parseInt(headers['x-ratelimit-remaining-requests']) : undefined,
    remainingTokens: headers['x-ratelimit-remaining-tokens'] ? 
      parseInt(headers['x-ratelimit-remaining-tokens']) : undefined,
    resetTime: headers['x-ratelimit-reset-requests'] ? 
      new Date(headers['x-ratelimit-reset-requests']) : undefined
  };
}

// Error classification helpers
export function isRetryableOpenAIError(error: unknown): boolean {
  if (error instanceof OpenAIError) {
    return error.retryable;
  }
  return false;
}

export function getOpenAIErrorRecoveryStrategy(error: OpenAIError): {
  shouldRetry: boolean;
  retryDelay: number;
  maxRetries: number;
  requiresModelFallback: boolean;
  requiresUserAction: boolean;
} {
  const baseStrategy = {
    shouldRetry: error.retryable,
    retryDelay: 1000,
    maxRetries: 3,
    requiresModelFallback: false,
    requiresUserAction: false
  };

  switch (error.code) {
    case 'MODEL_DEPRECATED':
    case 'MODEL_NOT_FOUND':
      return {
        ...baseStrategy,
        requiresModelFallback: true,
        retryDelay: 0, // Immediate retry with different model
        maxRetries: 1
      };

    case 'RATE_LIMIT_EXCEEDED':
      return {
        ...baseStrategy,
        retryDelay: 5000, // 5 second delay
        maxRetries: 5
      };

    case 'MODEL_OVERLOADED':
    case 'SERVICE_UNAVAILABLE':
      return {
        ...baseStrategy,
        retryDelay: 10000, // 10 second delay
        maxRetries: 3
      };

    case 'QUOTA_EXCEEDED':
    case 'INVALID_API_KEY':
    case 'CONTENT_POLICY_VIOLATION':
    case 'CONTEXT_LENGTH_EXCEEDED':
      return {
        ...baseStrategy,
        shouldRetry: false,
        requiresUserAction: true
      };

    default:
      return baseStrategy;
  }
} 