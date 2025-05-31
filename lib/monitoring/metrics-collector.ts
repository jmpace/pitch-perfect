// Metrics Collector Implementation
// Collects system health metrics and custom application metrics for monitoring

import { 
  MetricsCollector as IMetricsCollector, 
  HealthMetrics 
} from './types';
import { Logger } from '../logging/logger';
import os from 'os';
import fs from 'fs/promises';

/**
 * Custom metric entry
 */
interface CustomMetric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'duration';
  tags: Record<string, string>;
  timestamp: string;
}

/**
 * Metrics collector implementation
 */
export class MetricsCollector implements IMetricsCollector {
  private logger: Logger;
  private customMetrics: Map<string, CustomMetric> = new Map();
  private startTime: number;
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
    this.startTime = Date.now();
    
    // Clean up old metrics periodically
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Collect comprehensive health metrics
   */
  async collectHealthMetrics(): Promise<HealthMetrics> {
    try {
      const timestamp = new Date().toISOString();
      const uptime = (Date.now() - this.startTime) / 1000; // seconds

      // Application metrics
      const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
      const averageResponseTime = this.responseTimes.length > 0 
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
        : 0;

      // System metrics
      const systemMetrics = await this.collectSystemMetrics();
      
      // Database metrics (mock - in real implementation, connect to actual DB)
      const databaseMetrics = await this.collectDatabaseMetrics();
      
      // External service metrics
      const externalServiceMetrics = await this.collectExternalServiceMetrics();

      const healthMetrics: HealthMetrics = {
        timestamp,
        application: {
          uptime,
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          requestCount: this.requestCount,
          errorRate,
          averageResponseTime
        },
        system: systemMetrics,
        database: databaseMetrics,
        externalServices: externalServiceMetrics
      };

      this.logger.debug('Health metrics collected', { 
        uptime: Math.round(uptime),
        errorRate: Math.round(errorRate * 100) / 100,
        memoryUsage: `${Math.round(systemMetrics.memory.usage)}%`
      });

      return healthMetrics;

    } catch (error) {
      this.logger.error('Failed to collect health metrics', error as Error);
      throw error;
    }
  }

  /**
   * Record a custom metric
   */
  recordCustomMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    const metric: CustomMetric = {
      name,
      value,
      type: 'gauge',
      tags,
      timestamp: new Date().toISOString()
    };

    this.customMetrics.set(`${name}:${Date.now()}`, metric);
    
    this.logger.trace('Custom metric recorded', { name, value, tags });
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, tags: Record<string, string> = {}): void {
    const key = `${name}:counter`;
    const existing = this.customMetrics.get(key);
    
    const metric: CustomMetric = {
      name,
      value: existing ? existing.value + 1 : 1,
      type: 'counter',
      tags,
      timestamp: new Date().toISOString()
    };

    this.customMetrics.set(key, metric);
    
    this.logger.trace('Counter incremented', { name, value: metric.value, tags });
  }

  /**
   * Record a duration metric
   */
  recordDuration(name: string, duration: number, tags: Record<string, string> = {}): void {
    const metric: CustomMetric = {
      name,
      value: duration,
      type: 'duration',
      tags,
      timestamp: new Date().toISOString()
    };

    this.customMetrics.set(`${name}:${Date.now()}`, metric);
    
    // Also track for internal statistics
    if (name.includes('response_time') || name.includes('request_duration')) {
      this.responseTimes.push(duration);
      
      // Keep only last 1000 response times
      if (this.responseTimes.length > 1000) {
        this.responseTimes = this.responseTimes.slice(-1000);
      }
    }
    
    this.logger.trace('Duration recorded', { name, duration, tags });
  }

  /**
   * Record request statistics
   */
  recordRequest(isError = false, responseTime?: number): void {
    this.requestCount++;
    
    if (isError) {
      this.errorCount++;
    }
    
    if (responseTime !== undefined) {
      this.recordDuration('http_request_duration', responseTime, {
        status: isError ? 'error' : 'success'
      });
    }
  }

  /**
   * Get all custom metrics
   */
  getCustomMetrics(): CustomMetric[] {
    return Array.from(this.customMetrics.values());
  }

  /**
   * Get custom metrics by name
   */
  getCustomMetricsByName(name: string): CustomMetric[] {
    return Array.from(this.customMetrics.values())
      .filter(metric => metric.name === name);
  }

  /**
   * Clear all custom metrics
   */
  clearCustomMetrics(): void {
    this.customMetrics.clear();
    this.logger.debug('Custom metrics cleared');
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<HealthMetrics['system']> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // CPU usage (simplified - in production, use a proper monitoring library)
    const cpuUsage = await this.getCPUUsage();
    
    // Disk usage
    const diskUsage = await this.getDiskUsage();

    return {
      cpu: {
        usage: cpuUsage,
        load: os.loadavg()
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        usage: (usedMemory / totalMemory) * 100
      },
      disk: diskUsage
    };
  }

  /**
   * Get CPU usage percentage
   */
  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const totalTime = (endTime - startTime) * 1000; // Convert to microseconds
        const cpuTime = endUsage.user + endUsage.system;
        const usage = (cpuTime / totalTime) * 100;
        
        resolve(Math.min(100, Math.max(0, usage)));
      }, 100);
    });
  }

  /**
   * Get disk usage information
   */
  private async getDiskUsage(): Promise<HealthMetrics['system']['disk']> {
    try {
      // This is a simplified implementation
      // In production, use a proper disk usage library
      const stats = await fs.stat(process.cwd());
      
      // Mock disk usage - replace with actual disk usage calculation
      const totalDisk = 100 * 1024 * 1024 * 1024; // 100GB mock
      const usedDisk = 50 * 1024 * 1024 * 1024;   // 50GB mock
      
      return {
        used: usedDisk,
        total: totalDisk,
        usage: (usedDisk / totalDisk) * 100
      };
    } catch (error) {
      this.logger.warn('Failed to get disk usage', { error: (error as Error).message });
      return {
        used: 0,
        total: 0,
        usage: 0
      };
    }
  }

  /**
   * Collect database metrics
   */
  private async collectDatabaseMetrics(): Promise<HealthMetrics['database']> {
    // Mock database metrics - replace with actual database monitoring
    try {
      // In a real implementation, you would:
      // 1. Query database connection pool status
      // 2. Get query statistics from database
      // 3. Monitor slow query logs
      
      return {
        connectionCount: 5, // Mock active connections
        queryCount: this.getCustomMetricsByName('db_query').length,
        averageQueryTime: 25, // Mock average query time in ms
        slowQueries: 2 // Mock slow query count
      };
    } catch (error) {
      this.logger.warn('Failed to collect database metrics', { error: (error as Error).message });
      return {
        connectionCount: 0,
        queryCount: 0,
        averageQueryTime: 0,
        slowQueries: 0
      };
    }
  }

  /**
   * Collect external service metrics
   */
  private async collectExternalServiceMetrics(): Promise<HealthMetrics['externalServices']> {
    const services: HealthMetrics['externalServices'] = {};
    
    // Check common external services
    const servicesToCheck = [
      { name: 'openai', url: 'https://api.openai.com/v1/models', timeout: 5000 },
      { name: 'anthropic', url: 'https://api.anthropic.com/v1/messages', timeout: 5000 }
      // Add more services as needed
    ];

    for (const service of servicesToCheck) {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), service.timeout);
        
        const response = await fetch(service.url, {
          method: 'HEAD',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        services[service.name] = {
          status: response.ok ? 'healthy' : 'degraded',
          responseTime,
          errorRate: response.ok ? 0 : 100,
          lastCheck: new Date().toISOString()
        };
        
      } catch (error) {
        services[service.name] = {
          status: 'down',
          responseTime: service.timeout,
          errorRate: 100,
          lastCheck: new Date().toISOString()
        };
      }
    }

    return services;
  }

  /**
   * Clean up old custom metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    let cleanedCount = 0;

    for (const [key, metric] of this.customMetrics) {
      const metricTime = new Date(metric.timestamp).getTime();
      if (metricTime < cutoffTime) {
        this.customMetrics.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} old custom metrics`);
    }
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    customMetricsCount: number;
    requestCount: number;
    errorRate: number;
    averageResponseTime: number;
    uptime: number;
  } {
    const uptime = (Date.now() - this.startTime) / 1000;
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    const averageResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;

    return {
      customMetricsCount: this.customMetrics.size,
      requestCount: this.requestCount,
      errorRate,
      averageResponseTime,
      uptime
    };
  }
} 