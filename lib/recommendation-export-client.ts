/**
 * Client-side Export Utilities
 * 
 * Provides client-side functions for triggering exports and handling
 * file downloads from the recommendation system.
 */

import { 
  ExportFormat,
  ExportConfig,
  ExportResult,
  ExportMetadata
} from './recommendation-export';
import { PrioritizedRecommendation } from './recommendation-prioritization';
import { RecommendationSet } from './recommendation-engine';

// Client export configuration
export interface ClientExportConfig extends Partial<ExportConfig> {
  autoDownload?: boolean;
  openInNewTab?: boolean;
}

// Export response from API
interface ExportAPIResponse {
  success: boolean;
  metadata: ExportMetadata;
  content: string;
  error?: string;
}

/**
 * Export recommendations from the client
 */
export async function exportRecommendations(
  recommendations: PrioritizedRecommendation[],
  format: ExportFormat,
  config: ClientExportConfig = {},
  context?: {
    sessionId?: string;
    overallAssessment?: RecommendationSet['overallAssessment'];
  }
): Promise<ExportResult> {
  try {
    const requestBody = {
      recommendations,
      format,
      config,
      context
    };

    const response = await fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Export failed with status ${response.status}`);
    }

    const data: ExportAPIResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Export failed');
    }

    // Handle auto download
    if (config.autoDownload !== false) {
      downloadExportedContent(data.content, data.metadata.fileName, format);
    }

    // Handle open in new tab for HTML
    if (config.openInNewTab && format === 'html') {
      openInNewTab(data.content);
    }

    return {
      success: true,
      metadata: data.metadata,
      content: data.content
    };

  } catch (error) {
    return {
      success: false,
      metadata: {
        exportId: 'failed',
        exportedAt: new Date(),
        format,
        fileName: `export-failed.${format}`,
        recommendationCount: recommendations.length
      },
      error: error instanceof Error ? error.message : 'Unknown export error'
    };
  }
}

/**
 * Download content as a file
 */
export function downloadExportedContent(
  content: string,
  fileName: string,
  format: ExportFormat
): void {
  const mimeTypes = {
    html: 'text/html',
    pdf: 'application/pdf',
    csv: 'text/csv',
    json: 'application/json',
    text: 'text/plain'
  };

  let blob: Blob;
  
  if (format === 'pdf' && typeof content === 'string') {
    // Handle base64 encoded PDF content
    const binaryString = atob(content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: mimeTypes[format] });
  } else {
    blob = new Blob([content], { type: mimeTypes[format] });
  }

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Open HTML content in a new tab
 */
export function openInNewTab(htmlContent: string): void {
  const newWindow = window.open();
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
  }
}

/**
 * Quick export functions for common use cases
 */
export const quickExportHandlers = {
  /**
   * Export as HTML and download
   */
  exportAsHTML: async (
    recommendations: PrioritizedRecommendation[],
    context?: any
  ) => {
    return exportRecommendations(recommendations, 'html', {
      title: 'Pitch Perfect Recommendations Report',
      autoDownload: true
    }, context);
  },

  /**
   * Export as PDF and download
   */
  exportAsPDF: async (
    recommendations: PrioritizedRecommendation[],
    context?: any
  ) => {
    return exportRecommendations(recommendations, 'pdf', {
      title: 'Pitch Perfect Recommendations Report',
      autoDownload: true
    }, context);
  },

  /**
   * Export as CSV for Excel/Sheets
   */
  exportAsCSV: async (
    recommendations: PrioritizedRecommendation[],
    context?: any
  ) => {
    return exportRecommendations(recommendations, 'csv', {
      autoDownload: true,
      includeMetrics: true
    }, context);
  },

  /**
   * Export as JSON for data analysis
   */
  exportAsJSON: async (
    recommendations: PrioritizedRecommendation[],
    context?: any
  ) => {
    return exportRecommendations(recommendations, 'json', {
      autoDownload: true,
      includeMetrics: true,
      includeSummary: true
    }, context);
  },

  /**
   * Export as text for sharing
   */
  exportAsText: async (
    recommendations: PrioritizedRecommendation[],
    context?: any
  ) => {
    return exportRecommendations(recommendations, 'text', {
      autoDownload: true,
      includeSummary: true,
      includeActionSteps: true
    }, context);
  },

  /**
   * Preview HTML in new tab (no download)
   */
  previewHTML: async (
    recommendations: PrioritizedRecommendation[],
    context?: any
  ) => {
    return exportRecommendations(recommendations, 'html', {
      title: 'Pitch Perfect Recommendations Report',
      autoDownload: false,
      openInNewTab: true
    }, context);
  }
};

/**
 * Export multiple formats at once
 */
export async function exportMultipleFormats(
  recommendations: PrioritizedRecommendation[],
  formats: ExportFormat[],
  baseConfig: ClientExportConfig = {},
  context?: any
): Promise<Record<ExportFormat, ExportResult>> {
  const results: Record<string, ExportResult> = {};
  
  // Export sequentially to avoid overwhelming the server
  for (const format of formats) {
    results[format] = await exportRecommendations(
      recommendations,
      format,
      { ...baseConfig, autoDownload: false },
      context
    );
    
    // Add small delay between exports
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results as Record<ExportFormat, ExportResult>;
}

/**
 * Get export capabilities from the server
 */
export async function getExportCapabilities() {
  try {
    const response = await fetch('/api/export', {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get export capabilities: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get export capabilities:', error);
    return null;
  }
}

/**
 * Validate recommendations before export
 */
export function validateRecommendationsForExport(
  recommendations: PrioritizedRecommendation[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!recommendations || !Array.isArray(recommendations)) {
    errors.push('Recommendations must be an array');
    return { isValid: false, errors };
  }
  
  if (recommendations.length === 0) {
    errors.push('At least one recommendation is required for export');
  }
  
  if (recommendations.length > 100) {
    errors.push('Too many recommendations (max 100)');
  }
  
  // Validate recommendation structure
  recommendations.forEach((rec, index) => {
    if (!rec.id) errors.push(`Recommendation ${index + 1} missing ID`);
    if (!rec.title) errors.push(`Recommendation ${index + 1} missing title`);
    if (!rec.description) errors.push(`Recommendation ${index + 1} missing description`);
    if (!rec.priority) errors.push(`Recommendation ${index + 1} missing priority`);
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Generate export summary for UI display
 */
export function generateExportSummary(
  recommendations: PrioritizedRecommendation[],
  format: ExportFormat
): {
  recommendationCount: number;
  criticalCount: number;
  highCount: number;
  estimatedFileSize: string;
  formatDescription: string;
} {
  const criticalCount = recommendations.filter(r => r.priority === 'critical').length;
  const highCount = recommendations.filter(r => r.priority === 'high').length;
  
  // Rough file size estimates
  const avgRecSizeMap = {
    html: 2000,  // bytes per recommendation in HTML
    pdf: 3000,   // bytes per recommendation in PDF
    csv: 300,    // bytes per recommendation in CSV
    json: 800,   // bytes per recommendation in JSON
    text: 500    // bytes per recommendation in text
  };
  
  const estimatedSize = recommendations.length * (avgRecSizeMap[format] || 1000);
  
  const formatDescriptions = {
    html: 'Rich web format with styling, suitable for viewing and printing',
    pdf: 'Portable document format, professional presentation',
    csv: 'Spreadsheet format, great for analysis in Excel or Google Sheets',
    json: 'Structured data format, perfect for developers and data analysis',
    text: 'Plain text format, easy to share and read anywhere'
  };
  
  return {
    recommendationCount: recommendations.length,
    criticalCount,
    highCount,
    estimatedFileSize: formatFileSize(estimatedSize),
    formatDescription: formatDescriptions[format]
  };
} 