import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio, TranscriptionOptions } from '@/lib/whisper-service';
import { validateAudioFile } from '@/lib/audio-utils';
import { FileTracker } from '@/lib/file-tracking';
import { CleanupScheduler } from '@/lib/cleanup-scheduler';
import { rateLimiter } from '@/lib/openai-rate-limiter';
import { 
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
  normalizeError,
  withErrorHandling,
  withTimeout,
  logError
} from '@/lib/errors/handlers';
import { 
  isStorageError,
  ProcessingError,
  ConfigurationError,
  ValidationError
} from '@/lib/errors/types';
import { enforceRateLimit } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Apply IP-based rate limiting (additional layer to OpenAI rate limiting)
    enforceRateLimit(request, 'AI_PROCESSING', requestId);
    
    // Validate OpenAI configuration
    if (!process.env.OPENAI_API_KEY) {
      const configError = new ConfigurationError(
        'OpenAI API key not configured',
        { configField: 'OPENAI_API_KEY' },
        requestId
      );
      logError(configError, { endpoint: '/api/whisper', action: 'config_check' });
      return createErrorResponse(configError);
    }

    // Parse form data with error handling
    const formData = await withErrorHandling(
      () => request.formData(),
      'parsing_form_data',
      requestId
    );

    const file = formData.get('file') as File;
    const language = formData.get('language') as string || 'auto';
    const responseFormat = formData.get('response_format') as string || 'verbose_json';
    const temperature = formData.get('temperature') ? parseFloat(formData.get('temperature') as string) : 0;
    const prompt = formData.get('prompt') as string || undefined;
    const timestampGranularities = formData.getAll('timestamp_granularities') as ('word' | 'segment')[];

    // Validate file
    if (!file) {
      throw new ValidationError(
        'No audio file provided',
        { validation: 'missing_file' },
        requestId
      );
    }

    // Validate audio file using our utility
    const audioInfo = validateAudioFile(file, requestId);

    // Prepare transcription options
    const options: TranscriptionOptions = {
      language: language === 'auto' ? undefined : language,
      response_format: responseFormat as any,
      temperature,
      prompt,
      timestamp_granularities: timestampGranularities.length > 0 ? timestampGranularities : undefined,
    };

    // Perform transcription with timeout (rate limiting handled by service)
    const transcriptionResult = await withTimeout(
      transcribeAudio(file, file.name, options, requestId),
      120000, // 2 minutes timeout
      requestId
    );

    // Check if transcription was successful
    if (!transcriptionResult.success) {
      throw new ProcessingError(
        transcriptionResult.error || 'Transcription failed',
        { 
          audioInfo: transcriptionResult.metadata.audioInfo,
          options: transcriptionResult.metadata.options 
        },
        requestId
      );
    }

    // Register the transcription in our tracking system for cleanup
    try {
      const sessionId = `whisper_${requestId}`;
      FileTracker.registerFile(
        `transcription://${requestId}`,
        requestId,
        `${file.name}.transcription`,
        JSON.stringify(transcriptionResult).length,
        'application/json',
        sessionId
      );
    } catch (error) {
      // Log but don't fail transcription if tracking fails
      const trackingError = normalizeError(error, requestId);
      logError(trackingError, { 
        endpoint: '/api/whisper', 
        action: 'transcription_tracking',
        transcriptionId: requestId 
      });
    }

    // Trigger cleanup scheduler
    CleanupScheduler.onFileUploaded().catch(error => {
      const cleanupError = normalizeError(error, requestId);
      logError(cleanupError, { 
        endpoint: '/api/whisper', 
        action: 'cleanup_scheduling' 
      });
    });

    // Get rate limiter status for transparency
    const rateLimitStatus = rateLimiter.getStatus();

    // Prepare response data
    const responseData = {
      requestId,
      success: true,
      transcription: transcriptionResult.transcription,
      metadata: {
        ...transcriptionResult.metadata,
        audioFile: {
          name: audioInfo.name,
          size: audioInfo.size,
          type: audioInfo.type,
          estimatedDuration: audioInfo.estimatedDuration,
        },
      },
      // Include cleanup info for transparency
      cleanupInfo: {
        registeredForCleanup: true,
        expiresAfter: '24 hours',
        trackingId: requestId
      },
      // Include rate limiting info for transparency
      rateLimitInfo: {
        transcriptionRequestsRemaining: rateLimitStatus.transcription?.requestsRemaining || 0,
        transcriptionTokensRemaining: rateLimitStatus.transcription?.tokensRemaining || 0,
        queueSize: rateLimitStatus.transcription?.queueSize || 0,
      }
    };

    return createSuccessResponse(responseData, requestId);

  } catch (error) {
    // Normalize error and create appropriate response
    const transcriptionError = isStorageError(error) 
      ? error 
      : normalizeError(error, requestId);

    // Enhanced logging with context
    logError(transcriptionError, {
      endpoint: '/api/whisper',
      clientIP: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent'),
      contentLength: request.headers.get('content-length'),
    });

    return createErrorResponse(transcriptionError);
  }
}

// GET endpoint for checking Whisper API status and configuration
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Apply rate limiting for API status checks
    enforceRateLimit(request, 'AI_PROCESSING', requestId);
    
    // Basic configuration check
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    if (!hasApiKey) {
      return createErrorResponse(
        new ConfigurationError(
          'OpenAI API key not configured',
          { configField: 'OPENAI_API_KEY' },
          requestId
        )
      );
    }

    // Get current rate limiting status
    const rateLimitStatus = rateLimiter.getStatus();
    const queueInfo = rateLimiter.getQueueInfo();

    // Return API information
    const apiInfo = {
      status: 'ready',
      features: {
        transcription: true,
        supportedFormats: ['mp3', 'wav', 'm4a', 'flac', 'webm', 'ogg'],
        maxFileSize: '25MB',
        supportedLanguages: [
          'auto-detect', 'english', 'spanish', 'french', 'german', 
          'italian', 'portuguese', 'russian', 'japanese', 'korean', 
          'chinese', 'arabic', 'hindi'
        ],
        responseFormats: ['text', 'json', 'srt', 'verbose_json', 'vtt'],
        timestampGranularities: ['word', 'segment'],
      },
      rateLimiting: {
        enabled: true,
        transcription: {
          requestsRemaining: rateLimitStatus.transcription?.requestsRemaining || 0,
          tokensRemaining: rateLimitStatus.transcription?.tokensRemaining || 0,
          queueSize: rateLimitStatus.transcription?.queueSize || 0,
          resetTime: rateLimitStatus.transcription?.resetTime ? new Date(rateLimitStatus.transcription.resetTime).toISOString() : null,
        },
        queue: {
          totalSize: queueInfo.totalSize,
          avgWaitTime: Math.round(queueInfo.avgWaitTime / 1000), // Convert to seconds
        }
      },
      usage: {
        timeout: '2 minutes per request',
        retries: 'Intelligent rate limiting with queuing',
        cleanup: 'Auto-cleanup after 24 hours'
      }
    };

    return createSuccessResponse(apiInfo, requestId);

  } catch (error) {
    const normalizedError = normalizeError(error, requestId);
    return createErrorResponse(normalizedError);
  }
} 