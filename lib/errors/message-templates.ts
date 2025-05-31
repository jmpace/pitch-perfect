// User-Friendly Error Message Templates for Pitch Perfect Application
// Uses the error categorization schema to generate consistent, helpful messages

import { 
  ErrorCategory, 
  ErrorSeverity, 
  UserActionRecommendation,
  ErrorContext,
  EnhancedErrorInfo 
} from './error-categorization';

/**
 * Message Template Configuration
 * 
 * Defines how error messages should be formatted and what information to include
 */
export interface MessageTemplateConfig {
  includeErrorCode?: boolean;      // Show technical error code
  includeTimestamp?: boolean;      // Show when error occurred  
  includeRequestId?: boolean;      // Show request ID for support
  includeRetryInfo?: boolean;      // Show retry/timeout information
  includeFallbackInfo?: boolean;   // Show fallback options
  useProgressiveDisclosure?: boolean; // Show basic message first, details on expand
  maxMessageLength?: number;       // Maximum message length before truncation
  tone?: 'professional' | 'friendly' | 'technical'; // Message tone
}

/**
 * Contextual Message Variables
 * 
 * Dynamic variables that can be injected into message templates
 */
export interface MessageVariables {
  // File-related
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  
  // Service-related
  serviceName?: string;
  apiName?: string;
  
  // Time-related
  retryIn?: string;
  estimatedTime?: string;
  
  // Limits
  maxFileSize?: string;
  rateLimitReset?: string;
  quotaLimit?: string;
  
  // User-specific
  userPlan?: string;
  permissions?: string[];
  
  // Context-specific
  operation?: string;
  feature?: string;
  
  // Custom variables
  [key: string]: string | string[] | number | undefined;
}

/**
 * Message Template
 * 
 * Template structure for generating error messages
 */
export interface MessageTemplate {
  title: string;              // Short error title
  description: string;        // Main error description
  details?: string;           // Additional technical details
  primaryAction: string;      // Main action user should take
  secondaryActions?: string[]; // Alternative actions
  preventionTips?: string[];  // Tips to prevent future occurrences
  supportInfo?: string;       // When/how to contact support
}

/**
 * Enhanced Message Template
 * 
 * Extended template with dynamic content and formatting options
 */
export interface EnhancedMessageTemplate extends MessageTemplate {
  variables: string[];        // List of variables used in template
  requiredVariables: string[]; // Variables that must be provided
  formatting: {
    tone: MessageTemplateConfig['tone'];
    priority: 'low' | 'medium' | 'high' | 'critical';
    style: 'minimal' | 'detailed' | 'progressive';
  };
  metadata: {
    category: ErrorCategory;
    severity: ErrorSeverity;
    tags: string[];
    lastUpdated: string;
  };
}

/**
 * Generated Error Message
 * 
 * Final error message ready for display to users
 */
export interface GeneratedErrorMessage {
  // Core message components
  title: string;
  description: string;
  details?: string;
  
  // Action items
  primaryAction: string;
  secondaryActions?: string[];
  preventionTips?: string[];
  
  // Support and debugging
  supportInfo?: string;
  debugInfo?: {
    errorCode: string;
    requestId?: string;
    timestamp: string;
    correlationId?: string;
  };
  
  // UI guidance
  ui: {
    variant: 'destructive' | 'default' | 'warning' | 'info';
    icon: string;
    dismissible: boolean;
    autoHide: boolean;
    showRetry: boolean;
    showDetails: boolean;
  };
  
  // Accessibility
  a11y: {
    role: 'alert' | 'status' | 'log';
    ariaLabel: string;
    screenReaderText: string;
  };
}

/**
 * Message Template Registry
 * 
 * Centralized registry of all error message templates
 */
export class MessageTemplateRegistry {
  private static instance: MessageTemplateRegistry;
  private templates = new Map<string, EnhancedMessageTemplate>();
  private categoryTemplates = new Map<ErrorCategory, EnhancedMessageTemplate>();
  private severityTemplates = new Map<ErrorSeverity, EnhancedMessageTemplate>();

  private constructor() {
    this.initializeDefaultTemplates();
  }

  static getInstance(): MessageTemplateRegistry {
    if (!MessageTemplateRegistry.instance) {
      MessageTemplateRegistry.instance = new MessageTemplateRegistry();
    }
    return MessageTemplateRegistry.instance;
  }

  /**
   * Register a new message template
   */
  registerTemplate(code: string, template: EnhancedMessageTemplate): void {
    this.templates.set(code, template);
  }

  /**
   * Get template by error code
   */
  getTemplate(code: string): EnhancedMessageTemplate | undefined {
    return this.templates.get(code);
  }

  /**
   * Get template by category (fallback)
   */
  getCategoryTemplate(category: ErrorCategory): EnhancedMessageTemplate | undefined {
    return this.categoryTemplates.get(category);
  }

  /**
   * Get template by severity (fallback)
   */
  getSeverityTemplate(severity: ErrorSeverity): EnhancedMessageTemplate | undefined {
    return this.severityTemplates.get(severity);
  }

  /**
   * Initialize default templates for all categories and severities
   */
  private initializeDefaultTemplates(): void {
    // Authentication category templates
    this.categoryTemplates.set('authentication', {
      title: 'Authentication Required',
      description: 'You need to be authenticated to perform this action.',
      primaryAction: 'Please sign in and try again',
      secondaryActions: ['Refresh the page', 'Clear your browser cache'],
      supportInfo: 'Contact support if you continue to have authentication issues',
      variables: ['serviceName', 'operation'],
      requiredVariables: [],
      formatting: {
        tone: 'professional',
        priority: 'high',
        style: 'detailed'
      },
      metadata: {
        category: 'authentication',
        severity: 'high',
        tags: ['auth', 'access'],
        lastUpdated: new Date().toISOString()
      }
    });

    // Validation category templates
    this.categoryTemplates.set('validation', {
      title: 'Invalid Input',
      description: 'The information you provided doesn\'t meet the required format.',
      primaryAction: 'Please check your input and try again',
      secondaryActions: ['Review the format requirements', 'Use the provided examples'],
      preventionTips: ['Double-check your input before submitting'],
      variables: ['fieldName', 'expectedFormat', 'providedValue'],
      requiredVariables: [],
      formatting: {
        tone: 'friendly',
        priority: 'medium',
        style: 'detailed'
      },
      metadata: {
        category: 'validation',
        severity: 'medium',
        tags: ['input', 'format'],
        lastUpdated: new Date().toISOString()
      }
    });

    // Network category templates
    this.categoryTemplates.set('network', {
      title: 'Connection Problem',
      description: 'We\'re having trouble connecting to our servers.',
      primaryAction: 'Check your internet connection and try again',
      secondaryActions: ['Refresh the page', 'Try again in a few minutes'],
      variables: ['retryIn', 'estimatedTime'],
      requiredVariables: [],
      formatting: {
        tone: 'friendly',
        priority: 'medium',
        style: 'minimal'
      },
      metadata: {
        category: 'network',
        severity: 'medium',
        tags: ['connectivity', 'network'],
        lastUpdated: new Date().toISOString()
      }
    });

    // Storage category templates
    this.categoryTemplates.set('storage', {
      title: 'File Operation Failed',
      description: 'We encountered an issue while processing your file.',
      primaryAction: 'Please try uploading your file again',
      secondaryActions: ['Check file size and format', 'Try a different file'],
      preventionTips: ['Ensure your file meets the size and format requirements'],
      variables: ['fileName', 'fileSize', 'fileType', 'maxFileSize'],
      requiredVariables: [],
      formatting: {
        tone: 'friendly',
        priority: 'medium',
        style: 'detailed'
      },
      metadata: {
        category: 'storage',
        severity: 'medium',
        tags: ['file', 'upload', 'storage'],
        lastUpdated: new Date().toISOString()
      }
    });

    // Processing category templates
    this.categoryTemplates.set('processing', {
      title: 'Processing Error',
      description: 'We encountered an issue while analyzing your content.',
      primaryAction: 'Please try again in a few minutes',
      secondaryActions: ['Try with a different file', 'Use basic analysis mode'],
      variables: ['serviceName', 'estimatedTime', 'fileName'],
      requiredVariables: [],
      formatting: {
        tone: 'professional',
        priority: 'medium',
        style: 'detailed'
      },
      metadata: {
        category: 'processing',
        severity: 'medium',
        tags: ['processing', 'analysis'],
        lastUpdated: new Date().toISOString()
      }
    });

    // Rate limiting category templates
    this.categoryTemplates.set('rate_limiting', {
      title: 'Too Many Requests',
      description: 'You\'ve made too many requests in a short time.',
      primaryAction: 'Please wait before trying again',
      secondaryActions: ['Space out your requests'],
      preventionTips: ['Avoid rapid successive requests'],
      variables: ['retryIn', 'rateLimitReset', 'quotaLimit'],
      requiredVariables: [],
      formatting: {
        tone: 'professional',
        priority: 'medium',
        style: 'minimal'
      },
      metadata: {
        category: 'rate_limiting',
        severity: 'medium',
        tags: ['rate-limit', 'quota'],
        lastUpdated: new Date().toISOString()
      }
    });

    // External service category templates
    this.categoryTemplates.set('external_service', {
      title: 'Service Temporarily Unavailable',
      description: 'One of our external services is currently experiencing issues.',
      primaryAction: 'Please try again in a few minutes',
      secondaryActions: ['Use alternative features if available'],
      variables: ['serviceName', 'estimatedTime'],
      requiredVariables: [],
      formatting: {
        tone: 'professional',
        priority: 'high',
        style: 'detailed'
      },
      metadata: {
        category: 'external_service',
        severity: 'high',
        tags: ['external', 'service', 'downtime'],
        lastUpdated: new Date().toISOString()
      }
    });

    // Severity-based templates
    this.severityTemplates.set('critical', {
      title: 'Service Unavailable',
      description: 'Our service is currently experiencing issues and is temporarily unavailable.',
      primaryAction: 'Please try again later',
      supportInfo: 'If this issue persists, please contact our support team',
      variables: ['estimatedTime'],
      requiredVariables: [],
      formatting: {
        tone: 'professional',
        priority: 'critical',
        style: 'minimal'
      },
      metadata: {
        category: 'infrastructure',
        severity: 'critical',
        tags: ['downtime', 'critical'],
        lastUpdated: new Date().toISOString()
      }
    });

    this.severityTemplates.set('info', {
      title: 'Information',
      description: 'Here\'s some information about your request.',
      primaryAction: 'No action required',
      variables: [],
      requiredVariables: [],
      formatting: {
        tone: 'friendly',
        priority: 'low',
        style: 'minimal'
      },
      metadata: {
        category: 'internal_system',
        severity: 'info',
        tags: ['info', 'notification'],
        lastUpdated: new Date().toISOString()
      }
    });
  }
}

/**
 * Message Generator
 * 
 * Generates user-friendly error messages from error information and templates
 */
export class MessageGenerator {
  private registry: MessageTemplateRegistry;
  private defaultConfig: MessageTemplateConfig;

  constructor(config: Partial<MessageTemplateConfig> = {}) {
    this.registry = MessageTemplateRegistry.getInstance();
    this.defaultConfig = {
      includeErrorCode: false,
      includeTimestamp: false,
      includeRequestId: false,
      includeRetryInfo: true,
      includeFallbackInfo: true,
      useProgressiveDisclosure: true,
      maxMessageLength: 300,
      tone: 'friendly',
      ...config
    };
  }

  /**
   * Generate a complete error message from error info
   */
  generateMessage(
    errorInfo: EnhancedErrorInfo, 
    variables: MessageVariables = {},
    config: Partial<MessageTemplateConfig> = {}
  ): GeneratedErrorMessage {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    // Get the most specific template available
    const template = this.getBestTemplate(errorInfo.code, errorInfo.category, errorInfo.severity);
    
    // Generate message components
    const title = this.interpolateTemplate(template.title, variables);
    const description = this.interpolateTemplate(template.description, variables);
    const details = template.details ? this.interpolateTemplate(template.details, variables) : undefined;
    
    // Generate actions
    const primaryAction = this.interpolateTemplate(template.primaryAction, variables);
    const secondaryActions = template.secondaryActions?.map(action => 
      this.interpolateTemplate(action, variables)
    );
    const preventionTips = template.preventionTips?.map(tip => 
      this.interpolateTemplate(tip, variables)
    );
    
    // Generate support info
    const supportInfo = template.supportInfo ? 
      this.interpolateTemplate(template.supportInfo, variables) : undefined;
    
    // Generate debug info
    const debugInfo = mergedConfig.includeErrorCode || mergedConfig.includeRequestId || mergedConfig.includeTimestamp ? {
      errorCode: errorInfo.code,
      requestId: mergedConfig.includeRequestId ? errorInfo.context.requestId : undefined,
      timestamp: mergedConfig.includeTimestamp ? errorInfo.timestamp : errorInfo.timestamp,
      correlationId: errorInfo.correlationId
    } : undefined;
    
    // Determine UI configuration
    const ui = this.generateUIConfig(errorInfo.severity, errorInfo.category, errorInfo.recovery);
    
    // Generate accessibility info
    const a11y = this.generateA11yConfig(errorInfo.severity, title, description);
    
    return {
      title,
      description,
      details,
      primaryAction,
      secondaryActions,
      preventionTips,
      supportInfo,
      debugInfo,
      ui,
      a11y
    };
  }

  /**
   * Generate a quick notification message (minimal information)
   */
  generateNotification(
    errorInfo: EnhancedErrorInfo,
    variables: MessageVariables = {}
  ): { title: string; message: string; variant: GeneratedErrorMessage['ui']['variant'] } {
    const template = this.getBestTemplate(errorInfo.code, errorInfo.category, errorInfo.severity);
    const ui = this.generateUIConfig(errorInfo.severity, errorInfo.category, errorInfo.recovery);
    
    return {
      title: this.interpolateTemplate(template.title, variables),
      message: this.interpolateTemplate(template.description, variables),
      variant: ui.variant
    };
  }

  /**
   * Get the best available template for the error
   */
  private getBestTemplate(
    code: string, 
    category: ErrorCategory, 
    severity: ErrorSeverity
  ): EnhancedMessageTemplate {
    // Try specific error code first
    let template = this.registry.getTemplate(code);
    if (template) return template;
    
    // Try category template
    template = this.registry.getCategoryTemplate(category);
    if (template) return template;
    
    // Try severity template
    template = this.registry.getSeverityTemplate(severity);
    if (template) return template;
    
    // Fall back to generic template
    return this.getGenericTemplate(severity);
  }

  /**
   * Get a generic template for the severity level
   */
  private getGenericTemplate(severity: ErrorSeverity): EnhancedMessageTemplate {
    const templates = {
      critical: {
        title: 'Service Unavailable',
        description: 'Our service is currently experiencing issues.',
        primaryAction: 'Please try again later'
      },
      high: {
        title: 'Something Went Wrong',
        description: 'We encountered an unexpected issue.',
        primaryAction: 'Please try again'
      },
      medium: {
        title: 'Request Failed',
        description: 'Your request could not be completed.',
        primaryAction: 'Please try again'
      },
      low: {
        title: 'Minor Issue',
        description: 'A minor issue occurred.',
        primaryAction: 'You can continue using the service'
      },
      info: {
        title: 'Information',
        description: 'Here\'s some information about your request.',
        primaryAction: 'No action required'
      }
    };

    const baseTemplate = templates[severity];
    
    return {
      ...baseTemplate,
      variables: [],
      requiredVariables: [],
      formatting: {
        tone: 'professional',
        priority: severity as any,
        style: 'minimal'
      },
      metadata: {
        category: 'internal_system',
        severity,
        tags: ['generic'],
        lastUpdated: new Date().toISOString()
      }
    };
  }

  /**
   * Interpolate template string with variables
   */
  private interpolateTemplate(template: string, variables: MessageVariables): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      if (value === undefined) return match;
      if (Array.isArray(value)) return value.join(', ');
      return String(value);
    });
  }

  /**
   * Generate UI configuration based on error characteristics
   */
  private generateUIConfig(
    severity: ErrorSeverity, 
    category: ErrorCategory,
    recovery: any
  ): GeneratedErrorMessage['ui'] {
    const variants: Record<ErrorSeverity, GeneratedErrorMessage['ui']['variant']> = {
      critical: 'destructive',
      high: 'destructive', 
      medium: 'warning',
      low: 'default',
      info: 'info'
    };

    const icons: Record<ErrorSeverity, string> = {
      critical: 'AlertCircle',
      high: 'AlertTriangle',
      medium: 'AlertTriangle',
      low: 'Info',
      info: 'Info'
    };

    return {
      variant: variants[severity],
      icon: icons[severity],
      dismissible: severity !== 'critical',
      autoHide: severity === 'info' || severity === 'low',
      showRetry: recovery.retryable === true,
      showDetails: severity === 'critical' || severity === 'high'
    };
  }

  /**
   * Generate accessibility configuration
   */
  private generateA11yConfig(
    severity: ErrorSeverity, 
    title: string, 
    description: string
  ): GeneratedErrorMessage['a11y'] {
    const roles: Record<ErrorSeverity, GeneratedErrorMessage['a11y']['role']> = {
      critical: 'alert',
      high: 'alert',
      medium: 'alert',
      low: 'status',
      info: 'status'
    };

    return {
      role: roles[severity],
      ariaLabel: `${severity} error: ${title}`,
      screenReaderText: `${title}. ${description}`
    };
  }
}

// Export convenience functions
export const messageGenerator = new MessageGenerator();

export function generateErrorMessage(
  errorInfo: EnhancedErrorInfo,
  variables: MessageVariables = {},
  config: Partial<MessageTemplateConfig> = {}
): GeneratedErrorMessage {
  return messageGenerator.generateMessage(errorInfo, variables, config);
}

export function generateNotification(
  errorInfo: EnhancedErrorInfo,
  variables: MessageVariables = {}
): ReturnType<MessageGenerator['generateNotification']> {
  return messageGenerator.generateNotification(errorInfo, variables);
}

export default MessageGenerator; 