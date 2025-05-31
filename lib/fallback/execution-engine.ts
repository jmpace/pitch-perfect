// Fallback Execution Engine
// Orchestrates fallback strategy execution with graceful degradation

import {
  FallbackStrategy,
  FallbackContext,
  FallbackResult,
  FallbackChain,
  ServiceType,
  DegradationLevel,
  FallbackMetrics,
  SystemHealthWithFallbacks
} from './types';
import { fallbackRegistry } from './strategy-registry';
import { ErrorCategory, ErrorSeverity, ErrorCategorizer } from '../errors/error-categorization';
import { BaseStorageError } from '../errors/types';

/**
 * Resource monitor for tracking system resources during fallback execution
 */
class ResourceMonitor {
  private cpuUsage: number = 0;
  private memoryUsage: number = 0;
  private networkUsage: number = 0;
  private activeFallbacks: number = 0;

  updateMetrics(cpu: number, memory: number, network: number): void {
    this.cpuUsage = cpu;
    this.memoryUsage = memory;
    this.networkUsage = network;
  }

  incrementActiveFallbacks(): void {
    this.activeFallbacks++;
  }

  decrementActiveFallbacks(): void {
    this.activeFallbacks = Math.max(0, this.activeFallbacks - 1);
  }

  getResourceStatus(): {
    cpu: number;
    memory: number;
    network: number;
    activeFallbacks: number;
    resourcesAvailable: boolean;
  } {
    const config = fallbackRegistry.getConfig();
    const resourcesAvailable = 
      this.cpuUsage < config.resourceLimits.maxCpuUsage &&
      this.memoryUsage < config.resourceLimits.maxMemoryUsage &&
      this.networkUsage < config.resourceLimits.maxNetworkBandwidth &&
      this.activeFallbacks < config.maxConcurrentFallbacks;

    return {
      cpu: this.cpuUsage,
      memory: this.memoryUsage,
      network: this.networkUsage,
      activeFallbacks: this.activeFallbacks,
      resourcesAvailable
    };
  }
}

/**
 * Metrics collector for fallback system performance tracking
 */
class FallbackMetricsCollector {
  private metrics: Map<ServiceType, FallbackMetrics> = new Map();
  private dailyMetrics: Map<string, FallbackMetrics> = new Map(); // Date -> Metrics

  recordExecution(
    serviceType: ServiceType,
    strategyId: string,
    result: FallbackResult,
    executionTime: number
  ): void {
    const today = new Date().toISOString().split('T')[0];
    
    // Update service metrics
    let serviceMetrics = this.metrics.get(serviceType);
    if (!serviceMetrics) {
      serviceMetrics = this.createEmptyMetrics();
      this.metrics.set(serviceType, serviceMetrics);
    }
    
    this.updateMetrics(serviceMetrics, strategyId, result, executionTime);
    
    // Update daily metrics
    let dailyMetrics = this.dailyMetrics.get(today);
    if (!dailyMetrics) {
      dailyMetrics = this.createEmptyMetrics();
      this.dailyMetrics.set(today, dailyMetrics);
    }
    
    this.updateMetrics(dailyMetrics, strategyId, result, executionTime);
  }

  private createEmptyMetrics(): FallbackMetrics {
    return {
      totalAttempts: 0,
      successfulFallbacks: 0,
      failedFallbacks: 0,
      averageExecutionTime: 0,
      averageQualityScore: 0,
      degradationAcceptanceRate: 0,
      strategyUsageCount: {},
      strategySuccessRate: {},
      strategyPerformance: {},
      timeRange: {
        start: new Date().toISOString(),
        end: new Date().toISOString()
      },
      triggeringErrors: {},
      recoveryPatterns: {
        errorToStrategy: {},
        successfulRecoveries: 0,
        permanentFailures: 0
      }
    };
  }

  private updateMetrics(
    metrics: FallbackMetrics,
    strategyId: string,
    result: FallbackResult,
    executionTime: number
  ): void {
    metrics.totalAttempts++;
    
    if (result.success) {
      metrics.successfulFallbacks++;
      metrics.recoveryPatterns.successfulRecoveries++;
    } else {
      metrics.failedFallbacks++;
      if (!result.canRetryOriginal) {
        metrics.recoveryPatterns.permanentFailures++;
      }
    }
    
    // Update averages
    const totalExecutionTime = metrics.averageExecutionTime * (metrics.totalAttempts - 1) + executionTime;
    metrics.averageExecutionTime = totalExecutionTime / metrics.totalAttempts;
    
    const totalQualityScore = metrics.averageQualityScore * (metrics.totalAttempts - 1) + result.qualityScore;
    metrics.averageQualityScore = totalQualityScore / metrics.totalAttempts;
    
    // Update strategy metrics
    metrics.strategyUsageCount[strategyId] = (metrics.strategyUsageCount[strategyId] || 0) + 1;
    
    const strategyAttempts = metrics.strategyUsageCount[strategyId];
    const strategySuccesses = result.success ? 
      ((metrics.strategySuccessRate[strategyId] || 0) * (strategyAttempts - 1) + 1) : 
      ((metrics.strategySuccessRate[strategyId] || 0) * (strategyAttempts - 1));
    
    metrics.strategySuccessRate[strategyId] = strategySuccesses / strategyAttempts;
    
    // Update strategy performance
    if (!metrics.strategyPerformance[strategyId]) {
      metrics.strategyPerformance[strategyId] = {
        averageLatency: 0,
        qualityScore: 0,
        resourceUsage: 0
      };
    }
    
    const perf = metrics.strategyPerformance[strategyId];
    perf.averageLatency = ((perf.averageLatency * (strategyAttempts - 1)) + executionTime) / strategyAttempts;
    perf.qualityScore = ((perf.qualityScore * (strategyAttempts - 1)) + result.qualityScore) / strategyAttempts;
    
    // Update time range
    metrics.timeRange.end = new Date().toISOString();
  }

  getMetrics(serviceType?: ServiceType): FallbackMetrics | Record<ServiceType, FallbackMetrics> {
    if (serviceType) {
      return this.metrics.get(serviceType) || this.createEmptyMetrics();
    }
    
    const allMetrics = {} as Record<ServiceType, FallbackMetrics>;
    for (const [type, metrics] of this.metrics.entries()) {
      allMetrics[type] = metrics;
    }
    return allMetrics;
  }

  getDailyMetrics(date?: string): FallbackMetrics {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.dailyMetrics.get(targetDate) || this.createEmptyMetrics();
  }
}

/**
 * Main fallback execution engine
 */
export class FallbackExecutionEngine {
  private static instance: FallbackExecutionEngine;
  
  private resourceMonitor: ResourceMonitor = new ResourceMonitor();
  private metricsCollector: FallbackMetricsCollector = new FallbackMetricsCollector();
  private executionQueue: Map<string, Promise<FallbackResult>> = new Map();

  private constructor() {
    this.startResourceMonitoring();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FallbackExecutionEngine {
    if (!FallbackExecutionEngine.instance) {
      FallbackExecutionEngine.instance = new FallbackExecutionEngine();
    }
    return FallbackExecutionEngine.instance;
  }

  /**
   * Execute fallback strategy for a failed operation
   */
  async executeFallback<T>(
    serviceType: ServiceType,
    operation: () => Promise<T>,
    error: BaseStorageError,
    context: Partial<FallbackContext> = {}
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    
    try {
      // Check if fallbacks are enabled
      const config = fallbackRegistry.getConfig();
      if (!config.enabled || !config.serviceConfigs[serviceType]?.enabled) {
        return this.createFailureResult('fallback_disabled', error, startTime);
      }

      // Check resource availability
      const resourceStatus = this.resourceMonitor.getResourceStatus();
      if (!resourceStatus.resourcesAvailable) {
        return this.createFailureResult('resource_exhausted', error, startTime);
      }

      // Categorize the error
      const errorCategory = ErrorCategorizer.categorizeError(error);
      const severity = ErrorCategorizer.determineSeverity(error.statusCode, errorCategory);

      // Build execution context
      const fullContext = this.buildExecutionContext(
        serviceType,
        errorCategory,
        severity,
        error,
        context,
        resourceStatus
      );

      // Find appropriate fallback strategy
      const strategy = fallbackRegistry.getBestStrategy(
        serviceType,
        errorCategory,
        severity,
        fullContext.currentDegradationLevel,
        fullContext
      );

      if (!strategy) {
        return this.createFailureResult('no_strategy_found', error, startTime);
      }

      // Execute the strategy
      this.resourceMonitor.incrementActiveFallbacks();
      
      try {
        const result = await this.executeStrategy(strategy, fullContext, operation);
        
        // Record metrics
        const executionTime = Date.now() - startTime;
        this.metricsCollector.recordExecution(serviceType, strategy.id, result, executionTime);
        
        // Emit event
        fallbackRegistry.emitEvent({
          type: 'strategy_executed',
          timestamp: new Date().toISOString(),
          serviceType,
          strategyId: strategy.id,
          degradationLevel: result.degradationLevel,
          context: fullContext,
          result
        });

        return result;
        
      } finally {
        this.resourceMonitor.decrementActiveFallbacks();
      }

    } catch (executionError) {
      const executionTime = Date.now() - startTime;
      return this.createFailureResult('execution_error', executionError as BaseStorageError, startTime);
    }
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
    const chain = fallbackRegistry.getChainForService(serviceType, chainId);
    if (!chain) {
      throw new Error(`Fallback chain '${chainId}' not found for service '${serviceType}'`);
    }

    const startTime = Date.now();
    const results: FallbackResult[] = [];
    let previousResult: FallbackResult | undefined;

    // Execute strategies in chain order
    for (const strategyRef of chain.strategies) {
      // Check timeout
      if (Date.now() - startTime > chain.timeoutTotal) {
        break;
      }

      // Check condition if provided
      if (strategyRef.condition && !strategyRef.condition(context as FallbackContext, previousResult)) {
        continue;
      }

      const strategy = fallbackRegistry.getStrategy(strategyRef.strategyId);
      if (!strategy) {
        continue;
      }

      // Build context for this strategy
      const errorCategory = ErrorCategorizer.categorizeError(error);
      const severity = ErrorCategorizer.determineSeverity(error.statusCode, errorCategory);
      const resourceStatus = this.resourceMonitor.getResourceStatus();
      
      const fullContext = this.buildExecutionContext(
        serviceType,
        errorCategory,
        severity,
        error,
        context,
        resourceStatus
      );

      try {
        const result = await this.executeStrategy(strategy, fullContext, operation);
        results.push(result);
        previousResult = result;

        // If successful and chain should skip remaining on success
        if (result.success && chain.skipRemainingOnSuccess) {
          break;
        }

      } catch (strategyError) {
        const failureResult = this.createFailureResult(
          'strategy_execution_error',
          strategyError as BaseStorageError,
          Date.now()
        );
        results.push(failureResult);
        previousResult = failureResult;
      }
    }

    // Aggregate results based on chain configuration
    const finalResult = this.aggregateChainResults(chain, results);
    
    // Emit chain execution event
    fallbackRegistry.emitEvent({
      type: 'chain_executed',
      timestamp: new Date().toISOString(),
      serviceType,
      context: context as Partial<FallbackContext>,
      result: finalResult,
      metadata: {
        chainId,
        strategiesExecuted: results.length,
        totalExecutionTime: Date.now() - startTime
      }
    });

    return finalResult;
  }

  /**
   * Get current system health including fallback status
   */
  getSystemHealth(): SystemHealthWithFallbacks {
    const resourceStatus = this.resourceMonitor.getResourceStatus();
    const config = fallbackRegistry.getConfig();
    
    // Determine overall system status
    let overall: 'healthy' | 'degraded' | 'critical' | 'offline' = 'healthy';
    if (!resourceStatus.resourcesAvailable) {
      overall = 'degraded';
    }
    if (resourceStatus.cpu > 90 || resourceStatus.memory > 90) {
      overall = 'critical';
    }

    // Get service health for each service type
    const services = {} as Record<ServiceType, any>;
    const serviceTypes: ServiceType[] = [
      'vision_analysis', 'transcription', 'chat_completion', 'video_processing',
      'storage_operations', 'scoring_analysis', 'authentication', 'external_apis',
      'database_operations', 'search_functionality', 'notification_system', 'monitoring_system'
    ];

    for (const serviceType of serviceTypes) {
      const serviceConfig = config.serviceConfigs[serviceType];
      const strategies = fallbackRegistry.getStrategiesForService(serviceType);
      
      services[serviceType] = {
        status: serviceConfig?.enabled ? 'healthy' : 'offline',
        degradationLevel: 'none' as DegradationLevel,
        availableCapabilities: [], // Would be populated from service profiles
        unavailableCapabilities: [],
        activeFallbacks: strategies.map(s => s.id).slice(0, 3), // Show top 3
        estimatedRecoveryTime: undefined
      };
    }

    const totalExecutionsToday = this.metricsCollector.getDailyMetrics();
    
    return {
      overall,
      services,
      fallbackSystem: {
        status: resourceStatus.resourcesAvailable ? 'active' : 'overloaded',
        activeStrategies: fallbackRegistry.getStatistics().totalStrategies,
        queuedOperations: this.executionQueue.size,
        totalExecutionsToday: totalExecutionsToday.totalAttempts,
        successRate: totalExecutionsToday.totalAttempts > 0 ? 
          totalExecutionsToday.successfulFallbacks / totalExecutionsToday.totalAttempts : 0
      },
      operatorRecommendations: this.generateOperatorRecommendations(resourceStatus, overall)
    };
  }

  /**
   * Get fallback metrics
   */
  getMetrics(serviceType?: ServiceType): FallbackMetrics | Record<ServiceType, FallbackMetrics> {
    return this.metricsCollector.getMetrics(serviceType);
  }

  /**
   * Execute a single strategy
   */
  private async executeStrategy(
    strategy: FallbackStrategy,
    context: FallbackContext,
    operation: () => Promise<any>
  ): Promise<FallbackResult> {
    const startTime = Date.now();

    try {
      // Check if strategy can execute
      if (strategy.canExecute && !strategy.canExecute(context)) {
        throw new Error(`Strategy ${strategy.id} cannot execute in current context`);
      }

      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Strategy execution timeout')), strategy.timeout);
      });

      const executionPromise = strategy.execute(context, operation);
      const result = await Promise.race([executionPromise, timeoutPromise]) as FallbackResult;

      // Update result with execution metadata
      result.executionTime = Date.now() - startTime;
      result.strategyUsed = strategy.id;

      // Cleanup if provided
      if (strategy.cleanup) {
        try {
          strategy.cleanup(context, result);
        } catch (cleanupError) {
          console.warn(`Cleanup failed for strategy ${strategy.id}:`, cleanupError);
        }
      }

      return result;

    } catch (error) {
      return this.createFailureResult('strategy_execution_failed', error as BaseStorageError, startTime);
    }
  }

  /**
   * Build complete execution context
   */
  private buildExecutionContext(
    serviceType: ServiceType,
    errorCategory: ErrorCategory,
    severity: ErrorSeverity,
    error: BaseStorageError,
    partialContext: Partial<FallbackContext>,
    resourceStatus: any
  ): FallbackContext {
    const config = fallbackRegistry.getConfig();
    const serviceConfig = config.serviceConfigs[serviceType];

    return {
      // Inherited from ErrorContext
      requestId: partialContext.requestId || error.requestId,
      sessionId: partialContext.sessionId,
      userId: partialContext.userId,
      component: partialContext.component,
      operation: partialContext.operation || 'unknown',
      endpoint: partialContext.endpoint,
      method: partialContext.method,
      userAgent: partialContext.userAgent,
      ipAddress: partialContext.ipAddress,
      retryCount: partialContext.retryCount || 0,
      previousErrors: partialContext.previousErrors || [],
      fallbackUsed: partialContext.fallbackUsed || false,
      recoveryStrategy: partialContext.recoveryStrategy,
      metadata: partialContext.metadata || {},

      // Fallback-specific context
      serviceType,
      currentDegradationLevel: this.determineDegradationLevel(severity, errorCategory),
      maxAcceptableDegradation: serviceConfig?.maxDegradationLevel || 'partial',
      attemptCount: partialContext.attemptCount || 1,
      maxAttempts: 3,
      lastError: error,
      originalLatency: partialContext.originalLatency,
      fallbackLatency: partialContext.fallbackLatency,
      resourcesAvailable: resourceStatus.resourcesAvailable,
      alternativeResourcesCount: this.countAlternativeResources(serviceType),
      userPreferences: partialContext.userPreferences || {}
    };
  }

  /**
   * Determine degradation level based on error characteristics
   */
  private determineDegradationLevel(severity: ErrorSeverity, category: ErrorCategory): DegradationLevel {
    if (severity === 'critical') return 'complete';
    if (severity === 'high') return 'severe';
    if (severity === 'medium') return 'partial';
    if (severity === 'low') return 'minimal';
    return 'none';
  }

  /**
   * Count alternative resources available for a service
   */
  private countAlternativeResources(serviceType: ServiceType): number {
    return fallbackRegistry.getStrategiesForService(serviceType).length;
  }

  /**
   * Create a failure result
   */
  private createFailureResult(reason: string, error: BaseStorageError, startTime: number): FallbackResult {
    return {
      success: false,
      error,
      strategyUsed: 'none',
      degradationLevel: 'complete',
      executionTime: Date.now() - startTime,
      qualityScore: 0,
      userMessage: `Service temporarily unavailable: ${reason}`,
      userActions: ['Try again later', 'Contact support if problem persists'],
      showDegradationNotice: true,
      canRetryOriginal: true,
      alternativeStrategiesAvailable: 0,
      technicalDetails: {
        fallbacksAttempted: [],
        resourcesUsed: [],
        performanceMetrics: {},
        debugInfo: { reason, originalError: error.message }
      }
    };
  }

  /**
   * Aggregate results from a fallback chain
   */
  private aggregateChainResults(chain: FallbackChain, results: FallbackResult[]): FallbackResult {
    if (results.length === 0) {
      return this.createFailureResult('no_results', new Error('No results from chain') as any, Date.now());
    }

    switch (chain.resultAggregation) {
      case 'first_success':
        return results.find(r => r.success) || results[results.length - 1];
      
      case 'best_quality':
        return results.reduce((best, current) => 
          current.qualityScore > best.qualityScore ? current : best
        );
      
      case 'fastest':
        return results.reduce((fastest, current) => 
          current.executionTime < fastest.executionTime ? current : fastest
        );
      
      case 'custom':
        return chain.customAggregator ? chain.customAggregator(results) : results[0];
      
      default:
        return results[0];
    }
  }

  /**
   * Generate operator recommendations based on system state
   */
  private generateOperatorRecommendations(resourceStatus: any, overall: string): any[] {
    const recommendations = [];

    if (resourceStatus.cpu > 80) {
      recommendations.push({
        priority: 'high' as const,
        action: 'Investigate high CPU usage',
        impact: 'May affect fallback performance',
        estimatedFixTime: 300000 // 5 minutes
      });
    }

    if (resourceStatus.activeFallbacks > 8) {
      recommendations.push({
        priority: 'medium' as const,
        action: 'Monitor active fallback count',
        impact: 'High fallback usage may indicate service issues',
        estimatedFixTime: 600000 // 10 minutes
      });
    }

    if (overall === 'critical') {
      recommendations.push({
        priority: 'critical' as const,
        action: 'Immediate attention required',
        impact: 'System stability at risk',
        estimatedFixTime: 900000 // 15 minutes
      });
    }

    return recommendations;
  }

  /**
   * Start monitoring system resources
   */
  private startResourceMonitoring(): void {
    // Simplified resource monitoring
    // In a real implementation, this would integrate with system monitoring tools
    setInterval(() => {
      // Mock resource metrics - in reality, these would come from system monitors
      const cpu = Math.random() * 100;
      const memory = Math.random() * 100;
      const network = Math.random() * 50;
      
      this.resourceMonitor.updateMetrics(cpu, memory, network);
    }, 30000); // Update every 30 seconds
  }
}

// Export singleton instance
export const fallbackEngine = FallbackExecutionEngine.getInstance(); 