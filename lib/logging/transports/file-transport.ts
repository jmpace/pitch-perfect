// File Transport for Logging System
// Writes log entries to local files with rotation and buffering

import { LogTransport, LogLevel, LogEntry, LOG_LEVEL_VALUES } from '../types';
import { writeFile, appendFile, mkdir, stat, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * File transport configuration
 */
export interface FileTransportConfig {
  name?: string;
  level: LogLevel;
  enabled?: boolean;
  filename: string;
  directory?: string;
  format?: 'json' | 'text';
  rotation?: {
    enabled: boolean;
    maxSize: number; // bytes
    maxFiles: number;
    compress?: boolean;
  };
  buffer?: {
    enabled: boolean;
    size: number; // number of entries
    flushInterval: number; // milliseconds
  };
}

/**
 * File transport implementation with rotation and buffering
 */
export class FileTransport implements LogTransport {
  public readonly name: string;
  public readonly level: LogLevel;
  public readonly enabled: boolean;
  
  private config: Required<FileTransportConfig>;
  private buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isWriting = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(config: FileTransportConfig) {
    this.config = {
      name: config.name || 'file',
      level: config.level,
      enabled: config.enabled ?? true,
      filename: config.filename,
      directory: config.directory || './logs',
      format: config.format || 'json',
      rotation: {
        enabled: config.rotation?.enabled ?? true,
        maxSize: config.rotation?.maxSize ?? 10 * 1024 * 1024, // 10MB
        maxFiles: config.rotation?.maxFiles ?? 5,
        compress: config.rotation?.compress ?? false
      },
      buffer: {
        enabled: config.buffer?.enabled ?? true,
        size: config.buffer?.size ?? 100,
        flushInterval: config.buffer?.flushInterval ?? 5000 // 5 seconds
      }
    };
    
    this.name = this.config.name;
    this.level = this.config.level;
    this.enabled = this.config.enabled;

    // Initialize the transport
    this.initialize();
  }

  /**
   * Initialize the file transport
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure log directory exists
      await this.ensureDirectory();
      
      // Start flush timer if buffering is enabled
      if (this.config.buffer.enabled) {
        this.startFlushTimer();
      }
    } catch (error) {
      console.error('Failed to initialize file transport:', error);
    }
  }

  /**
   * Log an entry
   */
  async log(entry: LogEntry): Promise<void> {
    if (!this.enabled || !this.shouldLog(entry.level)) {
      return;
    }

    if (this.config.buffer.enabled) {
      this.addToBuffer(entry);
    } else {
      // Write immediately
      this.writeQueue = this.writeQueue.then(() => this.writeEntries([entry]));
    }
  }

  /**
   * Check if this transport should log the given level
   */
  private shouldLog(entryLevel: LogLevel): boolean {
    return LOG_LEVEL_VALUES[entryLevel] >= LOG_LEVEL_VALUES[this.level];
  }

  /**
   * Add entry to buffer
   */
  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);
    
    // Flush if buffer is full
    if (this.buffer.length >= this.config.buffer.size) {
      this.flushBuffer();
    }
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.buffer.flushInterval);
  }

  /**
   * Flush the buffer to file
   */
  private flushBuffer(): void {
    if (this.buffer.length === 0 || this.isWriting) {
      return;
    }

    const entriesToWrite = [...this.buffer];
    this.buffer = [];
    
    this.writeQueue = this.writeQueue.then(() => this.writeEntries(entriesToWrite));
  }

  /**
   * Write entries to file
   */
  private async writeEntries(entries: LogEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    this.isWriting = true;
    
    try {
      const filePath = this.getLogFilePath();
      
      // Check if rotation is needed
      if (this.config.rotation.enabled) {
        await this.checkRotation(filePath);
      }
      
      // Format entries
      const content = this.formatEntries(entries);
      
      // Write to file
      await appendFile(filePath, content, 'utf8');
      
    } catch (error) {
      console.error('Failed to write log entries:', error);
      // Re-add entries to buffer for retry
      this.buffer.unshift(...entries);
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Format entries for file output
   */
  private formatEntries(entries: LogEntry[]): string {
    if (this.config.format === 'json') {
      return entries.map(entry => JSON.stringify(entry) + '\n').join('');
    } else {
      // Text format
      return entries.map(entry => this.formatTextEntry(entry) + '\n').join('');
    }
  }

  /**
   * Format a single entry as text
   */
  private formatTextEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.component ? `[${entry.component}] ` : '';
    const operation = entry.operation ? `<${entry.operation}> ` : '';
    const requestId = entry.requestId ? `(${entry.requestId.substring(0, 8)}) ` : '';
    
    let line = `${timestamp} ${level} ${component}${operation}${requestId}${entry.message}`;
    
    if (entry.duration !== undefined) {
      line += ` +${entry.duration}ms`;
    }
    
    // Add error details on separate lines
    if (entry.error) {
      line += `\n  Error: ${entry.error.name} - ${entry.error.message}`;
      if (entry.error.stack) {
        line += `\n  Stack: ${entry.error.stack}`;
      }
    }
    
    // Add additional data
    if (entry.data && Object.keys(entry.data).length > 0) {
      line += `\n  Data: ${JSON.stringify(entry.data)}`;
    }
    
    return line;
  }

  /**
   * Get the current log file path
   */
  private getLogFilePath(): string {
    return path.join(this.config.directory, this.config.filename);
  }

  /**
   * Check if log rotation is needed and perform it
   */
  private async checkRotation(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      return;
    }

    try {
      const stats = await stat(filePath);
      
      if (stats.size >= this.config.rotation.maxSize) {
        await this.rotateFile(filePath);
      }
    } catch (error) {
      console.error('Failed to check file size for rotation:', error);
    }
  }

  /**
   * Rotate the log file
   */
  private async rotateFile(filePath: string): Promise<void> {
    try {
      const directory = path.dirname(filePath);
      const basename = path.basename(filePath, path.extname(filePath));
      const extension = path.extname(filePath);
      
      // Shift existing numbered files
      for (let i = this.config.rotation.maxFiles - 1; i >= 1; i--) {
        const oldFile = path.join(directory, `${basename}.${i}${extension}`);
        const newFile = path.join(directory, `${basename}.${i + 1}${extension}`);
        
        if (existsSync(oldFile)) {
          if (i === this.config.rotation.maxFiles - 1) {
            // Delete the oldest file
            await unlink(oldFile);
          } else {
            // Rename to next number
            await writeFile(newFile, await readdir(oldFile));
            await unlink(oldFile);
          }
        }
      }
      
      // Move current file to .1
      const rotatedFile = path.join(directory, `${basename}.1${extension}`);
      await writeFile(rotatedFile, await readdir(filePath));
      await unlink(filePath);
      
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Ensure the log directory exists
   */
  private async ensureDirectory(): Promise<void> {
    try {
      if (!existsSync(this.config.directory)) {
        await mkdir(this.config.directory, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
      throw error;
    }
  }

  /**
   * Flush any buffered logs
   */
  async flush(): Promise<void> {
    if (this.buffer.length > 0) {
      const entriesToFlush = [...this.buffer];
      this.buffer = [];
      await this.writeEntries(entriesToFlush);
    }
    
    // Wait for any pending writes to complete
    await this.writeQueue;
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    // Stop the flush timer
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
  updateConfig(newConfig: Partial<FileTransportConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig } as Required<FileTransportConfig>;
    
    // Restart flush timer if buffer config changed
    if (this.config.buffer.enabled && 
        (oldConfig.buffer.flushInterval !== this.config.buffer.flushInterval)) {
      this.startFlushTimer();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<FileTransportConfig> {
    return { ...this.config };
  }

  /**
   * Get transport statistics
   */
  getStats(): {
    bufferSize: number;
    isWriting: boolean;
    logFilePath: string;
    logFileExists: boolean;
  } {
    return {
      bufferSize: this.buffer.length,
      isWriting: this.isWriting,
      logFilePath: this.getLogFilePath(),
      logFileExists: existsSync(this.getLogFilePath())
    };
  }
} 