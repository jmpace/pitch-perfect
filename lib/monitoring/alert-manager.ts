// Alert Manager Implementation
// Handles creation, tracking, and management of alerts from errors and system events

import { 
  Alert, 
  AlertManager as IAlertManager, 
  AlertSeverity, 
  AlertStatus, 
  AlertRule,
  AlertFilters,
  NotificationChannel 
} from './types';
import { Logger } from '../logging/logger';
import { LogLevel, LogEntry } from '../logging/types';
import { EnhancedErrorInfo } from '../errors/error-categorization';
import { createHash } from 'crypto';

/**
 * In-memory alert storage (in production, this should be a database)
 */
interface AlertStorage {
  alerts: Map<string, Alert>;
  rules: Map<string, AlertRule>;
  stats: {
    totalAlerts: number;
    alertsByHour: Map<string, number>;
    alertsBySeverity: Map<AlertSeverity, number>;
  };
}

/**
 * Alert manager implementation
 */
export class AlertManager implements IAlertManager {
  private storage: AlertStorage;
  private logger: Logger;
  private isProcessing = false;
  private processingQueue: (() => Promise<void>)[] = [];

  constructor(logger: Logger, initialRules: AlertRule[] = []) {
    this.logger = logger;
    this.storage = {
      alerts: new Map(),
      rules: new Map(),
      stats: {
        totalAlerts: 0,
        alertsByHour: new Map(),
        alertsBySeverity: new Map()
      }
    };

    // Load initial rules
    initialRules.forEach(rule => this.addRule(rule));

    // Start cleanup process
    this.startCleanupProcess();
  }

  /**
   * Create a new alert
   */
  async createAlert(alertData: Omit<Alert, 'id' | 'createdAt' | 'lastUpdatedAt'>): Promise<Alert> {
    const id = this.generateAlertId(alertData);
    const now = new Date().toISOString();

    const alert: Alert = {
      ...alertData,
      id,
      createdAt: now,
      lastUpdatedAt: now,
      notificationsSent: [],
      escalationLevel: 0
    };

    // Check for duplicate alerts
    const existingAlert = this.findSimilarAlert(alert);
    if (existingAlert) {
      this.logger.debug('Similar alert found, updating existing alert', { 
        existingId: existingAlert.id, 
        newTitle: alert.title 
      });
      return this.updateAlert(existingAlert.id, {
        lastUpdatedAt: now,
        escalationLevel: existingAlert.escalationLevel + 1
      });
    }

    // Store the alert
    this.storage.alerts.set(id, alert);
    this.updateStats(alert);

    this.logger.info(`Alert created: ${alert.title}`, {
      alertId: id,
      severity: alert.severity,
      component: alert.source.component
    });

    return alert;
  }

  /**
   * Update an existing alert
   */
  async updateAlert(id: string, updates: Partial<Alert>): Promise<Alert> {
    const existingAlert = this.storage.alerts.get(id);
    if (!existingAlert) {
      throw new Error(`Alert with ID ${id} not found`);
    }

    const updatedAlert: Alert = {
      ...existingAlert,
      ...updates,
      lastUpdatedAt: new Date().toISOString()
    };

    this.storage.alerts.set(id, updatedAlert);

    this.logger.debug(`Alert updated: ${id}`, { 
      updates: Object.keys(updates),
      severity: updatedAlert.severity 
    });

    return updatedAlert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(id: string, resolution?: string): Promise<Alert> {
    const updates: Partial<Alert> = {
      status: AlertStatus.RESOLVED,
      resolvedAt: new Date().toISOString()
    };

    if (resolution) {
      updates.metadata = {
        ...updates.metadata,
        resolution
      };
    }

    const resolvedAlert = await this.updateAlert(id, updates);
    
    this.logger.info(`Alert resolved: ${resolvedAlert.title}`, {
      alertId: id,
      resolution: resolution || 'No resolution details provided'
    });

    return resolvedAlert;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(id: string, userId?: string): Promise<Alert> {
    const updates: Partial<Alert> = {
      status: AlertStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date().toISOString()
    };

    if (userId) {
      updates.metadata = {
        ...updates.metadata,
        acknowledgedBy: userId
      };
    }

    return this.updateAlert(id, updates);
  }

  /**
   * Get a specific alert
   */
  async getAlert(id: string): Promise<Alert | null> {
    return this.storage.alerts.get(id) || null;
  }

  /**
   * Get alerts with optional filters
   */
  async getAlerts(filters?: AlertFilters): Promise<Alert[]> {
    let alerts = Array.from(this.storage.alerts.values());

    if (!filters) {
      return alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Apply filters
    if (filters.severity) {
      alerts = alerts.filter(alert => filters.severity!.includes(alert.severity));
    }

    if (filters.status) {
      alerts = alerts.filter(alert => filters.status!.includes(alert.status));
    }

    if (filters.component) {
      alerts = alerts.filter(alert => filters.component!.includes(alert.source.component));
    }

    if (filters.environment) {
      alerts = alerts.filter(alert => filters.environment!.includes(alert.source.environment));
    }

    if (filters.tags) {
      alerts = alerts.filter(alert => 
        filters.tags!.some(tag => alert.tags.includes(tag))
      );
    }

    if (filters.createdAfter) {
      const afterDate = new Date(filters.createdAfter);
      alerts = alerts.filter(alert => new Date(alert.createdAt) > afterDate);
    }

    if (filters.createdBefore) {
      const beforeDate = new Date(filters.createdBefore);
      alerts = alerts.filter(alert => new Date(alert.createdAt) < beforeDate);
    }

    // Sort by creation time (newest first)
    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    if (filters.offset || filters.limit) {
      const start = filters.offset || 0;
      const end = filters.limit ? start + filters.limit : undefined;
      alerts = alerts.slice(start, end);
    }

    return alerts;
  }

  /**
   * Create alert from log entry
   */
  async createAlertFromLogEntry(logEntry: LogEntry): Promise<Alert | null> {
    // Check if this log entry should trigger an alert
    const matchingRules = this.findMatchingRules(logEntry);
    
    if (matchingRules.length === 0) {
      return null;
    }

    // Use the first matching rule (rules can be prioritized)
    const rule = matchingRules[0];

    // Check throttling
    if (rule.throttling.enabled && this.isThrottled(rule)) {
      this.logger.debug(`Alert rule ${rule.name} is throttled`, { ruleId: rule.id });
      return null;
    }

    // Create alert from rule and log entry
    const alert = await this.createAlert({
      title: this.interpolateTemplate(rule.alert.title, logEntry),
      description: this.interpolateTemplate(rule.alert.description, logEntry),
      severity: rule.alert.severity,
      status: AlertStatus.OPEN,
      source: {
        component: logEntry.component || 'unknown',
        operation: logEntry.operation,
        environment: logEntry.environment || 'unknown',
        version: logEntry.version
      },
      error: logEntry.error ? {
        category: this.determineErrorCategory(logEntry.error),
        enhancedInfo: logEntry.error.enhancedInfo,
        logEntry
      } : undefined,
      tags: [...rule.alert.tags, ...(logEntry.tags || [])],
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        logLevel: logEntry.level,
        requestId: logEntry.requestId
      },
      notificationsSent: [],
      escalationLevel: 0
    });

    this.logger.info(`Alert created from rule: ${rule.name}`, {
      alertId: alert.id,
      ruleId: rule.id,
      logLevel: logEntry.level
    });

    return alert;
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.storage.rules.set(rule.id, rule);
    this.logger.debug(`Alert rule added: ${rule.name}`, { ruleId: rule.id });
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.storage.rules.delete(ruleId);
    if (removed) {
      this.logger.debug(`Alert rule removed: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<AlertStatus, number>;
    bySeverity: Record<AlertSeverity, number>;
    recent: number; // last 24 hours
  } {
    const alerts = Array.from(this.storage.alerts.values());
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      total: alerts.length,
      byStatus: {
        [AlertStatus.OPEN]: 0,
        [AlertStatus.ACKNOWLEDGED]: 0,
        [AlertStatus.INVESTIGATING]: 0,
        [AlertStatus.RESOLVED]: 0,
        [AlertStatus.CLOSED]: 0
      },
      bySeverity: {
        [AlertSeverity.CRITICAL]: 0,
        [AlertSeverity.HIGH]: 0,
        [AlertSeverity.MEDIUM]: 0,
        [AlertSeverity.LOW]: 0,
        [AlertSeverity.INFO]: 0
      },
      recent: 0
    };

    alerts.forEach(alert => {
      stats.byStatus[alert.status]++;
      stats.bySeverity[alert.severity]++;
      
      if (new Date(alert.createdAt) > oneDayAgo) {
        stats.recent++;
      }
    });

    return stats;
  }

  /**
   * Generate a unique alert ID
   */
  private generateAlertId(alertData: Omit<Alert, 'id' | 'createdAt' | 'lastUpdatedAt'>): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify({
      title: alertData.title,
      component: alertData.source.component,
      environment: alertData.source.environment,
      timestamp: new Date().toISOString().substring(0, 10) // Date only for daily uniqueness
    }));
    return `alert-${hash.digest('hex').substring(0, 16)}`;
  }

  /**
   * Find similar alert to prevent duplicates
   */
  private findSimilarAlert(newAlert: Alert): Alert | null {
    const recentAlerts = Array.from(this.storage.alerts.values())
      .filter(alert => {
        const timeDiff = Date.now() - new Date(alert.createdAt).getTime();
        return timeDiff < 5 * 60 * 1000; // 5 minutes
      });

    return recentAlerts.find(alert => 
      alert.title === newAlert.title &&
      alert.source.component === newAlert.source.component &&
      alert.source.environment === newAlert.source.environment &&
      alert.status !== AlertStatus.RESOLVED &&
      alert.status !== AlertStatus.CLOSED
    ) || null;
  }

  /**
   * Find rules that match a log entry
   */
  private findMatchingRules(logEntry: LogEntry): AlertRule[] {
    return Array.from(this.storage.rules.values())
      .filter(rule => {
        if (!rule.enabled) return false;

        const conditions = rule.conditions;

        // Check log level
        if (conditions.logLevel && !conditions.logLevel.includes(logEntry.level)) {
          return false;
        }

        // Check component
        if (conditions.component && logEntry.component && 
            !conditions.component.includes(logEntry.component)) {
          return false;
        }

        // Check environment
        if (conditions.environment && logEntry.environment && 
            !conditions.environment.includes(logEntry.environment)) {
          return false;
        }

        // Check error category
        if (conditions.errorCategory && logEntry.error) {
          const errorCategory = this.determineErrorCategory(logEntry.error);
          if (!conditions.errorCategory.includes(errorCategory)) {
            return false;
          }
        }

        return true;
      });
  }

  /**
   * Check if a rule is currently throttled
   */
  private isThrottled(rule: AlertRule): boolean {
    if (!rule.throttling.enabled) return false;

    const hourKey = new Date().toISOString().substring(0, 13); // YYYY-MM-DDTHH
    const alertsThisHour = this.storage.stats.alertsByHour.get(hourKey) || 0;

    return alertsThisHour >= rule.throttling.maxAlertsPerHour;
  }

  /**
   * Interpolate template with log entry data
   */
  private interpolateTemplate(template: string, logEntry: LogEntry): string {
    return template
      .replace(/\{message\}/g, logEntry.message)
      .replace(/\{component\}/g, logEntry.component || 'unknown')
      .replace(/\{operation\}/g, logEntry.operation || 'unknown')
      .replace(/\{level\}/g, logEntry.level)
      .replace(/\{environment\}/g, logEntry.environment || 'unknown')
      .replace(/\{timestamp\}/g, logEntry.timestamp);
  }

  /**
   * Determine error category from log entry error
   */
  private determineErrorCategory(error: LogEntry['error']): string {
    if (!error) return 'unknown';
    
    if (error.enhancedInfo?.category) {
      return error.enhancedInfo.category;
    }
    
    // Fallback categorization based on error name/message
    const errorText = `${error.name} ${error.message}`.toLowerCase();
    
    if (errorText.includes('auth') || errorText.includes('unauthorized')) {
      return 'authentication';
    }
    if (errorText.includes('network') || errorText.includes('fetch')) {
      return 'network';
    }
    if (errorText.includes('validation') || errorText.includes('invalid')) {
      return 'validation';
    }
    
    return 'internal_system';
  }

  /**
   * Update statistics
   */
  private updateStats(alert: Alert): void {
    this.storage.stats.totalAlerts++;
    
    // Update hourly stats
    const hourKey = alert.createdAt.substring(0, 13); // YYYY-MM-DDTHH
    const currentCount = this.storage.stats.alertsByHour.get(hourKey) || 0;
    this.storage.stats.alertsByHour.set(hourKey, currentCount + 1);
    
    // Update severity stats
    const severityCount = this.storage.stats.alertsBySeverity.get(alert.severity) || 0;
    this.storage.stats.alertsBySeverity.set(alert.severity, severityCount + 1);
  }

  /**
   * Start periodic cleanup process
   */
  private startCleanupProcess(): void {
    // Clean up old alerts every hour
    setInterval(() => {
      this.cleanupOldAlerts();
      this.cleanupOldStats();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Clean up old resolved alerts
   */
  private cleanupOldAlerts(): void {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    let cleanedCount = 0;

    for (const [id, alert] of this.storage.alerts) {
      if ((alert.status === AlertStatus.RESOLVED || alert.status === AlertStatus.CLOSED) &&
          new Date(alert.resolvedAt || alert.lastUpdatedAt) < cutoffTime) {
        this.storage.alerts.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} old alerts`);
    }
  }

  /**
   * Clean up old statistics
   */
  private cleanupOldStats(): void {
    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const cutoffKey = cutoffTime.toISOString().substring(0, 13);

    let cleanedCount = 0;
    for (const hourKey of this.storage.stats.alertsByHour.keys()) {
      if (hourKey < cutoffKey) {
        this.storage.stats.alertsByHour.delete(hourKey);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} old hourly stats`);
    }
  }
} 