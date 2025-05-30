// Enhanced Error Handling Service with Circuit Breaker and Retry Logic
import { 
  BaseStorageError, 
  InternalServerError
} from './errors/types';
import { logError, normalizeError } from './errors/handlers';

// Circuit Breaker States
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

// Circuit Breaker Configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  minimumThroughput: number;
}

// Retry Configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Error Monitoring Configuration
export interface ErrorMonitoringConfig {
  alertThreshold: number;
  monitoringWindow: number;
  enableRealTimeAlerts: boolean;
}

// Circuit Breaker Implementation
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private requestCount = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly serviceName: string;

  constructor(serviceName: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.serviceName = serviceName;
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      minimumThroughput: 10,
      ...config
    };
  }

  async execute<T>(operation: () => Promise<T>, requestId: string): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new InternalServerError(
          `Circuit breaker is OPEN for ${this.serviceName}`,
          { 
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: new Date(this.lastFailureTime).toISOString()
          },
          requestId
        );
      }
    }

    this.requestCount++;
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = CircuitBreakerState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.shouldOpenCircuit()) {
      this.state = CircuitBreakerState.OPEN;
      logError(new InternalServerError(
        `Circuit breaker opened for ${this.serviceName}`,
        { 
          failureCount: this.failureCount,
          threshold: this.config.failureThreshold
        }
      ), { context: 'circuit-breaker' });
    }
  }

  private shouldOpenCircuit(): boolean {
    return (
      this.failureCount >= this.config.failureThreshold &&
      this.requestCount >= this.config.minimumThroughput
    );
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics(): {
    state: CircuitBreakerState;
    failureCount: number;
    requestCount: number;
    successRate: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      requestCount: this.requestCount,
      successRate: this.requestCount > 0 ? 
        ((this.requestCount - this.failureCount) / this.requestCount) * 100 : 0
    };
  }
}

// Enhanced Retry Logic with Exponential Backoff
export class RetryHandler {
  private readonly config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'INTERNAL_SERVER_ERROR',
        'VIDEO_PROCESSING_ERROR'
      ],
      ...config
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    requestId: string,
    context?: string
  ): Promise<T> {
    let lastError: BaseStorageError;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = normalizeError(error, requestId);
        
        // Don't retry if error is not retryable
        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }
        
        // Don't retry on last attempt
        if (attempt === this.config.maxAttempts) {
          break;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        
        logError(lastError, {
          context: context || 'retry-handler',
          attempt,
          maxAttempts: this.config.maxAttempts,
          nextRetryIn: delay
        });
        
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private isRetryableError(error: BaseStorageError): boolean {
    return this.config.retryableErrors.includes(error.code);
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelayMs * 
      Math.pow(this.config.backoffMultiplier, attempt - 1);
    
    // Add jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    const delayWithJitter = exponentialDelay + jitter;
    
    return Math.min(delayWithJitter, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Error Monitoring and Alerting
export class ErrorMonitor {
  private errorCounts = new Map<string, number[]>();
  private readonly config: ErrorMonitoringConfig;

  constructor(config: Partial<ErrorMonitoringConfig> = {}) {
    this.config = {
      alertThreshold: 10,
      monitoringWindow: 300000, // 5 minutes
      enableRealTimeAlerts: true,
      ...config
    };
  }

  recordError(error: BaseStorageError, context?: string): void {
    const now = Date.now();
    const key = `${error.code}:${context || 'unknown'}`;
    
    // Get existing timestamps for this error type
    const timestamps = this.errorCounts.get(key) || [];
    
    // Remove old timestamps outside the monitoring window
    const windowStart = now - this.config.monitoringWindow;
    const recentTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
    
    // Add current timestamp
    recentTimestamps.push(now);
    this.errorCounts.set(key, recentTimestamps);
    
    // Check if alert threshold is exceeded
    if (recentTimestamps.length >= this.config.alertThreshold) {
      this.triggerAlert(error, recentTimestamps.length, context);
    }
    
    // Cleanup old entries periodically
    this.cleanup();
  }

  private triggerAlert(error: BaseStorageError, count: number, context?: string): void {
    if (!this.config.enableRealTimeAlerts) return;
    
    const alertError = new InternalServerError(
      `High error rate detected: ${error.code}`,
      {
        errorCode: error.code,
        count,
        threshold: this.config.alertThreshold,
        windowMinutes: this.config.monitoringWindow / 60000,
        context
      }
    );
    
    logError(alertError, { context: 'error-monitor-alert' });
    
    // In production, you would send this to your alerting system
    console.error('🚨 ERROR ALERT:', {
      errorCode: error.code,
      count,
      context,
      message: `${count} occurrences of ${error.code} in the last ${this.config.monitoringWindow / 60000} minutes`
    });
  }

  private cleanup(): void {
    if (Math.random() < 0.01) { // 1% chance
      const now = Date.now();
      const windowStart = now - this.config.monitoringWindow;
      
      for (const [key, timestamps] of this.errorCounts.entries()) {
        const recentTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
        if (recentTimestamps.length === 0) {
          this.errorCounts.delete(key);
        } else {
          this.errorCounts.set(key, recentTimestamps);
        }
      }
    }
  }

  getErrorStats(): Record<string, { count: number; rate: number }> {
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;
    const stats: Record<string, { count: number; rate: number }> = {};
    
    for (const [key, timestamps] of this.errorCounts.entries()) {
      const recentTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
      const rate = (recentTimestamps.length / (this.config.monitoringWindow / 60000)); // errors per minute
      
      stats[key] = {
        count: recentTimestamps.length,
        rate: Math.round(rate * 100) / 100
      };
    }
    
    return stats;
  }
}

// Enhanced Error Handling Service
export class EnhancedErrorHandler {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private retryHandler: RetryHandler;
  private errorMonitor: ErrorMonitor;

  constructor(
    retryConfig?: Partial<RetryConfig>,
    monitoringConfig?: Partial<ErrorMonitoringConfig>
  ) {
    this.retryHandler = new RetryHandler(retryConfig);
    this.errorMonitor = new ErrorMonitor(monitoringConfig);
  }

  getCircuitBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(serviceName, config));
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  async executeWithProtection<T>(
    operation: () => Promise<T>,
    serviceName: string,
    requestId: string,
    context?: string
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceName);
    
    try {
      return await circuitBreaker.execute(async () => {
        return await this.retryHandler.execute(operation, requestId, context);
      }, requestId);
    } catch (error) {
      const normalizedError = normalizeError(error, requestId);
      this.errorMonitor.recordError(normalizedError, context);
      throw normalizedError;
    }
  }

  getSystemHealth(): {
    circuitBreakers: Record<string, ReturnType<CircuitBreaker['getMetrics']>>;
    errorStats: Record<string, { count: number; rate: number }>;
  } {
    const circuitBreakers: Record<string, ReturnType<CircuitBreaker['getMetrics']>> = {};
    
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      circuitBreakers[name] = breaker.getMetrics();
    }
    
    return {
      circuitBreakers,
      errorStats: this.errorMonitor.getErrorStats()
    };
  }
}

// Global instance
export const enhancedErrorHandler = new EnhancedErrorHandler(); 