import { NextRequest, NextResponse } from 'next/server';

// CORS configuration for API routes
export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  credentials?: boolean;
  maxAge?: number;
}

// Default CORS configuration for API routes
export const defaultCORSConfig: CORSConfig = {
  allowedOrigins: [
    // Development origins
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000',
    // Production origins - these should be updated when deploying
    'https://pitch-perfect.vercel.app', // Example production URL
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
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Strict CORS config for sensitive endpoints
export const strictCORSConfig: CORSConfig = {
  allowedOrigins: [
    'https://localhost:3000', // Only HTTPS in development
    'https://pitch-perfect.vercel.app', // Only production domain
  ],
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ],
  credentials: true,
  maxAge: 3600 // 1 hour
};

/**
 * Checks if an origin is allowed based on the CORS configuration
 */
export function isOriginAllowed(origin: string | null, config: CORSConfig): boolean {
  if (!origin) return true; // Same-origin requests
  
  // In production, be strict about origins
  if (process.env.NODE_ENV === 'production') {
    return config.allowedOrigins.includes(origin);
  }
  
  // In development, be more lenient but still check against allowed list
  return config.allowedOrigins.includes(origin);
}

/**
 * Adds CORS headers to a NextResponse
 */
export function addCORSHeaders(
  response: NextResponse, 
  origin: string | null, 
  config: CORSConfig = defaultCORSConfig
): NextResponse {
  if (isOriginAllowed(origin, config)) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    response.headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    response.headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    
    if (config.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    if (config.maxAge) {
      response.headers.set('Access-Control-Max-Age', config.maxAge.toString());
    }
    
    // Add Vary header for proper caching
    response.headers.set('Vary', 'Origin');
  }
  
  return response;
}

/**
 * Handles preflight OPTIONS requests
 */
export function handlePreflight(request: NextRequest, config: CORSConfig = defaultCORSConfig): NextResponse {
  const origin = request.headers.get('origin');
  
  if (!isOriginAllowed(origin, config)) {
    return new NextResponse('CORS policy violation', { status: 403 });
  }
  
  const response = new NextResponse(null, { status: 200 });
  return addCORSHeaders(response, origin, config);
}

/**
 * CORS middleware wrapper for API routes
 */
export function withCORS(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse,
  config: CORSConfig = defaultCORSConfig
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const origin = request.headers.get('origin');
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return handlePreflight(request, config);
    }
    
    // Check if origin is allowed for non-preflight requests
    if (!isOriginAllowed(origin, config)) {
      return new NextResponse('CORS policy violation', { status: 403 });
    }
    
    // Call the actual handler
    const response = await handler(request);
    
    // Add CORS headers to the response
    return addCORSHeaders(response, origin, config);
  };
}

/**
 * Simple CORS wrapper for standard REST API handlers
 */
export function corsify<T extends Record<string, any>>(
  handlers: T,
  config: CORSConfig = defaultCORSConfig
): T & { OPTIONS: (request: NextRequest) => NextResponse } {
  return {
    ...handlers,
    OPTIONS: (request: NextRequest) => handlePreflight(request, config)
  } as T & { OPTIONS: (request: NextRequest) => NextResponse };
} 