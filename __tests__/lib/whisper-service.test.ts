import { 
  transcribeAudio, 
  TranscriptionOptions, 
  TranscriptionResult,
  WHISPER_CONFIG 
} from '@/lib/whisper-service';
import { AudioFileInfo } from '@/lib/audio-utils';

// Mock dependencies
jest.mock('@/lib/openai-config', () => ({
  openai: {
    audio: {
      transcriptions: {
        create: jest.fn()
      }
    }
  },
  OPENAI_CONFIG: {
    MODELS: {
      TRANSCRIPTION: 'whisper-1'
    },
    DEFAULTS: {
      TIMEOUT: 30000
    }
  }
}));

jest.mock('@/lib/audio-utils', () => ({
  validateAudioFile: jest.fn(),
  getRecommendedTranscriptionOptions: jest.fn()
}));

jest.mock('@/lib/openai-rate-limiter', () => ({
  withRateLimit: jest.fn(),
  rateLimiter: {
    executeWithRateLimit: jest.fn()
  }
}));

jest.mock('@/lib/openai-cost-tracker', () => ({
  costTracker: {
    trackTranscription: jest.fn()
  }
}));

jest.mock('@/lib/errors/handlers', () => ({
  generateRequestId: jest.fn(() => 'test-request-id'),
  withTimeout: jest.fn()
}));

import { validateAudioFile, getRecommendedTranscriptionOptions } from '@/lib/audio-utils';
import { withRateLimit, rateLimiter } from '@/lib/openai-rate-limiter';
import { costTracker } from '@/lib/openai-cost-tracker';
import { generateRequestId } from '@/lib/errors/handlers';

describe('Whisper Service', () => {
  const mockFile = new File(['test audio content'], 'test.mp3', { type: 'audio/mpeg' });
  const mockAudioInfo: AudioFileInfo = {
    name: 'test.mp3',
    size: 1024000,
    type: 'audio/mpeg',
    extension: '.mp3',
    isValid: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test-key-12345';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('transcribeAudio', () => {
    it('should successfully transcribe audio with default options', async () => {
      // Setup mocks
      (validateAudioFile as jest.Mock).mockReturnValue(mockAudioInfo);
      (getRecommendedTranscriptionOptions as jest.Mock).mockReturnValue({
        response_format: 'json',
        language: 'en'
      });

      const mockTranscription = {
        text: 'This is a test transcription'
      };

      (withRateLimit as jest.Mock).mockImplementation(async (operation) => {
        return await operation();
      });

      // Mock the actual OpenAI API call
      const mockCreate = jest.fn().mockResolvedValue(mockTranscription);
      jest.doMock('@/lib/openai-config', () => ({
        openai: {
          audio: {
            transcriptions: {
              create: mockCreate
            }
          }
        },
        OPENAI_CONFIG: {
          MODELS: { TRANSCRIPTION: 'whisper-1' },
          DEFAULTS: { TIMEOUT: 30000 }
        }
      }));

      // Execute
      const result = await transcribeAudio(mockFile, 'test.mp3');

      // Verify
      expect(result.success).toBe(true);
      expect(result.transcription).toEqual(mockTranscription);
      expect(result.error).toBeUndefined();

      // Verify dependencies were called correctly
      expect(validateAudioFile).toHaveBeenCalledWith(mockFile, expect.any(String));
      expect(withRateLimit).toHaveBeenCalled();
      expect(costTracker.trackTranscription).toHaveBeenCalled();
    });

    it('should handle invalid audio file', async () => {
      // Setup mocks for invalid file
      const invalidAudioInfo = {
        ...mockAudioInfo,
        isValid: false
      };
      (validateAudioFile as jest.Mock).mockReturnValue(invalidAudioInfo);

      // Execute
      const result = await transcribeAudio(mockFile, 'test.mp3');

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.transcription).toBeUndefined();

      // Verify OpenAI was not called
      expect(withRateLimit).not.toHaveBeenCalled();
    });

    it('should handle OpenAI API errors', async () => {
      // Setup mocks
      (validateAudioFile as jest.Mock).mockReturnValue(mockAudioInfo);
      (getRecommendedTranscriptionOptions as jest.Mock).mockReturnValue({});

      const apiError = new Error('OpenAI API Error: Rate limit exceeded');
      (withRateLimit as jest.Mock).mockRejectedValue(apiError);

      // Execute
      const result = await transcribeAudio(mockFile, 'test.mp3');

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(result.transcription).toBeUndefined();

      // Verify error tracking
      expect(costTracker.trackTranscription).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Rate limit exceeded')
        })
      );
    });

    it('should use custom transcription options', async () => {
      // Setup mocks
      (validateAudioFile as jest.Mock).mockReturnValue(mockAudioInfo);
      (getRecommendedTranscriptionOptions as jest.Mock).mockReturnValue({
        response_format: 'json'
      });

      const customOptions: TranscriptionOptions = {
        language: 'es',
        response_format: 'verbose_json',
        temperature: 0.2
      };

      const mockTranscription = {
        text: 'Esta es una transcripción de prueba',
        language: 'es'
      };

      (withRateLimit as jest.Mock).mockImplementation(async (operation) => {
        return await operation();
      });

      const mockCreate = jest.fn().mockResolvedValue(mockTranscription);
      jest.doMock('@/lib/openai-config', () => ({
        openai: {
          audio: {
            transcriptions: {
              create: mockCreate
            }
          }
        }
      }));

      // Execute
      const result = await transcribeAudio(mockFile, 'test.mp3', customOptions);

      // Verify
      expect(result.success).toBe(true);
      expect(result.transcription).toEqual(mockTranscription);
    });

    it('should handle missing API key', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await transcribeAudio(mockFile, 'test.mp3');

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API key not configured');
    });

    it('should handle buffer input', async () => {
      const testBuffer = Buffer.from('test audio data');
      
      (getRecommendedTranscriptionOptions as jest.Mock).mockReturnValue({
        response_format: 'json'
      });

      const mockTranscription = {
        text: 'Buffer transcription test'
      };

      (withRateLimit as jest.Mock).mockImplementation(async (operation) => {
        return await operation();
      });

      const result = await transcribeAudio(testBuffer, 'test.mp3');

      expect(result.success).toBe(true);
      expect(result.transcription).toEqual(mockTranscription);
      
      // validateAudioFile should not be called for Buffer input
      expect(validateAudioFile).not.toHaveBeenCalled();
    });

    it('should handle very large files', async () => {
      const largeFile = new File(['x'.repeat(30 * 1024 * 1024)], 'large.mp3', { type: 'audio/mpeg' });
      
      const invalidAudioInfo = {
        ...mockAudioInfo,
        isValid: false,
        size: 30 * 1024 * 1024
      };
      
      (validateAudioFile as jest.Mock).mockReturnValue(invalidAudioInfo);

      const result = await transcribeAudio(largeFile, 'large.mp3');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('WHISPER_CONFIG', () => {
    it('should contain proper configuration', () => {
      expect(WHISPER_CONFIG.MAX_RETRIES).toBe(3);
      expect(WHISPER_CONFIG.TIMEOUT_MS).toBe(120000);
      expect(WHISPER_CONFIG.SUPPORTED_LANGUAGES).toContain('en');
      expect(WHISPER_CONFIG.SUPPORTED_LANGUAGES).toContain('es');
      expect(WHISPER_CONFIG.RESPONSE_FORMATS).toContain('json');
      expect(WHISPER_CONFIG.RESPONSE_FORMATS).toContain('verbose_json');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null file input', async () => {
      const result = await transcribeAudio(null as any, 'test.mp3');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty filename', async () => {
      const result = await transcribeAudio(mockFile, '');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network timeouts', async () => {
      (validateAudioFile as jest.Mock).mockReturnValue(mockAudioInfo);
      (getRecommendedTranscriptionOptions as jest.Mock).mockReturnValue({});

      const timeoutError = new Error('Request timeout');
      (withRateLimit as jest.Mock).mockRejectedValue(timeoutError);

      const result = await transcribeAudio(mockFile, 'test.mp3');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
}); 