// API endpoints for enhanced video processing with storage integration
import { NextRequest, NextResponse } from 'next/server';
import { 
  EnhancedVideoProcessor, 
  AdvancedProcessingOptions 
} from '@/lib/enhanced-video-processor';
import { 
  generateRequestId,
  normalizeError,
  logError
} from '@/lib/errors/handlers';

// POST /api/video/enhanced - Start enhanced video processing
export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const { videoUrl, options = {} } = await req.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(videoUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid video URL format' },
        { status: 400 }
      );
    }

    // Validate and sanitize options
    const processingOptions: AdvancedProcessingOptions = {
      frameInterval: options.frameInterval || 10,
      frameQuality: options.frameQuality || 85,
      frameResolution: options.frameResolution || { width: 1280, height: 720 },
      extractKeyFramesOnly: options.extractKeyFramesOnly || false,
      frameFormat: options.frameFormat || 'jpg',
      audioFormat: options.audioFormat || 'mp3',
      audioQuality: options.audioQuality || 128,
      extractAudio: options.extractAudio !== false,
      audioNormalization: options.audioNormalization || false,
      performQualityAnalysis: options.performQualityAnalysis || false,
      detectScenes: options.detectScenes || false,
      extractThumbnail: options.extractThumbnail !== false,
      maxFrames: Math.min(options.maxFrames || 100, 200),
      maxDuration: Math.min(options.maxDuration || 3600, 7200),
      timeout: Math.min(options.timeout || 1800000, 3600000),
      priority: options.priority || 'normal'
    };

    console.log(`Starting enhanced video processing for ${videoUrl} with options:`, processingOptions);

    // Process video directly (no job queue in simplified version)
    const results = await EnhancedVideoProcessor.processVideoAdvanced(videoUrl, processingOptions);

    return NextResponse.json({
      success: true,
      results,
      requestId
    });

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    
    logError(normalizedError, {
      context: 'enhanced-video-processing-api',
      operation: 'POST /api/video/enhanced'
    });

    const statusCode = normalizedError.name === 'VideoFormatError' ? 400 : 
                      normalizedError.name === 'VideoProcessingError' ? 422 : 500;

    return NextResponse.json(
      { 
        error: normalizedError.message,
        type: normalizedError.name,
        requestId
      },
      { status: statusCode }
    );
  }
}

// GET /api/video/enhanced - List all enhanced processing jobs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'formats') {
      const formats = EnhancedVideoProcessor.getSupportedFormats();
      return NextResponse.json({
        success: true,
        formats
      });
    }

    if (action === 'estimate') {
      const videoUrl = searchParams.get('videoUrl');
      if (!videoUrl) {
        return NextResponse.json(
          { error: 'Video URL required for cost estimation' },
          { status: 400 }
        );
      }

      const estimate = await EnhancedVideoProcessor.estimateProcessingCost(videoUrl);
      return NextResponse.json({
        success: true,
        estimate
      });
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    );

  } catch (error) {
    const requestId = generateRequestId();
    const normalizedError = normalizeError(error, requestId);
    
    logError(normalizedError, {
      context: 'enhanced-video-processing-api',
      operation: 'GET /api/video/enhanced'
    });

    return NextResponse.json(
      { 
        error: normalizedError.message,
        requestId
      },
      { status: 500 }
    );
  }
} 