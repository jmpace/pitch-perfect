import { NextRequest } from 'next/server';
import { VisionAnalysisService, AnalysisType, FrameAnalysisRequest, BatchAnalysisRequest } from '@/lib/vision-analysis';
import { createSuccessResponse, createErrorResponse, generateRequestId, normalizeError } from '@/lib/errors/handlers';
import { checkAuthentication } from '@/lib/openai-auth';

// Request validation schemas
interface SingleAnalysisRequestBody {
  type: 'single';
  frameUrl: string;
  timestamp: number;
  analysisType: AnalysisType;
  context?: {
    previousFrames?: string[];
    presentationTitle?: string;
    targetAudience?: string;
    analysisGoals?: string[];
  };
}

interface BatchAnalysisRequestBody {
  type: 'batch';
  frames: Array<{
    frameUrl: string;
    timestamp: number;
  }>;
  analysisType: AnalysisType;
  batchSize?: number;
  context?: {
    presentationTitle?: string;
    targetAudience?: string;
    analysisGoals?: string[];
  };
}

type VisionAnalysisRequestBody = SingleAnalysisRequestBody | BatchAnalysisRequestBody;

/**
 * POST /api/openai/vision
 * Analyze frames using GPT-4V for visual content extraction and insights
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Check OpenAI authentication
    const authStatus = await checkAuthentication();
    if (!authStatus.isAuthenticated) {
      const authError = normalizeError(new Error(authStatus.error || 'OpenAI authentication failed'), requestId);
      return createErrorResponse(authError);
    }

    // Parse and validate request body
    let body: VisionAnalysisRequestBody;
    try {
      body = await request.json();
    } catch (error) {
      const parseError = normalizeError(new Error('Invalid JSON in request body'), requestId);
      return createErrorResponse(parseError);
    }

    // Validate required fields
    const validationError = validateRequestBody(body);
    if (validationError) {
      const error = normalizeError(new Error(validationError), requestId);
      return createErrorResponse(error);
    }

    // Process based on request type
    if (body.type === 'single') {
      // Single frame analysis
      const analysisRequest: FrameAnalysisRequest = {
        frameUrl: body.frameUrl,
        timestamp: body.timestamp,
        analysisType: body.analysisType,
        context: body.context
      };

      const result = await VisionAnalysisService.analyzeFrame(analysisRequest);
      
      return createSuccessResponse({
        type: 'single',
        result,
        processingTime: result.processingTime,
        requestId
      }, requestId);

    } else if (body.type === 'batch') {
      // Batch frame analysis
      const batchRequest: BatchAnalysisRequest = {
        frames: body.frames.map(frame => ({
          frameUrl: frame.frameUrl,
          timestamp: frame.timestamp,
          analysisType: body.analysisType,
          context: body.context
        })),
        analysisType: body.analysisType,
        batchSize: body.batchSize,
        context: body.context
      };

      const result = await VisionAnalysisService.analyzeBatch(batchRequest);
      
      return createSuccessResponse({
        type: 'batch',
        result,
        processingTime: result.processingTime,
        requestId
      }, requestId);

    } else {
      const typeError = normalizeError(new Error('Invalid request type. Must be "single" or "batch"'), requestId);
      return createErrorResponse(typeError);
    }

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
}

/**
 * GET /api/openai/vision
 * Get information about available analysis types and configuration
 */
export async function GET() {
  const requestId = generateRequestId();

  try {
    const analysisTypes: Record<AnalysisType, string> = {
      slide_content: 'Extract text content, bullet points, and visual elements from slides',
      presentation_flow: 'Analyze slide type, narrative flow, and transition quality',
      visual_quality: 'Assess design consistency, color scheme, typography, and professionalism',
      engagement_cues: 'Identify visual hierarchy, call-to-action elements, and memorability factors',
      comprehensive: 'Complete analysis covering all aspects of the slide'
    };

    const limits = {
      maxBatchSize: 10,
      maxImageSize: '20MB',
      supportedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
      rateLimit: 'Follows OpenAI API rate limits'
    };

    const config = {
      model: 'gpt-4o',
      maxTokens: 1000,
      temperature: 0.1,
      analysisTypes,
      limits
    };

    return createSuccessResponse(config, requestId);

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
}

/**
 * Validate request body structure and required fields
 */
function validateRequestBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a valid object';
  }

  const requestBody = body as Record<string, unknown>;

  if (!requestBody.type) {
    return 'Request type is required ("single" or "batch")';
  }

  if (!requestBody.analysisType) {
    return 'Analysis type is required';
  }

  const validAnalysisTypes: AnalysisType[] = [
    'slide_content',
    'presentation_flow', 
    'visual_quality',
    'engagement_cues',
    'comprehensive'
  ];

  if (!validAnalysisTypes.includes(requestBody.analysisType as AnalysisType)) {
    return `Invalid analysis type. Must be one of: ${validAnalysisTypes.join(', ')}`;
  }

  if (requestBody.type === 'single') {
    if (!requestBody.frameUrl || typeof requestBody.frameUrl !== 'string') {
      return 'frameUrl is required and must be a string for single analysis';
    }

    if (typeof requestBody.timestamp !== 'number') {
      return 'timestamp is required and must be a number for single analysis';
    }

    // Validate URL format
    try {
      new URL(requestBody.frameUrl);
    } catch {
      return 'frameUrl must be a valid URL';
    }

  } else if (requestBody.type === 'batch') {
    if (!Array.isArray(requestBody.frames)) {
      return 'frames must be an array for batch analysis';
    }

    if (requestBody.frames.length === 0) {
      return 'frames array cannot be empty';
    }

    if (requestBody.frames.length > 10) {
      return 'Maximum 10 frames allowed per batch request';
    }

    // Validate each frame
    for (let i = 0; i < requestBody.frames.length; i++) {
      const frame = requestBody.frames[i] as Record<string, unknown>;
      
      if (!frame.frameUrl || typeof frame.frameUrl !== 'string') {
        return `Frame ${i}: frameUrl is required and must be a string`;
      }

      if (typeof frame.timestamp !== 'number') {
        return `Frame ${i}: timestamp is required and must be a number`;
      }

      try {
        new URL(frame.frameUrl);
      } catch {
        return `Frame ${i}: frameUrl must be a valid URL`;
      }
    }

    // Validate batch size if provided
    if (requestBody.batchSize !== undefined && (typeof requestBody.batchSize !== 'number' || requestBody.batchSize < 1 || requestBody.batchSize > 10)) {
      return 'batchSize must be a number between 1 and 10';
    }

  } else {
    return 'Invalid request type. Must be "single" or "batch"';
  }

  return null; // No validation errors
}

/**
 * OPTIONS handler for CORS support
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 