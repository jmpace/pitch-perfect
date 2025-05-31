// Main monitoring system exports
// Provides a unified interface for all monitoring functionality

export * from './types';
export { AlertManager } from './alert-manager';
export { NotificationManager } from './notification-manager';
export { MetricsCollector } from './metrics-collector';
export { MonitoringSystem } from './monitoring-system';

// Configuration utilities
import { 
  MonitoringConfig, 
  AlertRule, 
  NotificationRule, 
  NotificationChannel,
  AlertSeverity,
  DashboardConfig 
} from './types';
import { Logger } from '../logging/logger';
import { MonitoringSystem } from './monitoring-system';

/**
 * Create a default monitoring configuration
 */
export function createDefaultMonitoringConfig(
  environment: string = 'development',
  applicationName: string = 'pitch-perfect'
): MonitoringConfig {
  const defaultNotifications: NotificationRule[] = [
    {
      channel: NotificationChannel.EMAIL,
      enabled: true,
      config: {
        email: {
          recipients: ['alerts@pitch-perfect.com'],
          subject: '[{severity}] {title}',
          template: undefined
        }
      },
      conditions: {
        severityLevels: [AlertSeverity.CRITICAL, AlertSeverity.HIGH],
        escalationDelay: 300 // 5 minutes
      }
    }
  ];

  if (environment === 'production') {
    // Add Slack notifications for production
    defaultNotifications.push({
      channel: NotificationChannel.SLACK,
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      config: {
        slack: {
          webhook: process.env.SLACK_WEBHOOK_URL || '',
          channel: '#alerts',
          mentions: ['@channel']
        }
      },
      conditions: {
        severityLevels: [AlertSeverity.CRITICAL],
        escalationDelay: 60 // 1 minute for critical alerts
      }
    });
  }

  return {
    enabled: true,
    environment,
    applicationName,
    alerting: {
      enabled: true,
      rules: [], // Will be populated with defaults by the system
      defaultNotifications
    },
    dashboards: [],
    health: {
      enabled: true,
      checkInterval: environment === 'production' ? 30 : 60, // seconds
      endpoints: ['/health', '/api/health']
    },
    integrations: {
      // Configure based on available environment variables
      ...(process.env.DATADOG_API_KEY && {
        datadog: {
          apiKey: process.env.DATADOG_API_KEY,
          appKey: process.env.DATADOG_APP_KEY || '',
          site: process.env.DATADOG_SITE || 'datadoghq.com'
        }
      }),
      ...(process.env.NEWRELIC_LICENSE_KEY && {
        newrelic: {
          licenseKey: process.env.NEWRELIC_LICENSE_KEY,
          appId: process.env.NEWRELIC_APP_ID || ''
        }
      }),
      ...(process.env.GRAFANA_URL && {
        grafana: {
          url: process.env.GRAFANA_URL,
          apiKey: process.env.GRAFANA_API_KEY || '',
          orgId: process.env.GRAFANA_ORG_ID ? parseInt(process.env.GRAFANA_ORG_ID) : undefined
        }
      }),
      ...(process.env.PROMETHEUS_PUSH_GATEWAY && {
        prometheus: {
          pushGateway: process.env.PROMETHEUS_PUSH_GATEWAY,
          jobName: applicationName
        }
      })
    }
  };
}

/**
 * Create a monitoring system with default configuration
 */
export function createMonitoringSystem(
  logger: Logger,
  config?: Partial<MonitoringConfig>
): MonitoringSystem {
  const environment = process.env.NODE_ENV || 'development';
  const applicationName = process.env.npm_package_name || 'pitch-perfect';
  
  const defaultConfig = createDefaultMonitoringConfig(environment, applicationName);
  const finalConfig = config ? { ...defaultConfig, ...config } : defaultConfig;
  
  return new MonitoringSystem(finalConfig, logger);
}

/**
 * Helper to create alert rules for common scenarios
 */
export function createCommonAlertRules(): AlertRule[] {
  return [
    {
      id: 'api-errors',
      name: 'API Errors',
      description: 'Alert on API endpoint errors',
      enabled: true,
      conditions: {
        logLevel: ['ERROR' as any],
        component: ['api', 'endpoint', 'route']
      },
      alert: {
        severity: AlertSeverity.HIGH,
        title: 'API Error: {operation}',
        description: 'API endpoint {operation} in {component} is experiencing errors',
        tags: ['api', 'error']
      },
      notifications: [],
      throttling: {
        enabled: true,
        maxAlertsPerHour: 20,
        cooldownPeriod: 180 // 3 minutes
      }
    },
    {
      id: 'authentication-failures',
      name: 'Authentication Failures',
      description: 'Alert on authentication and authorization failures',
      enabled: true,
      conditions: {
        errorCategory: ['authentication', 'authorization']
      },
      alert: {
        severity: AlertSeverity.CRITICAL,
        title: 'Security Alert: {title}',
        description: 'Authentication/authorization failure: {description}',
        tags: ['security', 'auth', 'critical']
      },
      notifications: [],
      throttling: {
        enabled: true,
        maxAlertsPerHour: 10,
        cooldownPeriod: 300 // 5 minutes
      }
    },
    {
      id: 'database-errors',
      name: 'Database Errors',
      description: 'Alert on database connection and query errors',
      enabled: true,
      conditions: {
        errorCategory: ['database', 'persistence']
      },
      alert: {
        severity: AlertSeverity.HIGH,
        title: 'Database Error: {title}',
        description: 'Database operation failed: {description}',
        tags: ['database', 'persistence', 'error']
      },
      notifications: [],
      throttling: {
        enabled: true,
        maxAlertsPerHour: 15,
        cooldownPeriod: 240 // 4 minutes
      }
    },
    {
      id: 'infrastructure-issues',
      name: 'Infrastructure Issues',
      description: 'Alert on infrastructure and deployment issues',
      enabled: true,
      conditions: {
        errorCategory: ['infrastructure', 'network', 'deployment']
      },
      alert: {
        severity: AlertSeverity.CRITICAL,
        title: 'Infrastructure Alert: {title}',
        description: 'Infrastructure issue detected: {description}',
        tags: ['infrastructure', 'ops', 'critical']
      },
      notifications: [],
      throttling: {
        enabled: true,
        maxAlertsPerHour: 5,
        cooldownPeriod: 600 // 10 minutes
      }
    }
  ];
}

/**
 * Helper to create dashboard configurations for common metrics
 */
export function createCommonDashboards(): DashboardConfig[] {
  return [
    {
      id: 'application-overview',
      name: 'Application Overview',
      description: 'High-level application health and performance metrics',
      panels: [
        {
          id: 'error-rate',
          title: 'Error Rate',
          type: 'line_chart',
          position: { x: 0, y: 0, width: 6, height: 4 },
          query: {
            metric: 'error_rate',
            groupBy: ['component'],
            filters: {}
          },
          visualization: {
            colors: ['#ff4444'],
            thresholds: [
              { value: 5, color: '#ffaa00', operator: 'greater_than' },
              { value: 10, color: '#ff0000', operator: 'greater_than' }
            ],
            legend: true,
            grid: true
          }
        },
        {
          id: 'response-times',
          title: 'Response Times',
          type: 'line_chart',
          position: { x: 6, y: 0, width: 6, height: 4 },
          query: {
            metric: 'response_time',
            groupBy: ['endpoint'],
            filters: {}
          },
          visualization: {
            colors: ['#4444ff'],
            thresholds: [
              { value: 1000, color: '#ffaa00', operator: 'greater_than' },
              { value: 5000, color: '#ff0000', operator: 'greater_than' }
            ],
            legend: true,
            grid: true
          }
        },
        {
          id: 'active-alerts',
          title: 'Active Alerts',
          type: 'table',
          position: { x: 0, y: 4, width: 12, height: 4 },
          query: {
            metric: 'alerts',
            filters: { status: 'open' }
          },
          visualization: {
            legend: false,
            grid: true
          }
        }
      ],
      refresh: {
        interval: 30,
        autoRefresh: true
      },
      timeRange: {
        from: 'now-1h',
        to: 'now',
        relative: '1h'
      },
      filters: {
        environment: [process.env.NODE_ENV || 'development']
      }
    },
    {
      id: 'system-health',
      name: 'System Health',
      description: 'System resource utilization and health metrics',
      panels: [
        {
          id: 'memory-usage',
          title: 'Memory Usage',
          type: 'single_stat',
          position: { x: 0, y: 0, width: 3, height: 3 },
          query: {
            metric: 'memory_usage_percent'
          },
          visualization: {
            thresholds: [
              { value: 70, color: '#ffaa00', operator: 'greater_than' },
              { value: 90, color: '#ff0000', operator: 'greater_than' }
            ]
          }
        },
        {
          id: 'cpu-usage',
          title: 'CPU Usage',
          type: 'single_stat',
          position: { x: 3, y: 0, width: 3, height: 3 },
          query: {
            metric: 'cpu_usage_percent'
          },
          visualization: {
            thresholds: [
              { value: 70, color: '#ffaa00', operator: 'greater_than' },
              { value: 90, color: '#ff0000', operator: 'greater_than' }
            ]
          }
        },
        {
          id: 'disk-usage',
          title: 'Disk Usage',
          type: 'single_stat',
          position: { x: 6, y: 0, width: 3, height: 3 },
          query: {
            metric: 'disk_usage_percent'
          },
          visualization: {
            thresholds: [
              { value: 80, color: '#ffaa00', operator: 'greater_than' },
              { value: 95, color: '#ff0000', operator: 'greater_than' }
            ]
          }
        },
        {
          id: 'uptime',
          title: 'Uptime',
          type: 'single_stat',
          position: { x: 9, y: 0, width: 3, height: 3 },
          query: {
            metric: 'uptime_seconds'
          },
          visualization: {
            colors: ['#00ff00']
          }
        }
      ],
      refresh: {
        interval: 15,
        autoRefresh: true
      },
      timeRange: {
        from: 'now-30m',
        to: 'now',
        relative: '30m'
      },
      filters: {}
    }
  ];
}

/**
 * Environment-specific configuration helpers
 */
export const MonitoringPresets = {
  development: () => createDefaultMonitoringConfig('development'),
  staging: () => createDefaultMonitoringConfig('staging'),
  production: () => createDefaultMonitoringConfig('production'),
  
  // Minimal monitoring for testing
  testing: (): MonitoringConfig => ({
    enabled: false,
    environment: 'test',
    applicationName: 'pitch-perfect-test',
    alerting: {
      enabled: false,
      rules: [],
      defaultNotifications: []
    },
    dashboards: [],
    health: {
      enabled: false,
      checkInterval: 60,
      endpoints: []
    },
    integrations: {}
  })
}; 