// Log Rotation Manager
// Handles file rotation, compression, and cleanup of old log files

import { LogRotationConfig } from './types';
import { readFile, writeFile, unlink, stat, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { createGzip } from 'zlib';
import { promisify } from 'util';
import path from 'path';

/**
 * Log rotation manager for handling file rotation and cleanup
 */
export class LogRotationManager {
  private config: LogRotationConfig;

  constructor(config: LogRotationConfig) {
    this.config = config;
  }

  /**
   * Check if a file needs rotation
   */
  async needsRotation(filePath: string): Promise<boolean> {
    if (!this.config.enabled || !existsSync(filePath)) {
      return false;
    }

    try {
      const stats = await stat(filePath);
      return stats.size >= this.config.maxSize;
    } catch (error) {
      console.error('Failed to check file size for rotation:', error);
      return false;
    }
  }

  /**
   * Rotate a log file
   */
  async rotateFile(filePath: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const directory = path.dirname(filePath);
      const basename = path.basename(filePath, path.extname(filePath));
      const extension = path.extname(filePath);
      
      // Generate timestamp for rotation
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotationPattern = this.config.rotationPattern
        .replace('%t', timestamp)
        .replace('%n', '1')
        .replace('%b', basename);
      
      // Shift existing numbered files
      await this.shiftExistingFiles(directory, basename, extension);
      
      // Move current file to rotated name
      const rotatedFile = path.join(directory, `${rotationPattern}${extension}`);
      
      // Read the current file
      const content = await readFile(filePath);
      
      if (this.config.compress) {
        // Compress the rotated file
        const compressedFile = `${rotatedFile}.gz`;
        await this.compressFile(content, compressedFile);
      } else {
        // Just move the file
        await writeFile(rotatedFile, content);
      }
      
      // Clear the original file (truncate it)
      await writeFile(filePath, '');
      
      // Clean up old files
      await this.cleanupOldFiles(directory, basename, extension);
      
    } catch (error) {
      console.error('Failed to rotate log file:', error);
      throw error;
    }
  }

  /**
   * Shift existing numbered files
   */
  private async shiftExistingFiles(directory: string, basename: string, extension: string): Promise<void> {
    try {
      // Get all files in the directory
      const files = await readdir(directory);
      
      // Find rotated files with numbers
      const rotatedFiles = files
        .filter(file => file.startsWith(basename) && file.includes('.'))
        .map(file => {
          const match = file.match(/\.(\d+)(\.(gz|log))*$/);
          return match ? { file, number: parseInt(match[1], 10) } : null;
        })
        .filter((item): item is { file: string; number: number } => item !== null)
        .sort((a, b) => b.number - a.number); // Sort descending
      
      // Shift files
      for (const { file, number } of rotatedFiles) {
        const oldPath = path.join(directory, file);
        
        if (number >= this.config.maxFiles) {
          // Delete files that exceed the limit
          await unlink(oldPath);
        } else {
          // Rename to next number
          const newNumber = number + 1;
          const newFile = file.replace(/\.(\d+)/, `.${newNumber}`);
          const newPath = path.join(directory, newFile);
          
          const content = await readFile(oldPath);
          await writeFile(newPath, content);
          await unlink(oldPath);
        }
      }
    } catch (error) {
      console.error('Failed to shift existing files:', error);
    }
  }

  /**
   * Compress a file using gzip
   */
  private async compressFile(content: Buffer, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const gzip = createGzip();
      const chunks: Buffer[] = [];
      
      gzip.on('data', (chunk) => chunks.push(chunk));
      gzip.on('end', async () => {
        try {
          const compressed = Buffer.concat(chunks);
          await writeFile(outputPath, compressed);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      gzip.on('error', reject);
      
      gzip.write(content);
      gzip.end();
    });
  }

  /**
   * Clean up old files that exceed the maximum file count
   */
  private async cleanupOldFiles(directory: string, basename: string, extension: string): Promise<void> {
    try {
      const files = await readdir(directory);
      
      // Find all rotated files
      const rotatedFiles = files
        .filter(file => file.startsWith(basename) && file !== `${basename}${extension}`)
        .map(file => {
          const filePath = path.join(directory, file);
          return { file, filePath };
        });
      
      // Sort by modification time (oldest first)
      const sortedFiles = await Promise.all(
        rotatedFiles.map(async ({ file, filePath }) => {
          const stats = await stat(filePath);
          return { file, filePath, mtime: stats.mtime };
        })
      );
      
      sortedFiles.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
      
      // Delete files that exceed the limit
      if (sortedFiles.length > this.config.maxFiles) {
        const filesToDelete = sortedFiles.slice(0, sortedFiles.length - this.config.maxFiles);
        
        for (const { filePath } of filesToDelete) {
          try {
            await unlink(filePath);
          } catch (error) {
            console.error(`Failed to delete old log file ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old files:', error);
    }
  }

  /**
   * Get rotation statistics
   */
  async getRotationStats(filePath: string): Promise<{
    currentSize: number;
    rotationNeeded: boolean;
    rotatedFilesCount: number;
    totalLogSize: number;
  }> {
    const stats = {
      currentSize: 0,
      rotationNeeded: false,
      rotatedFilesCount: 0,
      totalLogSize: 0
    };

    try {
      if (existsSync(filePath)) {
        const fileStats = await stat(filePath);
        stats.currentSize = fileStats.size;
        stats.rotationNeeded = fileStats.size >= this.config.maxSize;
        stats.totalLogSize += fileStats.size;
      }

      // Count rotated files
      const directory = path.dirname(filePath);
      const basename = path.basename(filePath, path.extname(filePath));
      
      if (existsSync(directory)) {
        const files = await readdir(directory);
        const rotatedFiles = files.filter(file => 
          file.startsWith(basename) && file !== path.basename(filePath)
        );
        
        stats.rotatedFilesCount = rotatedFiles.length;
        
        // Calculate total size of all log files
        for (const file of rotatedFiles) {
          try {
            const fileStats = await stat(path.join(directory, file));
            stats.totalLogSize += fileStats.size;
          } catch (error) {
            // Ignore errors for individual files
          }
        }
      }
    } catch (error) {
      console.error('Failed to get rotation stats:', error);
    }

    return stats;
  }

  /**
   * Force rotation of a file regardless of size
   */
  async forceRotation(filePath: string): Promise<void> {
    if (existsSync(filePath)) {
      await this.rotateFile(filePath);
    }
  }

  /**
   * Update rotation configuration
   */
  updateConfig(newConfig: Partial<LogRotationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): LogRotationConfig {
    return { ...this.config };
  }

  /**
   * Format bytes for human-readable display
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate rotation configuration
   */
  static validateConfig(config: LogRotationConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (config.maxSize <= 0) {
      errors.push('maxSize must be greater than 0');
    }
    
    if (config.maxFiles <= 0) {
      errors.push('maxFiles must be greater than 0');
    }
    
    if (!config.rotationPattern || config.rotationPattern.trim().length === 0) {
      errors.push('rotationPattern cannot be empty');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 