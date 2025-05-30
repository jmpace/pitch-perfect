// Whisper API service for audio transcription
import { openai, OPENAI_CONFIG } from '@/lib/openai-config';
import { validateAudioFile, getRecommendedTranscriptionOptions, AudioFileInfo } from '@/lib/audio-utils';
import { ProcessingError, ConfigurationError } from '@/lib/errors/types';
import { withTimeout, generateRequestId } from '@/lib/errors/handlers';
import { withRateLimit, rateLimiter } from '@/lib/openai-rate-limiter';
import { costTracker } from '@/lib/openai-cost-tracker';

// Whisper API configuration
export const WHISPER_CONFIG = {
  MAX_RETRIES: 3,
  TIMEOUT_MS: 120000, // 2 minutes for transcription
  RETRY_DELAY_MS: 1000,
  SUPPORTED_LANGUAGES: [
    'auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'
  ],
  RESPONSE_FORMATS: ['json', 'text', 'srt', 'verbose_json', 'vtt'] as const,
} as const;

// Transcription request options
export interface TranscriptionOptions {
  language?: string;
  response_format?: typeof WHISPER_CONFIG.RESPONSE_FORMATS[number];
  temperature?: number;
  prompt?: string;
  timestamp_granularities?: ('word' | 'segment')[];
}

// Transcription result types
export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
}

export interface VerboseTranscriptionResult {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments: TranscriptionSegment[];
  words?: TranscriptionWord[];
}

export interface TranscriptionResult {
  success: boolean;
  transcription: string | VerboseTranscriptionResult;
  metadata: {
    requestId: string;
    audioInfo: AudioFileInfo;
    options: TranscriptionOptions;
    processingTime: number;
    language?: string;
    duration?: number;
    segments?: number;
    words?: number;
  };
  error?: string;
}

/**
 * Transcribe audio file using OpenAI Whisper API
 */
export async function transcribeAudio(
  file: File | Buffer,
  filename: string,
  options: TranscriptionOptions = {},
  requestId?: string
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  const reqId = requestId || generateRequestId();
  let audioInfo: AudioFileInfo | undefined;

  try {
    // Validate configuration
    if (!process.env.OPENAI_API_KEY) {
      throw new ConfigurationError(
        'OpenAI API key not configured',
        { configField: 'OPENAI_API_KEY' },
        reqId
      );
    }

    // Validate file if it's a File object
    if (file instanceof File) {
      audioInfo = validateAudioFile(file, reqId);
    } else {
      // For Buffer, create minimal audio info
      audioInfo = {
        name: filename,
        size: file.length,
        type: 'application/octet-stream',
        extension: filename.substring(filename.lastIndexOf('.')),
        isValid: true,
      };
    }

    // Merge options with recommended settings
    const recommendedOptions = getRecommendedTranscriptionOptions(audioInfo);
    const finalOptions: TranscriptionOptions = {
      ...recommendedOptions,
      ...options,
    };

    // Validate options
    validateTranscriptionOptions(finalOptions, reqId);

    // Estimate tokens for rate limiting
    const estimatedTokens = rateLimiter.estimateTokens('transcription', audioInfo.size);

    // Make the API call with rate limiting and timeout
    const transcriptionResponse = await withRateLimit(
      'transcription',
      () => withTimeout(
        openai.audio.transcriptions.create({
          file: file instanceof File ? file : new File([file], filename),
          model: OPENAI_CONFIG.MODELS.TRANSCRIPTION,
          language: finalOptions.language !== 'auto' ? finalOptions.language : undefined,
          response_format: finalOptions.response_format || 'verbose_json',
          temperature: finalOptions.temperature,
          prompt: finalOptions.prompt,
          timestamp_granularities: finalOptions.timestamp_granularities,
        }),
        WHISPER_CONFIG.TIMEOUT_MS,
        reqId
      ),
      estimatedTokens,
      'medium' // Priority level
    );

    const processingTime = Date.now() - startTime;

    // Process the response based on format
    let result: TranscriptionResult;
    
    if (finalOptions.response_format === 'verbose_json') {
      const verboseResult = transcriptionResponse as VerboseTranscriptionResult;
      
      // Track cost for verbose response
      try {
        const audioDurationMinutes = verboseResult.duration / 60; // Convert seconds to minutes
        const outputTokens = verboseResult.text?.length ? Math.ceil(verboseResult.text.length / 4) : 0;
        
        await costTracker.trackTranscription(
          OPENAI_CONFIG.MODELS.TRANSCRIPTION,
          audioDurationMinutes,
          outputTokens,
          processingTime,
          true, // success
          'transcription_verbose',
          reqId,
          undefined,
          {
            metadata: {
              audioFileName: filename,
              audioSize: audioInfo.size,
              language: verboseResult.language,
              segmentCount: verboseResult.segments?.length,
              wordCount: verboseResult.words?.length
            }
          }
        );
      } catch (trackingError) {
        console.warn('[Whisper Service] Cost tracking failed:', trackingError);
      }
      
      result = {
        success: true,
        transcription: verboseResult,
        metadata: {
          requestId: reqId,
          audioInfo,
          options: finalOptions,
          processingTime,
          language: verboseResult.language,
          duration: verboseResult.duration,
          segments: verboseResult.segments?.length,
          words: verboseResult.words?.length,
        },
      };
    } else {
      // For text, json, srt, vtt formats - transcriptionResponse is a string
      const transcriptionText = typeof transcriptionResponse === 'string' ? transcriptionResponse : (transcriptionResponse as any).text || '';
      
      // Track cost for simple response (estimate duration from file size)
      try {
        // Rough estimation: assume 1MB = ~1 minute of audio (varies by format/quality)
        const estimatedDurationMinutes = (audioInfo.size / (1024 * 1024)) || 0.1; // Minimum 0.1 minutes
        const outputTokens = transcriptionText.length ? Math.ceil(transcriptionText.length / 4) : 0;
        
        await costTracker.trackTranscription(
          OPENAI_CONFIG.MODELS.TRANSCRIPTION,
          estimatedDurationMinutes,
          outputTokens,
          processingTime,
          true, // success
          `transcription_${finalOptions.response_format || 'json'}`,
          reqId,
          undefined,
          {
            metadata: {
              audioFileName: filename,
              audioSize: audioInfo.size,
              responseFormat: finalOptions.response_format,
              estimatedDuration: true
            }
          }
        );
      } catch (trackingError) {
        console.warn('[Whisper Service] Cost tracking failed:', trackingError);
      }
      
      result = {
        success: true,
        transcription: transcriptionText,
        metadata: {
          requestId: reqId,
          audioInfo,
          options: finalOptions,
          processingTime,
        },
      };
    }

    return result;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Track failed transcription
    try {
      const estimatedDurationMinutes = (audioInfo?.size ? audioInfo.size / (1024 * 1024) : 0.1);
      await costTracker.trackTranscription(
        OPENAI_CONFIG.MODELS.TRANSCRIPTION,
        estimatedDurationMinutes,
        0, // No output tokens on failure
        processingTime,
        false, // failure
        'transcription_failed',
        reqId,
        error instanceof Error ? error.constructor.name : 'UnknownError',
        {
          metadata: {
            audioFileName: filename,
            audioSize: audioInfo?.size || 0,
            errorMessage: error instanceof Error ? error.message : String(error)
          }
        }
      );
    } catch (trackingError) {
      console.warn('[Whisper Service] Cost tracking for failed request failed:', trackingError);
    }
    
    // Create error result
    const errorMessage = error instanceof Error ? error.message : 'Unknown transcription error';
    
    return {
      success: false,
      transcription: '',
      metadata: {
        requestId: reqId,
        audioInfo: audioInfo || {} as AudioFileInfo,
        options,
        processingTime,
      },
      error: errorMessage,
    };
  }
}

/**
 * Validate transcription options
 */
function validateTranscriptionOptions(options: TranscriptionOptions, requestId: string): void {
  if (options.language && options.language !== 'auto' && !WHISPER_CONFIG.SUPPORTED_LANGUAGES.includes(options.language as any)) {
    throw new ProcessingError(
      'Unsupported language specified',
      { 
        language: options.language,
        supportedLanguages: WHISPER_CONFIG.SUPPORTED_LANGUAGES 
      },
      requestId
    );
  }

  if (options.response_format && !WHISPER_CONFIG.RESPONSE_FORMATS.includes(options.response_format)) {
    throw new ProcessingError(
      'Unsupported response format specified',
      { 
        format: options.response_format,
        supportedFormats: WHISPER_CONFIG.RESPONSE_FORMATS 
      },
      requestId
    );
  }

  if (options.temperature !== undefined && (options.temperature < 0 || options.temperature > 1)) {
    throw new ProcessingError(
      'Temperature must be between 0 and 1',
      { temperature: options.temperature },
      requestId
    );
  }
}

/**
 * Extract text content from transcription result
 */
export function extractTextFromTranscription(result: TranscriptionResult): string {
  if (!result.success) {
    return '';
  }

  if (typeof result.transcription === 'string') {
    return result.transcription;
  }

  // For verbose_json format
  return result.transcription.text || '';
}

/**
 * Extract segments with timestamps from transcription result
 */
export function extractSegmentsFromTranscription(result: TranscriptionResult): TranscriptionSegment[] {
  if (!result.success || typeof result.transcription === 'string') {
    return [];
  }

  return result.transcription.segments || [];
}

/**
 * Extract word-level timestamps from transcription result
 */
export function extractWordsFromTranscription(result: TranscriptionResult): TranscriptionWord[] {
  if (!result.success || typeof result.transcription === 'string') {
    return [];
  }

  return result.transcription.words || [];
}

/**
 * Format transcription result for display
 */
export function formatTranscriptionForDisplay(result: TranscriptionResult): {
  text: string;
  metadata: string;
  hasTimestamps: boolean;
  segments: Array<{ text: string; start: number; end: number }>;
} {
  const text = extractTextFromTranscription(result);
  const segments = extractSegmentsFromTranscription(result);
  
  const metadata = [
    result.metadata.language && `Language: ${result.metadata.language}`,
    result.metadata.duration && `Duration: ${Math.round(result.metadata.duration)}s`,
    result.metadata.segments && `Segments: ${result.metadata.segments}`,
    `Processing time: ${(result.metadata.processingTime / 1000).toFixed(1)}s`,
  ].filter(Boolean).join(' • ');

  return {
    text,
    metadata,
    hasTimestamps: segments.length > 0,
    segments: segments.map(seg => ({
      text: seg.text,
      start: seg.start,
      end: seg.end,
    })),
  };
} 