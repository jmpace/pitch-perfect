// External Transport for Logging System
// Sends log entries to external logging services with batching and retry logic

import { LogTransport, LogLevel, LogEntry, LOG_LEVEL_VALUES, ExternalLoggingConfig } from '../types';

/**
 * External transport configuration
 */
export interface ExternalTransportConfig {
  name?: string;
  level: LogLevel;
  enabled?: boolean;
  externalConfig: ExternalLoggingConfig;
}

/**
 * Retry state for failed requests
 */
interface RetryState {
  attempts: number;
  nextRetryTime: number;
  entries: LogEntry[];
}

/**
 * External transport implementation
 */
export class ExternalTransport implements LogTransport {
  public readonly name: string;
  public readonly level: LogLevel;
  public readonly enabled: boolean;
  
  private config: Required<ExternalTransportConfig>;
  private buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private retryQueue: RetryState[] = [];
  private isProcessing = false;

  constructor(config: ExternalTransportConfig) {
    this.config = {
      name: config.name || 'external',
      level: config.level,
      enabled: config.enabled ?? true,
      externalConfig: config.externalConfig
    };
    
    this.name = this.config.name;
    this.level = this.config.level;
    this.enabled = this.config.enabled;

    // Start batch processing
    if (this.enabled && this.config.externalConfig.enabled) {
      this.startBatchProcessing();
    }
  }

  /**
   * Log an entry to the external service
   */
  async log(entry: LogEntry): Promise<void> {
    if (!this.enabled || !this.config.externalConfig.enabled || !this.shouldLog(entry.level)) {
      return;
    }

    // Add to buffer
    this.buffer.push(entry);
    
    // Flush if buffer is full
    if (this.buffer.length >= this.config.externalConfig.batchSize) {
      this.flushBuffer();
    }
  }

  /**
   * Check if this transport should log the given level
   */
  private shouldLog(entryLevel: LogLevel): boolean {
    return LOG_LEVEL_VALUES[entryLevel] >= LOG_LEVEL_VALUES[this.level];
  }

  /**
   * Start the batch processing timer
   */
  private startBatchProcessing(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
      this.processRetryQueue();
    }, this.config.externalConfig.flushInterval);
  }

  /**
   * Flush the current buffer
   */
  private flushBuffer(): void {
    if (this.buffer.length === 0 || this.isProcessing) {
      return;
    }

    const entriesToSend = [...this.buffer];
    this.buffer = [];
    
    this.sendToExternal(entriesToSend);
  }

  /**
   * Send entries to external logging service
   */
  private async sendToExternal(entries: LogEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      const payload = this.formatPayload(entries);
      
      switch (this.config.externalConfig.provider) {
        case 'datadog':
          await this.sendToDatadog(payload);
          break;
        case 'newrelic':
          await this.sendToNewRelic(payload);
          break;
        case 'logtail':
          await this.sendToLogtail(payload);
          break;
        case 'winston-cloudwatch':
          await this.sendToCloudWatch(payload);
          break;
        case 'custom':
          await this.sendToCustomEndpoint(payload);
          break;
        default:
          throw new Error(`Unsupported external provider: ${this.config.externalConfig.provider}`);
      }
      
    } catch (error) {
      console.error('Failed to send logs to external service:', error);
      
      // Add to retry queue
      this.addToRetryQueue(entries);
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Format payload for external service
   */
  private formatPayload(entries: LogEntry[]): unknown {
    return {
      logs: entries.map(entry => ({
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        component: entry.component,
        operation: entry.operation,
        requestId: entry.requestId,
        sessionId: entry.sessionId,
        userId: entry.userId,
        error: entry.error,
        data: entry.data,
        tags: entry.tags,
        duration: entry.duration,
        memoryUsage: entry.memoryUsage,
        environment: entry.environment,
        version: entry.version,
        buildId: entry.buildId
      })),
      metadata: {
        application: 'pitch-perfect',
        source: 'file-logging-transport',
        batchSize: entries.length,
        sentAt: new Date().toISOString()
      }
    };
  }

  /**
   * Send to Datadog
   */
  private async sendToDatadog(payload: unknown): Promise<void> {
    if (!this.config.externalConfig.apiKey) {
      throw new Error('Datadog API key is required');
    }

    const response = await fetch('https://http-intake.logs.datadoghq.com/v1/input/' + this.config.externalConfig.apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.config.externalConfig.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Datadog API error: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Send to New Relic
   */
  private async sendToNewRelic(payload: unknown): Promise<void> {
    if (!this.config.externalConfig.apiKey) {
      throw new Error('New Relic API key is required');
    }

    const response = await fetch('https://log-api.newrelic.com/log/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-License-Key': this.config.externalConfig.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`New Relic API error: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Send to Logtail
   */
  private async sendToLogtail(payload: unknown): Promise<void> {
    if (!this.config.externalConfig.apiKey) {
      throw new Error('Logtail API key is required');
    }

    const response = await fetch('https://in.logtail.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.externalConfig.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Logtail API error: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Send to CloudWatch (via AWS SDK would be better, but this is a basic implementation)
   */
  private async sendToCloudWatch(payload: unknown): Promise<void> {
    // This is a simplified implementation
    // In practice, you'd use the AWS SDK for CloudWatch Logs
    console.warn('CloudWatch integration requires AWS SDK implementation');
    throw new Error('CloudWatch integration not fully implemented');
  }

  /**
   * Send to custom endpoint
   */
  private async sendToCustomEndpoint(payload: unknown): Promise<void> {
    if (!this.config.externalConfig.endpoint) {
      throw new Error('Custom endpoint URL is required');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.externalConfig.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.externalConfig.apiKey}`;
    }

    const response = await fetch(this.config.externalConfig.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Custom endpoint error: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Add entries to retry queue
   */
  private addToRetryQueue(entries: LogEntry[]): void {
    const retryConfig = this.config.externalConfig.retryConfig;
    const now = Date.now();
    
    this.retryQueue.push({
      attempts: 0,
      nextRetryTime: now + retryConfig.retryDelay,
      entries
    });
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0 || this.isProcessing) {
      return;
    }

    const now = Date.now();
    const retryConfig = this.config.externalConfig.retryConfig;
    
    // Find entries ready for retry
    const readyForRetry = this.retryQueue.filter(item => now >= item.nextRetryTime);
    
    for (const retryItem of readyForRetry) {
      // Remove from queue
      const index = this.retryQueue.indexOf(retryItem);
      this.retryQueue.splice(index, 1);
      
      // Check max retries
      if (retryItem.attempts >= retryConfig.maxRetries) {
        console.error(`Giving up on ${retryItem.entries.length} log entries after ${retryItem.attempts} attempts`);
        continue;
      }
      
      // Retry sending
      retryItem.attempts++;
      
      try {
        await this.sendToExternal(retryItem.entries);
      } catch (error) {
        // Calculate next retry time with optional exponential backoff
        let delay = retryConfig.retryDelay;
        if (retryConfig.exponentialBackoff) {
          delay = delay * Math.pow(2, retryItem.attempts - 1);
        }
        
        retryItem.nextRetryTime = now + delay;
        this.retryQueue.push(retryItem);
      }
    }
  }

  /**
   * Flush any buffered logs
   */
  async flush(): Promise<void> {
    // Flush current buffer
    if (this.buffer.length > 0) {
      const entriesToFlush = [...this.buffer];
      this.buffer = [];
      await this.sendToExternal(entriesToFlush);
    }
    
    // Process retry queue
    await this.processRetryQueue();
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    // Stop the timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Flush any remaining logs
    await this.flush();
  }

  /**
   * Update transport configuration
   */
  updateConfig(newConfig: Partial<ExternalTransportConfig>): void {
    this.config = { ...this.config, ...newConfig } as Required<ExternalTransportConfig>;
    
    // Restart batch processing if config changed
    if (this.enabled && this.config.externalConfig.enabled) {
      this.startBatchProcessing();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ExternalTransportConfig> {
    return { ...this.config };
  }

  /**
   * Get transport statistics
   */
  getStats(): {
    bufferSize: number;
    retryQueueSize: number;
    isProcessing: boolean;
    provider: string;
  } {
    return {
      bufferSize: this.buffer.length,
      retryQueueSize: this.retryQueue.length,
      isProcessing: this.isProcessing,
      provider: this.config.externalConfig.provider
    };
  }
} 