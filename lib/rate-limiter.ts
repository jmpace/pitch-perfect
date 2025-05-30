import { NextRequest } from 'next/server';

/**
 * Rate limiting configuration for different endpoint types
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier?: 'ip' | 'user' | 'custom'; // How to identify clients
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skipFailedRequests?: boolean; // Only count successful requests
  enableHeaders?: boolean; // Add rate limit headers to response
  message?: string; // Custom rate limit exceeded message
}

/**
 * Rate limit result information
 */
export interface RateLimitResult {
  isAllowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number; // Seconds until next request allowed
}

/**
 * Rate limit store entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

/**
 * Predefined rate limit configurations for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
  // General API endpoints
  API_GENERAL: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    identifier: 'ip' as const,
    enableHeaders: true,
    message: 'Too many requests from this IP, please try again later'
  },
  
  // File upload endpoints
  UPLOAD: {
    windowMs: 60000, // 1 minute  
    maxRequests: 10,
    identifier: 'ip' as const,
    enableHeaders: true,
    message: 'Too many file uploads, please wait before uploading again'
  },
  
  // AI/OpenAI processing endpoints
  AI_PROCESSING: {
    windowMs: 60000, // 1 minute
    maxRequests: 20,
    identifier: 'ip' as const,
    enableHeaders: true,
    message: 'Too many AI processing requests, please wait before trying again'
  },
  
  // Video processing endpoints
  VIDEO_PROCESSING: {
    windowMs: 300000, // 5 minutes
    maxRequests: 5,
    identifier: 'ip' as const,
    enableHeaders: true,
    message: 'Too many video processing requests, please wait before trying again'
  },
  
  // Storage operations
  STORAGE: {
    windowMs: 60000, // 1 minute
    maxRequests: 50,
    identifier: 'ip' as const,
    enableHeaders: true,
    message: 'Too many storage requests, please try again later'
  },
  
  // Health check endpoints
  HEALTH: {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
    identifier: 'ip' as const,
    enableHeaders: true,
    message: 'Too many health check requests'
  },
  
  // Strict rate limiting for sensitive operations
  STRICT: {
    windowMs: 300000, // 5 minutes
    maxRequests: 10,
    identifier: 'ip' as const,
    enableHeaders: true,
    message: 'Rate limit exceeded for sensitive operation'
  }
} as const;

/**
 * Enhanced rate limiter with multiple configurations and proper header support
 */
export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Start cleanup interval to prevent memory leaks
    this.startCleanup();
  }
  
  /**
   * Check if a request should be allowed based on rate limiting
   */
  check(identifier: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const key = `${identifier}:${config.windowMs}:${config.maxRequests}`;
    
    // Get or create entry
    let entry = this.store.get(key);
    if (!entry || now >= entry.resetTime) {
      // Create new window
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
        firstRequest: now
      };
      this.store.set(key, entry);
    }
    
    // Calculate remaining requests and time
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetTime = entry.resetTime;
    
    // Check if request should be allowed
    const isAllowed = entry.count < config.maxRequests;
    
    if (isAllowed) {
      entry.count++;
    }
    
    return {
      isAllowed,
      limit: config.maxRequests,
      remaining: isAllowed ? remaining - 1 : 0,
      resetTime,
      retryAfter: isAllowed ? undefined : Math.ceil((resetTime - now) / 1000)
    };
  }
  
  /**
   * Extract client identifier from request
   */
  getIdentifier(request: NextRequest, type: 'ip' | 'user' | 'custom' = 'ip'): string {
    switch (type) {
      case 'ip':
        return this.getClientIP(request);
      case 'user':
        // For future user-based rate limiting
        return request.headers.get('authorization') || this.getClientIP(request);
      case 'custom':
        // For custom identification logic
        return request.headers.get('x-client-id') || this.getClientIP(request);
      default:
        return this.getClientIP(request);
    }
  }
  
  /**
   * Extract client IP address from request headers
   */
  private getClientIP(request: NextRequest): string {
    // Check various headers that might contain the real IP
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      // x-forwarded-for can contain multiple IPs, get the first one
      return xForwardedFor.split(',')[0].trim();
    }
    
    const xRealIP = request.headers.get('x-real-ip');
    if (xRealIP) {
      return xRealIP.trim();
    }
    
    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    if (cfConnectingIP) {
      return cfConnectingIP.trim();
    }
    
    // Fallback for development/unknown environments
    // Note: NextRequest doesn't have an ip property, so we use a default
    return 'unknown-ip';
  }
  
  /**
   * Get rate limit headers for response
   */
  getHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetTime.toString()
    };
    
    if (result.retryAfter) {
      headers['Retry-After'] = result.retryAfter.toString();
    }
    
    return headers;
  }
  
  /**
   * Reset rate limit for specific identifier
   */
  reset(identifier: string, config?: RateLimitConfig): void {
    if (config) {
      const key = `${identifier}:${config.windowMs}:${config.maxRequests}`;
      this.store.delete(key);
    } else {
      // Reset all entries for this identifier
      const keysToDelete: string[] = [];
      for (const key of Array.from(this.store.keys())) {
        if (key.startsWith(`${identifier}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.store.delete(key));
    }
  }
  
  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    // Collect keys to delete
    for (const key of Array.from(this.store.keys())) {
      const entry = this.store.get(key);
      if (entry && now >= entry.resetTime) {
        keysToDelete.push(key);
      }
    }
    
    // Delete expired entries
    keysToDelete.forEach(key => this.store.delete(key));
  }
  
  /**
   * Get current rate limit status for monitoring
   */
  getStatus(): Record<string, { requests: number; limit: number; remaining: number; resetTime: number }> {
    const status: Record<string, { requests: number; limit: number; remaining: number; resetTime: number }> = {};
    
    for (const [key, entry] of Array.from(this.store.entries())) {
      // Extract limit from key format: identifier:windowMs:maxRequests
      const keyParts = key.split(':');
      const limit = parseInt(keyParts[2]) || 0;
      const remaining = Math.max(0, limit - entry.count);
      
      status[key] = {
        requests: entry.count,
        limit,
        remaining,
        resetTime: entry.resetTime,
      };
    }
    
    return status;
  }
  
  /**
   * Get memory usage statistics
   */
  getMemoryStats(): { totalEntries: number; totalRequests: number } {
    let totalRequests = 0;
    
    for (const [key, entry] of Array.from(this.store.entries())) {
      totalRequests += entry.count;
    }
    
    return {
      totalEntries: this.store.size,
      totalRequests,
    };
  }
  
  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      for (const [key, entry] of Array.from(this.store.entries())) {
        if (now >= entry.resetTime) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.store.delete(key));
    }, 60000); // Cleanup every minute
  }
  
  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global rate limiter instance
const globalRateLimiter = new RateLimiter();

/**
 * Convenient function to check rate limits with predefined configurations
 */
export function checkRateLimit(
  request: NextRequest,
  configName: keyof typeof RATE_LIMIT_CONFIGS,
  customConfig?: Partial<RateLimitConfig>
): RateLimitResult {
  const baseConfig = RATE_LIMIT_CONFIGS[configName];
  const config = { ...baseConfig, ...customConfig };
  
  const identifier = globalRateLimiter.getIdentifier(request, config.identifier);
  return globalRateLimiter.check(identifier, config);
}

/**
 * Enhanced rate limit check with error throwing (compatible with existing implementation)
 */
export function enforceRateLimit(
  request: NextRequest,
  configName: keyof typeof RATE_LIMIT_CONFIGS,
  requestId: string,
  customConfig?: Partial<RateLimitConfig>
): RateLimitResult {
  const result = checkRateLimit(request, configName, customConfig);
  
  if (!result.isAllowed) {
    const config = { ...RATE_LIMIT_CONFIGS[configName], ...customConfig };
    const identifier = globalRateLimiter.getIdentifier(request, config.identifier);
    
    // Import and throw error to maintain compatibility with existing error handling
    const { InternalServerError } = require('./errors/types');
    throw new InternalServerError(
      config.message || `Rate limit exceeded: ${config.maxRequests} requests per ${config.windowMs}ms`,
      {
        identifier,
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.resetTime,
        retryAfter: result.retryAfter
      },
      requestId
    );
  }
  
  return result;
}

/**
 * Get rate limiter instance for advanced usage
 */
export function getRateLimiter(): RateLimiter {
  return globalRateLimiter;
}

export default globalRateLimiter; 