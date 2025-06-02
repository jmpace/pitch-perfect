/**
 * API Key Validation Middleware
 * Secure API key validation and protection for Next.js routes
 */

// Force this module to run in Node.js runtime only
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyManager } from './manager';
import { ApiProvider, SecurityLevel, ApiKeyOperationResult } from './types';
import { sanitizeKeyForLogging } from './encryption';
import { validateApiKey, detectProvider, PROVIDER_CONFIGS } from './validator';

// Middleware configuration
interface ApiKeyMiddlewareConfig {
  enableValidation: boolean;
  enableUsageTracking: boolean;
  enableRateLimiting: boolean;
  securityLevel: SecurityLevel;
  allowedProviders?: ApiProvider[];
  excludedPaths?: string[];
  requireApiKey?: boolean;
  logRequests?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: ApiKeyMiddlewareConfig = {
  enableValidation: true,
  enableUsageTracking: true,
  enableRateLimiting: true,
  securityLevel: SecurityLevel.HIGH,
  excludedPaths: [
    '/api/health',
    '/api/debug',
    '/_next',
    '/favicon.ico',
    '/robots.txt'
  ],
  requireApiKey: false,
  logRequests: true
};

// Request metadata interface
interface RequestMetadata {
  timestamp: Date;
  ip: string;
  userAgent: string;
  endpoint: string;
  method: string;
  hasApiKey: boolean;
  provider?: ApiProvider;
  keyId?: string;
  validationResult?: any;
}

/**
 * API Key Validation Middleware
 */
export class ApiKeyMiddleware {
  private config: ApiKeyMiddlewareConfig;
  private keyManager = getApiKeyManager();
  private requestCache = new Map<string, { timestamp: number; count: number }>();

  constructor(config: Partial<ApiKeyMiddlewareConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main middleware handler
   */
  public async handle(request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();

    try {
      // Extract request metadata
      const metadata = this.extractRequestMetadata(request);

      // Check if path should be excluded
      if (this.shouldExcludePath(metadata.endpoint)) {
        return NextResponse.next();
      }

      // Extract API key from request
      const apiKeyResult = this.extractApiKey(request);
      metadata.hasApiKey = apiKeyResult.success;

      // Handle requests without API keys
      if (!apiKeyResult.success) {
        if (this.config.requireApiKey) {
          return this.createErrorResponse(
            'API key required',
            401,
            'MISSING_API_KEY',
            metadata
          );
        }
        // Continue without validation for non-required endpoints
        return NextResponse.next();
      }

      const apiKey = apiKeyResult.data!;
      const provider = detectProvider(apiKey);
      metadata.provider = provider;

      // Validate provider if restrictions are configured
      if (this.config.allowedProviders && !this.config.allowedProviders.includes(provider)) {
        return this.createErrorResponse(
          `Provider ${provider} not allowed`,
          403,
          'PROVIDER_NOT_ALLOWED',
          metadata
        );
      }

      // Validate API key
      if (this.config.enableValidation) {
        const validation = validateApiKey(apiKey, provider, this.config.securityLevel);
        metadata.validationResult = validation;

        if (!validation.isValid) {
          this.logSecurityEvent('API_KEY_VALIDATION_FAILED', metadata, {
            issues: validation.issues,
            securityScore: validation.securityScore
          });

          return this.createErrorResponse(
            'Invalid API key',
            401,
            'INVALID_API_KEY',
            metadata,
            validation.issues
          );
        }

        // Check security score threshold
        if (validation.securityScore < 70) {
          this.logSecurityEvent('LOW_SECURITY_SCORE', metadata, {
            securityScore: validation.securityScore,
            warnings: validation.warnings
          });
        }
      }

      // Rate limiting check
      if (this.config.enableRateLimiting) {
        const rateLimitResult = this.checkRateLimit(metadata);
        if (!rateLimitResult.allowed) {
          this.logSecurityEvent('RATE_LIMIT_EXCEEDED', metadata, rateLimitResult);

          return this.createErrorResponse(
            'Rate limit exceeded',
            429,
            'RATE_LIMIT_EXCEEDED',
            metadata,
            [`Limit: ${rateLimitResult.limit} requests per minute`]
          );
        }
      }

      // Find registered key ID for usage tracking
      if (this.config.enableUsageTracking) {
        const keyIds = this.keyManager.getKeysMetadata()
          .filter(k => k.provider === provider)
          .map(k => k.id);

        if (keyIds.length > 0) {
          metadata.keyId = keyIds[0]; // Use first matching key for tracking
        }
      }

      // Log successful request
      if (this.config.logRequests) {
        this.logSecurityEvent('API_REQUEST_AUTHORIZED', metadata, {
          processingTime: Date.now() - startTime
        });
      }

      // Create enhanced response with security headers
      const response = NextResponse.next();
      this.addSecurityHeaders(response, metadata);

      // Record usage after successful validation
      if (metadata.keyId && this.config.enableUsageTracking) {
        // We'll record the actual success/failure after the API call completes
        // This is a limitation of Next.js middleware - we don't know the final response here
        setTimeout(() => {
          this.keyManager.recordUsage(metadata.keyId!, true, Date.now() - startTime);
        }, 0);
      }

      return response;

    } catch (error) {
      const metadata = this.extractRequestMetadata(request);
      this.logSecurityEvent('MIDDLEWARE_ERROR', metadata, {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      });

      return this.createErrorResponse(
        'Internal security error',
        500,
        'MIDDLEWARE_ERROR',
        metadata
      );
    }
  }

  /**
   * Extract API key from request headers or query parameters
   */
  private extractApiKey(request: NextRequest): ApiKeyOperationResult<string> {
    // Check Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        return {
          success: true,
          data: authHeader.substring(7),
          metadata: { source: 'authorization_header' }
        };
      }

      if (authHeader.startsWith('ApiKey ')) {
        return {
          success: true,
          data: authHeader.substring(7),
          metadata: { source: 'authorization_header' }
        };
      }
    }

    // Check X-API-Key header
    const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('x-api-key');
    if (apiKeyHeader) {
      return {
        success: true,
        data: apiKeyHeader,
        metadata: { source: 'x_api_key_header' }
      };
    }

    // Check query parameter (less secure, should be avoided in production)
    const { searchParams } = new URL(request.url);
    const apiKeyParam = searchParams.get('api_key') || searchParams.get('apikey');
    if (apiKeyParam) {
      return {
        success: true,
        data: apiKeyParam,
        metadata: { source: 'query_parameter', warning: 'API key in URL is insecure' }
      };
    }

    return {
      success: false,
      error: 'No API key found in request'
    };
  }

  /**
   * Extract request metadata for logging and tracking
   */
  private extractRequestMetadata(request: NextRequest): RequestMetadata {
    const url = new URL(request.url);
    
    return {
      timestamp: new Date(),
      ip: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      endpoint: url.pathname,
      method: request.method,
      hasApiKey: false
    };
  }

  /**
   * Get client IP address with fallbacks
   */
  private getClientIP(request: NextRequest): string {
    // Check various headers for client IP
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }

    const xRealIP = request.headers.get('x-real-ip');
    if (xRealIP) {
      return xRealIP;
    }

    const xClientIP = request.headers.get('x-client-ip');
    if (xClientIP) {
      return xClientIP;
    }

    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    if (cfConnectingIP) {
      return cfConnectingIP;
    }

    // For serverless environments, IP may not be directly available
    // Return unknown as fallback
    return 'unknown';
  }

  /**
   * Check if path should be excluded from API key validation
   */
  private shouldExcludePath(path: string): boolean {
    return this.config.excludedPaths?.some(excluded => 
      path.startsWith(excluded)
    ) || false;
  }

  /**
   * Simple rate limiting implementation
   */
  private checkRateLimit(metadata: RequestMetadata): {
    allowed: boolean;
    limit: number;
    current: number;
    resetTime?: Date;
  } {
    const key = `${metadata.ip}:${metadata.endpoint}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const limit = 100; // requests per minute

    let entry = this.requestCache.get(key);
    
    if (!entry || now - entry.timestamp > windowMs) {
      // New window or expired entry
      entry = { timestamp: now, count: 1 };
      this.requestCache.set(key, entry);
      
      return {
        allowed: true,
        limit,
        current: 1,
        resetTime: new Date(now + windowMs)
      };
    }

    entry.count++;
    
    return {
      allowed: entry.count <= limit,
      limit,
      current: entry.count,
      resetTime: new Date(entry.timestamp + windowMs)
    };
  }

  /**
   * Add security headers to response
   */
  private addSecurityHeaders(response: NextResponse, metadata: RequestMetadata): void {
    // Add API key security headers
    response.headers.set('X-API-Security-Level', this.config.securityLevel);
    response.headers.set('X-Request-ID', `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    
    if (metadata.provider) {
      response.headers.set('X-API-Provider', metadata.provider);
    }

    // Rate limiting headers
    if (this.config.enableRateLimiting) {
      const rateLimitInfo = this.checkRateLimit(metadata);
      response.headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
      response.headers.set('X-RateLimit-Remaining', Math.max(0, rateLimitInfo.limit - rateLimitInfo.current).toString());
      
      if (rateLimitInfo.resetTime) {
        response.headers.set('X-RateLimit-Reset', Math.floor(rateLimitInfo.resetTime.getTime() / 1000).toString());
      }
    }

    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
  }

  /**
   * Create error response with security information
   */
  private createErrorResponse(
    message: string,
    status: number,
    code: string,
    metadata: RequestMetadata,
    details?: string[]
  ): NextResponse {
    const errorResponse = {
      error: {
        message,
        code,
        timestamp: metadata.timestamp.toISOString(),
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      ...(details && { details })
    };

    const response = NextResponse.json(errorResponse, { status });
    this.addSecurityHeaders(response, metadata);

    return response;
  }

  /**
   * Log security events for audit and monitoring
   */
  private logSecurityEvent(
    eventType: string,
    metadata: RequestMetadata,
    additionalData?: any
  ): void {
    const logEntry = {
      timestamp: metadata.timestamp.toISOString(),
      eventType,
      ip: metadata.ip,
      endpoint: metadata.endpoint,
      method: metadata.method,
      userAgent: metadata.userAgent,
      provider: metadata.provider,
      hasApiKey: metadata.hasApiKey,
      ...additionalData
    };

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Security] ${eventType}:`, JSON.stringify(logEntry, null, 2));
    }

    // In production, you might want to send to a logging service
    // Example: await sendToLoggingService(logEntry);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ApiKeyMiddlewareConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): ApiKeyMiddlewareConfig {
    return { ...this.config };
  }
}

/**
 * Create API key middleware instance
 */
export function createApiKeyMiddleware(config?: Partial<ApiKeyMiddlewareConfig>): ApiKeyMiddleware {
  return new ApiKeyMiddleware(config);
}

/**
 * Helper function to integrate with existing Next.js middleware
 */
export function withApiKeyValidation(
  config?: Partial<ApiKeyMiddlewareConfig>
) {
  const middleware = createApiKeyMiddleware(config);
  
  return async (request: NextRequest): Promise<NextResponse> => {
    return middleware.handle(request);
  };
}

export default ApiKeyMiddleware; 