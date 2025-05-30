import { NextRequest } from 'next/server';
import { rateLimiter } from '@/lib/openai-rate-limiter';
import { createSuccessResponse, createErrorResponse, generateRequestId, normalizeError } from '@/lib/errors/handlers';
import { checkAuthentication } from '@/lib/openai-auth';

/**
 * GET /api/openai/rate-limit
 * Get current rate limiting status and configuration
 */
export async function GET(_request: NextRequest) {
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
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Check OpenAI authentication
    const authStatus = await checkAuthentication();
    if (!authStatus.isAuthenticated) {
      const authError = normalizeError(new Error(authStatus.error || 'OpenAI authentication failed'), requestId);
      return createErrorResponse(authError);
    }

    let body: {
      action?: string;
      limits?: Record<string, unknown>;
    };
    try {
      body = await request.json();
    } catch (_error) {
      const parseError = normalizeError(new Error('Invalid JSON in request body'), requestId);
      return createErrorResponse(parseError);
    }

    // Handle different actions
    if (body.action === 'reset') {
      // Reset the rate limiter state
      rateLimiter.reset();
      
      return createSuccessResponse({
        action: 'reset',
        message: 'Rate limiter state has been reset',
        timestamp: new Date().toISOString()
      }, requestId);

    } else if (body.action === 'update_limits') {
      // Update rate limits (this would typically be done automatically via API headers)
      if (body.limits) {
        // Note: In a real implementation, you might want to validate these limits
        // For now, we'll just acknowledge the request
        return createSuccessResponse({
          action: 'update_limits',
          message: 'Rate limits are automatically updated from OpenAI API responses',
          note: 'Manual limit updates are not supported for safety',
          timestamp: new Date().toISOString()
        }, requestId);
      }

    } else if (body.action === 'status') {
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
      const actionError = normalizeError(new Error(`Unknown action: ${body.action}. Supported actions: reset, update_limits, status`), requestId);
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
export async function PATCH(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Check OpenAI authentication
    const authStatus = await checkAuthentication();
    if (!authStatus.isAuthenticated) {
      const authError = normalizeError(new Error(authStatus.error || 'OpenAI authentication failed'), requestId);
      return createErrorResponse(authError);
    }

    let body: {
      headers?: Record<string, string>;
    };
    try {
      body = await request.json();
    } catch (_error) {
      const parseError = normalizeError(new Error('Invalid JSON in request body'), requestId);
      return createErrorResponse(parseError);
    }

    // Simulate updating rate limits from API headers
    if (body.headers) {
      const mockHeaders = new Headers();
      
      if (body.headers['x-ratelimit-limit-requests']) {
        mockHeaders.set('x-ratelimit-limit-requests', body.headers['x-ratelimit-limit-requests']);
      }
      if (body.headers['x-ratelimit-limit-tokens']) {
        mockHeaders.set('x-ratelimit-limit-tokens', body.headers['x-ratelimit-limit-tokens']);
      }
      if (body.headers['x-ratelimit-remaining-requests']) {
        mockHeaders.set('x-ratelimit-remaining-requests', body.headers['x-ratelimit-remaining-requests']);
      }
      if (body.headers['x-ratelimit-remaining-tokens']) {
        mockHeaders.set('x-ratelimit-remaining-tokens', body.headers['x-ratelimit-remaining-tokens']);
      }

      rateLimiter.updateLimitsFromApiResponse(mockHeaders);

      return createSuccessResponse({
        action: 'simulate_headers',
        message: 'Rate limits updated from simulated headers',
        updatedHeaders: body.headers,
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