// Transcription results handling and processing
import { TranscriptionResult, TranscriptionSegment, TranscriptionWord } from '@/lib/whisper-service';
import { formatDuration } from '@/lib/audio-utils';

// Storage interface for transcription results
export interface StoredTranscriptionResult {
  id: string;
  timestamp: string;
  audioFileName: string;
  audioFileSize: number;
  language: string;
  duration: number;
  processingTime: number;
  transcriptionText: string;
  segments: TranscriptionSegment[];
  words: TranscriptionWord[];
  metadata: {
    requestId: string;
    options: any;
    hasTimestamps: boolean;
    segmentCount: number;
    wordCount: number;
  };
}

// In-memory storage for demo purposes (replace with database in production)
const transcriptionStorage = new Map<string, StoredTranscriptionResult>();

/**
 * Store transcription result for later retrieval
 */
export function storeTranscriptionResult(
  result: TranscriptionResult,
  id?: string
): StoredTranscriptionResult {
  const transcriptionId = id || result.metadata.requestId;
  
  // Extract relevant data from the result
  const transcriptionText = typeof result.transcription === 'string' 
    ? result.transcription 
    : result.transcription.text || '';
    
  const segments = typeof result.transcription === 'string'
    ? []
    : result.transcription.segments || [];
    
  const words = typeof result.transcription === 'string'
    ? []
    : result.transcription.words || [];

  const stored: StoredTranscriptionResult = {
    id: transcriptionId,
    timestamp: new Date().toISOString(),
    audioFileName: result.metadata.audioInfo.name,
    audioFileSize: result.metadata.audioInfo.size,
    language: result.metadata.language || 'unknown',
    duration: result.metadata.duration || 0,
    processingTime: result.metadata.processingTime,
    transcriptionText,
    segments,
    words,
    metadata: {
      requestId: result.metadata.requestId,
      options: result.metadata.options,
      hasTimestamps: segments.length > 0,
      segmentCount: segments.length,
      wordCount: words.length,
    },
  };

  transcriptionStorage.set(transcriptionId, stored);
  return stored;
}

/**
 * Retrieve stored transcription result by ID
 */
export function getStoredTranscriptionResult(id: string): StoredTranscriptionResult | null {
  return transcriptionStorage.get(id) || null;
}

/**
 * List all stored transcription results
 */
export function listStoredTranscriptionResults(): StoredTranscriptionResult[] {
  return Array.from(transcriptionStorage.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Delete stored transcription result
 */
export function deleteStoredTranscriptionResult(id: string): boolean {
  return transcriptionStorage.delete(id);
}

/**
 * Clear all stored transcription results
 */
export function clearAllStoredTranscriptionResults(): void {
  transcriptionStorage.clear();
}

/**
 * Format transcription result for different output formats
 */
export function formatTranscriptionOutput(
  result: StoredTranscriptionResult,
  format: 'text' | 'json' | 'srt' | 'vtt' | 'segments'
): string {
  switch (format) {
    case 'text':
      return result.transcriptionText;
      
    case 'json':
      return JSON.stringify({
        text: result.transcriptionText,
        language: result.language,
        duration: result.duration,
        segments: result.segments,
        words: result.words,
        metadata: result.metadata,
      }, null, 2);
      
    case 'srt':
      return formatAsSRT(result.segments);
      
    case 'vtt':
      return formatAsVTT(result.segments);
      
    case 'segments':
      return formatAsSegmentedText(result.segments);
      
    default:
      return result.transcriptionText;
  }
}

/**
 * Format segments as SRT subtitle format
 */
function formatAsSRT(segments: TranscriptionSegment[]): string {
  if (segments.length === 0) {
    return '';
  }

  return segments.map((segment, index) => {
    const startTime = formatSRTTimestamp(segment.start);
    const endTime = formatSRTTimestamp(segment.end);
    
    return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text.trim()}\n`;
  }).join('\n');
}

/**
 * Format segments as VTT subtitle format
 */
function formatAsVTT(segments: TranscriptionSegment[]): string {
  if (segments.length === 0) {
    return 'WEBVTT\n\n';
  }

  const vttContent = segments.map(segment => {
    const startTime = formatVTTTimestamp(segment.start);
    const endTime = formatVTTTimestamp(segment.end);
    
    return `${startTime} --> ${endTime}\n${segment.text.trim()}`;
  }).join('\n\n');

  return `WEBVTT\n\n${vttContent}\n`;
}

/**
 * Format segments as readable segmented text with timestamps
 */
function formatAsSegmentedText(segments: TranscriptionSegment[]): string {
  if (segments.length === 0) {
    return '';
  }

  return segments.map(segment => {
    const startTime = formatDuration(segment.start);
    const endTime = formatDuration(segment.end);
    
    return `[${startTime} - ${endTime}] ${segment.text.trim()}`;
  }).join('\n\n');
}

/**
 * Format timestamp for SRT format (HH:MM:SS,mmm)
 */
function formatSRTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Format timestamp for VTT format (HH:MM:SS.mmm)
 */
function formatVTTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Generate summary statistics for a transcription result
 */
export function generateTranscriptionSummary(result: StoredTranscriptionResult): {
  overview: {
    fileName: string;
    language: string;
    duration: string;
    processingTime: string;
    audioFileSize: string;
  };
  content: {
    totalWords: number;
    totalCharacters: number;
    segmentCount: number;
    averageSegmentLength: string;
    averageConfidence?: number;
  };
  quality: {
    hasTimestamps: boolean;
    wordLevelTimestamps: boolean;
    compressionRatio?: number;
    noSpeechProbability?: number;
  };
} {
  const words = result.transcriptionText.split(/\s+/).filter(word => word.length > 0);
  const avgSegmentDuration = result.segments.length > 0 
    ? result.segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0) / result.segments.length
    : 0;
  
  const avgCompressionRatio = result.segments.length > 0
    ? result.segments.reduce((sum, seg) => sum + seg.compression_ratio, 0) / result.segments.length
    : undefined;
    
  const avgNoSpeechProb = result.segments.length > 0
    ? result.segments.reduce((sum, seg) => sum + seg.no_speech_prob, 0) / result.segments.length
    : undefined;

  return {
    overview: {
      fileName: result.audioFileName,
      language: result.language,
      duration: formatDuration(result.duration),
      processingTime: `${(result.processingTime / 1000).toFixed(1)}s`,
      audioFileSize: formatFileSize(result.audioFileSize),
    },
    content: {
      totalWords: words.length,
      totalCharacters: result.transcriptionText.length,
      segmentCount: result.segments.length,
      averageSegmentLength: formatDuration(avgSegmentDuration),
      averageConfidence: avgCompressionRatio ? (1 - avgCompressionRatio) : undefined,
    },
    quality: {
      hasTimestamps: result.metadata.hasTimestamps,
      wordLevelTimestamps: result.words.length > 0,
      compressionRatio: avgCompressionRatio,
      noSpeechProbability: avgNoSpeechProb,
    },
  };
}

/**
 * Search through transcription text content
 */
export function searchTranscriptions(
  query: string,
  options: {
    caseSensitive?: boolean;
    wholeWords?: boolean;
    includeTimestamps?: boolean;
  } = {}
): Array<{
  transcriptionId: string;
  fileName: string;
  matches: Array<{
    text: string;
    segmentIndex?: number;
    startTime?: number;
    endTime?: number;
  }>;
}> {
  const results: Array<{
    transcriptionId: string;
    fileName: string;
    matches: Array<{
      text: string;
      segmentIndex?: number;
      startTime?: number;
      endTime?: number;
    }>;
  }> = [];

  const searchFlags = options.caseSensitive ? 'g' : 'gi';
  const searchPattern = options.wholeWords ? `\\b${query}\\b` : query;
  const regex = new RegExp(searchPattern, searchFlags);

  for (const result of transcriptionStorage.values()) {
    const matches: Array<{
      text: string;
      segmentIndex?: number;
      startTime?: number;
      endTime?: number;
    }> = [];

    if (options.includeTimestamps && result.segments.length > 0) {
      // Search within segments to get timestamp information
      result.segments.forEach((segment, index) => {
        if (regex.test(segment.text)) {
          matches.push({
            text: segment.text,
            segmentIndex: index,
            startTime: segment.start,
            endTime: segment.end,
          });
        }
      });
    } else {
      // Simple text search
      if (regex.test(result.transcriptionText)) {
        matches.push({
          text: result.transcriptionText,
        });
      }
    }

    if (matches.length > 0) {
      results.push({
        transcriptionId: result.id,
        fileName: result.audioFileName,
        matches,
      });
    }
  }

  return results;
}

/**
 * Helper function to format file size (duplicated from audio-utils for independence)
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 