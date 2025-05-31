// Console Transport for Logging System
// Outputs formatted log entries to the console with optional color coding

import { LogTransport, LogLevel, LogEntry, LOG_LEVEL_VALUES } from '../types';

/**
 * ANSI color codes for console output
 */
const COLORS = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

/**
 * Color mapping for log levels
 */
const LEVEL_COLORS = {
  [LogLevel.ERROR]: COLORS.red,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.INFO]: COLORS.blue,
  [LogLevel.DEBUG]: COLORS.green,
  [LogLevel.TRACE]: COLORS.gray
};

/**
 * Console transport configuration
 */
export interface ConsoleTransportConfig {
  name?: string;
  level: LogLevel;
  enabled?: boolean;
  colorize?: boolean;
  prettyPrint?: boolean;
  includeTimestamp?: boolean;
  includeLevel?: boolean;
  includeComponent?: boolean;
  timestampFormat?: 'iso' | 'readable' | 'time-only';
  maxMessageLength?: number;
}

/**
 * Console transport implementation
 */
export class ConsoleTransport implements LogTransport {
  public readonly name: string;
  public readonly level: LogLevel;
  public readonly enabled: boolean;
  
  private config: Required<ConsoleTransportConfig>;

  constructor(config: ConsoleTransportConfig) {
    this.config = {
      name: config.name || 'console',
      level: config.level,
      enabled: config.enabled ?? true,
      colorize: config.colorize ?? true,
      prettyPrint: config.prettyPrint ?? true,
      includeTimestamp: config.includeTimestamp ?? true,
      includeLevel: config.includeLevel ?? true,
      includeComponent: config.includeComponent ?? true,
      timestampFormat: config.timestampFormat || 'readable',
      maxMessageLength: config.maxMessageLength || 1000
    };
    
    this.name = this.config.name;
    this.level = this.config.level;
    this.enabled = this.config.enabled;
  }

  /**
   * Log an entry to the console
   */
  async log(entry: LogEntry): Promise<void> {
    if (!this.enabled || !this.shouldLog(entry.level)) {
      return;
    }

    const formattedMessage = this.formatMessage(entry);
    const consoleMethod = this.getConsoleMethod(entry.level);
    
    consoleMethod(formattedMessage);

    // If pretty print is enabled and there's additional data, log it separately
    if (this.config.prettyPrint) {
      this.logAdditionalData(entry);
    }
  }

  /**
   * Check if this transport should log the given level
   */
  private shouldLog(entryLevel: LogLevel): boolean {
    return LOG_LEVEL_VALUES[entryLevel] >= LOG_LEVEL_VALUES[this.level];
  }

  /**
   * Get the appropriate console method for the log level
   */
  private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
      case LogLevel.ERROR:
        return console.error;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
      default:
        return console.log;
    }
  }

  /**
   * Format the main log message
   */
  private formatMessage(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.config.includeTimestamp) {
      const timestamp = this.formatTimestamp(entry.timestamp);
      parts.push(this.colorize(timestamp, COLORS.gray));
    }

    // Log level
    if (this.config.includeLevel) {
      const levelStr = `[${entry.level.toUpperCase()}]`;
      const coloredLevel = this.colorize(levelStr, LEVEL_COLORS[entry.level], true);
      parts.push(coloredLevel);
    }

    // Component
    if (this.config.includeComponent && entry.component) {
      const component = `{${entry.component}}`;
      parts.push(this.colorize(component, COLORS.cyan));
    }

    // Operation
    if (entry.operation) {
      const operation = `<${entry.operation}>`;
      parts.push(this.colorize(operation, COLORS.magenta));
    }

    // Request ID (shortened)
    if (entry.requestId) {
      const shortId = entry.requestId.substring(0, 8);
      const requestId = `(${shortId})`;
      parts.push(this.colorize(requestId, COLORS.yellow));
    }

    // Main message
    let message = entry.message;
    if (this.config.maxMessageLength && message.length > this.config.maxMessageLength) {
      message = message.substring(0, this.config.maxMessageLength) + '...';
    }
    parts.push(message);

    // Duration (if available)
    if (entry.duration !== undefined) {
      const duration = `+${entry.duration}ms`;
      parts.push(this.colorize(duration, COLORS.green));
    }

    return parts.join(' ');
  }

  /**
   * Log additional data (error details, data object, etc.)
   */
  private logAdditionalData(entry: LogEntry): void {
    // Error details
    if (entry.error) {
      console.group(this.colorize('Error Details:', COLORS.red, true));
      
      if (entry.error.stack) {
        console.log(this.colorize('Stack Trace:', COLORS.dim));
        console.log(entry.error.stack);
      }
      
      if (entry.error.enhancedInfo) {
        console.log(this.colorize('Enhanced Error Info:', COLORS.dim));
        console.log(JSON.stringify(entry.error.enhancedInfo, null, 2));
      }
      
      console.groupEnd();
    }

    // Additional data
    if (entry.data && Object.keys(entry.data).length > 0) {
      console.group(this.colorize('Additional Data:', COLORS.blue, true));
      console.log(JSON.stringify(entry.data, null, 2));
      console.groupEnd();
    }

    // Tags
    if (entry.tags && entry.tags.length > 0) {
      const tagsStr = entry.tags.map(tag => `#${tag}`).join(' ');
      console.log(this.colorize(`Tags: ${tagsStr}`, COLORS.gray));
    }

    // Memory usage
    if (entry.memoryUsage) {
      const memoryStr = `Memory: ${(entry.memoryUsage / 1024 / 1024).toFixed(2)}MB`;
      console.log(this.colorize(memoryStr, COLORS.gray));
    }
  }

  /**
   * Format timestamp based on configuration
   */
  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    
    switch (this.config.timestampFormat) {
      case 'iso':
        return timestamp;
      
      case 'time-only':
        return date.toTimeString().split(' ')[0];
      
      case 'readable':
      default:
        return date.toLocaleString();
    }
  }

  /**
   * Apply colors to text if colorization is enabled
   */
  private colorize(text: string, color: string, bold = false): string {
    if (!this.config.colorize) {
      return text;
    }

    let coloredText = color + text + COLORS.reset;
    if (bold) {
      coloredText = COLORS.bold + coloredText;
    }
    
    return coloredText;
  }

  /**
   * Update transport configuration
   */
  updateConfig(newConfig: Partial<ConsoleTransportConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ConsoleTransportConfig> {
    return { ...this.config };
  }

  /**
   * Flush any buffered logs (no-op for console)
   */
  async flush(): Promise<void> {
    // Console output is immediate, no flushing needed
  }

  /**
   * Close the transport (no-op for console)
   */
  async close(): Promise<void> {
    // Nothing to close for console transport
  }
} 