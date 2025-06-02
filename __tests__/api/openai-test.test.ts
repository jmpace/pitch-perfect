import { createMocks } from 'node-mocks-http';
import { GET, POST } from '@/app/api/openai/test/route';
import { NextRequest } from 'next/server';

// Mock the OpenAI config module
jest.mock('@/lib/openai-config', () => ({
  validateApiKey: jest.fn(),
  testOpenAIConnection: jest.fn()
}));

// Mock the sanitization middleware
jest.mock('@/lib/sanitization/middleware', () => ({
  createSanitizedHandler: jest.fn((handler: any) => {
    return async (request: any) => {
      // Provide a mock sanitizedData object
      const sanitizedData = {
        body: null, // This will force the handler to parse manually
        headers: {},
        query: {}
      };
      return handler(request, sanitizedData);
    };
  }),
  SANITIZATION_CONFIGS: {
    STANDARD: {}
  }
}));

// Mock the sanitization module
jest.mock('@/lib/sanitization', () => ({
  sanitize: {
    object: jest.fn((obj) => obj),
    textInput: jest.fn((text) => text),
    isDangerous: jest.fn(() => false)
  }
}));

// Mock the rate limiter
jest.mock('@/lib/rate-limiter', () => ({
  enforceRateLimit: jest.fn()
}));

// Mock the error handlers
jest.mock('@/lib/errors/handlers', () => ({
  generateRequestId: jest.fn(() => 'test-request-id')
}));

import { validateApiKey, testOpenAIConnection } from '@/lib/openai-config';

describe('/api/openai/test API Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('GET /api/openai/test', () => {
    it('should return success when API key is configured and connection works', async () => {
      // Setup environment and mocks
      process.env.OPENAI_API_KEY = 'sk-test1234567890abcdef1234567890abcdef';
      (validateApiKey as jest.Mock).mockReturnValue(true);
      (testOpenAIConnection as jest.Mock).mockResolvedValue({
        success: true,
        models: ['gpt-4', 'gpt-3.5-turbo', 'whisper-1']
      });

      // Create mock request
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'GET'
      });

      // Execute the API route
      const response = await GET(request);
      const jsonResponse = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toBe('OpenAI API connection successful');
      expect(jsonResponse.availableModels).toEqual(['gpt-4', 'gpt-3.5-turbo', 'whisper-1']);
      expect(jsonResponse.timestamp).toBeDefined();

      // Verify function calls
      expect(validateApiKey).toHaveBeenCalledWith(process.env.OPENAI_API_KEY);
      expect(testOpenAIConnection).toHaveBeenCalled();
    });

    it('should return error when API key is not configured', async () => {
      // Remove API key from environment
      delete process.env.OPENAI_API_KEY;

      // Create mock request
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'GET'
      });

      // Execute the API route
      const response = await GET(request);
      const jsonResponse = await response.json();

      // Verify response
      expect(response.status).toBe(500);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('OpenAI API key not configured');
      expect(jsonResponse.details).toBe('Please set OPENAI_API_KEY environment variable');

      // Verify functions were not called
      expect(validateApiKey).not.toHaveBeenCalled();
      expect(testOpenAIConnection).not.toHaveBeenCalled();
    });

    it('should return error when API key format is invalid', async () => {
      // Setup invalid API key
      process.env.OPENAI_API_KEY = 'invalid-key';
      (validateApiKey as jest.Mock).mockReturnValue(false);

      // Create mock request
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'GET'
      });

      // Execute the API route
      const response = await GET(request);
      const jsonResponse = await response.json();

      // Verify response
      expect(response.status).toBe(500);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Invalid API key format');
      expect(jsonResponse.details).toBe('OpenAI API keys should start with "sk-" and be longer than 20 characters');

      // Verify validation was called but connection test was not
      expect(validateApiKey).toHaveBeenCalledWith('invalid-key');
      expect(testOpenAIConnection).not.toHaveBeenCalled();
    });

    it('should return error when OpenAI connection fails', async () => {
      // Setup environment and mocks
      process.env.OPENAI_API_KEY = 'sk-test1234567890abcdef1234567890abcdef';
      (validateApiKey as jest.Mock).mockReturnValue(true);
      (testOpenAIConnection as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Authentication failed'
      });

      // Create mock request
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'GET'
      });

      // Execute the API route
      const response = await GET(request);
      const jsonResponse = await response.json();

      // Verify response
      expect(response.status).toBe(500);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Failed to connect to OpenAI API');
      expect(jsonResponse.details).toBe('Authentication failed');

      // Verify function calls
      expect(validateApiKey).toHaveBeenCalled();
      expect(testOpenAIConnection).toHaveBeenCalled();
    });

    it('should handle unexpected errors gracefully', async () => {
      // Setup environment and mocks
      process.env.OPENAI_API_KEY = 'sk-test1234567890abcdef1234567890abcdef';
      (validateApiKey as jest.Mock).mockReturnValue(true);
      (testOpenAIConnection as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      // Create mock request
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'GET'
      });

      // Execute the API route
      const response = await GET(request);
      const jsonResponse = await response.json();

      // Verify response
      expect(response.status).toBe(500);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Internal server error during OpenAI API test');
      expect(jsonResponse.details).toBe('Network timeout');
    });
  });

  describe('POST /api/openai/test', () => {
    it('should validate valid API key format', async () => {
      // Setup mocks
      (validateApiKey as jest.Mock).mockReturnValue(true);

      // Create mock request with valid API key
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'POST',
        body: JSON.stringify({
          apiKey: 'sk-test1234567890abcdef1234567890abcdef'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Execute the API route
      const response = await POST(request);
      const jsonResponse = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toBe('API key format is valid');
      expect(jsonResponse.keyFormat).toBe('Valid OpenAI API key format');
      expect(jsonResponse.timestamp).toBeDefined();

      // Verify function calls
      expect(validateApiKey).toHaveBeenCalledWith('sk-test1234567890abcdef1234567890abcdef');
    });

    it('should reject invalid API key format', async () => {
      // Setup mocks
      (validateApiKey as jest.Mock).mockReturnValue(false);

      // Create mock request with invalid API key
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'POST',
        body: JSON.stringify({
          apiKey: 'invalid-key'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Execute the API route
      const response = await POST(request);
      const jsonResponse = await response.json();

      // Verify response
      expect(response.status).toBe(400);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Invalid API key format');
      expect(jsonResponse.details).toBe('OpenAI API keys should start with "sk-" and be longer than 20 characters');

      // Verify function calls
      expect(validateApiKey).toHaveBeenCalledWith('invalid-key');
    });

    it('should return error when no API key is provided', async () => {
      // Create mock request without API key
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Execute the API route
      const response = await POST(request);
      const jsonResponse = await response.json();

      // Verify response
      expect(response.status).toBe(400);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('No API key provided');
      expect(jsonResponse.details).toBe('Please provide an API key in the request body');

      // Verify validation was not called
      expect(validateApiKey).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON gracefully', async () => {
      // Create mock request with malformed JSON
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Execute the API route
      const response = await POST(request);
      const jsonResponse = await response.json();

      // Verify response - the route returns 400 for invalid JSON
      expect(response.status).toBe(400);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Invalid JSON in request body');
      expect(jsonResponse.details).toBe('Please provide valid JSON');
    });

    it('should handle empty request body', async () => {
      // Create mock request with empty body
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'POST',
        body: JSON.stringify({ apiKey: '' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Execute the API route
      const response = await POST(request);
      const jsonResponse = await response.json();

      // Verify response
      expect(response.status).toBe(400);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('No API key provided');

      // Verify validation was not called
      expect(validateApiKey).not.toHaveBeenCalled();
    });

    it('should handle null API key', async () => {
      // Create mock request with null API key
      const request = new NextRequest('http://localhost:3000/api/openai/test', {
        method: 'POST',
        body: JSON.stringify({ apiKey: null }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Execute the API route
      const response = await POST(request);
      const jsonResponse = await response.json();

      // Verify response
      expect(response.status).toBe(400);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('No API key provided');

      // Verify validation was not called
      expect(validateApiKey).not.toHaveBeenCalled();
    });
  });
}); 