// Specific Error Message Templates for Pitch Perfect Application
// Defines templates for all existing error codes in the system

import { EnhancedMessageTemplate, MessageTemplateRegistry } from './message-templates';
import { ErrorCategory, ErrorSeverity } from './error-categorization';

/**
 * Initialize all specific error templates for the Pitch Perfect application
 */
export function initializeSpecificTemplates(): void {
  const registry = MessageTemplateRegistry.getInstance();

  // Authentication Errors
  registry.registerTemplate('INVALID_API_KEY', {
    title: 'Authentication Failed',
    description: 'We couldn\'t verify your access credentials.',
    details: 'The API key provided is invalid or has expired.',
    primaryAction: 'Please refresh the page and try again',
    secondaryActions: ['Clear your browser cache', 'Try again in a few minutes'],
    supportInfo: 'If this problem persists, please contact support with request ID {{requestId}}',
    variables: ['requestId'],
    requiredVariables: [],
    formatting: {
      tone: 'professional',
      priority: 'high',
      style: 'detailed'
    },
    metadata: {
      category: 'authentication',
      severity: 'high',
      tags: ['api-key', 'auth', 'credentials'],
      lastUpdated: new Date().toISOString()
    }
  });

  registry.registerTemplate('BLOB_ACCESS_ERROR', {
    title: 'File Access Issue',
    description: 'We couldn\'t access the file storage system.',
    details: 'There might be a temporary issue with our file storage service.',
    primaryAction: 'Please try uploading your file again',
    secondaryActions: ['Wait a few minutes and retry', 'Try with a different file'],
    supportInfo: 'Contact support if you continue to experience file access issues',
    variables: ['fileName'],
    requiredVariables: [],
    formatting: {
      tone: 'friendly',
      priority: 'medium',
      style: 'detailed'
    },
    metadata: {
      category: 'storage',
      severity: 'medium',
      tags: ['blob', 'storage', 'access'],
      lastUpdated: new Date().toISOString()
    }
  });

  // File Validation Errors
  registry.registerTemplate('INVALID_FILE_TYPE', {
    title: 'Unsupported File Type',
    description: 'The file type you selected isn\'t supported for analysis.',
    details: 'Please choose a video file in MP4, MOV, AVI, or WebM format.',
    primaryAction: 'Select a supported video file format',
    secondaryActions: ['Convert your file to MP4 format', 'Check our supported formats list'],
    preventionTips: ['Always check file format requirements before uploading'],
    variables: ['fileName', 'fileType', 'supportedFormats'],
    requiredVariables: [],
    formatting: {
      tone: 'friendly',
      priority: 'low',
      style: 'detailed'
    },
    metadata: {
      category: 'user_input',
      severity: 'low',
      tags: ['file-type', 'validation', 'format'],
      lastUpdated: new Date().toISOString()
    }
  });

  registry.registerTemplate('FILE_SIZE_ERROR', {
    title: 'File Too Large',
    description: 'Your file exceeds the maximum size limit of {{maxFileSize}}.',
    details: 'Large files may take longer to process and could cause timeout issues.',
    primaryAction: 'Choose a smaller file or compress your video',
    secondaryActions: ['Use video compression software', 'Split large files into smaller segments'],
    preventionTips: ['Compress videos before uploading to reduce file size'],
    variables: ['fileName', 'fileSize', 'maxFileSize'],
    requiredVariables: ['maxFileSize'],
    formatting: {
      tone: 'friendly',
      priority: 'medium',
      style: 'detailed'
    },
    metadata: {
      category: 'user_input',
      severity: 'medium',
      tags: ['file-size', 'validation', 'limit'],
      lastUpdated: new Date().toISOString()
    }
  });

  registry.registerTemplate('FILE_VALIDATION_ERROR', {
    title: 'File Validation Failed',
    description: 'We found an issue with your file that prevents it from being processed.',
    details: 'The file may be corrupted, incomplete, or in an unexpected format.',
    primaryAction: 'Try uploading a different file',
    secondaryActions: ['Re-export your video from the original source', 'Check if the file opens in a video player'],
    preventionTips: ['Ensure files are completely downloaded before uploading'],
    variables: ['fileName', 'validationError'],
    requiredVariables: [],
    formatting: {
      tone: 'friendly',
      priority: 'medium',
      style: 'detailed'
    },
    metadata: {
      category: 'validation',
      severity: 'medium',
      tags: ['file-validation', 'corruption', 'format'],
      lastUpdated: new Date().toISOString()
    }
  });

  // Network Errors
  registry.registerTemplate('NETWORK_ERROR', {
    title: 'Connection Issue',
    description: 'We\'re having trouble connecting to our servers.',
    details: 'This could be due to a temporary network issue or server maintenance.',
    primaryAction: 'Check your internet connection and try again',
    secondaryActions: ['Refresh the page', 'Try again in a few minutes', 'Switch to a different network'],
    variables: ['retryIn'],
    requiredVariables: [],
    formatting: {
      tone: 'friendly',
      priority: 'medium',
      style: 'minimal'
    },
    metadata: {
      category: 'network',
      severity: 'medium',
      tags: ['network', 'connectivity', 'connection'],
      lastUpdated: new Date().toISOString()
    }
  });

  registry.registerTemplate('TIMEOUT_ERROR', {
    title: 'Request Timeout',
    description: 'Your request took longer than expected and timed out.',
    details: 'This often happens with large files or during high server load.',
    primaryAction: 'Try again with a smaller file or wait a few minutes',
    secondaryActions: ['Compress your video before uploading', 'Try during off-peak hours'],
    preventionTips: ['Use smaller files for faster processing', 'Ensure stable internet connection'],
    variables: ['fileName', 'estimatedTime'],
    requiredVariables: [],
    formatting: {
      tone: 'friendly',
      priority: 'medium',
      style: 'detailed'
    },
    metadata: {
      category: 'network',
      severity: 'medium',
      tags: ['timeout', 'performance', 'processing'],
      lastUpdated: new Date().toISOString()
    }
  });

  // Rate Limiting Errors
  registry.registerTemplate('RATE_LIMIT_EXCEEDED', {
    title: 'Too Many Requests',
    description: 'You\'ve made too many requests in a short time. Please wait {{retryIn}} before trying again.',
    details: 'Rate limiting helps ensure fair usage and optimal performance for all users.',
    primaryAction: 'Wait {{retryIn}} before making another request',
    secondaryActions: ['Space out your uploads', 'Process files one at a time'],
    preventionTips: ['Upload files individually rather than in rapid succession'],
    variables: ['retryIn', 'quotaLimit'],
    requiredVariables: ['retryIn'],
    formatting: {
      tone: 'professional',
      priority: 'medium',
      style: 'minimal'
    },
    metadata: {
      category: 'rate_limiting',
      severity: 'medium',
      tags: ['rate-limit', 'quota', 'throttling'],
      lastUpdated: new Date().toISOString()
    }
  });

  // Processing Errors
  registry.registerTemplate('PROCESSING_ERROR', {
    title: 'Processing Failed',
    description: 'We encountered an issue while analyzing your {{fileType}} file.',
    details: 'This could be due to file complexity, server load, or temporary service issues.',
    primaryAction: 'Try processing your file again',
    secondaryActions: ['Try with a different file', 'Use a shorter video clip', 'Contact support if this persists'],
    variables: ['fileName', 'fileType', 'processingStage'],
    requiredVariables: [],
    formatting: {
      tone: 'friendly',
      priority: 'medium',
      style: 'detailed'
    },
    metadata: {
      category: 'processing',
      severity: 'medium',
      tags: ['processing', 'analysis', 'failure'],
      lastUpdated: new Date().toISOString()
    }
  });

  // Storage Errors
  registry.registerTemplate('STORAGE_QUOTA_EXCEEDED', {
    title: 'Storage Limit Reached',
    description: 'You\'ve reached your storage quota limit.',
    details: 'Please free up space by deleting old files or upgrade your plan for more storage.',
    primaryAction: 'Delete unused files or upgrade your plan',
    secondaryActions: ['Review and clean up old uploads', 'Contact support about plan options'],
    variables: ['currentUsage', 'quotaLimit', 'userPlan'],
    requiredVariables: [],
    formatting: {
      tone: 'professional',
      priority: 'medium',
      style: 'detailed'
    },
    metadata: {
      category: 'storage',
      severity: 'medium',
      tags: ['storage', 'quota', 'limit'],
      lastUpdated: new Date().toISOString()
    }
  });

  registry.registerTemplate('UPLOAD_ERROR', {
    title: 'Upload Failed',
    description: 'We couldn\'t complete the upload of your file {{fileName}}.',
    details: 'This might be due to network issues, server problems, or file corruption.',
    primaryAction: 'Try uploading your file again',
    secondaryActions: ['Check your internet connection', 'Try with a different file', 'Use a smaller file size'],
    preventionTips: ['Ensure stable internet connection during uploads'],
    variables: ['fileName', 'fileSize', 'uploadProgress'],
    requiredVariables: [],
    formatting: {
      tone: 'friendly',
      priority: 'medium',
      style: 'detailed'
    },
    metadata: {
      category: 'storage',
      severity: 'medium',
      tags: ['upload', 'transfer', 'failure'],
      lastUpdated: new Date().toISOString()
    }
  });

  // OpenAI Specific Errors
  registry.registerTemplate('MODEL_DEPRECATED', {
    title: 'AI Model Update Required',
    description: 'The AI model being used has been deprecated and needs to be updated.',
    details: 'We\'ll automatically switch to an updated model for your analysis.',
    primaryAction: 'Your request will be processed with an updated model',
    secondaryActions: ['No action required from you'],
    variables: ['oldModel', 'newModel'],
    requiredVariables: [],
    formatting: {
      tone: 'professional',
      priority: 'low',
      style: 'minimal'
    },
    metadata: {
      category: 'processing',
      severity: 'low',
      tags: ['ai-model', 'deprecated', 'update'],
      lastUpdated: new Date().toISOString()
    }
  });

  registry.registerTemplate('QUOTA_EXCEEDED', {
    title: 'AI Processing Quota Exceeded',
    description: 'You\'ve reached your AI processing quota for this period.',
    details: 'Your quota will reset {{resetTime}} or you can upgrade your plan for higher limits.',
    primaryAction: 'Wait for quota reset or upgrade your plan',
    secondaryActions: ['Try again after {{resetTime}}', 'Contact support about plan upgrades'],
    variables: ['resetTime', 'quotaLimit', 'userPlan'],
    requiredVariables: [],
    formatting: {
      tone: 'professional',
      priority: 'medium',
      style: 'detailed'
    },
    metadata: {
      category: 'rate_limiting',
      severity: 'medium',
      tags: ['quota', 'ai-processing', 'limit'],
      lastUpdated: new Date().toISOString()
    }
  });

  registry.registerTemplate('MODEL_OVERLOADED', {
    title: 'AI Service Busy',
    description: 'Our AI processing service is currently experiencing high demand.',
    details: 'This is temporary and usually resolves within a few minutes.',
    primaryAction: 'Please try again in a few minutes',
    secondaryActions: ['Try during off-peak hours for faster processing'],
    variables: ['estimatedWaitTime'],
    requiredVariables: [],
    formatting: {
      tone: 'friendly',
      priority: 'medium',
      style: 'minimal'
    },
    metadata: {
      category: 'external_service',
      severity: 'medium',
      tags: ['ai-service', 'overload', 'capacity'],
      lastUpdated: new Date().toISOString()
    }
  });

  registry.registerTemplate('CONTEXT_LENGTH_EXCEEDED', {
    title: 'Content Too Complex',
    description: 'Your content is too complex or lengthy for our current AI model to process.',
    details: 'Try breaking your content into smaller segments or using a shorter video.',
    primaryAction: 'Use a shorter video or split into segments',
    secondaryActions: ['Trim your video to key sections', 'Process in smaller chunks'],
    preventionTips: ['Keep videos under 10 minutes for optimal processing'],
    variables: ['contentLength', 'maxLength'],
    requiredVariables: [],
    formatting: {
      tone: 'friendly',
      priority: 'medium',
      style: 'detailed'
    },
    metadata: {
      category: 'user_input',
      severity: 'medium',
      tags: ['content-length', 'ai-limit', 'complexity'],
      lastUpdated: new Date().toISOString()
    }
  });

  // Configuration Errors
  registry.registerTemplate('CONFIGURATION_ERROR', {
    title: 'System Configuration Issue',
    description: 'There\'s a temporary configuration issue with our service.',
    details: 'Our team has been notified and is working to resolve this quickly.',
    primaryAction: 'Please try again in a few minutes',
    supportInfo: 'Contact support if this issue persists for more than 10 minutes',
    variables: ['estimatedTime'],
    requiredVariables: [],
    formatting: {
      tone: 'professional',
      priority: 'high',
      style: 'minimal'
    },
    metadata: {
      category: 'configuration',
      severity: 'high',
      tags: ['configuration', 'system', 'setup'],
      lastUpdated: new Date().toISOString()
    }
  });

  // Internal Server Errors
  registry.registerTemplate('INTERNAL_SERVER_ERROR', {
    title: 'Unexpected Error',
    description: 'We encountered an unexpected issue while processing your request.',
    details: 'Our team has been automatically notified of this issue.',
    primaryAction: 'Please try your request again',
    secondaryActions: ['Wait a few minutes and retry', 'Try with different content'],
    supportInfo: 'If this error continues, please contact support with error ID {{requestId}}',
    variables: ['requestId'],
    requiredVariables: [],
    formatting: {
      tone: 'professional',
      priority: 'high',
      style: 'detailed'
    },
    metadata: {
      category: 'internal_system',
      severity: 'high',
      tags: ['server-error', 'unexpected', 'system'],
      lastUpdated: new Date().toISOString()
    }
  });

  // Validation Errors
  registry.registerTemplate('VALIDATION_ERROR', {
    title: 'Invalid Input',
    description: 'The information you provided doesn\'t match the expected format.',
    details: 'Please check your input and ensure it meets the specified requirements.',
    primaryAction: 'Review and correct your input',
    secondaryActions: ['Check the format examples provided', 'Clear the form and start over'],
    preventionTips: ['Double-check input formats before submitting'],
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
      tags: ['validation', 'input', 'format'],
      lastUpdated: new Date().toISOString()
    }
  });

  registry.registerTemplate('MISSING_PARAMETER', {
    title: 'Missing Required Information',
    description: 'Some required information is missing from your request.',
    details: 'Please ensure all required fields are filled out before submitting.',
    primaryAction: 'Complete all required fields and try again',
    secondaryActions: ['Check for empty required fields', 'Review the form requirements'],
    preventionTips: ['Look for fields marked with asterisks (*) - these are required'],
    variables: ['missingField'],
    requiredVariables: [],
    formatting: {
      tone: 'friendly',
      priority: 'medium',
      style: 'detailed'
    },
    metadata: {
      category: 'validation',
      severity: 'medium',
      tags: ['validation', 'required-field', 'missing'],
      lastUpdated: new Date().toISOString()
    }
  });
}

// Auto-initialize templates when module is imported
initializeSpecificTemplates(); 