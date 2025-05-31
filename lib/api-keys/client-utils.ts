/**
 * Client-Side API Key Utilities
 * Safe browser utilities for API key validation and management
 */

import { useState, useEffect, useCallback } from 'react';
import { ApiProvider, SecurityLevel, KeyValidationResult } from './types';

// Client-safe configuration
export const CLIENT_CONFIG = {
  VALIDATION_ENDPOINT: '/api/security/api-keys',
  DEBOUNCE_MS: 500,
  CACHE_DURATION: 300000, // 5 minutes
  MAX_RETRIES: 3,
} as const;

// Client-side validation cache
const validationCache = new Map<string, {
  result: KeyValidationResult;
  timestamp: number;
}>();

// Request counter for rate limiting
const requestCounts = new Map<string, {
  count: number;
  resetTime: number;
}>();

/**
 * Client-safe API key validation (format only)
 */
export function validateApiKeyFormat(
  apiKey: string,
  provider?: ApiProvider
): {
  isValidFormat: boolean;
  detectedProvider: ApiProvider | null;
  issues: string[];
  warnings: string[];
} {
  const result = {
    isValidFormat: false,
    detectedProvider: null as ApiProvider | null,
    issues: [] as string[],
    warnings: [] as string[]
  };

  // Basic input validation
  if (!apiKey || typeof apiKey !== 'string') {
    result.issues.push('API key is required');
    return result;
  }

  const trimmedKey = apiKey.trim();
  if (trimmedKey.length === 0) {
    result.issues.push('API key cannot be empty');
    return result;
  }

  if (trimmedKey !== apiKey) {
    result.warnings.push('API key has leading/trailing whitespace');
  }

  // Detect provider from format
  const detectedProvider = detectProviderFromKey(trimmedKey);
  result.detectedProvider = detectedProvider;

  // Basic format validation
  const formatCheck = checkBasicFormat(trimmedKey, detectedProvider);
  result.isValidFormat = formatCheck.isValid;
  result.issues.push(...formatCheck.issues);
  result.warnings.push(...formatCheck.warnings);

  return result;
}

/**
 * Detect API provider from key format (client-safe)
 */
export function detectProviderFromKey(apiKey: string): ApiProvider | null {
  if (!apiKey) return null;

  // OpenAI
  if (/^sk-[a-zA-Z0-9]{20,}$/.test(apiKey)) {
    return ApiProvider.OPENAI;
  }

  // Anthropic
  if (/^sk-ant-[a-zA-Z0-9\-_]{20,}$/.test(apiKey)) {
    return ApiProvider.ANTHROPIC;
  }

  // Perplexity
  if (/^pplx-[a-zA-Z0-9]{20,}$/.test(apiKey)) {
    return ApiProvider.PERPLEXITY;
  }

  // Google
  if (/^AIza[0-9A-Za-z\-_]{35}$/.test(apiKey)) {
    return ApiProvider.GOOGLE;
  }

  // Vercel Blob
  if (/^vercel_blob_rw_[a-zA-Z0-9]{16}_[a-zA-Z0-9]{32}$/.test(apiKey)) {
    return ApiProvider.VERCEL_BLOB;
  }

  // OpenRouter
  if (/^sk-or-[a-zA-Z0-9\-_]{20,}$/.test(apiKey)) {
    return ApiProvider.OPENROUTER;
  }

  // XAI
  if (/^xai-[a-zA-Z0-9]{20,}$/.test(apiKey)) {
    return ApiProvider.XAI;
  }

  // Mistral (32 character hex)
  if (/^[a-zA-Z0-9]{32}$/.test(apiKey)) {
    return ApiProvider.MISTRAL;
  }

  // Azure OpenAI (32 character hex)
  if (/^[a-f0-9]{32}$/.test(apiKey)) {
    return ApiProvider.AZURE_OPENAI;
  }

  return ApiProvider.CUSTOM;
}

/**
 * Basic format validation (client-safe)
 */
function checkBasicFormat(
  apiKey: string,
  provider: ApiProvider | null
): {
  isValid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Length checks
  if (apiKey.length < 8) {
    issues.push('API key is too short (minimum 8 characters)');
  }

  if (apiKey.length > 500) {
    issues.push('API key is too long (maximum 500 characters)');
  }

  // Security checks
  if (/(.)\1{4,}/.test(apiKey)) {
    warnings.push('API key contains repeated characters');
  }

  if (/123|abc|test|demo|example/i.test(apiKey)) {
    issues.push('API key contains weak patterns');
  }

  // Provider-specific checks
  if (provider) {
    const providerChecks = validateProviderFormat(apiKey, provider);
    issues.push(...providerChecks.issues);
    warnings.push(...providerChecks.warnings);
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Provider-specific format validation
 */
function validateProviderFormat(
  apiKey: string,
  provider: ApiProvider
): {
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  switch (provider) {
    case ApiProvider.OPENAI:
      if (!apiKey.startsWith('sk-')) {
        issues.push('OpenAI API keys must start with "sk-"');
      }
      if (apiKey.length < 20) {
        issues.push('OpenAI API keys must be at least 20 characters');
      }
      break;

    case ApiProvider.ANTHROPIC:
      if (!apiKey.startsWith('sk-ant-')) {
        issues.push('Anthropic API keys must start with "sk-ant-"');
      }
      break;

    case ApiProvider.PERPLEXITY:
      if (!apiKey.startsWith('pplx-')) {
        issues.push('Perplexity API keys must start with "pplx-"');
      }
      break;

    case ApiProvider.GOOGLE:
      if (!apiKey.startsWith('AIza')) {
        issues.push('Google API keys must start with "AIza"');
      }
      if (apiKey.length !== 39) {
        issues.push('Google API keys must be exactly 39 characters');
      }
      break;

    case ApiProvider.VERCEL_BLOB:
      if (!apiKey.startsWith('vercel_blob_rw_')) {
        issues.push('Vercel Blob tokens must start with "vercel_blob_rw_"');
      }
      break;

    default:
      // No specific validation for other providers
      break;
  }

  return { issues, warnings };
}

/**
 * Check if request is rate limited
 */
function isRateLimited(endpoint: string): boolean {
  const key = `client_${endpoint}`;
  const now = Date.now();
  const limit = 60; // requests per minute
  const windowMs = 60000; // 1 minute

  let counter = requestCounts.get(key);
  
  if (!counter || now > counter.resetTime) {
    counter = { count: 0, resetTime: now + windowMs };
    requestCounts.set(key, counter);
  }

  counter.count++;
  return counter.count > limit;
}

/**
 * Make API request with error handling and retries
 */
async function makeApiRequest<T>(
  url: string,
  options: RequestInit,
  retries: number = CLIENT_CONFIG.MAX_RETRIES
): Promise<{
  success: boolean;
  data?: T;
  error?: string;
}> {
  // Rate limiting check
  if (isRateLimited(url)) {
    return {
      success: false,
      error: 'Too many requests. Please wait a moment and try again.'
    };
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Retry on network errors
    if (retries > 0 && (
      errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout')
    )) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return makeApiRequest(url, options, retries - 1);
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * React hook for API key validation
 */
export function useApiKeyValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<KeyValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateKey = useCallback(async (
    apiKey: string,
    provider?: ApiProvider,
    useServerValidation = true
  ) => {
    if (!apiKey) {
      setValidationResult(null);
      setError(null);
      return;
    }

    // Start with client-side validation
    const clientResult = validateApiKeyFormat(apiKey, provider);
    
    if (!clientResult.isValidFormat) {
      setValidationResult({
        isValid: false,
        provider: clientResult.detectedProvider || ApiProvider.CUSTOM,
        issues: clientResult.issues,
        warnings: clientResult.warnings,
        recommendations: ['Fix format issues before proceeding'],
        securityScore: 0
      });
      setError(null);
      return;
    }

    if (!useServerValidation) {
      setValidationResult({
        isValid: true,
        provider: clientResult.detectedProvider || ApiProvider.CUSTOM,
        issues: [],
        warnings: clientResult.warnings,
        recommendations: [],
        securityScore: 75 // Basic score for format-only validation
      });
      setError(null);
      return;
    }

    // Check cache
    const cacheKey = `${apiKey}_${provider || 'auto'}`;
    const cached = validationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CLIENT_CONFIG.CACHE_DURATION) {
      setValidationResult(cached.result);
      setError(null);
      return;
    }

    // Server-side validation
    setIsValidating(true);
    setError(null);

    try {
      const response = await makeApiRequest<{
        validation: KeyValidationResult;
      }>(
        `${CLIENT_CONFIG.VALIDATION_ENDPOINT}?action=validate&key=${encodeURIComponent(apiKey)}&provider=${provider || ''}`,
        { method: 'GET' }
      );

      if (response.success && response.data) {
        const result = response.data.validation;
        setValidationResult(result);
        
        // Cache the result
        validationCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      } else {
        setError(response.error || 'Validation failed');
        setValidationResult(null);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Validation failed';
      setError(errorMessage);
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  }, []);

  const clearValidation = useCallback(() => {
    setValidationResult(null);
    setError(null);
    setIsValidating(false);
  }, []);

  return {
    validateKey,
    clearValidation,
    isValidating,
    validationResult,
    error
  };
}

/**
 * React hook for API key security monitoring
 */
export function useApiKeySecurity() {
  const [securityReport, setSecurityReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSecurityReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await makeApiRequest<any>(
        `${CLIENT_CONFIG.VALIDATION_ENDPOINT}?action=security-report`,
        { method: 'GET' }
      );

      if (response.success && response.data) {
        setSecurityReport(response.data.securityReport);
      } else {
        setError(response.error || 'Failed to fetch security report');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch security report';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurityReport();
  }, [fetchSecurityReport]);

  return {
    securityReport,
    isLoading,
    error,
    refreshReport: fetchSecurityReport
  };
}

/**
 * Debounced validation hook
 */
export function useDebouncedApiKeyValidation(debounceMs = CLIENT_CONFIG.DEBOUNCE_MS) {
  const [debouncedValue, setDebouncedValue] = useState('');
  const validation = useApiKeyValidation();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedValue) {
        validation.validateKey(debouncedValue);
      } else {
        validation.clearValidation();
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [debouncedValue, debounceMs, validation]);

  const setApiKey = useCallback((value: string) => {
    setDebouncedValue(value);
  }, []);

  return {
    ...validation,
    setApiKey
  };
}

/**
 * Utility to sanitize API key for display
 */
export function sanitizeApiKeyForDisplay(apiKey: string, showChars = 4): string {
  if (!apiKey || apiKey.length <= showChars * 2) {
    return '***';
  }

  const start = apiKey.substring(0, showChars);
  const end = apiKey.substring(apiKey.length - showChars);
  const middle = '*'.repeat(Math.max(3, apiKey.length - showChars * 2));

  return `${start}${middle}${end}`;
}

/**
 * Get provider display information
 */
export function getProviderInfo(provider: ApiProvider): {
  name: string;
  color: string;
  icon: string;
  docsUrl: string;
} {
  const providerInfo: Record<ApiProvider, any> = {
    [ApiProvider.OPENAI]: {
      name: 'OpenAI',
      color: 'emerald',
      icon: '🤖',
      docsUrl: 'https://platform.openai.com/docs'
    },
    [ApiProvider.ANTHROPIC]: {
      name: 'Anthropic',
      color: 'blue',
      icon: '🧠',
      docsUrl: 'https://docs.anthropic.com'
    },
    [ApiProvider.PERPLEXITY]: {
      name: 'Perplexity',
      color: 'purple',
      icon: '🔍',
      docsUrl: 'https://docs.perplexity.ai'
    },
    [ApiProvider.VERCEL_BLOB]: {
      name: 'Vercel Blob',
      color: 'gray',
      icon: '📦',
      docsUrl: 'https://vercel.com/docs/storage'
    },
    [ApiProvider.GOOGLE]: {
      name: 'Google AI',
      color: 'red',
      icon: '🔥',
      docsUrl: 'https://ai.google.dev'
    },
    [ApiProvider.MISTRAL]: {
      name: 'Mistral AI',
      color: 'orange',
      icon: '🌟',
      docsUrl: 'https://docs.mistral.ai'
    },
    [ApiProvider.AZURE_OPENAI]: {
      name: 'Azure OpenAI',
      color: 'blue',
      icon: '☁️',
      docsUrl: 'https://docs.microsoft.com/azure/cognitive-services/openai'
    },
    [ApiProvider.OPENROUTER]: {
      name: 'OpenRouter',
      color: 'indigo',
      icon: '🔀',
      docsUrl: 'https://openrouter.ai/docs'
    },
    [ApiProvider.XAI]: {
      name: 'xAI',
      color: 'slate',
      icon: '✨',
      docsUrl: 'https://x.ai/api'
    },
    [ApiProvider.OLLAMA]: {
      name: 'Ollama',
      color: 'green',
      icon: '🦙',
      docsUrl: 'https://ollama.ai/docs'
    },
    [ApiProvider.CUSTOM]: {
      name: 'Custom',
      color: 'gray',
      icon: '⚙️',
      docsUrl: '#'
    }
  };

  return providerInfo[provider] || providerInfo[ApiProvider.CUSTOM];
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Storage utilities for client-side caching
 */
export const storage = {
  set: (key: string, value: any, ttl?: number) => {
    if (!isBrowser()) return;
    
    const item = {
      value,
      timestamp: Date.now(),
      ttl: ttl || CLIENT_CONFIG.CACHE_DURATION
    };
    
    try {
      localStorage.setItem(`apikey_${key}`, JSON.stringify(item));
    } catch (error) {
      // Storage failed, continue without caching
    }
  },

  get: (key: string) => {
    if (!isBrowser()) return null;
    
    try {
      const item = localStorage.getItem(`apikey_${key}`);
      if (!item) return null;
      
      const parsed = JSON.parse(item);
      
      if (Date.now() - parsed.timestamp > parsed.ttl) {
        localStorage.removeItem(`apikey_${key}`);
        return null;
      }
      
      return parsed.value;
    } catch (error) {
      return null;
    }
  },

  remove: (key: string) => {
    if (!isBrowser()) return;
    
    try {
      localStorage.removeItem(`apikey_${key}`);
    } catch (error) {
      // Ignore errors
    }
  },

  clear: () => {
    if (!isBrowser()) return;
    
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('apikey_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      // Ignore errors
    }
  }
};

export default {
  validateApiKeyFormat,
  detectProviderFromKey,
  useApiKeyValidation,
  useApiKeySecurity,
  useDebouncedApiKeyValidation,
  sanitizeApiKeyForDisplay,
  getProviderInfo,
  storage
}; 