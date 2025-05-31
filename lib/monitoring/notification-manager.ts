// Notification Manager Implementation
// Handles sending alerts to various notification channels

import { 
  Alert, 
  NotificationManager as INotificationManager, 
  NotificationChannel, 
  NotificationRule,
  AlertSeverity,
  AlertStatus
} from './types';
import { Logger } from '../logging/logger';

/**
 * Email service interface (simplified)
 */
interface EmailService {
  sendEmail(to: string[], subject: string, body: string): Promise<boolean>;
}

/**
 * SMS service interface (simplified)
 */
interface SMSService {
  sendSMS(phoneNumbers: string[], message: string): Promise<boolean>;
}

/**
 * Notification manager implementation
 */
export class NotificationManager implements INotificationManager {
  private logger: Logger;
  private emailService?: EmailService;
  private smsService?: SMSService;

  constructor(
    logger: Logger, 
    emailService?: EmailService, 
    smsService?: SMSService
  ) {
    this.logger = logger;
    this.emailService = emailService;
    this.smsService = smsService;
  }

  /**
   * Send a notification for an alert to a specific channel
   */
  async sendNotification(alert: Alert, channel: NotificationChannel): Promise<boolean> {
    try {
      this.logger.debug(`Sending notification for alert ${alert.id} via ${channel}`);

      switch (channel) {
        case NotificationChannel.EMAIL:
          return await this.sendEmailNotification(alert);
        
        case NotificationChannel.SLACK:
          return await this.sendSlackNotification(alert);
        
        case NotificationChannel.WEBHOOK:
          return await this.sendWebhookNotification(alert);
        
        case NotificationChannel.SMS:
          return await this.sendSMSNotification(alert);
        
        case NotificationChannel.DISCORD:
          return await this.sendDiscordNotification(alert);
        
        case NotificationChannel.TEAMS:
          return await this.sendTeamsNotification(alert);
        
        default:
          this.logger.warn(`Unsupported notification channel: ${channel}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to send notification via ${channel}`, error as Error, {
        alertId: alert.id,
        channel
      });
      return false;
    }
  }

  /**
   * Send notifications to multiple channels
   */
  async sendBulkNotifications(alerts: Alert[], channels: NotificationChannel[]): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const alert of alerts) {
      for (const channel of channels) {
        promises.push(
          this.sendNotification(alert, channel).then(success => {
            if (success) {
              this.logger.info(`Notification sent successfully`, {
                alertId: alert.id,
                channel,
                severity: alert.severity
              });
            }
          })
        );
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Test a notification channel configuration
   */
  async testNotification(channel: NotificationChannel, config: NotificationRule['config']): Promise<boolean> {
    try {
      const testAlert: Alert = {
        id: 'test-alert',
        title: 'Test Alert',
        description: 'This is a test alert to verify notification configuration',
        severity: AlertSeverity.INFO,
        status: AlertStatus.OPEN,
        source: {
          component: 'monitoring-system',
          environment: 'test'
        },
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        tags: ['test'],
        metadata: { test: true },
        notificationsSent: [],
        escalationLevel: 0
      };

      switch (channel) {
        case NotificationChannel.EMAIL:
          return await this.sendEmailNotificationWithConfig(testAlert, config.email);
        
        case NotificationChannel.SLACK:
          return await this.sendSlackNotificationWithConfig(testAlert, config.slack);
        
        case NotificationChannel.WEBHOOK:
          return await this.sendWebhookNotificationWithConfig(testAlert, config.webhook);
        
        case NotificationChannel.SMS:
          return await this.sendSMSNotificationWithConfig(testAlert, config.sms);
        
        default:
          this.logger.warn(`Test not supported for channel: ${channel}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Test notification failed for ${channel}`, error as Error);
      return false;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert): Promise<boolean> {
    // This would use configuration from notification rules
    // For now, using a simple implementation
    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const body = this.formatEmailBody(alert);
    
    if (!this.emailService) {
      this.logger.warn('Email service not configured');
      return false;
    }

    // Mock recipients - in real implementation, get from notification rules
    const recipients = ['alerts@example.com'];
    return await this.emailService.sendEmail(recipients, subject, body);
  }

  /**
   * Send email notification with specific config
   */
  private async sendEmailNotificationWithConfig(
    alert: Alert, 
    config?: NotificationRule['config']['email']
  ): Promise<boolean> {
    if (!config || !this.emailService) {
      return false;
    }

    const subject = config.subject || `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const body = config.template ? 
      this.interpolateTemplate(config.template, alert) : 
      this.formatEmailBody(alert);

    return await this.emailService.sendEmail(config.recipients, subject, body);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert): Promise<boolean> {
    // Mock Slack webhook - in real implementation, get from config
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.warn('Slack webhook URL not configured');
      return false;
    }

    return await this.sendSlackNotificationWithConfig(alert, {
      webhook: webhookUrl,
      channel: '#alerts'
    });
  }

  /**
   * Send Slack notification with specific config
   */
  private async sendSlackNotificationWithConfig(
    alert: Alert, 
    config?: NotificationRule['config']['slack']
  ): Promise<boolean> {
    if (!config) {
      return false;
    }

    const payload = {
      channel: config.channel,
      username: 'Pitch Perfect Alerts',
      icon_emoji: this.getSeverityEmoji(alert.severity),
      text: `*${alert.title}*`,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Component',
              value: alert.source.component,
              short: true
            },
            {
              title: 'Environment',
              value: alert.source.environment,
              short: true
            },
            {
              title: 'Time',
              value: new Date(alert.createdAt).toLocaleString(),
              short: true
            },
            {
              title: 'Description',
              value: alert.description,
              short: false
            }
          ]
        }
      ]
    };

    // Add mentions if configured
    if (config.mentions && config.mentions.length > 0) {
      payload.text += `\n${config.mentions.map(mention => `<@${mention}>`).join(' ')}`;
    }

    const response = await fetch(config.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.ok;
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert): Promise<boolean> {
    // Mock webhook - in real implementation, get from config
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.warn('Webhook URL not configured');
      return false;
    }

    return await this.sendWebhookNotificationWithConfig(alert, {
      url: webhookUrl,
      method: 'POST'
    });
  }

  /**
   * Send webhook notification with specific config
   */
  private async sendWebhookNotificationWithConfig(
    alert: Alert, 
    config?: NotificationRule['config']['webhook']
  ): Promise<boolean> {
    if (!config) {
      return false;
    }

    const payload = config.template ? 
      JSON.parse(this.interpolateTemplate(config.template, alert)) :
      {
        alert: {
          id: alert.id,
          title: alert.title,
          description: alert.description,
          severity: alert.severity,
          status: alert.status,
          source: alert.source,
          createdAt: alert.createdAt,
          tags: alert.tags
        }
      };

    const headers = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    const response = await fetch(config.url, {
      method: config.method,
      headers,
      body: JSON.stringify(payload)
    });

    return response.ok;
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(alert: Alert): Promise<boolean> {
    if (!this.smsService) {
      this.logger.warn('SMS service not configured');
      return false;
    }

    const message = `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.description}`;
    const phoneNumbers = ['+1234567890']; // Mock - get from config

    return await this.smsService.sendSMS(phoneNumbers, message);
  }

  /**
   * Send SMS notification with specific config
   */
  private async sendSMSNotificationWithConfig(
    alert: Alert, 
    config?: NotificationRule['config']['sms']
  ): Promise<boolean> {
    if (!config || !this.smsService) {
      return false;
    }

    const message = `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.description}`;
    return await this.smsService.sendSMS(config.phoneNumbers, message);
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(alert: Alert): Promise<boolean> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.warn('Discord webhook URL not configured');
      return false;
    }

    const payload = {
      username: 'Pitch Perfect Alerts',
      avatar_url: 'https://example.com/alert-bot-avatar.png',
      embeds: [
        {
          title: alert.title,
          description: alert.description,
          color: parseInt(this.getSeverityColor(alert.severity).replace('#', ''), 16),
          fields: [
            {
              name: 'Severity',
              value: alert.severity.toUpperCase(),
              inline: true
            },
            {
              name: 'Component',
              value: alert.source.component,
              inline: true
            },
            {
              name: 'Environment',
              value: alert.source.environment,
              inline: true
            }
          ],
          timestamp: alert.createdAt
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.ok;
  }

  /**
   * Send Microsoft Teams notification
   */
  private async sendTeamsNotification(alert: Alert): Promise<boolean> {
    const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.warn('Teams webhook URL not configured');
      return false;
    }

    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: alert.title,
      themeColor: this.getSeverityColor(alert.severity),
      sections: [
        {
          activityTitle: alert.title,
          activitySubtitle: `Severity: ${alert.severity.toUpperCase()}`,
          activityText: alert.description,
          facts: [
            {
              name: 'Component',
              value: alert.source.component
            },
            {
              name: 'Environment',
              value: alert.source.environment
            },
            {
              name: 'Time',
              value: new Date(alert.createdAt).toLocaleString()
            }
          ]
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.ok;
  }

  /**
   * Format email body for alert
   */
  private formatEmailBody(alert: Alert): string {
    let body = `Alert: ${alert.title}\n\n`;
    body += `Severity: ${alert.severity.toUpperCase()}\n`;
    body += `Status: ${alert.status}\n`;
    body += `Component: ${alert.source.component}\n`;
    body += `Environment: ${alert.source.environment}\n`;
    body += `Time: ${new Date(alert.createdAt).toLocaleString()}\n\n`;
    body += `Description:\n${alert.description}\n\n`;
    
    if (alert.error) {
      body += `Error Details:\n`;
      body += `Category: ${alert.error.category}\n`;
      if (alert.error.enhancedInfo) {
        body += `Details: ${JSON.stringify(alert.error.enhancedInfo, null, 2)}\n`;
      }
    }
    
    if (alert.tags.length > 0) {
      body += `\nTags: ${alert.tags.join(', ')}\n`;
    }
    
    body += `\nAlert ID: ${alert.id}`;
    
    return body;
  }

  /**
   * Interpolate template with alert data
   */
  private interpolateTemplate(template: string, alert: Alert): string {
    return template
      .replace(/\{id\}/g, alert.id)
      .replace(/\{title\}/g, alert.title)
      .replace(/\{description\}/g, alert.description)
      .replace(/\{severity\}/g, alert.severity)
      .replace(/\{status\}/g, alert.status)
      .replace(/\{component\}/g, alert.source.component)
      .replace(/\{environment\}/g, alert.source.environment)
      .replace(/\{createdAt\}/g, alert.createdAt)
      .replace(/\{tags\}/g, alert.tags.join(', '));
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return ':red_circle:';
      case 'high': return ':orange_circle:';
      case 'medium': return ':yellow_circle:';
      case 'low': return ':blue_circle:';
      case 'info': return ':white_circle:';
      default: return ':grey_circle:';
    }
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#FF0000';
      case 'high': return '#FF8C00';
      case 'medium': return '#FFD700';
      case 'low': return '#87CEEB';
      case 'info': return '#90EE90';
      default: return '#808080';
    }
  }
} 