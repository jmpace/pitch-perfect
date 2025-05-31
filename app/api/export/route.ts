/**
 * Export API Endpoint
 * 
 * Handles requests to export recommendations in various formats
 * (HTML, PDF, CSV, JSON, Text)
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createRecommendationExporter,
  ExportFormat,
  ExportConfig,
  ExportResult
} from '@/lib/recommendation-export';
import { PrioritizedRecommendation } from '@/lib/recommendation-prioritization';
import { RecommendationSet } from '@/lib/recommendation-engine';

// Supported export formats
const SUPPORTED_FORMATS: ExportFormat[] = ['html', 'pdf', 'csv', 'json', 'text'];

// Export request interface
interface ExportRequest {
  recommendations: PrioritizedRecommendation[];
  format: ExportFormat;
  config?: Partial<ExportConfig>;
  context?: {
    sessionId?: string;
    overallAssessment?: RecommendationSet['overallAssessment'];
  };
}

/**
 * POST /api/export
 * Export recommendations in the specified format
 */
export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();

    // Validate required fields
    if (!body.recommendations || !Array.isArray(body.recommendations)) {
      return NextResponse.json(
        { error: 'Invalid or missing recommendations array' },
        { status: 400 }
      );
    }

    if (!body.format || !SUPPORTED_FORMATS.includes(body.format)) {
      return NextResponse.json(
        { error: `Invalid format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}` },
        { status: 400 }
      );
    }

    if (body.recommendations.length === 0) {
      return NextResponse.json(
        { error: 'No recommendations provided for export' },
        { status: 400 }
      );
    }

    // Create exporter and perform export
    const exporter = createRecommendationExporter();
    const result: ExportResult = await exporter.exportRecommendations(
      body.recommendations,
      { ...body.config, format: body.format },
      body.context
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Export failed' },
        { status: 500 }
      );
    }

    // Determine content type and file extension
    const contentTypes = {
      html: 'text/html',
      pdf: 'application/pdf',
      csv: 'text/csv',
      json: 'application/json',
      text: 'text/plain'
    };

    const contentType = contentTypes[body.format];
    const fileName = result.metadata.fileName;

    // For direct downloads, return the content with appropriate headers
    if (request.headers.get('accept')?.includes('application/octet-stream')) {
      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
      headers.set('Content-Length', result.metadata.fileSize?.toString() || '0');
      
      return new NextResponse(result.content, { headers });
    }

    // For JSON responses, return metadata and content
    return NextResponse.json({
      success: true,
      metadata: result.metadata,
      content: result.content instanceof Buffer 
        ? result.content.toString('base64') 
        : result.content
    });

  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during export' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/export
 * Get export format information and capabilities
 */
export async function GET() {
  return NextResponse.json({
    supportedFormats: SUPPORTED_FORMATS,
    formatDescriptions: {
      html: 'Rich HTML format with embedded styles, suitable for web viewing and printing',
      pdf: 'PDF document format (requires server-side rendering)',
      csv: 'Comma-separated values format for spreadsheet import',
      json: 'Structured JSON format with full metadata and context',
      text: 'Plain text format for basic reports and sharing'
    },
    defaultConfig: {
      includeMetrics: true,
      includeTimeline: false,
      includeSummary: true,
      includeActionSteps: true,
      groupByPriority: true,
      groupByCategory: false
    },
    maxRecommendations: 100, // Reasonable limit for performance
    version: '1.0.0'
  });
} 