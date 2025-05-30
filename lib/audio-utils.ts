// Audio utilities for Whisper API integration
import { ProcessingError } from '@/lib/errors/types';

// Supported audio formats for Whisper API
export const SUPPORTED_AUDIO_FORMATS = [
  'audio/mpeg',           // .mp3
  'audio/wav',            // .wav
  'audio/x-wav',          // .wav (alternative MIME)
  'audio/mp4',            // .m4a
  'audio/x-m4a',          // .m4a (alternative MIME)
  'audio/flac',           // .flac
  'audio/webm',           // .webm
  'audio/ogg',            // .ogg
] as const;

export const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.m4a',
  '.flac',
  '.webm',
  '.ogg',
] as const;

// Audio validation configuration
export const AUDIO_CONFIG = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB (OpenAI Whisper limit)
  MAX_DURATION: 60 * 60,           // 1 hour estimated max
  MIN_FILE_SIZE: 1024,             // 1KB minimum
} as const;

export interface AudioFileInfo {
  name: string;
  size: number;
  type: string;
  extension: string;
  isValid: boolean;
  estimatedDuration?: number;
  metadata?: {
    format: string;
    sampleRate?: number;
    channels?: number;
    bitrate?: number;
  };
}

/**
 * Validate if a file is a supported audio format
 */
export function isValidAudioFormat(file: File): boolean {
  // Check MIME type
  if (SUPPORTED_AUDIO_FORMATS.includes(file.type as any)) {
    return true;
  }

  // Fallback: check file extension if MIME type is not recognized
  const extension = getFileExtension(file.name).toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.includes(extension as any);
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex !== -1 ? filename.slice(lastDotIndex) : '';
}

/**
 * Validate audio file for Whisper API processing
 */
export function validateAudioFile(file: File, requestId?: string): AudioFileInfo {
  const extension = getFileExtension(file.name);
  
  const audioInfo: AudioFileInfo = {
    name: file.name,
    size: file.size,
    type: file.type,
    extension,
    isValid: false,
  };

  // Check if file exists
  if (!file) {
    throw new ProcessingError(
      'No audio file provided',
      { validation: 'missing_file' },
      requestId
    );
  }

  // Check file size constraints
  if (file.size < AUDIO_CONFIG.MIN_FILE_SIZE) {
    throw new ProcessingError(
      'Audio file is too small',
      { 
        validation: 'file_too_small',
        size: file.size,
        minSize: AUDIO_CONFIG.MIN_FILE_SIZE 
      },
      requestId
    );
  }

  if (file.size > AUDIO_CONFIG.MAX_FILE_SIZE) {
    throw new ProcessingError(
      'Audio file is too large for Whisper API',
      { 
        validation: 'file_too_large',
        size: file.size,
        maxSize: AUDIO_CONFIG.MAX_FILE_SIZE,
        maxSizeMB: Math.round(AUDIO_CONFIG.MAX_FILE_SIZE / (1024 * 1024))
      },
      requestId
    );
  }

  // Check audio format
  if (!isValidAudioFormat(file)) {
    throw new ProcessingError(
      'Unsupported audio format',
      { 
        validation: 'unsupported_format',
        fileType: file.type,
        fileName: file.name,
        supportedFormats: SUPPORTED_AUDIO_FORMATS,
        supportedExtensions: SUPPORTED_AUDIO_EXTENSIONS
      },
      requestId
    );
  }

  // If we get here, the file is valid
  audioInfo.isValid = true;
  
  // Estimate duration based on file size and format (rough estimation)
  audioInfo.estimatedDuration = estimateAudioDuration(file.size, file.type);

  return audioInfo;
}

/**
 * Rough estimation of audio duration based on file size and format
 * This is just an approximation for UI purposes
 */
function estimateAudioDuration(fileSize: number, mimeType: string): number {
  // Rough bitrate estimates for different formats (in bytes per second)
  const bitrateEstimates: Record<string, number> = {
    'audio/mpeg': 16000,      // ~128kbps MP3
    'audio/wav': 176000,      // ~1411kbps WAV (44.1kHz, 16-bit, stereo)
    'audio/x-wav': 176000,
    'audio/mp4': 16000,       // ~128kbps M4A
    'audio/x-m4a': 16000,
    'audio/flac': 88000,      // ~700kbps FLAC
    'audio/webm': 16000,      // ~128kbps WebM
    'audio/ogg': 16000,       // ~128kbps OGG
  };

  const estimatedBytesPerSecond = bitrateEstimates[mimeType] || 16000;
  return Math.round(fileSize / estimatedBytesPerSecond);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Get recommended transcription options based on file characteristics
 */
export function getRecommendedTranscriptionOptions(audioInfo: AudioFileInfo) {
  const options: {
    language?: string;
    response_format: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    temperature?: number;
  } = {
    response_format: 'verbose_json', // Default to verbose for timestamps
    temperature: 0, // More deterministic results
  };

  // For longer files, use verbose_json to get timestamps
  if (audioInfo.estimatedDuration && audioInfo.estimatedDuration > 300) { // 5 minutes
    options.response_format = 'verbose_json';
  }

  return options;
} 