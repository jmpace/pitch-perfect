// Convenience Functions for Logging
// Provides easy access to logging functionality using the default logger

import { logger } from './default-config';
import { BaseStorageError } from '../errors/types';

/**
 * Log an error message with optional error object and data
 */
export function logError(message: string, error?: Error | BaseStorageError, data?: Record<string, unknown>): void {
  logger.error(message, error, data);
}

/**
 * Log a warning message with optional data
 */
export function logWarning(message: string, data?: Record<string, unknown>): void {
  logger.warn(message, data);
}

/**
 * Log an info message with optional data
 */
export function logInfo(message: string, data?: Record<string, unknown>): void {
  logger.info(message, data);
}

/**
 * Log a debug message with optional data
 */
export function logDebug(message: string, data?: Record<string, unknown>): void {
  logger.debug(message, data);
}

/**
 * Log a trace message with optional data
 */
export function logTrace(message: string, data?: Record<string, unknown>): void {
  logger.trace(message, data);
} 