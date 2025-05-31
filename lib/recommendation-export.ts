/**
 * Recommendation Export System
 * 
 * Provides functionality to export recommendations and feedback in various formats
 * including HTML, PDF, CSV, and JSON while maintaining structure and context.
 */

import { 
  PrioritizedRecommendation
} from './recommendation-prioritization';
import { 
  Recommendation, 
  RecommendationSet,
  RecommendationCategory,
  RecommendationType
} from './recommendation-engine';
import { ComprehensiveFrameworkScore } from './scoring-framework';
import { TemplateExporter, TemplateRenderResult, TemplateData } from './recommendation-templates/types';

// Export format types
export type ExportFormat = 'html' | 'pdf' | 'csv' | 'json' | 'text';

// Export configuration options
export interface ExportConfig {
  format: ExportFormat;
  includeMetrics?: boolean;
  includeTimeline?: boolean;
  includeSummary?: boolean;
  includeActionSteps?: boolean;
  groupByPriority?: boolean;
  groupByCategory?: boolean;
  fileName?: string;
  title?: string;
  userProfile?: {
    name?: string;
    experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  };
}

// Export metadata
export interface ExportMetadata {
  exportId: string;
  exportedAt: Date;
  format: ExportFormat;
  fileName: string;
  fileSize?: number;
  recommendationCount: number;
  sessionId?: string;
  userProfile?: {
    name?: string;
    experienceLevel?: string;
  };
}

// Export result
export interface ExportResult {
  success: boolean;
  metadata: ExportMetadata;
  content?: string | Buffer;
  downloadUrl?: string;
  error?: string;
}

// CSV row structure for recommendations
interface RecommendationCSVRow {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  type: string;
  estimatedImpact: string;
  estimatedEffort: string;
  timeToImplement: number;
  confidence: number;
  priorityScore: number;
  actionSteps: string;
  evidence?: string;
  prerequisites?: string;
}

/**
 * Main Recommendation Exporter Class
 */
export class RecommendationExporter implements TemplateExporter {
  private defaultConfig: ExportConfig = {
    format: 'html',
    includeMetrics: true,
    includeTimeline: false,
    includeSummary: true,
    includeActionSteps: true,
    groupByPriority: false,
    groupByCategory: false,
    title: 'Pitch Perfect Recommendations'
  };

  /**
   * Export recommendations in the specified format
   */
  async exportRecommendations(
    recommendations: PrioritizedRecommendation[],
    config: Partial<ExportConfig> = {},
    context?: {
      sessionId?: string;
      overallAssessment?: RecommendationSet['overallAssessment'];
      frameworkScore?: ComprehensiveFrameworkScore;
    }
  ): Promise<ExportResult> {
    const exportConfig = { ...this.defaultConfig, ...config };
    const exportId = this.generateExportId();
    const fileName = exportConfig.fileName || this.generateFileName(exportConfig.format, exportId);

    try {
      let content: string | Buffer;
      let fileSize: number | undefined;

      switch (exportConfig.format) {
        case 'html':
          content = await this.exportRecommendationsToHTML(recommendations, exportConfig, context);
          fileSize = Buffer.byteLength(content, 'utf8');
          break;
        case 'pdf':
          content = await this.exportRecommendationsToPDF(recommendations, exportConfig, context);
          fileSize = content.length;
          break;
        case 'csv':
          content = await this.exportRecommendationsToCSV(recommendations, exportConfig);
          fileSize = Buffer.byteLength(content, 'utf8');
          break;
        case 'json':
          content = this.exportRecommendationsToJSON(recommendations, exportConfig, context);
          fileSize = Buffer.byteLength(content, 'utf8');
          break;
        case 'text':
          content = this.exportRecommendationsToText(recommendations, exportConfig, context);
          fileSize = Buffer.byteLength(content, 'utf8');
          break;
        default:
          throw new Error(`Unsupported export format: ${exportConfig.format}`);
      }

      const metadata: ExportMetadata = {
        exportId,
        exportedAt: new Date(),
        format: exportConfig.format,
        fileName,
        fileSize,
        recommendationCount: recommendations.length,
        sessionId: context?.sessionId,
        userProfile: exportConfig.userProfile
      };

      return {
        success: true,
        metadata,
        content
      };

    } catch (error) {
      return {
        success: false,
        metadata: {
          exportId,
          exportedAt: new Date(),
          format: exportConfig.format,
          fileName,
          recommendationCount: recommendations.length,
          sessionId: context?.sessionId
        },
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  /**
   * Export to HTML format
   */
  private async exportRecommendationsToHTML(
    recommendations: PrioritizedRecommendation[],
    config: ExportConfig,
    context?: any
  ): Promise<string> {
    let html = this.generateHTMLHeader(config, context);

    // Summary section
    if (config.includeSummary && context?.overallAssessment) {
      html += this.generateHTMLSummary(context.overallAssessment, recommendations);
    }

    // Group recommendations
    const groupedRecs = this.groupRecommendations(recommendations, config);

    // Render recommendations by group
    for (const [groupName, recs] of Object.entries(groupedRecs)) {
      if (recs.length === 0) continue;
      
      html += `<div class="recommendation-group">\n`;
      html += `<h2 class="group-title">${groupName}</h2>\n`;
      
      for (const rec of recs) {
        // Create simple HTML template for export instead of React component
        html += this.renderRecommendationToHTML(rec, config);
      }
      
      html += `</div>\n`;
    }
    
    html += this.generateHTMLFooter();
    
    return html;
  }

  /**
   * Render a single recommendation to HTML string (for export purposes)
   */
  private renderRecommendationToHTML(
    recommendation: PrioritizedRecommendation,
    config: ExportConfig
  ): string {
    const priorityClass = recommendation.priority.toLowerCase();
    const impactClass = recommendation.estimatedImpact.toLowerCase();
    
    let html = `<div class="recommendation-item priority-${priorityClass} impact-${impactClass}">\n`;
    
    // Header
    html += `  <div class="recommendation-header">\n`;
    html += `    <h3 class="recommendation-title">${recommendation.title}</h3>\n`;
    html += `    <div class="recommendation-badges">\n`;
    html += `      <span class="badge priority-${priorityClass}">${recommendation.priority} Priority</span>\n`;
    html += `      <span class="badge impact-${impactClass}">${recommendation.estimatedImpact} Impact</span>\n`;
    html += `      <span class="badge effort-${recommendation.estimatedEffort.toLowerCase()}">${recommendation.estimatedEffort} Effort</span>\n`;
    html += `    </div>\n`;
    html += `  </div>\n`;
    
    // Description
    html += `  <div class="recommendation-description">\n`;
    html += `    <p>${recommendation.description}</p>\n`;
    html += `  </div>\n`;
    
    // Metrics
    if (config.includeMetrics) {
      html += `  <div class="recommendation-metrics">\n`;
      html += `    <div class="metric">\n`;
      html += `      <span class="metric-label">Time to Implement:</span>\n`;
      html += `      <span class="metric-value">${recommendation.timeToImplement} hours</span>\n`;
      html += `    </div>\n`;
      html += `    <div class="metric">\n`;
      html += `      <span class="metric-label">Confidence:</span>\n`;
      html += `      <span class="metric-value">${Math.round(recommendation.confidence * 100)}%</span>\n`;
      html += `    </div>\n`;
      html += `    <div class="metric">\n`;
      html += `      <span class="metric-label">Priority Score:</span>\n`;
      html += `      <span class="metric-value">${recommendation.priorityScore.toFixed(2)}</span>\n`;
      html += `    </div>\n`;
      html += `  </div>\n`;
    }
    
    // Action steps
    if (config.includeActionSteps && recommendation.actionableSteps.length > 0) {
      html += `  <div class="recommendation-actions">\n`;
      html += `    <h4>Action Steps:</h4>\n`;
      html += `    <ol class="action-steps">\n`;
      recommendation.actionableSteps.forEach(step => {
        html += `      <li>${step}</li>\n`;
      });
      html += `    </ol>\n`;
      html += `  </div>\n`;
    }
    
    // Evidence/reasoning
    if (recommendation.evidence) {
      html += `  <div class="recommendation-evidence">\n`;
      html += `    <h4>Evidence:</h4>\n`;
      html += `    <p class="evidence-text">${recommendation.evidence}</p>\n`;
      html += `  </div>\n`;
    }
    
    // Prerequisites
    if (recommendation.prerequisiteRecommendations && recommendation.prerequisiteRecommendations.length > 0) {
      html += `  <div class="recommendation-prerequisites">\n`;
      html += `    <h4>Prerequisites:</h4>\n`;
      html += `    <ul class="prerequisites">\n`;
      recommendation.prerequisiteRecommendations.forEach(prereq => {
        html += `      <li>${prereq}</li>\n`;
      });
      html += `    </ul>\n`;
      html += `  </div>\n`;
    }
    
    html += `</div>\n\n`;
    
    return html;
  }

  /**
   * Export to PDF format (requires puppeteer for server-side rendering)
   */
  private async exportRecommendationsToPDF(
    recommendations: PrioritizedRecommendation[],
    config: ExportConfig,
    context?: any
  ): Promise<Buffer> {
    // Generate HTML first
    const html = await this.exportRecommendationsToHTML(recommendations, config, context);
    
    // For now, return HTML as Buffer until puppeteer is added
    // In production, this would use puppeteer to generate PDF
    const htmlWithPDFStyles = this.addPDFStyles(html);
    return Buffer.from(htmlWithPDFStyles, 'utf8');
  }

  /**
   * Export to CSV format
   */
  private async exportRecommendationsToCSV(
    recommendations: PrioritizedRecommendation[],
    config: ExportConfig
  ): Promise<string> {
    const headers = [
      'ID',
      'Title',
      'Description',
      'Category',
      'Priority',
      'Type',
      'Impact',
      'Effort',
      'Time (hours)',
      'Confidence (%)',
      'Priority Score',
      'Action Steps',
      'Evidence',
      'Prerequisites'
    ];

    const rows: string[][] = [headers];

    recommendations.forEach(rec => {
      const row = [
        rec.id,
        `"${rec.title.replace(/"/g, '""')}"`,
        `"${rec.description.replace(/"/g, '""')}"`,
        rec.category,
        rec.priority,
        rec.type,
        rec.estimatedImpact,
        rec.estimatedEffort,
        rec.timeToImplement.toString(),
        Math.round(rec.confidence * 100).toString(),
        rec.priorityScore.toFixed(2),
        `"${rec.actionableSteps.join('; ').replace(/"/g, '""')}"`,
        rec.evidence ? `"${rec.evidence.replace(/"/g, '""')}"` : '',
        rec.prerequisiteRecommendations ? `"${rec.prerequisiteRecommendations.join(', ')}"` : ''
      ];
      rows.push(row);
    });

    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Export to JSON format
   */
  private exportRecommendationsToJSON(
    recommendations: PrioritizedRecommendation[],
    config: ExportConfig,
    context?: any
  ): string {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        format: 'json',
        recommendationCount: recommendations.length,
        sessionId: context?.sessionId,
        userProfile: config.userProfile
      },
      context: {
        overallAssessment: context?.overallAssessment,
        frameworkScore: context?.frameworkScore
      },
      recommendations: recommendations,
      grouped: config.groupByPriority || config.groupByCategory 
        ? this.groupRecommendations(recommendations, config)
        : undefined,
      config: {
        includeMetrics: config.includeMetrics,
        includeTimeline: config.includeTimeline,
        includeSummary: config.includeSummary,
        includeActionSteps: config.includeActionSteps,
        groupByPriority: config.groupByPriority,
        groupByCategory: config.groupByCategory
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export to plain text format
   */
  private exportRecommendationsToText(
    recommendations: PrioritizedRecommendation[],
    config: ExportConfig,
    context?: any
  ): string {
    let text = `PITCH PERFECT - RECOMMENDATION REPORT\n`;
    text += `=====================================\n\n`;
    text += `Generated: ${new Date().toLocaleString()}\n`;
    text += `Total Recommendations: ${recommendations.length}\n`;
    
    if (context?.sessionId) {
      text += `Session ID: ${context.sessionId}\n`;
    }
    
    text += `\n`;

    // Summary section
    if (config.includeSummary && context?.overallAssessment) {
      text += `OVERALL ASSESSMENT\n`;
      text += `------------------\n`;
      
      if (context.overallAssessment.competitivePosition) {
        text += `Competitive Position: ${context.overallAssessment.competitivePosition}\n`;
      }
      
      text += `\nPrimary Strengths:\n`;
      context.overallAssessment.primaryStrengths?.forEach((strength: string) => {
        text += `• ${strength}\n`;
      });
      
      text += `\nPrimary Weaknesses:\n`;
      context.overallAssessment.primaryWeaknesses?.forEach((weakness: string) => {
        text += `• ${weakness}\n`;
      });
      
      text += `\n`;
    }

    // Group and display recommendations
    const groupedRecs = this.groupRecommendations(recommendations, config);
    
    for (const [groupName, recs] of Object.entries(groupedRecs)) {
      if (recs.length === 0) continue;
      
      text += `${groupName.toUpperCase()}\n`;
      text += `${'-'.repeat(groupName.length)}\n\n`;
      
      recs.forEach((rec, index) => {
        text += `${index + 1}. ${rec.title}\n`;
        text += `   Priority: ${rec.priority} | Impact: ${rec.estimatedImpact} | Effort: ${rec.estimatedEffort}\n`;
        text += `   Time to Implement: ${rec.timeToImplement} hours\n`;
        text += `   Confidence: ${Math.round(rec.confidence * 100)}%\n\n`;
        text += `   Description:\n   ${rec.description}\n\n`;
        
        if (config.includeActionSteps && rec.actionableSteps.length > 0) {
          text += `   Action Steps:\n`;
          rec.actionableSteps.forEach((step, stepIndex) => {
            text += `   ${stepIndex + 1}. ${step}\n`;
          });
          text += `\n`;
        }
        
        if (rec.evidence) {
          text += `   Evidence: ${rec.evidence}\n\n`;
        }
        
        text += `   ---\n\n`;
      });
    }

    return text;
  }

  /**
   * Generate export ID
   */
  private generateExportId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate filename based on format and ID
   */
  private generateFileName(format: ExportFormat, exportId: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `pitch-perfect-recommendations-${timestamp}-${exportId}.${format}`;
  }

  /**
   * Group recommendations based on configuration
   */
  private groupRecommendations(
    recommendations: PrioritizedRecommendation[],
    config: ExportConfig
  ): Record<string, PrioritizedRecommendation[]> {
    if (config.groupByPriority) {
      return {
        'Critical Priority': recommendations.filter(r => r.priority === 'critical'),
        'High Priority': recommendations.filter(r => r.priority === 'high'),
        'Medium Priority': recommendations.filter(r => r.priority === 'medium'),
        'Low Priority': recommendations.filter(r => r.priority === 'low')
      };
    }
    
    if (config.groupByCategory) {
      return {
        'Speech': recommendations.filter(r => r.category === 'speech'),
        'Content': recommendations.filter(r => r.category === 'content'),
        'Visual': recommendations.filter(r => r.category === 'visual'),
        'Overall': recommendations.filter(r => r.category === 'overall'),
        'Cross Category': recommendations.filter(r => r.category === 'cross_category')
      };
    }
    
    return { 'All Recommendations': recommendations };
  }

  /**
   * Generate HTML header with embedded styles
   */
  private generateHTMLHeader(config: ExportConfig, context?: any): string {
    const title = config.title || 'Pitch Perfect Recommendations';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #fff;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1e40af;
            margin: 0;
            font-size: 2.5rem;
        }
        .metadata {
            color: #64748b;
            font-size: 0.9rem;
            margin-top: 10px;
        }
        .summary {
            background: #f8fafc;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin-bottom: 30px;
            border-radius: 0 8px 8px 0;
        }
        .group-title {
            color: #1e40af;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 1.5rem;
        }
        .recommendation-item {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .recommendation-group {
            margin-bottom: 40px;
        }
        @media print {
            body { margin: 0; }
            .recommendation-item { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <div class="metadata">
            Generated on ${new Date().toLocaleString()}
            ${context?.sessionId ? ` | Session: ${context.sessionId}` : ''}
        </div>
    </div>
`;
  }

  /**
   * Generate HTML summary section
   */
  private generateHTMLSummary(
    overallAssessment: RecommendationSet['overallAssessment'],
    recommendations: PrioritizedRecommendation[]
  ): string {
    return `
    <div class="summary">
        <h2>Executive Summary</h2>
        <p><strong>Total Recommendations:</strong> ${recommendations.length}</p>
        ${overallAssessment.competitivePosition ? 
          `<p><strong>Competitive Position:</strong> ${overallAssessment.competitivePosition}</p>` : ''}
        
        <div style="margin-top: 20px;">
            <h3>Primary Strengths</h3>
            <ul>
                ${overallAssessment.primaryStrengths?.map(strength => 
                  `<li>${strength}</li>`).join('') || ''}
            </ul>
        </div>
        
        <div style="margin-top: 20px;">
            <h3>Areas for Improvement</h3>
            <ul>
                ${overallAssessment.primaryWeaknesses?.map(weakness => 
                  `<li>${weakness}</li>`).join('') || ''}
            </ul>
        </div>
    </div>
`;
  }

  /**
   * Generate HTML footer
   */
  private generateHTMLFooter(): string {
    return `
    <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 0.8rem;">
        <p>Generated by Pitch Perfect Recommendation System</p>
        <p>Visit us at <a href="#">pitchperfect.ai</a></p>
    </div>
</body>
</html>`;
  }

  /**
   * Add PDF-specific styles to HTML
   */
  private addPDFStyles(html: string): string {
    const pdfStyles = `
        <style>
            @page {
                margin: 1in;
                size: letter;
            }
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            .recommendation-item {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .group-title {
                page-break-after: avoid;
            }
        </style>
    `;
    
    return html.replace('</head>', `${pdfStyles}</head>`);
  }

  /**
   * Implementation of TemplateExporter interface methods
   */
  async exportToHTML(templates: TemplateRenderResult[]): Promise<string> {
    throw new Error('Use exportRecommendations method instead');
  }

  async exportToPDF(templates: TemplateRenderResult[]): Promise<Buffer> {
    throw new Error('Use exportRecommendations method instead');
  }

  exportToJSON(data: TemplateData[]): string {
    throw new Error('Use exportRecommendations method instead');
  }

  exportToCSV(data: TemplateData[]): string {
    throw new Error('Use exportRecommendations method instead');
  }
}

/**
 * Utility function to create exporter instance
 */
export function createRecommendationExporter(): RecommendationExporter {
  return new RecommendationExporter();
}

/**
 * Quick export helper for common use cases
 */
export async function quickExport(
  recommendations: PrioritizedRecommendation[],
  format: ExportFormat = 'html',
  options: Partial<ExportConfig> = {}
): Promise<ExportResult> {
  const exporter = createRecommendationExporter();
  return exporter.exportRecommendations(recommendations, { format, ...options });
}

/**
 * Batch export helper for multiple formats
 */
export async function batchExport(
  recommendations: PrioritizedRecommendation[],
  formats: ExportFormat[],
  baseConfig: Partial<ExportConfig> = {}
): Promise<Record<ExportFormat, ExportResult>> {
  const exporter = createRecommendationExporter();
  const results: Record<string, ExportResult> = {};
  
  for (const format of formats) {
    results[format] = await exporter.exportRecommendations(
      recommendations, 
      { ...baseConfig, format }
    );
  }
  
  return results as Record<ExportFormat, ExportResult>;
} 