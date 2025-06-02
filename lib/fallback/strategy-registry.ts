// Fallback Strategy Registry
// Centralized management of fallback strategies across all services

import {
  FallbackStrategy,
  FallbackChain,
  ServiceType,
  ServiceProfile,
  DegradationLevel,
  FallbackContext,
  FallbackSystemConfig,
  FallbackEvent,
  FallbackEventType
} from './types';
import { ErrorCategory, ErrorSeverity } from '../errors/error-categorization';
import { BaseStorageError } from '../errors/types';

/**
 * Event emitter for fallback system events
 */
class FallbackEventEmitter {
  private listeners: Map<FallbackEventType, ((event: FallbackEvent) => void)[]> = new Map();

  on(eventType: FallbackEventType, listener: (event: FallbackEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  emit(event: FallbackEvent): void {
    const listeners = this.listeners.get(event.type) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in fallback event listener for ${event.type}:`, error);
      }
    });
  }

  removeListener(eventType: FallbackEventType, listener: (event: FallbackEvent) => void): void {
    const listeners = this.listeners.get(eventType) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
}

/**
 * Registry for managing fallback strategies and service profiles
 */
export class FallbackStrategyRegistry {
  private static instance: FallbackStrategyRegistry;
  
  // Core registries
  private strategies: Map<string, FallbackStrategy> = new Map();
  private serviceProfiles: Map<ServiceType, ServiceProfile> = new Map();
  private fallbackChains: Map<string, FallbackChain> = new Map();
  
  // Indexed lookups for performance
  private strategiesByService: Map<ServiceType, Set<string>> = new Map();
  private strategiesByCategory: Map<ErrorCategory, Set<string>> = new Map();
  private strategiesByDegradation: Map<DegradationLevel, Set<string>> = new Map();
  
  // Configuration and metrics
  private config: FallbackSystemConfig;
  private eventEmitter: FallbackEventEmitter = new FallbackEventEmitter();
  
  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializeDefaultProfiles();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FallbackStrategyRegistry {
    if (!FallbackStrategyRegistry.instance) {
      FallbackStrategyRegistry.instance = new FallbackStrategyRegistry();
    }
    return FallbackStrategyRegistry.instance;
  }

  /**
   * Register a new fallback strategy
   */
  registerStrategy(strategy: FallbackStrategy): void {
    // Validate strategy
    this.validateStrategy(strategy);
    
    // Store strategy
    this.strategies.set(strategy.id, strategy);
    
    // Update indexes
    this.updateIndexes(strategy);
    
    // Emit registration event
    this.eventEmitter.emit({
      type: 'strategy_registered',
      timestamp: new Date().toISOString(),
      serviceType: strategy.serviceType,
      strategyId: strategy.id,
      context: {},
      metadata: {
        priority: strategy.priority,
        supportedDegradationLevels: strategy.supportedDegradationLevels
      }
    });
  }

  /**
   * Register a service profile
   */
  registerServiceProfile(profile: ServiceProfile): void {
    this.validateServiceProfile(profile);
    this.serviceProfiles.set(profile.serviceType, profile);
  }

  /**
   * Register a fallback chain
   */
  registerChain(chain: FallbackChain): void {
    this.validateChain(chain);
    this.fallbackChains.set(chain.id, chain);
  }

  /**
   * Get strategies for a specific service
   */
  getStrategiesForService(serviceType: ServiceType): FallbackStrategy[] {
    const strategyIds = this.strategiesByService.get(serviceType) || new Set();
    return Array.from(strategyIds)
      .map(id => this.strategies.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  /**
   * Find strategies that match specific error conditions
   */
  findMatchingStrategies(
    serviceType: ServiceType,
    errorCategory: ErrorCategory,
    severity: ErrorSeverity,
    degradationLevel: DegradationLevel,
    context: Partial<FallbackContext> = {}
  ): FallbackStrategy[] {
    const serviceStrategies = this.getStrategiesForService(serviceType);
    
    return serviceStrategies.filter(strategy => {
      // Check error category match
      if (!strategy.triggerConditions.errorCategories.includes(errorCategory)) {
        return false;
      }
      
      // Check severity match
      if (!strategy.triggerConditions.severityLevels.includes(severity)) {
        return false;
      }
      
      // Check degradation level support
      if (!strategy.supportedDegradationLevels.includes(degradationLevel)) {
        return false;
      }
      
      // Check custom conditions if provided
      if (strategy.triggerConditions.customConditions) {
        try {
          return strategy.triggerConditions.customConditions(context as FallbackContext);
        } catch (error) {
          console.warn(`Custom condition check failed for strategy ${strategy.id}:`, error);
          return false;
        }
      }
      
      // Check if strategy can execute
      if (strategy.canExecute && !strategy.canExecute(context as FallbackContext)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Get the best strategy for a given context
   */
  getBestStrategy(
    serviceType: ServiceType,
    errorCategory: ErrorCategory,
    severity: ErrorSeverity,
    degradationLevel: DegradationLevel,
    context: Partial<FallbackContext> = {}
  ): FallbackStrategy | null {
    const matchingStrategies = this.findMatchingStrategies(
      serviceType, 
      errorCategory, 
      severity, 
      degradationLevel, 
      context
    );
    
    if (matchingStrategies.length === 0) {
      return null;
    }
    
    // Return highest priority strategy
    return matchingStrategies[0];
  }

  /**
   * Get fallback chain for a service
   */
  getChainForService(serviceType: ServiceType, chainId?: string): FallbackChain | null {
    if (chainId) {
      return this.fallbackChains.get(chainId) || null;
    }
    
    // Find first chain for this service type
    for (const chain of this.fallbackChains.values()) {
      if (chain.serviceType === serviceType) {
        return chain;
      }
    }
    
    return null;
  }

  /**
   * Get service profile
   */
  getServiceProfile(serviceType: ServiceType): ServiceProfile | null {
    return this.serviceProfiles.get(serviceType) || null;
  }

  /**
   * Update system configuration
   */
  updateConfig(newConfig: Partial<FallbackSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): FallbackSystemConfig {
    return { ...this.config };
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: FallbackEventType, listener: (event: FallbackEvent) => void): void {
    this.eventEmitter.on(eventType, listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: FallbackEventType, listener: (event: FallbackEvent) => void): void {
    this.eventEmitter.removeListener(eventType, listener);
  }

  /**
   * Emit event (internal use)
   */
  emitEvent(event: FallbackEvent): void {
    this.eventEmitter.emit(event);
  }

  /**
   * Get all registered strategies
   */
  getAllStrategies(): FallbackStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get strategy by ID
   */
  getStrategy(id: string): FallbackStrategy | null {
    return this.strategies.get(id) || null;
  }

  /**
   * Remove strategy
   */
  removeStrategy(id: string): boolean {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      return false;
    }
    
    this.strategies.delete(id);
    this.removeFromIndexes(strategy);
    return true;
  }

  /**
   * Get registry statistics
   */
  getStatistics(): {
    totalStrategies: number;
    strategiesByService: Record<ServiceType, number>;
    totalChains: number;
    registeredServices: number;
  } {
    const strategiesByService: Record<ServiceType, number> = {} as Record<ServiceType, number>;
    
    this.strategiesByService.forEach((strategyIds, serviceType) => {
      strategiesByService[serviceType] = strategyIds.size;
    });

    return {
      totalStrategies: this.strategies.size,
      strategiesByService,
      totalChains: this.fallbackChains.size,
      registeredServices: this.serviceProfiles.size
    };
  }

  /**
   * Reset the registry state (for testing)
   */
  reset(): void {
    this.strategies.clear();
    this.serviceProfiles.clear();
    this.fallbackChains.clear();
    this.strategiesByService.clear();
    this.strategiesByCategory.clear();
    this.strategiesByDegradation.clear();
    
    // Reset to default config
    this.config = this.getDefaultConfig();
    
    // Reinitialize default profiles
    this.initializeDefaultProfiles();
  }

  /**
   * Validate strategy configuration
   */
  private validateStrategy(strategy: FallbackStrategy): void {
    if (!strategy.id || strategy.id.trim() === '') {
      throw new Error('Strategy ID cannot be empty');
    }
    
    if (this.strategies.has(strategy.id)) {
      throw new Error(`Strategy with ID '${strategy.id}' already exists`);
    }
    
    if (!strategy.name || strategy.name.trim() === '') {
      throw new Error('Strategy name cannot be empty');
    }
    
    if (!strategy.execute || typeof strategy.execute !== 'function') {
      throw new Error('Strategy must have a valid execute function');
    }
    
    if (strategy.priority < 0) {
      throw new Error('Strategy priority must be non-negative');
    }
    
    if (strategy.timeout <= 0) {
      throw new Error('Strategy timeout must be positive');
    }
    
    // Validate trigger conditions
    if (!strategy.triggerConditions.errorCategories || strategy.triggerConditions.errorCategories.length === 0) {
      throw new Error('Strategy must specify at least one error category');
    }
    
    if (!strategy.triggerConditions.severityLevels || strategy.triggerConditions.severityLevels.length === 0) {
      throw new Error('Strategy must specify at least one severity level');
    }
  }

  /**
   * Validate service profile configuration
   */
  private validateServiceProfile(profile: ServiceProfile): void {
    if (!profile.serviceName || profile.serviceName.trim() === '') {
      throw new Error('Service profile name cannot be empty');
    }
    
    if (!profile.capabilities || profile.capabilities.length === 0) {
      throw new Error('Service profile must have at least one capability');
    }
    
    // Validate capabilities
    const capabilityIds = new Set<string>();
    for (const capability of profile.capabilities) {
      if (capabilityIds.has(capability.id)) {
        throw new Error(`Duplicate capability ID: ${capability.id}`);
      }
      capabilityIds.add(capability.id);
      
      if (capability.estimatedLatency < 0) {
        throw new Error('Capability latency must be non-negative');
      }
    }
    
    // Validate minimal viable capabilities exist
    for (const capabilityId of profile.minimalViableCapabilities) {
      if (!capabilityIds.has(capabilityId)) {
        throw new Error(`Minimal viable capability '${capabilityId}' not found in capabilities`);
      }
    }
  }

  /**
   * Validate fallback chain configuration
   */
  private validateChain(chain: FallbackChain): void {
    if (!chain.id || chain.id.trim() === '') {
      throw new Error('Chain ID cannot be empty');
    }
    
    if (this.fallbackChains.has(chain.id)) {
      throw new Error(`Chain with ID '${chain.id}' already exists`);
    }
    
    if (!chain.strategies || chain.strategies.length === 0) {
      throw new Error('Chain must have at least one strategy');
    }
    
    // Validate strategy references
    for (const strategyRef of chain.strategies) {
      if (!this.strategies.has(strategyRef.strategyId)) {
        throw new Error(`Strategy '${strategyRef.strategyId}' referenced in chain does not exist`);
      }
    }
    
    if (chain.maxChainDepth <= 0) {
      throw new Error('Chain max depth must be positive');
    }
    
    if (chain.timeoutTotal <= 0) {
      throw new Error('Chain total timeout must be positive');
    }
  }

  /**
   * Update indexes when a strategy is added
   */
  private updateIndexes(strategy: FallbackStrategy): void {
    // Index by service type
    if (!this.strategiesByService.has(strategy.serviceType)) {
      this.strategiesByService.set(strategy.serviceType, new Set());
    }
    this.strategiesByService.get(strategy.serviceType)!.add(strategy.id);
    
    // Index by error categories
    for (const category of strategy.triggerConditions.errorCategories) {
      if (!this.strategiesByCategory.has(category)) {
        this.strategiesByCategory.set(category, new Set());
      }
      this.strategiesByCategory.get(category)!.add(strategy.id);
    }
    
    // Index by degradation levels
    for (const level of strategy.supportedDegradationLevels) {
      if (!this.strategiesByDegradation.has(level)) {
        this.strategiesByDegradation.set(level, new Set());
      }
      this.strategiesByDegradation.get(level)!.add(strategy.id);
    }
  }

  /**
   * Remove strategy from indexes
   */
  private removeFromIndexes(strategy: FallbackStrategy): void {
    // Remove from service index
    const serviceStrategies = this.strategiesByService.get(strategy.serviceType);
    if (serviceStrategies) {
      serviceStrategies.delete(strategy.id);
      if (serviceStrategies.size === 0) {
        this.strategiesByService.delete(strategy.serviceType);
      }
    }
    
    // Remove from category indexes
    for (const category of strategy.triggerConditions.errorCategories) {
      const categoryStrategies = this.strategiesByCategory.get(category);
      if (categoryStrategies) {
        categoryStrategies.delete(strategy.id);
        if (categoryStrategies.size === 0) {
          this.strategiesByCategory.delete(category);
        }
      }
    }
    
    // Remove from degradation indexes
    for (const level of strategy.supportedDegradationLevels) {
      const levelStrategies = this.strategiesByDegradation.get(level);
      if (levelStrategies) {
        levelStrategies.delete(strategy.id);
        if (levelStrategies.size === 0) {
          this.strategiesByDegradation.delete(level);
        }
      }
    }
  }

  /**
   * Get default system configuration
   */
  private getDefaultConfig(): FallbackSystemConfig {
    return {
      enabled: true,
      globalTimeout: 30000, // 30 seconds
      maxConcurrentFallbacks: 10,
      serviceConfigs: {} as Record<ServiceType, any>,
      metricsCollection: true,
      detailedLogging: true,
      userNotifications: true,
      resourceLimits: {
        maxMemoryUsage: 512, // MB
        maxCpuUsage: 80,     // %
        maxNetworkBandwidth: 10 // MB/s
      },
      circuitBreakerIntegration: true,
      retrySystemIntegration: true,
      monitoringSystemIntegration: true
    };
  }

  /**
   * Initialize default service profiles
   */
  private initializeDefaultProfiles(): void {
    // This will be expanded with actual service profiles
    // For now, just set up the structure
    const serviceTypes: ServiceType[] = [
      'vision_analysis', 'transcription', 'chat_completion', 'video_processing',
      'storage_operations', 'scoring_analysis', 'authentication', 'external_apis',
      'database_operations', 'search_functionality', 'notification_system', 'monitoring_system'
    ];
    
    // Initialize empty service configs
    for (const serviceType of serviceTypes) {
      this.config.serviceConfigs[serviceType] = {
        enabled: true,
        maxDegradationLevel: 'partial' as DegradationLevel,
        preferQualityOverSpeed: false
      };
    }
  }
}

// Export singleton instance
export const fallbackRegistry = FallbackStrategyRegistry.getInstance(); 