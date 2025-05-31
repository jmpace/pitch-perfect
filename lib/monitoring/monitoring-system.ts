// Main Monitoring System
// Integrates alert management, notifications, metrics collection, and logging

import { 
  MonitoringConfig, 
  Alert, 
  AlertRule, 
  NotificationChannel,
  AlertSeverity,
  AlertStatus,
  HealthMetrics 
} from './types';
import { AlertManager } from './alert-manager';
import { NotificationManager } from './notification-manager';
import { MetricsCollector } from './metrics-collector';
import { Logger } from '../logging/logger';
import { LogLevel, LogEntry } from '../logging/types';

/**
 * Main monitoring system that orchestrates all monitoring components
 */
export class MonitoringSystem {
  private config: MonitoringConfig;
  private logger: Logger;
  private alertManager: AlertManager;
  private notificationManager: NotificationManager;
  private metricsCollector: MetricsCollector;
  private healthCheckInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: MonitoringConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Initialize components
    this.alertManager = new AlertManager(logger, config.alerting.rules);
    this.notificationManager = new NotificationManager(logger);
    this.metricsCollector = new MetricsCollector(logger);

    if (config.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize the monitoring system
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing monitoring system', {
        environment: this.config.environment,
        application: this.config.applicationName,
        alertingEnabled: this.config.alerting.enabled,
        healthMonitoringEnabled: this.config.health.enabled
      });

      // Set up log entry monitoring
      this.setupLogEntryMonitoring();

      // Start health monitoring
      if (this.config.health.enabled) {
        this.startHealthMonitoring();
      }

      // Set up default alert rules if none provided
      if (this.config.alerting.enabled && this.config.alerting.rules.length === 0) {
        this.setupDefaultAlertRules();
      }

      this.logger.info('Monitoring system initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize monitoring system', error as Error);
      throw error;
    }
  }

  /**
   * Process a log entry for potential alerts
   */
  async processLogEntry(logEntry: LogEntry): Promise<void> {
    if (!this.config.enabled || !this.config.alerting.enabled) {
      return;
    }

    try {
      // Record metrics
      if (logEntry.level === LogLevel.ERROR) {
        this.metricsCollector.incrementCounter('errors_total', {
          component: logEntry.component || 'unknown',
          environment: logEntry.environment || 'unknown'
        });
      }

      if (logEntry.duration !== undefined) {
        this.metricsCollector.recordDuration('operation_duration', logEntry.duration, {
          operation: logEntry.operation || 'unknown',
          component: logEntry.component || 'unknown'
        });
      }

      // Check for alert conditions
      const alert = await this.alertManager.createAlertFromLogEntry(logEntry);
      
      if (alert) {
        await this.handleNewAlert(alert);
      }

    } catch (error) {
      this.logger.error('Failed to process log entry for monitoring', error as Error, {
        logEntryId: logEntry.requestId
      });
    }
  }

  /**
   * Handle a new alert
   */
  private async handleNewAlert(alert: Alert): Promise<void> {
    try {
      this.logger.info(`New alert created: ${alert.title}`, {
        alertId: alert.id,
        severity: alert.severity,
        component: alert.source.component
      });

      // Send notifications based on severity and configuration
      await this.sendAlertNotifications(alert);

      // Record alert metrics
      this.metricsCollector.incrementCounter('alerts_total', {
        severity: alert.severity,
        component: alert.source.component,
        environment: alert.source.environment
      });

    } catch (error) {
      this.logger.error('Failed to handle new alert', error as Error, {
        alertId: alert.id
      });
    }
  }

  /**
   * Send notifications for an alert
   */
  private async sendAlertNotifications(alert: Alert): Promise<void> {
    if (!this.config.alerting.enabled) {
      return;
    }

    // Get notification channels based on severity
    const channels = this.getNotificationChannelsForSeverity(alert.severity);
    
    if (channels.length === 0) {
      this.logger.debug('No notification channels configured for alert', {
        alertId: alert.id,
        severity: alert.severity
      });
      return;
    }

    // Send notifications
    for (const channel of channels) {
      try {
        const success = await this.notificationManager.sendNotification(alert, channel);
        
        if (success) {
          // Update alert with sent notification
          await this.alertManager.updateAlert(alert.id, {
            notificationsSent: [...alert.notificationsSent, channel]
          });
        }

      } catch (error) {
        this.logger.error(`Failed to send notification via ${channel}`, error as Error, {
          alertId: alert.id,
          channel
        });
      }
    }
  }

  /**
   * Get notification channels for a given severity
   */
  private getNotificationChannelsForSeverity(severity: AlertSeverity): NotificationChannel[] {
    const channels: NotificationChannel[] = [];

    // Check default notifications
    for (const rule of this.config.alerting.defaultNotifications) {
      if (rule.enabled && rule.conditions.severityLevels.includes(severity)) {
        channels.push(rule.channel);
      }
    }

    return channels;
  }

  /**
   * Set up log entry monitoring
   */
  private setupLogEntryMonitoring(): void {
    // In a real implementation, this would integrate with the logging system
    // to automatically process log entries as they're created
    this.logger.debug('Log entry monitoring set up');
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed', error as Error);
      }
    }, this.config.health.checkInterval * 1000);

    this.logger.info('Health monitoring started', {
      interval: this.config.health.checkInterval
    });
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const metrics = await this.metricsCollector.collectHealthMetrics();
      
      // Check for health issues
      await this.checkHealthThresholds(metrics);
      
      this.logger.debug('Health check completed', {
        uptime: Math.round(metrics.application.uptime),
        errorRate: Math.round(metrics.application.errorRate * 100) / 100,
        memoryUsage: Math.round(metrics.system.memory.usage)
      });

    } catch (error) {
      this.logger.error('Failed to perform health check', error as Error);
    }
  }

  /**
   * Check health metrics against thresholds
   */
  private async checkHealthThresholds(metrics: HealthMetrics): Promise<void> {
    // Memory usage check
    if (metrics.system.memory.usage > 90) {
      await this.createHealthAlert(
        'High Memory Usage',
        `Memory usage is at ${Math.round(metrics.system.memory.usage)}%`,
        AlertSeverity.HIGH,
        { memoryUsage: metrics.system.memory.usage }
      );
    }

    // Error rate check
    if (metrics.application.errorRate > 10) {
      await this.createHealthAlert(
        'High Error Rate',
        `Error rate is at ${Math.round(metrics.application.errorRate * 100) / 100}%`,
        AlertSeverity.HIGH,
        { errorRate: metrics.application.errorRate }
      );
    }

    // External service checks
    for (const [serviceName, serviceMetrics] of Object.entries(metrics.externalServices)) {
      if (serviceMetrics.status === 'down') {
        await this.createHealthAlert(
          `External Service Down: ${serviceName}`,
          `External service ${serviceName} is not responding`,
          AlertSeverity.CRITICAL,
          { 
            service: serviceName, 
            responseTime: serviceMetrics.responseTime,
            errorRate: serviceMetrics.errorRate 
          }
        );
      }
    }
  }

  /**
   * Create a health-related alert
   */
  private async createHealthAlert(
    title: string, 
    description: string, 
    severity: AlertSeverity,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await this.alertManager.createAlert({
        title,
        description,
        severity,
        status: AlertStatus.OPEN,
        source: {
          component: 'health-monitor',
          environment: this.config.environment
        },
        tags: ['health', 'automated'],
        metadata: {
          ...metadata,
          automated: true,
          healthCheck: true
        },
        notificationsSent: [],
        escalationLevel: 0
      });

    } catch (error) {
      this.logger.error('Failed to create health alert', error as Error, {
        title,
        severity
      });
    }
  }

  /**
   * Set up default alert rules
   */
  private setupDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'critical-errors',
        name: 'Critical Errors',
        description: 'Alert on any critical errors',
        enabled: true,
        conditions: {
          logLevel: [LogLevel.ERROR],
          errorCategory: ['authentication', 'authorization', 'security', 'infrastructure']
        },
        alert: {
          severity: AlertSeverity.CRITICAL,
          title: 'Critical Error: {message}',
          description: 'A critical error occurred in {component}: {message}',
          tags: ['critical', 'error']
        },
        notifications: this.config.alerting.defaultNotifications,
        throttling: {
          enabled: true,
          maxAlertsPerHour: 10,
          cooldownPeriod: 300 // 5 minutes
        }
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds threshold',
        enabled: true,
        conditions: {
          errorRate: {
            threshold: 5, // 5% error rate
            timeWindow: 300, // 5 minutes
            operator: 'greater_than'
          }
        },
        alert: {
          severity: AlertSeverity.HIGH,
          title: 'High Error Rate Detected',
          description: 'Error rate has exceeded threshold in {component}',
          tags: ['error-rate', 'performance']
        },
        notifications: this.config.alerting.defaultNotifications,
        throttling: {
          enabled: true,
          maxAlertsPerHour: 5,
          cooldownPeriod: 600 // 10 minutes
        }
      }
    ];

    defaultRules.forEach(rule => this.alertManager.addRule(rule));
    
    this.logger.info(`Added ${defaultRules.length} default alert rules`);
  }

  /**
   * Get current health metrics
   */
  async getHealthMetrics(): Promise<HealthMetrics> {
    return await this.metricsCollector.collectHealthMetrics();
  }

  /**
   * Get current alerts
   */
  async getAlerts(filters?: Parameters<AlertManager['getAlerts']>[0]): Promise<Alert[]> {
    return await this.alertManager.getAlerts(filters);
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): ReturnType<AlertManager['getStats']> {
    return this.alertManager.getStats();
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): ReturnType<MetricsCollector['getMetricsSummary']> {
    return this.metricsCollector.getMetricsSummary();
  }

  /**
   * Test notification configuration
   */
  async testNotification(channel: NotificationChannel, config: any): Promise<boolean> {
    return await this.notificationManager.testNotification(channel, config);
  }

  /**
   * Add a custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertManager.addRule(rule);
    this.logger.info(`Alert rule added: ${rule.name}`, { ruleId: rule.id });
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertManager.removeRule(ruleId);
    if (removed) {
      this.logger.info(`Alert rule removed: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metricsCollector.recordCustomMetric(name, value, tags);
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.health?.enabled !== undefined) {
      if (newConfig.health.enabled && !this.healthCheckInterval) {
        this.startHealthMonitoring();
      } else if (!newConfig.health.enabled && this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }
    }
    
    this.logger.info('Monitoring configuration updated');
  }

  /**
   * Shutdown the monitoring system
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    
    this.logger.info('Shutting down monitoring system');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Clean up any remaining tasks
    try {
      // Flush any pending notifications
      // In a real implementation, you might want to flush pending operations
      
      this.logger.info('Monitoring system shutdown complete');
    } catch (error) {
      this.logger.error('Error during monitoring system shutdown', error as Error);
    }
  }
} 