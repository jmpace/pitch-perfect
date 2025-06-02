import { 
  transcribeAudio, 
  TranscriptionOptions, 
  TranscriptionResult,
  WHISPER_CONFIG 
} from '@/lib/whisper-service';
import { AudioFileInfo } from '@/lib/audio-utils';
import { validateAudioFile, getRecommendedTranscriptionOptions } from '@/lib/audio-utils';
import { withRateLimit, rateLimiter } from '@/lib/openai-rate-limiter';
import { costTracker } from '@/lib/openai-cost-tracker';
import { generateRequestId, withTimeout } from '@/lib/errors/handlers';
import { openai } from '@/lib/openai-config';

// Get access to the mocked create function
const mockOpenAICreate = openai.audio.transcriptions.create as jest.MockedFunction<typeof openai.audio.transcriptions.create>;

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
    executeWithRateLimit: jest.fn(),
    estimateTokens: jest.fn().mockReturnValue(100),
    requestPermission: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockReturnValue({}),
  },
  OpenAIRateLimiter: {
    getInstance: jest.fn().mockReturnValue({
      estimateTokens: jest.fn().mockReturnValue(100),
      requestPermission: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue({}),
    }),
  },
}));

jest.mock('@/lib/openai-cost-tracker', () => ({
  costTracker: {
    trackTranscription: jest.fn()
  }
}));

jest.mock('@/lib/errors/handlers', () => ({
  generateRequestId: jest.fn(() => 'test-request-id'),
  withTimeout: jest.fn().mockImplementation(async (operation) => {
    // Execute the operation directly for tests
    return await operation;
  }),
}));

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
        response_format: 'verbose_json',
        language: 'en'
      });

      const mockTranscription = {
        task: 'transcribe',
        language: 'en',
        duration: 10.5,
        text: 'This is a test transcription',
        segments: [],
        words: []
      };

      (withRateLimit as jest.Mock).mockImplementation(async (endpoint, operation) => {
        return await operation();
      });

      // Mock the OpenAI API response
      mockOpenAICreate.mockResolvedValue(mockTranscription);

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
      // Setup mocks for invalid file - validateAudioFile should throw an error
      const validationError = new Error('Audio file is too large for Whisper API');
      (validateAudioFile as jest.Mock).mockImplementation(() => {
        throw validationError;
      });

      // Execute
      const result = await transcribeAudio(mockFile, 'test.mp3');

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
      expect(result.transcription).toBe('');

      // Verify OpenAI was not called
      expect(withRateLimit).not.toHaveBeenCalled();
    });

    it('should handle OpenAI API errors', async () => {
      // Setup mocks
      (validateAudioFile as jest.Mock).mockReturnValue(mockAudioInfo);
      (getRecommendedTranscriptionOptions as jest.Mock).mockReturnValue({
        response_format: 'verbose_json'
      });

      const apiError = new Error('OpenAI API Error: Rate limit exceeded');
      (withRateLimit as jest.Mock).mockRejectedValue(apiError);

      // Execute
      const result = await transcribeAudio(mockFile, 'test.mp3');

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(result.transcription).toBe('');

      // Verify error tracking was called with correct parameters
      expect(costTracker.trackTranscription).toHaveBeenCalled();
    });

    it('should use custom transcription options', async () => {
      // Setup mocks
      (validateAudioFile as jest.Mock).mockReturnValue(mockAudioInfo);
      (getRecommendedTranscriptionOptions as jest.Mock).mockReturnValue({
        response_format: 'verbose_json'
      });

      const customOptions: TranscriptionOptions = {
        language: 'es',
        response_format: 'verbose_json',
        temperature: 0.2
      };

      const mockTranscription = {
        task: 'transcribe',
        language: 'es',
        duration: 8.2,
        text: 'Esta es una transcripción de prueba',
        segments: [],
        words: []
      };

      (withRateLimit as jest.Mock).mockImplementation(async (endpoint, operation) => {
        return await operation();
      });

      mockOpenAICreate.mockResolvedValue(mockTranscription);

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
      
      // Setup mocks - note validateAudioFile is not called for Buffer input
      (getRecommendedTranscriptionOptions as jest.Mock).mockReturnValue({
        response_format: 'verbose_json',
        language: 'en'
      });

      const mockTranscription = {
        task: 'transcribe',
        language: 'en',
        duration: 5.3,
        text: 'This is a test transcription from buffer',
        segments: [],
        words: []
      };

      (withRateLimit as jest.Mock).mockImplementation(async (endpoint, operation) => {
        return await operation();
      });

      mockOpenAICreate.mockResolvedValue(mockTranscription);

      // Execute
      const result = await transcribeAudio(testBuffer, 'test.mp3');

      expect(result.success).toBe(true);
      expect(result.transcription).toEqual(mockTranscription);
      
      // validateAudioFile should not be called for Buffer input
      expect(validateAudioFile).not.toHaveBeenCalled();
    });

    it('should handle very large files', async () => {
      const largeFile = new File(['x'.repeat(30 * 1024 * 1024)], 'large.mp3', { type: 'audio/mpeg' });
      
      // validateAudioFile should throw an error for files that are too large
      const validationError = new Error('Audio file is too large for Whisper API');
      (validateAudioFile as jest.Mock).mockImplementation(() => {
        throw validationError;
      });

      const result = await transcribeAudio(largeFile, 'large.mp3');

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should handle empty filename', async () => {
      // For empty filename, the service should handle it gracefully
      // The validateAudioFile will still be called with the file, but filename validation might fail
      (validateAudioFile as jest.Mock).mockReturnValue(mockAudioInfo);
      (getRecommendedTranscriptionOptions as jest.Mock).mockReturnValue({
        response_format: 'verbose_json'
      });

      // Mock successful transcription
      const mockTranscription = {
        task: 'transcribe',
        language: 'en',
        duration: 5.0,
        text: 'Test transcription',
        segments: [],
        words: []
      };

      (withRateLimit as jest.Mock).mockImplementation(async (endpoint, operation) => {
        return await operation();
      });

      mockOpenAICreate.mockResolvedValue(mockTranscription);

      const result = await transcribeAudio(mockFile, '');

      // The service should handle empty filename gracefully and still work
      expect(result.success).toBe(true);
      expect(result.transcription).toEqual(mockTranscription);
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

    it('should handle network timeouts', async () => {
      // Setup mocks
      (validateAudioFile as jest.Mock).mockReturnValue(mockAudioInfo);
      (getRecommendedTranscriptionOptions as jest.Mock).mockReturnValue({
        response_format: 'verbose_json'
      });

      const timeoutError = new Error('Network timeout after 30 seconds');
      (withRateLimit as jest.Mock).mockRejectedValue(timeoutError);

      // Execute
      const result = await transcribeAudio(mockFile, 'test.mp3');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
}); 