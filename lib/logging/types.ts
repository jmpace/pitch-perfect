// Type definitions for the logging system

import { EnhancedErrorInfo } from '../errors/error-categorization';

/**
 * Log levels in order of severity (highest to lowest)
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

/**
 * Numeric values for log levels (for filtering and comparison)
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 50,
  [LogLevel.WARN]: 40,
  [LogLevel.INFO]: 30,
  [LogLevel.DEBUG]: 20,
  [LogLevel.TRACE]: 10
};

/**
 * Core log entry structure
 */
export interface LogEntry {
  // Core identification
  timestamp: string;
  level: LogLevel;
  message: string;
  
  // Context information
  component?: string;
  operation?: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  
  // Error information (when logging errors)
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    statusCode?: number;
    enhancedInfo?: EnhancedErrorInfo;
  };
  
  // Additional data
  data?: Record<string, unknown>;
  tags?: string[];
  
  // Performance metrics
  duration?: number;
  memoryUsage?: number;
  
  // Environment info
  environment?: string;
  version?: string;
  buildId?: string;
}

/**
 * Configuration for log rotation
 */
export interface LogRotationConfig {
  enabled: boolean;
  maxSize: number; // in bytes
  maxFiles: number;
  compress: boolean;
  rotationPattern: string; // filename pattern for rotated files
}

/**
 * Configuration for sensitive data sanitization
 */
export interface SensitiveDataConfig {
  enabled: boolean;
  sensitiveFields: string[]; // field names to sanitize
  sanitizationMethod: 'mask' | 'hash' | 'remove';
  customSanitizers?: Record<string, (value: unknown) => unknown>;
}

/**
 * Transport interface for different logging destinations
 */
export interface LogTransport {
  name: string;
  level: LogLevel;
  enabled: boolean;
  log(entry: LogEntry): Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

/**
 * Main logger configuration
 */
export interface LogConfig {
  // Basic settings
  level: LogLevel;
  enabled: boolean;
  
  // Environment settings
  environment: 'development' | 'staging' | 'production';
  isDevelopment: boolean;
  
  // Application info
  applicationName: string;
  version?: string;
  buildId?: string;
  
  // Features
  includeStackTrace: boolean;
  includeMemoryUsage: boolean;
  asyncLogging: boolean;
  bufferSize: number; // for async logging
  
  // Sensitive data handling
  sensitiveData: SensitiveDataConfig;
  
  // Log rotation
  rotation: LogRotationConfig;
  
  // Transports
  transports: LogTransport[];
  
  // Output formatting
  formatting: {
    timestamp: 'iso' | 'unix' | 'readable';
    colorize: boolean;
    prettyPrint: boolean;
  };
}

/**
 * Performance metrics for logging operations
 */
export interface LoggingMetrics {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  averageLogTime: number;
  transportErrors: number;
  bufferOverflows: number;
  lastFlushTime?: string;
}

/**
 * Context for request-scoped logging
 */
export interface LoggingContext {
  requestId: string;
  operation?: string;
  component?: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

/**
 * External logging service configuration
 */
export interface ExternalLoggingConfig {
  enabled: boolean;
  provider: 'datadog' | 'newrelic' | 'logtail' | 'winston-cloudwatch' | 'custom';
  endpoint?: string;
  apiKey?: string;
  region?: string;
  batchSize: number;
  flushInterval: number; // milliseconds
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };
}

/**
 * Log query interface for retrieving logs
 */
export interface LogQuery {
  level?: LogLevel | LogLevel[];
  startTime?: string;
  endTime?: string;
  component?: string;
  operation?: string;
  requestId?: string;
  userId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Log search result
 */
export interface LogSearchResult {
  entries: LogEntry[];
  totalCount: number;
  hasMore: boolean;
  queryTime: number;
} 