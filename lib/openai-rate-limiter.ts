import { OPENAI_CONFIG } from './openai-config';
import { generateRequestId } from './errors/handlers';
import { ProcessingError } from './errors/types';

// OpenAI API rate limit configuration
export interface OpenAIRateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
  imagesPerMinute?: number;
}

// API endpoint types
export type OpenAIEndpoint = 'chat' | 'transcription' | 'vision' | 'embedding' | 'tts';

// Rate limit tracking data
interface RateLimitTracker {
  requests: number[];
  tokens: number[];
  resetTime: number;
  totalRequestsToday: number;
  totalTokensToday: number;
  dailyResetTime: number;
}

// Queue item for pending requests
interface QueuedRequest {
  id: string;
  endpoint: OpenAIEndpoint;
  estimatedTokens: number;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
  resolve: (value: void) => void;
  reject: (error: Error) => void;
  retryCount: number;
  maxRetries: number;
}

// Rate limit response from OpenAI API
export interface OpenAIRateLimitResponse {
  remainingRequests?: number;
  remainingTokens?: number;
  resetRequests?: string;
  resetTokens?: string;
  limitRequests?: number;
  limitTokens?: number;
}

// Default rate limits by tier (conservative estimates)
const DEFAULT_RATE_LIMITS: Record<string, OpenAIRateLimits> = {
  free: {
    requestsPerMinute: 3,
    tokensPerMinute: 40000,
    requestsPerDay: 200,
    imagesPerMinute: 1,
  },
  tier1: {
    requestsPerMinute: 200,
    tokensPerMinute: 40000,
    requestsPerDay: 10000,
    imagesPerMinute: 5,
  },
  tier2: {
    requestsPerMinute: 500,
    tokensPerMinute: 150000,
    requestsPerDay: 50000,
    imagesPerMinute: 10,
  },
  tier3: {
    requestsPerMinute: 1000,
    tokensPerMinute: 250000,
    requestsPerDay: 100000,
    imagesPerMinute: 20,
  },
  tier4: {
    requestsPerMinute: 5000,
    tokensPerMinute: 500000,
    requestsPerDay: 300000,
    imagesPerMinute: 50,
  },
  tier5: {
    requestsPerMinute: 10000,
    tokensPerMinute: 1000000,
    requestsPerDay: 1000000,
    imagesPerMinute: 100,
  },
};

// Model-specific token estimation
const TOKEN_ESTIMATION = {
  chat: {
    inputMultiplier: 1.0,
    outputMultiplier: 1.0,
    baseTokens: 10,
  },
  transcription: {
    inputMultiplier: 0.1, // Audio is cheaper in tokens
    outputMultiplier: 1.0,
    baseTokens: 50,
  },
  vision: {
    inputMultiplier: 1.2, // Vision uses more tokens
    outputMultiplier: 1.0,
    baseTokens: 100,
  },
  embedding: {
    inputMultiplier: 1.0,
    outputMultiplier: 0, // No output tokens
    baseTokens: 5,
  },
  tts: {
    inputMultiplier: 1.0,
    outputMultiplier: 0, // No text output
    baseTokens: 20,
  },
};

export class OpenAIRateLimiter {
  private static instance: OpenAIRateLimiter;
  private trackers: Map<OpenAIEndpoint, RateLimitTracker> = new Map();
  private queue: QueuedRequest[] = [];
  private processing = false;
  private currentLimits: OpenAIRateLimits;
  private detectedTier: string = 'tier2'; // Default assumption
  
  constructor(initialLimits?: OpenAIRateLimits) {
    this.currentLimits = initialLimits || DEFAULT_RATE_LIMITS[this.detectedTier];
    this.initializeTrackers();
  }

  static getInstance(): OpenAIRateLimiter {
    if (!OpenAIRateLimiter.instance) {
      OpenAIRateLimiter.instance = new OpenAIRateLimiter();
    }
    return OpenAIRateLimiter.instance;
  }

  /**
   * Initialize rate limit trackers for all endpoints
   */
  private initializeTrackers(): void {
    const endpoints: OpenAIEndpoint[] = ['chat', 'transcription', 'vision', 'embedding', 'tts'];
    
    endpoints.forEach(endpoint => {
      this.trackers.set(endpoint, {
        requests: [],
        tokens: [],
        resetTime: Date.now() + 60000,
        totalRequestsToday: 0,
        totalTokensToday: 0,
        dailyResetTime: this.getNextMidnight(),
      });
    });
  }

  /**
   * Request permission to make an OpenAI API call
   */
  async requestPermission(
    endpoint: OpenAIEndpoint,
    estimatedTokens: number,
    priority: 'high' | 'medium' | 'low' = 'medium',
    maxRetries: number = 3
  ): Promise<void> {
    const requestId = generateRequestId();

    return new Promise<void>((resolve, reject) => {
      const queueItem: QueuedRequest = {
        id: requestId,
        endpoint,
        estimatedTokens,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
        retryCount: 0,
        maxRetries,
      };

      this.queue.push(queueItem);
      this.sortQueue();
      this.processQueue();
    });
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];
      
      try {
        await this.processRequest(request);
        this.queue.shift(); // Remove processed request
      } catch (_error) {
        // Handle failed request
        const currentRequest = this.queue.shift()!;
        
        if (currentRequest.retryCount < currentRequest.maxRetries) {
          // Retry with exponential backoff
          currentRequest.retryCount++;
          const delay = this.calculateBackoffDelay(currentRequest.retryCount);
          
          setTimeout(() => {
            this.queue.unshift(currentRequest); // Add back to front
            this.processQueue();
          }, delay);
        } else {
          // Max retries exceeded
          currentRequest.reject(
            new ProcessingError(
              'Rate limit exceeded and max retries reached',
              {
                endpoint: currentRequest.endpoint,
                estimatedTokens: currentRequest.estimatedTokens,
                retryCount: currentRequest.retryCount,
              },
              currentRequest.id
            )
          );
        }
      }
    }

    this.processing = false;
  }

  /**
   * Process individual request
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    const tracker = this.trackers.get(request.endpoint);
    if (!tracker) {
      throw new Error(`No tracker found for endpoint: ${request.endpoint}`);
    }

    // Check if we can proceed
    if (this.canProceed(request.endpoint, request.estimatedTokens)) {
      // Update tracking
      this.updateTracker(request.endpoint, request.estimatedTokens);
      request.resolve();
    } else {
      // Calculate wait time
      const waitTime = this.calculateWaitTime(request.endpoint);
      
      if (waitTime > 30000) { // If wait is longer than 30 seconds, reject
        throw new ProcessingError(
          'Rate limit wait time too long',
          {
            endpoint: request.endpoint,
            waitTime,
            estimatedTokens: request.estimatedTokens,
          },
          request.id
        );
      }

      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.processRequest(request); // Recursive retry
    }
  }

  /**
   * Check if request can proceed given current rate limits
   */
  private canProceed(endpoint: OpenAIEndpoint, estimatedTokens: number): boolean {
    const tracker = this.trackers.get(endpoint)!;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    tracker.requests = tracker.requests.filter(time => time > oneMinuteAgo);
    tracker.tokens = tracker.tokens.filter(time => time > oneMinuteAgo);

    // Check daily limits
    if (tracker.totalRequestsToday >= (this.currentLimits.requestsPerDay || Infinity)) {
      return false;
    }

    if (tracker.totalTokensToday + estimatedTokens > (this.currentLimits.tokensPerDay || Infinity)) {
      return false;
    }

    // Check minute limits
    if (tracker.requests.length >= this.currentLimits.requestsPerMinute) {
      return false;
    }

    const currentTokenCount = tracker.tokens.reduce((sum, _) => sum + estimatedTokens, 0);
    if (currentTokenCount + estimatedTokens > this.currentLimits.tokensPerMinute) {
      return false;
    }

    return true;
  }

  /**
   * Update tracker after successful request
   */
  private updateTracker(endpoint: OpenAIEndpoint, actualTokens: number): void {
    const tracker = this.trackers.get(endpoint)!;
    const now = Date.now();

    tracker.requests.push(now);
    tracker.tokens.push(actualTokens);
    tracker.totalRequestsToday++;
    tracker.totalTokensToday += actualTokens;

    // Reset daily counters if needed
    if (now > tracker.dailyResetTime) {
      tracker.totalRequestsToday = 1;
      tracker.totalTokensToday = actualTokens;
      tracker.dailyResetTime = this.getNextMidnight();
    }
  }

  /**
   * Calculate wait time for rate limit
   */
  private calculateWaitTime(endpoint: OpenAIEndpoint): number {
    const tracker = this.trackers.get(endpoint)!;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Find the oldest request/token usage that we need to wait for
    const oldestRequest = Math.min(...tracker.requests.filter(time => time > oneMinuteAgo));
    const oldestToken = Math.min(...tracker.tokens.filter(time => time > oneMinuteAgo));

    const requestWait = tracker.requests.length >= this.currentLimits.requestsPerMinute 
      ? oldestRequest + 60000 - now 
      : 0;

    const tokenWait = tracker.tokens.length >= this.currentLimits.tokensPerMinute
      ? oldestToken + 60000 - now
      : 0;

    return Math.max(requestWait, tokenWait, 1000); // Minimum 1 second wait
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(retryCount: number): number {
    const baseDelay = OPENAI_CONFIG.RATE_LIMITS.BACKOFF_MULTIPLIER || 2;
    const maxDelay = 60000; // 1 minute max
    const delay = Math.min(1000 * Math.pow(baseDelay, retryCount), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Sort queue by priority and timestamp
   */
  private sortQueue(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    
    this.queue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Update rate limits based on OpenAI API response headers
   */
  updateLimitsFromApiResponse(headers: Headers): void {
    const remainingRequests = headers.get('x-ratelimit-remaining-requests');
    const remainingTokens = headers.get('x-ratelimit-remaining-tokens');
    const limitRequests = headers.get('x-ratelimit-limit-requests');
    const limitTokens = headers.get('x-ratelimit-limit-tokens');

    if (limitRequests && limitTokens) {
      // Detect tier based on actual limits
      const detectedLimits: OpenAIRateLimits = {
        requestsPerMinute: parseInt(limitRequests, 10),
        tokensPerMinute: parseInt(limitTokens, 10),
      };

      this.currentLimits = { ...this.currentLimits, ...detectedLimits };
      
      // Log limit updates
      console.log('[OpenAI Rate Limiter] Updated rate limits from API response:', {
        requestsPerMinute: this.currentLimits.requestsPerMinute,
        tokensPerMinute: this.currentLimits.tokensPerMinute,
        remainingRequests: remainingRequests ? parseInt(remainingRequests, 10) : null,
        remainingTokens: remainingTokens ? parseInt(remainingTokens, 10) : null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Estimate tokens for a request
   */
  estimateTokens(
    endpoint: OpenAIEndpoint,
    input: string | number,
    maxTokens?: number
  ): number {
    const estimation = TOKEN_ESTIMATION[endpoint];
    let tokens = estimation.baseTokens;

    if (typeof input === 'string') {
      // Rough estimation: 1 token ≈ 4 characters
      const inputTokens = Math.ceil(input.length / 4);
      tokens += inputTokens * estimation.inputMultiplier;
    } else {
      tokens += input * estimation.inputMultiplier;
    }

    if (maxTokens) {
      tokens += maxTokens * estimation.outputMultiplier;
    }

    return Math.ceil(tokens);
  }

  /**
   * Get current rate limit status
   */
  getStatus(): Record<OpenAIEndpoint, {
    requestsUsed: number;
    tokensUsed: number;
    requestsRemaining: number;
    tokensRemaining: number;
    resetTime: number;
    queueSize: number;
  }> {
    const status: Record<OpenAIEndpoint, {
      requestsUsed: number;
      tokensUsed: number;
      requestsRemaining: number;
      tokensRemaining: number;
      resetTime: number;
      queueSize: number;
    }> = {} as Record<OpenAIEndpoint, {
      requestsUsed: number;
      tokensUsed: number;
      requestsRemaining: number;
      tokensRemaining: number;
      resetTime: number;
      queueSize: number;
    }>;
    
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    this.trackers.forEach((tracker, endpoint) => {
      const recentRequests = tracker.requests.filter(time => time > oneMinuteAgo);
      const recentTokens = tracker.tokens.filter(time => time > oneMinuteAgo);
      
      status[endpoint] = {
        requestsUsed: recentRequests.length,
        tokensUsed: recentTokens.length,
        requestsRemaining: this.currentLimits.requestsPerMinute - recentRequests.length,
        tokensRemaining: this.currentLimits.tokensPerMinute - recentTokens.length,
        resetTime: Math.max(...recentRequests, ...recentTokens) + 60000,
        queueSize: this.queue.filter(item => item.endpoint === endpoint).length,
      };
    });

    return status;
  }

  /**
   * Handle 429 rate limit error from OpenAI
   */
  async handleRateLimitError(
    endpoint: OpenAIEndpoint,
    error: Error & { status?: number; message: string },
    retryAfter?: number
  ): Promise<void> {
    const waitTime = retryAfter ? retryAfter * 1000 : this.calculateBackoffDelay(1);
    
    console.warn('[OpenAI Rate Limiter] 429 rate limit error from OpenAI API:', {
      endpoint,
      waitTime,
      error: error.message,
      retryAfter,
      timestamp: new Date().toISOString(),
    });

    return new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Get next midnight timestamp
   */
  private getNextMidnight(): number {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Reset rate limiter (for testing)
   */
  reset(): void {
    this.trackers.clear();
    this.queue = [];
    this.processing = false;
    this.initializeTrackers();
  }

  /**
   * Get queue information
   */
  getQueueInfo(): {
    totalSize: number;
    byEndpoint: Record<OpenAIEndpoint, number>;
    byPriority: Record<string, number>;
    avgWaitTime: number;
  } {
    const byEndpoint: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let totalWaitTime = 0;

    this.queue.forEach(item => {
      byEndpoint[item.endpoint] = (byEndpoint[item.endpoint] || 0) + 1;
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
      totalWaitTime += Date.now() - item.timestamp;
    });

    return {
      totalSize: this.queue.length,
      byEndpoint: byEndpoint as Record<OpenAIEndpoint, number>,
      byPriority,
      avgWaitTime: this.queue.length > 0 ? totalWaitTime / this.queue.length : 0,
    };
  }
}

// Export singleton instance
export const rateLimiter = OpenAIRateLimiter.getInstance();

// Helper function for easy integration
export async function withRateLimit<T>(
  endpoint: OpenAIEndpoint,
  operation: () => Promise<T>,
  estimatedTokens: number,
  priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<T> {
  await rateLimiter.requestPermission(endpoint, estimatedTokens, priority);
  
  try {
    const result = await operation();
    return result;
  } catch (error: unknown) {
    // Handle 429 errors specifically
    const err = error as Error & { status?: number; headers?: { get?: (key: string) => string | null } };
    if (err?.status === 429 || err?.message?.includes('rate limit')) {
      const retryAfter = err?.headers?.get?.('retry-after');
      await rateLimiter.handleRateLimitError(endpoint, err, retryAfter ? parseInt(retryAfter, 10) : undefined);
      throw error; // Re-throw for upstream handling
    }
    throw error;
  }
} 