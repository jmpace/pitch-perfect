import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimiter, RATE_LIMIT_CONFIGS } from './lib/rate-limiter';
import { withApiKeyValidation } from './lib/api-keys/middleware';
import { SecurityLevel } from './lib/api-keys/types';

// CORS configuration
const corsConfig = {
  // Development origins
  allowedOrigins: [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000'
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'X-CSRF-Token',
    'X-Requested-With',
    'Accept',
    'Accept-Version',
    'Content-Length',
    'Content-MD5',
    'Content-Type',
    'Date',
    'X-Api-Version',
    'Authorization',
    'X-API-Key'  // Add support for API key header
  ],
  maxAge: 86400 // 24 hours
};

// Configure API key validation
const apiKeyValidation = withApiKeyValidation({
  enableValidation: true,
  enableUsageTracking: true,
  enableRateLimiting: true,
  securityLevel: SecurityLevel.HIGH,
  excludedPaths: [
    '/api/health',
    '/api/debug',
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/api/security/api-keys' // Allow access to key management endpoint
  ],
  requireApiKey: false, // Only validate if present
  logRequests: process.env.NODE_ENV === 'development'
});

function addCorsHeaders(response: NextResponse, origin?: string): NextResponse {
  // Set CORS headers
  if (origin && corsConfig.allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  response.headers.set('Access-Control-Allow-Methods', corsConfig.allowedMethods.join(', '));
  response.headers.set('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '));
  response.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return response;
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}

function addRateLimitHeaders(response: NextResponse, headers: Record<string, string>): NextResponse {
  // Add rate limiting headers
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, String(value));
  }
  
  return response;
}

/**
 * Determine rate limit configuration based on request path
 */
function getRateLimitConfigForPath(pathname: string): keyof typeof RATE_LIMIT_CONFIGS {
  // API route specific rate limits
  if (pathname.startsWith('/api/upload')) {
    return 'UPLOAD';
  } else if (pathname.startsWith('/api/openai') || pathname.startsWith('/api/whisper')) {
    return 'AI_PROCESSING';
  } else if (pathname.startsWith('/api/video')) {
    return 'VIDEO_PROCESSING';
  } else if (pathname.startsWith('/api/storage') || pathname.startsWith('/api/cleanup')) {
    return 'STORAGE';
  } else if (pathname.startsWith('/api/health')) {
    return 'HEALTH';
  } else if (pathname.startsWith('/api')) {
    return 'API_GENERAL';
  }
  
  // Default for non-API routes (more lenient)
  return 'API_GENERAL';
}

/**
 * Apply rate limiting to request and add headers to response
 */
function applyRateLimit(request: NextRequest, response: NextResponse): NextResponse {
  try {
    const pathname = request.nextUrl.pathname;
    const configName = getRateLimitConfigForPath(pathname);
    
    // Check rate limit
    const rateLimitResult = checkRateLimit(request, configName);
    
    // Add rate limit headers
    const rateLimiter = getRateLimiter();
    const headers = rateLimiter.getHeaders(rateLimitResult);
    
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    
    // If rate limit exceeded, return 429 response
    if (!rateLimitResult.isAllowed) {
      const config = RATE_LIMIT_CONFIGS[configName];
      
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: config.message,
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime,
          retryAfter: rateLimitResult.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        }
      );
    }
    
    return response;
    
  } catch (error) {
    // If rate limiting fails, log error but don't block request
    console.error('[Middleware] Rate limiting error:', error);
    
    // Create fallback response
    const fallbackResponse = NextResponse.next();
    
    // Add fallback headers
    fallbackResponse.headers.set('X-RateLimit-Limit', '100');
    fallbackResponse.headers.set('X-RateLimit-Remaining', '99');
    
    return addCorsHeaders(fallbackResponse, request.headers.get('origin') || undefined);
  }
}

export async function middleware(request: NextRequest) {
  // Get the current URL and origin
  const url = request.nextUrl.clone();
  const origin = request.headers.get('origin');
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = NextResponse.next();
    return addCorsHeaders(response, origin || undefined);
  }
  
  // In production, enforce HTTPS redirect
  if (process.env.NODE_ENV === 'production' && url.protocol === 'http:') {
    url.protocol = 'https:';
    return NextResponse.redirect(url);
  }

  // Apply API key validation first (if applicable)
  try {
    const apiKeyValidationResponse = await apiKeyValidation(request);
    
    // If API key validation failed, return the validation response
    if (apiKeyValidationResponse.status !== 200 && apiKeyValidationResponse.status !== undefined) {
      return apiKeyValidationResponse;
    }
  } catch (error) {
    console.error('[Middleware] API key validation error:', error);
    // Continue with request if API key validation fails unexpectedly
  }

  // Apply rate limiting based on route
  let rateLimitConfig: keyof typeof RATE_LIMIT_CONFIGS = 'API_GENERAL';
  
  if (url.pathname.startsWith('/api/upload')) {
    rateLimitConfig = 'UPLOAD';
  } else if (url.pathname.startsWith('/api/openai') || url.pathname.startsWith('/api/whisper')) {
    rateLimitConfig = 'AI_PROCESSING';
  } else if (url.pathname.startsWith('/api/video')) {
    rateLimitConfig = 'VIDEO_PROCESSING';
  } else if (url.pathname.startsWith('/api/storage')) {
    rateLimitConfig = 'STORAGE';
  } else if (url.pathname.startsWith('/api/health')) {
    rateLimitConfig = 'HEALTH';
  }

  try {
    // Check rate limiting
    const rateLimitResult = checkRateLimit(request, rateLimitConfig);
    
    if (!rateLimitResult.isAllowed) {
      // Rate limit exceeded
      const rateLimitResponse = new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: RATE_LIMIT_CONFIGS[rateLimitConfig].message,
          retryAfter: rateLimitResult.retryAfter
        }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      // Add rate limit headers
      const rateLimiter = getRateLimiter();
      const rateLimitHeaders = rateLimiter.getHeaders(rateLimitResult);
      addRateLimitHeaders(rateLimitResponse, rateLimitHeaders);
      
      // Add CORS headers to error response
      addCorsHeaders(rateLimitResponse, origin || undefined);
      
      return rateLimitResponse;
    }

    // Create successful response
    const response = NextResponse.next();
    
    // Add rate limit headers to successful response  
    const rateLimiter = getRateLimiter();
    const rateLimitHeaders = rateLimiter.getHeaders(rateLimitResult);
    addRateLimitHeaders(response, rateLimitHeaders);
    
    // Add CORS headers
    addCorsHeaders(response, origin || undefined);
    
    // Add security headers
    addSecurityHeaders(response);
    
    return response;
    
  } catch (error) {
    console.error('[Middleware] Error processing request:', error);
    
    // Create fallback response  
    const fallbackResponse = NextResponse.next();
    
    // Add basic headers
    addCorsHeaders(fallbackResponse, origin || undefined);
    addSecurityHeaders(fallbackResponse);
    
    return fallbackResponse;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Note: Removed api exclusion to handle CORS for API routes
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 