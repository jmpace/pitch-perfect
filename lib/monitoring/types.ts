// Type definitions for monitoring system integration

import { LogLevel, LogEntry } from '../logging/types';
import { EnhancedErrorInfo } from '../errors/error-categorization';

/**
 * Alert severity levels for monitoring systems
 */
export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Alert status for tracking alert lifecycle
 */
export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

/**
 * Notification channels for alerts
 */
export enum NotificationChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  DISCORD = 'discord',
  TEAMS = 'teams'
}

/**
 * Core alert interface
 */
export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  
  // Source information
  source: {
    component: string;
    operation?: string;
    environment: string;
    version?: string;
  };
  
  // Error context
  error?: {
    category: string;
    enhancedInfo?: EnhancedErrorInfo;
    logEntry?: LogEntry;
  };
  
  // Timing information
  createdAt: string;
  lastUpdatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  
  // Metadata
  tags: string[];
  metadata: Record<string, unknown>;
  
  // Notification tracking
  notificationsSent: NotificationChannel[];
  
  // Related alerts
  relatedAlerts?: string[];
  escalationLevel: number;
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Trigger conditions
  conditions: {
    logLevel?: LogLevel[];
    errorCategory?: string[];
    component?: string[];
    environment?: string[];
    
    // Rate-based conditions
    errorRate?: {
      threshold: number;
      timeWindow: number; // seconds
      operator: 'greater_than' | 'less_than' | 'equals';
    };
    
    // Custom conditions
    customQuery?: string;
  };
  
  // Alert configuration
  alert: {
    severity: AlertSeverity;
    title: string;
    description: string;
    tags: string[];
  };
  
  // Notification settings
  notifications: NotificationRule[];
  
  // Throttling and cooldown
  throttling: {
    enabled: boolean;
    maxAlertsPerHour: number;
    cooldownPeriod: number; // seconds
  };
}

/**
 * Notification rule configuration
 */
export interface NotificationRule {
  channel: NotificationChannel;
  enabled: boolean;
  
  // Channel-specific configuration
  config: {
    // Email configuration
    email?: {
      recipients: string[];
      subject?: string;
      template?: string;
    };
    
    // Slack configuration
    slack?: {
      webhook: string;
      channel: string;
      mentions?: string[];
    };
    
    // Webhook configuration
    webhook?: {
      url: string;
      method: 'POST' | 'PUT';
      headers?: Record<string, string>;
      template?: string;
    };
    
    // SMS configuration
    sms?: {
      phoneNumbers: string[];
      provider: 'twilio' | 'aws_sns';
    };
  };
  
  // Conditions for this notification
  conditions: {
    severityLevels: AlertSeverity[];
    timeWindow?: {
      start: string; // HH:MM format
      end: string;   // HH:MM format
      timezone: string;
    };
    escalationDelay?: number; // seconds
  };
}

/**
 * Monitoring dashboard configuration
 */
export interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  
  // Dashboard panels
  panels: DashboardPanel[];
  
  // Refresh settings
  refresh: {
    interval: number; // seconds
    autoRefresh: boolean;
  };
  
  // Time range
  timeRange: {
    from: string;
    to: string;
    relative?: string; // '1h', '24h', '7d', etc.
  };
  
  // Filters
  filters: {
    environment?: string[];
    component?: string[];
    severity?: AlertSeverity[];
  };
}

/**
 * Dashboard panel configuration
 */
export interface DashboardPanel {
  id: string;
  title: string;
  type: 'line_chart' | 'bar_chart' | 'pie_chart' | 'table' | 'single_stat' | 'heatmap';
  
  // Panel positioning
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Data source configuration
  query: {
    metric: string;
    groupBy?: string[];
    filters?: Record<string, unknown>;
    timeRange?: string;
  };
  
  // Visualization settings
  visualization: {
    colors?: string[];
    thresholds?: {
      value: number;
      color: string;
      operator: 'greater_than' | 'less_than';
    }[];
    legend?: boolean;
    grid?: boolean;
  };
}

/**
 * System health metrics
 */
export interface HealthMetrics {
  timestamp: string;
  
  // Application metrics
  application: {
    uptime: number;
    version: string;
    environment: string;
    requestCount: number;
    errorRate: number;
    averageResponseTime: number;
  };
  
  // System metrics
  system: {
    cpu: {
      usage: number;
      load: number[];
    };
    memory: {
      used: number;
      total: number;
      usage: number;
    };
    disk: {
      used: number;
      total: number;
      usage: number;
    };
  };
  
  // Database metrics
  database: {
    connectionCount: number;
    queryCount: number;
    averageQueryTime: number;
    slowQueries: number;
  };
  
  // External service metrics
  externalServices: {
    [serviceName: string]: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;
      errorRate: number;
      lastCheck: string;
    };
  };
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  
  // General settings
  environment: string;
  applicationName: string;
  
  // Alert management
  alerting: {
    enabled: boolean;
    rules: AlertRule[];
    defaultNotifications: NotificationRule[];
  };
  
  // Dashboard configuration
  dashboards: DashboardConfig[];
  
  // Health monitoring
  health: {
    enabled: boolean;
    checkInterval: number; // seconds
    endpoints: string[];
  };
  
  // Integration settings
  integrations: {
    datadog?: {
      apiKey: string;
      appKey: string;
      site?: string;
    };
    
    newrelic?: {
      licenseKey: string;
      appId: string;
    };
    
    grafana?: {
      url: string;
      apiKey: string;
      orgId?: number;
    };
    
    prometheus?: {
      pushGateway: string;
      jobName: string;
    };
  };
}

/**
 * Alert manager interface
 */
export interface AlertManager {
  createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'lastUpdatedAt'>): Promise<Alert>;
  updateAlert(id: string, updates: Partial<Alert>): Promise<Alert>;
  resolveAlert(id: string, resolution?: string): Promise<Alert>;
  getAlert(id: string): Promise<Alert | null>;
  getAlerts(filters?: AlertFilters): Promise<Alert[]>;
  acknowledgeAlert(id: string, userId?: string): Promise<Alert>;
}

/**
 * Alert filters for querying
 */
export interface AlertFilters {
  severity?: AlertSeverity[];
  status?: AlertStatus[];
  component?: string[];
  environment?: string[];
  createdAfter?: string;
  createdBefore?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Notification manager interface
 */
export interface NotificationManager {
  sendNotification(alert: Alert, channel: NotificationChannel): Promise<boolean>;
  sendBulkNotifications(alerts: Alert[], channels: NotificationChannel[]): Promise<void>;
  testNotification(channel: NotificationChannel, config: NotificationRule['config']): Promise<boolean>;
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  collectHealthMetrics(): Promise<HealthMetrics>;
  recordCustomMetric(name: string, value: number, tags?: Record<string, string>): void;
  incrementCounter(name: string, tags?: Record<string, string>): void;
  recordDuration(name: string, duration: number, tags?: Record<string, string>): void;
}

/**
 * Dashboard provider interface
 */
export interface DashboardProvider {
  createDashboard(config: DashboardConfig): Promise<string>;
  updateDashboard(id: string, config: Partial<DashboardConfig>): Promise<void>;
  deleteDashboard(id: string): Promise<void>;
  getDashboard(id: string): Promise<DashboardConfig | null>;
  generateEmbedUrl(id: string, filters?: Record<string, unknown>): Promise<string>;
} 