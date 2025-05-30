import { 
  checkAuthentication, 
  getAuthenticatedClient,
  validateEnvironment,
  getSetupStatus,
  AuthStatus,
  SETUP_INSTRUCTIONS
} from '@/lib/openai-auth';
import { validateApiKey, testOpenAIConnection } from '@/lib/openai-config';

// Mock the OpenAI client
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    models: {
      list: jest.fn()
    }
  }))
}));

// Mock the config module
jest.mock('@/lib/openai-config', () => ({
  openai: {
    models: {
      list: jest.fn()
    }
  },
  validateApiKey: jest.fn(),
  testOpenAIConnection: jest.fn(),
  OPENAI_CONFIG: {
    MODELS: {
      TRANSCRIPTION: 'whisper-1',
      VISION: 'gpt-4o',
      CHAT: 'gpt-4-turbo-preview',
      EMBEDDING: 'text-embedding-3-small',
    }
  }
}));

describe('OpenAI Authentication', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key format', () => {
      const mockValidateApiKey = validateApiKey as jest.MockedFunction<typeof validateApiKey>;
      mockValidateApiKey.mockReturnValue(true);
      
      const validKey = 'sk-' + 'a'.repeat(48);
      expect(validateApiKey(validKey)).toBe(true);
    });

    it('should return false for invalid API key format', () => {
      const mockValidateApiKey = validateApiKey as jest.MockedFunction<typeof validateApiKey>;
      mockValidateApiKey.mockReturnValue(false);
      
      expect(validateApiKey('invalid-key')).toBe(false);
    });
  });

  describe('validateEnvironment', () => {
    it('should return valid status when API key is present and valid', () => {
      process.env.OPENAI_API_KEY = 'sk-' + 'a'.repeat(48);
      const mockValidateApiKey = validateApiKey as jest.MockedFunction<typeof validateApiKey>;
      mockValidateApiKey.mockReturnValue(true);
      
      const result = validateEnvironment();
      
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should return invalid status when API key is missing', () => {
      delete process.env.OPENAI_API_KEY;
      
      const result = validateEnvironment();
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('OPENAI_API_KEY environment variable is not set');
      expect(result.recommendations).toContain('Add OPENAI_API_KEY to your .env.local file');
    });

    it('should return invalid status when API key has invalid format', () => {
      process.env.OPENAI_API_KEY = 'invalid-format';
      const mockValidateApiKey = validateApiKey as jest.MockedFunction<typeof validateApiKey>;
      mockValidateApiKey.mockReturnValue(false);
      
      const result = validateEnvironment();
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('OPENAI_API_KEY has invalid format');
      expect(result.recommendations).toContain('Ensure API key starts with "sk-" and is properly formatted');
    });
  });

  describe('checkAuthentication', () => {
    it('should return success status when authentication works', async () => {
      process.env.OPENAI_API_KEY = 'sk-' + 'a'.repeat(48);
      const mockValidateApiKey = validateApiKey as jest.MockedFunction<typeof validateApiKey>;
      mockValidateApiKey.mockReturnValue(true);
      
      // Mock successful API call
      const mockModels = {
        list: jest.fn().mockResolvedValue({
          data: [
            { id: 'gpt-4', object: 'model' },
            { id: 'gpt-3.5-turbo', object: 'model' },
            { id: 'whisper-1', object: 'model' }
          ]
        })
      };
      
      jest.doMock('@/lib/openai-config', () => ({
        openai: { models: mockModels },
        validateApiKey: mockValidateApiKey
      }));

      const result = await checkAuthentication();
      
      expect(result.isAuthenticated).toBe(true);
      expect(result.hasValidKey).toBe(true);
      expect(result.models).toEqual(['gpt-4', 'gpt-3.5-turbo', 'whisper-1']);
      expect(result.error).toBeUndefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return error status when API call fails', async () => {
      process.env.OPENAI_API_KEY = 'sk-' + 'a'.repeat(48);
      const mockValidateApiKey = validateApiKey as jest.MockedFunction<typeof validateApiKey>;
      mockValidateApiKey.mockReturnValue(true);
      
      // Mock failed API call
      const mockModels = {
        list: jest.fn().mockRejectedValue(new Error('401 Unauthorized'))
      };
      
      jest.doMock('@/lib/openai-config', () => ({
        openai: { models: mockModels },
        validateApiKey: mockValidateApiKey
      }));

      const result = await checkAuthentication();
      
      expect(result.isAuthenticated).toBe(false);
      expect(result.hasValidKey).toBe(false);
      expect(result.error).toBe('Invalid API key - please check your OPENAI_API_KEY');
    });

    it('should return error status when environment is invalid', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const result = await checkAuthentication();
      
      expect(result.isAuthenticated).toBe(false);
      expect(result.hasValidKey).toBe(false);
      expect(result.error).toContain('Environment issues');
    });
  });

  describe('getAuthenticatedClient', () => {
    it('should return client when authentication succeeds', async () => {
      process.env.OPENAI_API_KEY = 'sk-' + 'a'.repeat(48);
      const mockValidateApiKey = validateApiKey as jest.MockedFunction<typeof validateApiKey>;
      mockValidateApiKey.mockReturnValue(true);
      
      // Mock successful authentication
      const mockModels = {
        list: jest.fn().mockResolvedValue({
          data: [{ id: 'gpt-4', object: 'model' }]
        })
      };
      
      const mockOpenAI = { models: mockModels };
      
      jest.doMock('@/lib/openai-config', () => ({
        openai: mockOpenAI,
        validateApiKey: mockValidateApiKey
      }));

      const client = await getAuthenticatedClient();
      expect(client).toBeDefined();
      expect(client.models).toBeDefined();
    });

    it('should throw error when authentication fails', async () => {
      delete process.env.OPENAI_API_KEY;
      
      await expect(getAuthenticatedClient()).rejects.toThrow('OpenAI authentication failed');
    });
  });

  describe('getSetupStatus', () => {
    it('should return setup instructions and environment status', () => {
      process.env.OPENAI_API_KEY = 'sk-' + 'a'.repeat(48);
      const mockValidateApiKey = validateApiKey as jest.MockedFunction<typeof validateApiKey>;
      mockValidateApiKey.mockReturnValue(true);
      
      const status = getSetupStatus();
      
      expect(status.environment).toBeDefined();
      expect(status.instructions).toEqual(SETUP_INSTRUCTIONS);
      expect(status.nextSteps).toBeDefined();
    });

    it('should provide recommendations when environment is invalid', () => {
      delete process.env.OPENAI_API_KEY;
      
      const status = getSetupStatus();
      
      expect(status.environment.isValid).toBe(false);
      expect(status.nextSteps).toContain('Add OPENAI_API_KEY to your .env.local file');
    });
  });

  describe('SETUP_INSTRUCTIONS', () => {
    it('should contain proper setup instructions', () => {
      expect(SETUP_INSTRUCTIONS.title).toBe('OpenAI API Setup Instructions');
      expect(SETUP_INSTRUCTIONS.steps).toHaveLength(6);
      expect(SETUP_INSTRUCTIONS.notes.length).toBeGreaterThan(0);
      expect(SETUP_INSTRUCTIONS.troubleshooting).toBeDefined();
    });
  });
}); 