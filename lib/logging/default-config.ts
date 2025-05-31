// Default Configuration and Logger Instance
// Provides sensible defaults and a ready-to-use logger instance

import { LogLevel, LogConfig } from './types';
import { Logger } from './logger';
import { ConsoleTransport } from './transports/console-transport';
import { FileTransport } from './transports/file-transport';

/**
 * Get environment-specific default configuration
 */
export function createDefaultConfig(): LogConfig {
  const nodeEnv = process.env.NODE_ENV;
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';
  const isNonDevelopment = !isDevelopment; // Use this for staging and production file logging
  
  return {
    // Basic settings
    level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
    enabled: true,
    
    // Environment settings
    environment: (nodeEnv as 'development' | 'staging' | 'production') || 'development',
    isDevelopment,
    
    // Application info
    applicationName: 'pitch-perfect',
    version: process.env.npm_package_version || '1.0.0',
    buildId: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    
    // Features
    includeStackTrace: !isProduction,
    includeMemoryUsage: isDevelopment,
    asyncLogging: !isDevelopment, // Sync logging in dev for immediate feedback
    bufferSize: 100,
    
    // Sensitive data handling
    sensitiveData: {
      enabled: true,
      sensitiveFields: [
        // Add application-specific sensitive fields
        'openai_api_key',
        'anthropic_api_key',
        'blob_token',
        'user_password',
        'session_token'
      ],
      sanitizationMethod: 'mask'
    },
    
    // Log rotation
    rotation: {
      enabled: true,
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      compress: true,
      rotationPattern: '%b-%t'
    },
    
    // Transports
    transports: [
      // Console transport for all environments
      new ConsoleTransport({
        level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
        colorize: isDevelopment,
        prettyPrint: isDevelopment,
        timestampFormat: isDevelopment ? 'time-only' : 'iso'
      }),
      
      // File transport for production and staging (any non-development environment)
      ...(isNonDevelopment && nodeEnv !== 'test' ? [
        new FileTransport({
          level: LogLevel.INFO,
          filename: 'application.log',
          directory: './logs',
          format: 'json',
          rotation: {
            enabled: true,
            maxSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10,
            compress: true
          },
          buffer: {
            enabled: true,
            size: 100,
            flushInterval: 5000
          }
        })
      ] : [])
    ],
    
    // Output formatting
    formatting: {
      timestamp: isDevelopment ? 'readable' : 'iso',
      colorize: isDevelopment,
      prettyPrint: isDevelopment
    }
  };
}

/**
 * Create a logger with default configuration
 */
export function createDefaultLogger(): Logger {
  const config = createDefaultConfig();
  return new Logger(config);
}

/**
 * Create a development-optimized logger
 */
export function createDevelopmentLogger(): Logger {
  const config = createDefaultConfig();
  
  // Override for development
  config.level = LogLevel.TRACE;
  config.includeStackTrace = true;
  config.includeMemoryUsage = true;
  config.asyncLogging = false;
  config.sensitiveData.enabled = false; // Disable sanitization in dev
  
  // Development-friendly console transport
  config.transports = [
    new ConsoleTransport({
      level: LogLevel.TRACE,
      colorize: true,
      prettyPrint: true,
      timestampFormat: 'time-only',
      maxMessageLength: 500
    })
  ];
  
  return new Logger(config);
}

/**
 * Create a production-optimized logger
 */
export function createProductionLogger(): Logger {
  const config = createDefaultConfig();
  
  // Override for production
  config.level = LogLevel.WARN;
  config.includeStackTrace = false;
  config.includeMemoryUsage = false;
  config.asyncLogging = true;
  config.bufferSize = 200;
  
  // Production transports
  config.transports = [
    // Minimal console output
    new ConsoleTransport({
      level: LogLevel.ERROR,
      colorize: false,
      prettyPrint: false,
      timestampFormat: 'iso'
    }),
    
    // Comprehensive file logging
    new FileTransport({
      level: LogLevel.WARN,
      filename: 'application.log',
      directory: './logs',
      format: 'json',
      rotation: {
        enabled: true,
        maxSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 20,
        compress: true
      },
      buffer: {
        enabled: true,
        size: 200,
        flushInterval: 3000
      }
    })
  ];
  
  return new Logger(config);
}

/**
 * Create a logger optimized for testing
 */
export function createTestLogger(): Logger {
  const config = createDefaultConfig();
  
  // Override for testing
  config.level = LogLevel.ERROR; // Only log errors during tests
  config.asyncLogging = false; // Synchronous for testing
  config.includeStackTrace = true;
  config.sensitiveData.enabled = false;
  
  // Test-friendly console transport only
  config.transports = [
    new ConsoleTransport({
      level: LogLevel.ERROR,
      colorize: false,
      prettyPrint: false,
      timestampFormat: 'iso'
    })
  ];
  
  return new Logger(config);
}

/**
 * Default logger instance
 * This is the main logger that should be used throughout the application
 */
export const logger = createDefaultLogger();

/**
 * Development logger instance (when explicitly needed)
 */
export const devLogger = process.env.NODE_ENV === 'development' 
  ? createDevelopmentLogger() 
  : logger;

/**
 * Production logger instance (when explicitly needed)
 */
export const prodLogger = process.env.NODE_ENV === 'production' 
  ? createProductionLogger() 
  : logger;

/**
 * Helper function to get appropriate logger for current environment
 */
export function getEnvironmentLogger(): Logger {
  switch (process.env.NODE_ENV) {
    case 'test':
      return createTestLogger();
    case 'development':
      return createDevelopmentLogger();
    case 'production':
      return createProductionLogger();
    default:
      return createDefaultLogger();
  }
} 