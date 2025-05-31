// Centralized Logging System for Pitch Perfect Application
// Main entry point for all logging functionality

export { Logger } from './logger';
export type { LogLevel, LogEntry, LogConfig, LogTransport, LogRotationConfig } from './types';
export { ConsoleTransport } from './transports/console-transport';
export { FileTransport } from './transports/file-transport';
export { ExternalTransport } from './transports/external-transport';
export { SensitiveDataSanitizer } from './sensitive-data-sanitizer';
export { LogRotationManager } from './log-rotation-manager';
export { 
  createDefaultLogger, 
  createDevelopmentLogger, 
  createProductionLogger, 
  createTestLogger,
  getEnvironmentLogger,
  logger,
  devLogger,
  prodLogger
} from './default-config';

// Re-export convenience functions
export { 
  logError, 
  logWarning, 
  logInfo, 
  logDebug, 
  logTrace 
} from './convenience';

// Default logger instance for convenient usage
export { logger as default } from './default-config'; 