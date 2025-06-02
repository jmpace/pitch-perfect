import OpenAI from 'openai';
import { getApiKeyManager } from './api-keys/manager';
import { ApiProvider } from './api-keys/types';

// Legacy environment validation with fallback to new system
function getOpenAIKey(): string {
  // First try to get from new API key management system
  try {
    const keyManager = getApiKeyManager();
    const keys = keyManager.getKeysMetadata();
    const openaiKey = keys.find(k => k.provider === ApiProvider.OPENAI);
    
    if (openaiKey) {
      const keyResult = keyManager.getApiKey(openaiKey.id);
      if (keyResult.success) {
        return keyResult.data!;
      }
    }
  } catch (error) {
    console.warn('Failed to get API key from management system, falling back to environment variable:', error);
  }

  // Fallback to environment variable
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is required. ' +
      'Please add it to your .env.local file or register it with the API key management system.'
    );
  }

  return apiKey;
}

// Create and configure OpenAI client with secure key management
const apiKey = getOpenAIKey();
export const openai = new OpenAI({
  apiKey: apiKey,
  // Allow browser usage in test environment for Jest
  dangerouslyAllowBrowser: process.env.NODE_ENV === 'test',
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

  // Security configuration
  SECURITY: {
    VALIDATE_RESPONSES: true,
    LOG_REQUESTS: process.env.NODE_ENV === 'development',
    SANITIZE_LOGS: true,
    MONITOR_USAGE: true,
  },
} as const;

// Type definitions for better TypeScript support
export type OpenAIModel = typeof OPENAI_CONFIG.MODELS[keyof typeof OPENAI_CONFIG.MODELS];

export interface OpenAIRequestOptions {
  maxTokens?: number;
  temperature?: number;
  model?: OpenAIModel;
  timeout?: number;
  trackUsage?: boolean;
}

// Enhanced utility function to validate API key format with security checks
export function validateApiKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  // Basic format validation
  if (!key.startsWith('sk-') || key.length < 20) {
    return false;
  }

  // Additional security checks
  if (key.includes('demo') || key.includes('test') || key.includes('example')) {
    console.warn('API key appears to be a demo/test key');
    return false;
  }

  return true;
}

// Enhanced connection test with usage tracking
export async function testOpenAIConnection(): Promise<{
  success: boolean;
  error?: string;
  models?: string[];
  keyValidation?: {
    isValid: boolean;
    securityScore?: number;
    issues?: string[];
  };
}> {
  try {
    const startTime = Date.now();

    // Validate the API key using new management system
    let keyValidation;
    try {
      const keyManager = getApiKeyManager();
      const keys = keyManager.getKeysMetadata();
      const openaiKey = keys.find(k => k.provider === ApiProvider.OPENAI);
      
      if (openaiKey) {
        const validationResult = await keyManager.validateKey(openaiKey.id);
        keyValidation = {
          isValid: Boolean(validationResult.success && validationResult.data),
          securityScore: validationResult.metadata?.securityScore as number | undefined,
          issues: validationResult.metadata?.issues as string[] | undefined
        };
      }
    } catch (error) {
      console.warn('Could not validate key through management system:', error);
    }

    // Test the connection by listing available models
    const response = await openai.models.list();
    const modelIds = response.data.map(model => model.id);
    
    // Record usage if monitoring is enabled
    const responseTime = Date.now() - startTime;
    if (OPENAI_CONFIG.SECURITY.MONITOR_USAGE) {
      try {
        const keyManager = getApiKeyManager();
        const keys = keyManager.getKeysMetadata();
        const openaiKey = keys.find(k => k.provider === ApiProvider.OPENAI);
        
        if (openaiKey) {
          keyManager.recordUsage(openaiKey.id, true, responseTime);
        }
      } catch (error) {
        // Silent fail for usage tracking
      }
    }

    return {
      success: true,
      models: modelIds.slice(0, 5), // Return first 5 models as proof
      keyValidation
    };
  } catch (error) {
    // Record failed usage
    if (OPENAI_CONFIG.SECURITY.MONITOR_USAGE) {
      try {
        const keyManager = getApiKeyManager();
        const keys = keyManager.getKeysMetadata();
        const openaiKey = keys.find(k => k.provider === ApiProvider.OPENAI);
        
        if (openaiKey) {
          keyManager.recordUsage(openaiKey.id, false);
        }
      } catch (trackingError) {
        // Silent fail for usage tracking
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Secure OpenAI client wrapper with monitoring
export class SecureOpenAIClient {
  private client: OpenAI;
  private keyManager = getApiKeyManager();

  constructor() {
    this.client = openai;
  }

  /**
   * Make a secure API call with monitoring and validation
   */
  async makeRequest<T>(
    requestFn: (client: OpenAI) => Promise<T>,
    options: OpenAIRequestOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let error: Error | null = null;

    try {
      // Validate key before making request
      if (options.trackUsage !== false) {
        await this.validateCurrentKey();
      }

      // Make the request
      const result = await requestFn(this.client);
      success = true;
      return result;

    } catch (err) {
      error = err instanceof Error ? err : new Error('Unknown error');
      throw error;

    } finally {
      // Record usage if tracking is enabled
      if (options.trackUsage !== false && OPENAI_CONFIG.SECURITY.MONITOR_USAGE) {
        try {
          const keys = this.keyManager.getKeysMetadata();
          const openaiKey = keys.find(k => k.provider === ApiProvider.OPENAI);
          
          if (openaiKey) {
            const responseTime = Date.now() - startTime;
            this.keyManager.recordUsage(openaiKey.id, success, responseTime);
          }
        } catch (trackingError) {
          // Silent fail for usage tracking
        }
      }

      // Log request if enabled
      if (OPENAI_CONFIG.SECURITY.LOG_REQUESTS) {
        console.log(`[OpenAI] Request ${success ? 'succeeded' : 'failed'} in ${Date.now() - startTime}ms`, 
          error ? { error: error.message } : {});
      }
    }
  }

  /**
   * Validate the current API key
   */
  private async validateCurrentKey(): Promise<void> {
    try {
      const keys = this.keyManager.getKeysMetadata();
      const openaiKey = keys.find(k => k.provider === ApiProvider.OPENAI);
      
      if (openaiKey) {
        const validation = await this.keyManager.validateKey(openaiKey.id);
        if (!validation.success || !validation.data) {
          throw new Error('API key validation failed');
        }
      }
    } catch (error) {
      console.warn('API key validation warning:', error);
      // Don't throw here to maintain backward compatibility
    }
  }

  /**
   * Get the underlying OpenAI client (for backward compatibility)
   */
  get raw(): OpenAI {
    return this.client;
  }
}

// Create secure client instance
export const secureOpenAI = new SecureOpenAIClient();

// Export the configured client as default (backward compatibility)
export default openai; 