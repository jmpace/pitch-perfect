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

  // Test support methods - delegate to registry and engine
  
  /**
   * Reset the fallback system (for testing)
   */
  reset(): void {
    // Reset registry state
    fallbackRegistry.reset?.();
    
    // Reset initialization flag
    this.initialized = false;
    
    // Clear service profiles
    this.serviceProfiles?.clear();
  }

  /**
   * Register a fallback strategy
   */
  registerStrategy(strategy: any): void {
    return fallbackRegistry.registerStrategy(strategy);
  }

  /**
   * Get a specific strategy by ID
   */
  getStrategy(id: string): any {
    return fallbackRegistry.getStrategy(id);
  }

  /**
   * Get strategies for a specific service type
   */
  getStrategiesForService(serviceType: ServiceType): any[] {
    return fallbackRegistry.getStrategiesForService(serviceType);
  }

  /**
   * Register a service profile
   */
  registerServiceProfile(profile: any): void {
    // Store service profiles (simplified implementation for tests)
    if (!this.serviceProfiles) {
      this.serviceProfiles = new Map();
    }
    this.serviceProfiles.set(profile.serviceType, profile);
  }

  private serviceProfiles?: Map<string, any>;

  /**
   * Get a service profile
   */
  getServiceProfile(serviceType: string): any {
    return this.serviceProfiles?.get(serviceType);
  }

  /**
   * Determine degradation level based on capabilities
   */
  determineDegradationLevel(serviceType: string, availableCapabilities: string[]): string {
    const profile = this.getServiceProfile(serviceType);
    if (!profile) return 'none';

    const essentialCaps = profile.capabilities.filter((cap: any) => cap.essential);
    const hasAllEssential = essentialCaps.every((cap: any) => 
      availableCapabilities.includes(cap.id)
    );

    if (hasAllEssential) {
      return 'none';
    } else {
      return 'complete';
    }
  }

  /**
   * Execute a specific strategy
   */
  async executeStrategy(strategyId: string, context: any, originalOperation: any): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const strategy = this.getStrategy(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    try {
      // Implement timeout if strategy specifies one
      if (strategy.timeout && strategy.timeout > 0) {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Strategy execution timeout')), strategy.timeout)
        );
        
        const result = await Promise.race([
          strategy.execute(context, originalOperation),
          timeoutPromise
        ]);
        return result;
      } else {
        const result = await strategy.execute(context, originalOperation);
        return result;
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Strategy execution failed',
        strategyUsed: strategyId
      };
    }
  }

  /**
   * Execute operation with fallback strategies
   */
  async executeWithFallback(serviceType: string, operation: any, context: any): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Try original operation first
      const result = await operation();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      // Get available strategies for this service
      const strategies = this.getStrategiesForService(serviceType as ServiceType);
      
      // Try strategies in priority order
      for (const strategy of strategies) {
        try {
          const result = await strategy.execute(context, operation);
          if (result.success) {
            return result;
          }
        } catch (strategyError) {
          // Continue to next strategy
          continue;
        }
      }

      // All strategies failed
      return {
        success: false,
        error: 'All fallback strategies failed'
      };
    }
  }

  /**
   * Get the next degradation level
   */
  getNextDegradationLevel(currentLevel: string): string {
    const levels = ['none', 'minimal', 'partial', 'severe', 'complete'];
    const currentIndex = levels.indexOf(currentLevel);
    
    if (currentIndex === -1 || currentIndex === levels.length - 1) {
      return 'complete';
    }
    
    return levels[currentIndex + 1];
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