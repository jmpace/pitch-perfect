import { NextRequest } from 'next/server';
import { rateLimiter } from '@/lib/openai-rate-limiter';
import { createSuccessResponse, createErrorResponse, generateRequestId, normalizeError } from '@/lib/errors/handlers';
import { checkAuthentication } from '@/lib/openai-auth';
import { createSanitizedHandler, SANITIZATION_CONFIGS, type SanitizedRequestData } from '@/lib/sanitization/middleware';
import { sanitize } from '@/lib/sanitization';

/**
 * GET /api/openai/rate-limit
 * Get current rate limiting status and configuration
 */
async function handleGet(_request: NextRequest, _sanitizedData: SanitizedRequestData) {
  const requestId = generateRequestId();

  try {
    // Check OpenAI authentication
    const authStatus = await checkAuthentication();
    if (!authStatus.isAuthenticated) {
      const authError = normalizeError(new Error(authStatus.error || 'OpenAI authentication failed'), requestId);
      return createErrorResponse(authError);
    }

    const status = rateLimiter.getStatus();
    const queueInfo = rateLimiter.getQueueInfo();

    const response = {
      timestamp: new Date().toISOString(),
      status: 'active',
      endpoints: status,
      queue: queueInfo,
      summary: {
        totalActiveRequests: Object.values(status).reduce((sum, endpoint) => sum + endpoint.requestsUsed, 0),
        totalActiveTokens: Object.values(status).reduce((sum, endpoint) => sum + endpoint.tokensUsed, 0),
        totalQueuedRequests: queueInfo.totalSize,
        avgQueueWaitTime: Math.round(queueInfo.avgWaitTime / 1000), // Convert to seconds
      },
      configuration: {
        rateLimiterActive: true,
        queueingEnabled: true,
        retryEnabled: true,
        maxRetries: 3,
        maxWaitTime: 30000,
      }
    };

    return createSuccessResponse(response, requestId);

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
}

/**
 * POST /api/openai/rate-limit
 * Update rate limiting configuration or reset state
 */
async function handlePost(request: NextRequest, sanitizedData: SanitizedRequestData) {
  const requestId = generateRequestId();

  try {
    // Check OpenAI authentication
    const authStatus = await checkAuthentication();
    if (!authStatus.isAuthenticated) {
      const authError = normalizeError(new Error(authStatus.error || 'OpenAI authentication failed'), requestId);
      return createErrorResponse(authError);
    }

    // Use sanitized body data if available, otherwise parse manually
    let body: {
      action?: string;
      limits?: Record<string, unknown>;
    };

    if (sanitizedData.body) {
      body = sanitizedData.body;
    } else {
      try {
        const rawBody = await request.json();
        body = sanitize.object(rawBody);
      } catch (_error) {
        const parseError = normalizeError(new Error('Invalid JSON in request body'), requestId);
        return createErrorResponse(parseError);
      }
    }

    // Sanitize the action string
    const action = body.action ? sanitize.textInput(body.action) : undefined;

    // Handle different actions
    if (action === 'reset') {
      // Reset the rate limiter state
      rateLimiter.reset();
      
      return createSuccessResponse({
        action: 'reset',
        message: 'Rate limiter state has been reset',
        timestamp: new Date().toISOString()
      }, requestId);

    } else if (action === 'update_limits') {
      // Update rate limits (this would typically be done automatically via API headers)
      if (body.limits) {
        // Sanitize the limits object
        const sanitizedLimits = sanitize.object(body.limits);
        
        // Note: In a real implementation, you might want to validate these limits
        // For now, we'll just acknowledge the request
        return createSuccessResponse({
          action: 'update_limits',
          message: 'Rate limits are automatically updated from OpenAI API responses',
          note: 'Manual limit updates are not supported for safety',
          providedLimits: sanitizedLimits,
          timestamp: new Date().toISOString()
        }, requestId);
      } else {
        const limitsError = normalizeError(new Error('No limits provided for update_limits action'), requestId);
        return createErrorResponse(limitsError);
      }

    } else if (action === 'status') {
      // Return detailed status (same as GET but via POST for complex queries)
      const status = rateLimiter.getStatus();
      const queueInfo = rateLimiter.getQueueInfo();

      return createSuccessResponse({
        action: 'status',
        data: {
          endpoints: status,
          queue: queueInfo,
          timestamp: new Date().toISOString()
        }
      }, requestId);

    } else {
      const actionError = normalizeError(new Error(`Unknown action: ${action}. Supported actions: reset, update_limits, status`), requestId);
      return createErrorResponse(actionError);
    }

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
}

/**
 * PATCH /api/openai/rate-limit
 * Simulate rate limit header updates (for testing/development)
 */
async function handlePatch(request: NextRequest, sanitizedData: SanitizedRequestData) {
  const requestId = generateRequestId();

  try {
    // Check OpenAI authentication
    const authStatus = await checkAuthentication();
    if (!authStatus.isAuthenticated) {
      const authError = normalizeError(new Error(authStatus.error || 'OpenAI authentication failed'), requestId);
      return createErrorResponse(authError);
    }

    // Use sanitized body data if available, otherwise parse manually
    let body: {
      headers?: Record<string, string>;
    };

    if (sanitizedData.body) {
      body = sanitizedData.body;
    } else {
      try {
        const rawBody = await request.json();
        body = sanitize.object(rawBody);
      } catch (_error) {
        const parseError = normalizeError(new Error('Invalid JSON in request body'), requestId);
        return createErrorResponse(parseError);
      }
    }

    // Simulate updating rate limits from API headers
    if (body.headers) {
      // Sanitize the headers object
      const sanitizedHeaders = sanitize.object(body.headers);
      const mockHeaders = new Headers();
      
      // Only allow specific rate limit headers and sanitize their values
      const allowedHeaders = [
        'x-ratelimit-limit-requests',
        'x-ratelimit-limit-tokens',
        'x-ratelimit-remaining-requests',
        'x-ratelimit-remaining-tokens'
      ];

      for (const headerName of allowedHeaders) {
        if (sanitizedHeaders[headerName]) {
          const sanitizedValue = sanitize.textInput(sanitizedHeaders[headerName]);
          if (sanitizedValue && /^\d+$/.test(sanitizedValue)) { // Only numeric values
            mockHeaders.set(headerName, sanitizedValue);
          }
        }
      }

      rateLimiter.updateLimitsFromApiResponse(mockHeaders);

      return createSuccessResponse({
        action: 'simulate_headers',
        message: 'Rate limits updated from simulated headers',
        updatedHeaders: Object.fromEntries(mockHeaders.entries()),
        timestamp: new Date().toISOString()
      }, requestId);
    }

    const headerError = normalizeError(new Error('No headers provided for simulation'), requestId);
    return createErrorResponse(headerError);

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
}

// Export sanitized handlers using STANDARD configuration
export const GET = createSanitizedHandler(handleGet, SANITIZATION_CONFIGS.STANDARD);
export const POST = createSanitizedHandler(handlePost, SANITIZATION_CONFIGS.STANDARD);
export const PATCH = createSanitizedHandler(handlePatch, SANITIZATION_CONFIGS.STANDARD); 