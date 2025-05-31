// Main Logger Class
// Orchestrates all logging transports and provides the primary logging interface

import { 
  LogLevel, 
  LogEntry, 
  LogConfig, 
  LogTransport, 
  LoggingMetrics, 
  LoggingContext,
  LOG_LEVEL_VALUES 
} from './types';
import { SensitiveDataSanitizer } from './sensitive-data-sanitizer';
import { EnhancedErrorInfo } from '../errors/error-categorization';
import { BaseStorageError } from '../errors/types';

/**
 * Main Logger class that coordinates all logging operations
 */
export class Logger {
  private config: LogConfig;
  private transports: LogTransport[] = [];
  private sanitizer: SensitiveDataSanitizer;
  private buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private metrics: LoggingMetrics;
  private contextStack: LoggingContext[] = [];
  private isShuttingDown = false;

  constructor(config: LogConfig) {
    this.config = config;
    this.sanitizer = new SensitiveDataSanitizer(config.sensitiveData);
    this.transports = config.transports;
    
    // Initialize metrics
    this.metrics = {
      totalLogs: 0,
      logsByLevel: {
        [LogLevel.ERROR]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.DEBUG]: 0,
        [LogLevel.TRACE]: 0
      },
      averageLogTime: 0,
      transportErrors: 0,
      bufferOverflows: 0
    };

    // Start async processing if enabled
    if (config.asyncLogging) {
      this.startAsyncProcessing();
    }

    // Handle process shutdown
    this.setupShutdownHandlers();
  }

  /**
   * Log an error with enhanced error information
   */
  error(message: string, error?: Error | BaseStorageError, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, { error: this.formatError(error), data });
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, { data });
  }

  /**
   * Log an info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, { data });
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, { data });
  }

  /**
   * Log a trace message
   */
  trace(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, { data });
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel, 
    message: string, 
    options: {
      error?: { name: string; message: string; stack?: string; code?: string; statusCode?: number; enhancedInfo?: EnhancedErrorInfo };
      data?: Record<string, unknown>;
      component?: string;
      operation?: string;
      requestId?: string;
      sessionId?: string;
      userId?: string;
      tags?: string[];
      duration?: number;
    } = {}
  ): void {
    // Check if logging is enabled and level is appropriate
    if (!this.config.enabled || !this.shouldLog(level)) {
      return;
    }

    const startTime = Date.now();

    try {
      // Get current context
      const currentContext = this.getCurrentContext();
      
      // Create log entry
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        component: options.component || currentContext?.component,
        operation: options.operation || currentContext?.operation,
        requestId: options.requestId || currentContext?.requestId,
        sessionId: options.sessionId,
        userId: options.userId,
        error: options.error,
        data: options.data,
        tags: options.tags,
        duration: options.duration,
        environment: this.config.environment,
        version: this.config.version,
        buildId: this.config.buildId
      };

      // Add memory usage if enabled
      if (this.config.includeMemoryUsage) {
        entry.memoryUsage = process.memoryUsage().heapUsed;
      }

      // Sanitize sensitive data
      const sanitizedEntry = this.sanitizer.sanitize(entry);

      // Update metrics
      this.updateMetrics(level, Date.now() - startTime);

      // Process the log entry
      if (this.config.asyncLogging) {
        this.addToBuffer(sanitizedEntry);
      } else {
        this.processLogEntry(sanitizedEntry);
      }

    } catch (error) {
      console.error('Logging system error:', error);
      this.metrics.transportErrors++;
    }
  }

  /**
   * Check if this level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.config.level];
  }

  /**
   * Format error for logging
   */
  private formatError(error?: Error | BaseStorageError): LogEntry['error'] | undefined {
    if (!error) return undefined;

    const formatted: LogEntry['error'] = {
      name: error.name,
      message: error.message
    };

    if (this.config.includeStackTrace && error.stack) {
      formatted.stack = error.stack;
    }

    // Add enhanced error info if available
    if ('code' in error) {
      formatted.code = error.code;
    }

    if ('statusCode' in error) {
      formatted.statusCode = error.statusCode;
    }

    if ('getEnhancedInfo' in error && typeof error.getEnhancedInfo === 'function') {
      formatted.enhancedInfo = error.getEnhancedInfo();
    }

    return formatted;
  }

  /**
   * Add entry to async buffer
   */
  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);

    // Check for buffer overflow
    if (this.buffer.length >= this.config.bufferSize) {
      if (this.config.bufferSize > 0) {
        this.metrics.bufferOverflows++;
        // Remove oldest entries to make room
        this.buffer = this.buffer.slice(-this.config.bufferSize);
      }
      this.flushBuffer();
    }
  }

  /**
   * Process a log entry through all transports
   */
  private async processLogEntry(entry: LogEntry): Promise<void> {
    const promises = this.transports
      .filter(transport => transport.enabled)
      .map(async transport => {
        try {
          await transport.log(entry);
        } catch (error) {
          console.error(`Transport ${transport.name} failed:`, error);
          this.metrics.transportErrors++;
        }
      });

    await Promise.allSettled(promises);
  }

  /**
   * Start async processing
   */
  private startAsyncProcessing(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush buffer periodically
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, 1000); // Flush every second
  }

  /**
   * Flush the buffer
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const entriesToProcess = [...this.buffer];
    this.buffer = [];

    // Process all entries
    for (const entry of entriesToProcess) {
      await this.processLogEntry(entry);
    }

    this.metrics.lastFlushTime = new Date().toISOString();
  }

  /**
   * Update logging metrics
   */
  private updateMetrics(level: LogLevel, processingTime: number): void {
    this.metrics.totalLogs++;
    this.metrics.logsByLevel[level]++;
    
    // Update average processing time
    const totalTime = this.metrics.averageLogTime * (this.metrics.totalLogs - 1) + processingTime;
    this.metrics.averageLogTime = totalTime / this.metrics.totalLogs;
  }

  /**
   * Get current context from stack
   */
  private getCurrentContext(): LoggingContext | undefined {
    return this.contextStack[this.contextStack.length - 1];
  }

  /**
   * Push a new logging context
   */
  pushContext(context: LoggingContext): void {
    this.contextStack.push(context);
  }

  /**
   * Pop the current logging context
   */
  popContext(): LoggingContext | undefined {
    return this.contextStack.pop();
  }

  /**
   * Create a scoped logger with context
   */
  withContext(context: Partial<LoggingContext>): Logger {
    const scopedLogger = new Logger(this.config);
    scopedLogger.transports = this.transports;
    scopedLogger.contextStack = [...this.contextStack];
    
    if (context.requestId || context.operation || context.component) {
      scopedLogger.pushContext({
        requestId: context.requestId || 'unknown',
        operation: context.operation,
        component: context.component,
        startTime: Date.now(),
        metadata: context.metadata
      });
    }
    
    return scopedLogger;
  }

  /**
   * Time an operation
   */
  async time<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.debug(`Starting operation: ${operation}`);
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.info(`Operation completed: ${operation}`, { duration });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`Operation failed: ${operation}`, error as Error, { duration });
      throw error;
    }
  }

  /**
   * Add a transport
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * Remove a transport
   */
  removeTransport(transportName: string): boolean {
    const index = this.transports.findIndex(t => t.name === transportName);
    if (index >= 0) {
      this.transports.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update logger configuration
   */
  updateConfig(newConfig: Partial<LogConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.sensitiveData) {
      this.sanitizer.updateConfig(newConfig.sensitiveData);
    }
    
    if (newConfig.asyncLogging !== undefined) {
      if (newConfig.asyncLogging && !this.flushTimer) {
        this.startAsyncProcessing();
      } else if (!newConfig.asyncLogging && this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = undefined;
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): LoggingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current configuration
   */
  getConfig(): LogConfig {
    return { ...this.config };
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    // Flush internal buffer first
    await this.flushBuffer();
    
    // Flush all transports
    const promises = this.transports.map(async transport => {
      if (transport.flush) {
        try {
          await transport.flush();
        } catch (error) {
          console.error(`Failed to flush transport ${transport.name}:`, error);
        }
      }
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Setup shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      try {
        await this.flush();
        
        // Close all transports
        const promises = this.transports.map(async transport => {
          if (transport.close) {
            try {
              await transport.close();
            } catch (error) {
              console.error(`Failed to close transport ${transport.name}:`, error);
            }
          }
        });
        
        await Promise.allSettled(promises);
      } catch (error) {
        console.error('Error during logger shutdown:', error);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', shutdown);
  }

  /**
   * Manually shutdown the logger
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    await this.flush();
    
    // Close all transports
    for (const transport of this.transports) {
      if (transport.close) {
        try {
          await transport.close();
        } catch (error) {
          console.error(`Failed to close transport ${transport.name}:`, error);
        }
      }
    }
  }
} 