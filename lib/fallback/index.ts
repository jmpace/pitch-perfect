// Main Fallback System Interface
// Central point for all fallback functionality integration

export * from './types';
export * from './strategy-registry';
export * from './execution-engine';

// Strategy implementations
export * from './strategies/vision-analysis-strategies';

import { fallbackRegistry } from './strategy-registry';
import { fallbackEngine } from './execution-engine';
import { initializeVisionAnalysisStrategies } from './strategies/vision-analysis-strategies';
import { 
  FallbackContext, 
  FallbackResult, 
  ServiceType, 
  DegradationLevel,
  SystemHealthWithFallbacks,
  FallbackMetrics
} from './types';
import { BaseStorageError } from '../errors/types';

/**
 * Main Fallback Manager - Primary interface for using the fallback system
 */
export class FallbackManager {
  private static instance: FallbackManager;
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): FallbackManager {
    if (!FallbackManager.instance) {
      FallbackManager.instance = new FallbackManager();
    }
    return FallbackManager.instance;
  }

  /**
   * Initialize the fallback system with all strategies
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize all service-specific strategies
      initializeVisionAnalysisStrategies();
      
      // TODO: Initialize other service strategies
      // initializeTranscriptionStrategies();
      // initializeChatCompletionStrategies();
      // initializeVideoProcessingStrategies();
      // initializeStorageStrategies();
      
      this.initialized = true;
      console.log('Fallback system initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize fallback system:', error);
      throw error;
    }
  }

  /**
   * Execute a fallback strategy for a failed operation
   */
  async executeFallback<T>(
    serviceType: ServiceType,
    operation: () => Promise<T>,
    error: BaseStorageError,
    context: Partial<FallbackContext> = {}
  ): Promise<FallbackResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    return fallbackEngine.executeFallback(serviceType, operation, error, context);
  }

  /**
   * Execute a fallback chain for complex scenarios
   */
  async executeChain<T>(
    chainId: string,
    serviceType: ServiceType,
    operation: () => Promise<T>,
    error: BaseStorageError,
    context: Partial<FallbackContext> = {}
  ): Promise<FallbackResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    return fallbackEngine.executeChain(chainId, serviceType, operation, error, context);
  }

  /**
   * Get system health including fallback status
   */
  getSystemHealth(): SystemHealthWithFallbacks {
    return fallbackEngine.getSystemHealth();
  }

  /**
   * Get fallback metrics
   */
  getMetrics(serviceType?: ServiceType): FallbackMetrics | Record<ServiceType, FallbackMetrics> {
    return fallbackEngine.getMetrics(serviceType);
  }

  /**
   * Check if fallbacks are available for a service
   */
  hasStrategiesForService(serviceType: ServiceType): boolean {
    const strategies = fallbackRegistry.getStrategiesForService(serviceType);
    return strategies.length > 0;
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalStrategies: number;
    strategiesByService: Record<ServiceType, number>;
    totalChains: number;
    registeredServices: number;
  } {
    return fallbackRegistry.getStatistics();
  }

  /**
   * Enable or disable fallbacks for a specific service
   */
  setServiceEnabled(serviceType: ServiceType, enabled: boolean): void {
    const config = fallbackRegistry.getConfig();
    config.serviceConfigs[serviceType] = {
      ...config.serviceConfigs[serviceType],
      enabled
    };
    fallbackRegistry.updateConfig(config);
  }

  /**
   * Set maximum degradation level for a service
   */
  setMaxDegradationLevel(serviceType: ServiceType, level: DegradationLevel): void {
    const config = fallbackRegistry.getConfig();
    config.serviceConfigs[serviceType] = {
      ...config.serviceConfigs[serviceType],
      maxDegradationLevel: level
    };
    fallbackRegistry.updateConfig(config);
  }

  /**
   * Add event listener for fallback events
   */
  addEventListener(eventType: any, listener: (event: any) => void): void {
    fallbackRegistry.addEventListener(eventType, listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: any, listener: (event: any) => void): void {
    fallbackRegistry.removeEventListener(eventType, listener);
  }
}

/**
 * Convenient wrapper functions for common operations
 */

/**
 * Execute operation with automatic fallback on failure
 */
export async function withFallback<T>(
  serviceType: ServiceType,
  operation: () => Promise<T>,
  context: Partial<FallbackContext> = {}
): Promise<{ data?: T; fallbackResult?: FallbackResult; usedFallback: boolean }> {
  const fallbackManager = FallbackManager.getInstance();
  
  try {
    // Try the original operation first
    const data = await operation();
    return { data, usedFallback: false };
    
  } catch (error) {
    // Execute fallback on error
    const fallbackResult = await fallbackManager.executeFallback(
      serviceType,
      operation,
      error as BaseStorageError,
      context
    );
    
    return {
      data: fallbackResult.success ? fallbackResult.data : undefined,
      fallbackResult,
      usedFallback: true
    };
  }
}

/**
 * Check if service should degrade based on health and configuration
 */
export function shouldDegrade(
  serviceType: ServiceType,
  currentDegradationLevel: DegradationLevel
): boolean {
  const fallbackManager = FallbackManager.getInstance();
  const health = fallbackManager.getSystemHealth();
  const serviceHealth = health.services[serviceType];
  
  if (!serviceHealth) {
    return false;
  }
  
  // Check if current degradation is worse than service status
  const degradationOrder: DegradationLevel[] = ['none', 'minimal', 'partial', 'severe', 'complete'];
  const currentIndex = degradationOrder.indexOf(currentDegradationLevel);
  const serviceIndex = degradationOrder.indexOf(serviceHealth.degradationLevel);
  
  return currentIndex > serviceIndex;
}

/**
 * Get user-friendly degradation message
 */
export function getDegradationMessage(
  serviceType: ServiceType,
  degradationLevel: DegradationLevel,
  fallbackResult?: FallbackResult
): string {
  if (fallbackResult?.userMessage) {
    return fallbackResult.userMessage;
  }
  
  const serviceNames: Record<ServiceType, string> = {
    vision_analysis: 'AI Vision Analysis',
    transcription: 'Audio Transcription',
    chat_completion: 'AI Chat',
    video_processing: 'Video Processing',
    storage_operations: 'File Storage',
    scoring_analysis: 'Analysis Scoring',
    authentication: 'Authentication',
    external_apis: 'External Services',
    database_operations: 'Database',
    search_functionality: 'Search',
    notification_system: 'Notifications',
    monitoring_system: 'Monitoring'
  };
  
  const serviceName = serviceNames[serviceType] || serviceType;
  
  switch (degradationLevel) {
    case 'minimal':
      return `${serviceName} is running with reduced features.`;
    case 'partial':
      return `${serviceName} is operating with limited functionality.`;
    case 'severe':
      return `${serviceName} is experiencing significant issues. Basic features only.`;
    case 'complete':
      return `${serviceName} is currently unavailable. Please try again later.`;
    default:
      return `${serviceName} is operating normally.`;
  }
}

// Export singleton instance for direct use
export const fallbackManager = FallbackManager.getInstance(); 