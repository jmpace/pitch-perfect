import OpenAI from 'openai';

// Ensure API key is available
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    'OPENAI_API_KEY environment variable is required. ' +
    'Please add it to your .env.local file or environment configuration.'
  );
}

// Create and configure OpenAI client
export const openai = new OpenAI({
  apiKey: apiKey,
});

// Configuration constants
export const OPENAI_CONFIG = {
  // Models available for different use cases
  MODELS: {
    TRANSCRIPTION: 'whisper-1',
    VISION: 'gpt-4o', // Updated to current vision model
    CHAT: 'gpt-4-turbo-preview',
    EMBEDDING: 'text-embedding-3-small',
  },
  
  // Rate limiting and cost management
  RATE_LIMITS: {
    REQUESTS_PER_MINUTE: 500, // OpenAI default for paid tier
    TOKENS_PER_MINUTE: 40000, // OpenAI default for paid tier
    MAX_RETRIES: 3,
    BACKOFF_MULTIPLIER: 2,
  },
  
  // Request configuration
  DEFAULTS: {
    MAX_TOKENS: 1000,
    TEMPERATURE: 0.1, // Lower temperature for more consistent results
    TIMEOUT: 30000, // 30 seconds
  },
} as const;

// Type definitions for better TypeScript support
export type OpenAIModel = typeof OPENAI_CONFIG.MODELS[keyof typeof OPENAI_CONFIG.MODELS];

export interface OpenAIRequestOptions {
  maxTokens?: number;
  temperature?: number;
  model?: OpenAIModel;
  timeout?: number;
}

// Utility function to validate API key format
export function validateApiKey(key: string): boolean {
  return key.startsWith('sk-') && key.length > 20;
}

// Test function to verify API connection
export async function testOpenAIConnection(): Promise<{
  success: boolean;
  error?: string;
  models?: string[];
}> {
  try {
    // Test the connection by listing available models
    const response = await openai.models.list();
    const modelIds = response.data.map(model => model.id);
    
    return {
      success: true,
      models: modelIds.slice(0, 5), // Return first 5 models as proof
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Export the configured client as default
export default openai; 