// Comprehensive Fallback Mechanism Framework Types
// Integrates with existing error categorization and recovery strategy systems

import { ErrorCategory, ErrorSeverity, ErrorContext } from '../errors/error-categorization';
import { BaseStorageError } from '../errors/types';

/**
 * Degradation levels for graceful service degradation
 */
export type DegradationLevel = 'none' | 'minimal' | 'partial' | 'severe' | 'complete';

/**
 * Service types that can have fallback mechanisms
 */
export type ServiceType = 
  | 'vision_analysis'      // AI vision processing
  | 'transcription'        // Audio transcription
  | 'chat_completion'      // Chat/text generation
  | 'video_processing'     // Video analysis and processing
  | 'storage_operations'   // File storage operations
  | 'scoring_analysis'     // Scoring and recommendation
  | 'authentication'       // Auth services
  | 'external_apis'        // Third-party API calls
  | 'database_operations'  // Database queries
  | 'search_functionality' // Search operations
  | 'notification_system'  // Notification delivery
  | 'monitoring_system';   // Health monitoring

/**
 * Fallback strategy execution context
 */
export interface FallbackContext extends ErrorContext {
  // Service identification
  serviceType: ServiceType;
  operation: string;
  
  // Degradation information
  currentDegradationLevel: DegradationLevel;
  maxAcceptableDegradation: DegradationLevel;
  
  // Execution tracking
  attemptCount: number;
  maxAttempts: number;
  lastError?: BaseStorageError;
  
  // Performance metrics
  originalLatency?: number;
  fallbackLatency?: number;
  
  // Resource information
  resourcesAvailable: boolean;
  alternativeResourcesCount: number;
  
  // User context
  userPreferences?: {
    qualityOverSpeed?: boolean;
    acceptDegradedService?: boolean;
    maxWaitTime?: number;
  };
}

/**
 * Service capability definition
 */
export interface ServiceCapability {
  id: string;
  name: string;
  description: string;
  essential: boolean;          // Is this capability critical?
  degradationImpact: DegradationLevel; // Impact if this capability fails
  dependencies: string[];      // Other capabilities this depends on
  fallbackAvailable: boolean;  // Can this capability be replaced?
  estimatedLatency: number;    // Expected execution time (ms)
  resourceIntensive: boolean;  // Does this require significant resources?
}

/**
 * Service profile defining capabilities and degradation behavior
 */
export interface ServiceProfile {
  serviceType: ServiceType;
  serviceName: string;
  capabilities: ServiceCapability[];
  minimalViableCapabilities: string[]; // Minimum capabilities needed to function
  degradationPolicy: {
    allowAutomaticDegradation: boolean;
    maxDegradationLevel: DegradationLevel;
    degradationTimeout: number; // Max time before degrading (ms)
    restoreConditions: string[]; // Conditions for restoring full service
  };
  healthIndicators: {
    latencyThreshold: number;   // Max acceptable latency (ms)
    errorRateThreshold: number; // Max acceptable error rate (%)
    resourceUsageThreshold: number; // Max resource usage (%)
  };
}

/**
 * Fallback strategy interface
 */
export interface FallbackStrategy {
  id: string;
  name: string;
  description: string;
  
  // Strategy metadata
  serviceType: ServiceType;
  targetCapabilities: string[];
  supportedDegradationLevels: DegradationLevel[];
  
  // Execution criteria
  triggerConditions: {
    errorCategories: ErrorCategory[];
    severityLevels: ErrorSeverity[];
    degradationLevels: DegradationLevel[];
    customConditions?: (context: FallbackContext) => boolean;
  };
  
  // Execution configuration
  priority: number; // Higher numbers = higher priority
  maxRetries: number;
  retryDelay: number; // Base delay between retries (ms)
  timeout: number;    // Max execution time (ms)
  
  // Resource requirements
  resourceRequirements: {
    cpu?: 'low' | 'medium' | 'high';
    memory?: 'low' | 'medium' | 'high';
    network?: 'low' | 'medium' | 'high';
    external?: boolean; // Requires external services
  };
  
  // Performance characteristics
  expectedLatencyMultiplier: number; // How much slower than primary (1.0 = same speed)
  qualityDegradation: number; // 0.0-1.0, where 1.0 = no degradation
  successProbability: number; // 0.0-1.0, estimated success rate
  
  // Execution function
  execute: FallbackExecutor;
  
  // Optional validation and cleanup
  canExecute?: (context: FallbackContext) => boolean;
  cleanup?: (context: FallbackContext, result: FallbackResult) => void;
}

/**
 * Fallback executor function type
 */
export type FallbackExecutor = (
  context: FallbackContext,
  originalOperation: () => Promise<any>
) => Promise<FallbackResult>;

/**
 * Result of fallback execution
 */
export interface FallbackResult {
  success: boolean;
  data?: any;
  error?: BaseStorageError;
  
  // Execution metadata
  strategyUsed: string;
  degradationLevel: DegradationLevel;
  executionTime: number; // ms
  qualityScore: number;  // 0.0-1.0
  
  // User messaging
  userMessage?: string;
  userActions?: string[];
  showDegradationNotice: boolean;
  
  // Technical details
  technicalDetails?: {
    fallbacksAttempted: string[];
    resourcesUsed: string[];
    performanceMetrics: Record<string, number>;
    debugInfo?: Record<string, unknown>;
  };
  
  // Recovery information
  canRetryOriginal: boolean;
  estimatedRecoveryTime?: number; // ms until original service might be available
  alternativeStrategiesAvailable: number;
}

/**
 * Fallback chain configuration for complex scenarios
 */
export interface FallbackChain {
  id: string;
  name: string;
  serviceType: ServiceType;
  strategies: {
    strategyId: string;
    order: number;
    condition?: (context: FallbackContext, previousResult?: FallbackResult) => boolean;
  }[];
  
  // Chain configuration
  maxChainDepth: number;
  timeoutTotal: number; // Total timeout for entire chain
  skipRemainingOnSuccess: boolean;
  
  // Aggregation settings
  resultAggregation: 'first_success' | 'best_quality' | 'fastest' | 'custom';
  customAggregator?: (results: FallbackResult[]) => FallbackResult;
}

/**
 * Degradation notification for UI components
 */
export interface DegradationNotification {
  id: string;
  serviceType: ServiceType;
  degradationLevel: DegradationLevel;
  
  // User-facing content
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  
  // Actions user can take
  actions: {
    id: string;
    label: string;
    action: 'retry' | 'accept' | 'switch_mode' | 'contact_support' | 'custom';
    customHandler?: () => void;
  }[];
  
  // Display configuration
  autoHide: boolean;
  hideAfter?: number; // ms
  persistent: boolean; // Should survive page reloads
  
  // Tracking
  timestamp: string;
  dismissed: boolean;
  userResponse?: string;
}

/**
 * Fallback metrics for monitoring and analysis
 */
export interface FallbackMetrics {
  // Execution metrics
  totalAttempts: number;
  successfulFallbacks: number;
  failedFallbacks: number;
  averageExecutionTime: number;
  
  // Quality metrics
  averageQualityScore: number;
  userSatisfactionScore?: number;
  degradationAcceptanceRate: number; // % of users who accept degraded service
  
  // Strategy effectiveness
  strategyUsageCount: Record<string, number>;
  strategySuccessRate: Record<string, number>;
  strategyPerformance: Record<string, {
    averageLatency: number;
    qualityScore: number;
    resourceUsage: number;
  }>;
  
  // Temporal data
  timeRange: {
    start: string;
    end: string;
  };
  
  // Error patterns
  triggeringErrors: Record<string, number>; // Error code -> count
  recoveryPatterns: {
    errorToStrategy: Record<string, string[]>;
    successfulRecoveries: number;
    permanentFailures: number;
  };
}

/**
 * Configuration for fallback system
 */
export interface FallbackSystemConfig {
  // Global settings
  enabled: boolean;
  globalTimeout: number; // Max time for any fallback operation
  maxConcurrentFallbacks: number;
  
  // Service-specific overrides
  serviceConfigs: Record<ServiceType, {
    enabled: boolean;
    maxDegradationLevel: DegradationLevel;
    preferQualityOverSpeed: boolean;
    customStrategies?: string[];
  }>;
  
  // Monitoring and logging
  metricsCollection: boolean;
  detailedLogging: boolean;
  userNotifications: boolean;
  
  // Performance tuning
  resourceLimits: {
    maxMemoryUsage: number; // MB
    maxCpuUsage: number;    // %
    maxNetworkBandwidth: number; // MB/s
  };
  
  // Integration settings
  circuitBreakerIntegration: boolean;
  retrySystemIntegration: boolean;
  monitoringSystemIntegration: boolean;
}

/**
 * System health status including fallback information
 */
export interface SystemHealthWithFallbacks {
  overall: 'healthy' | 'degraded' | 'critical' | 'offline';
  
  services: Record<ServiceType, {
    status: 'healthy' | 'degraded' | 'offline';
    degradationLevel: DegradationLevel;
    availableCapabilities: string[];
    unavailableCapabilities: string[];
    activeFallbacks: string[];
    estimatedRecoveryTime?: number;
  }>;
  
  fallbackSystem: {
    status: 'active' | 'inactive' | 'overloaded';
    activeStrategies: number;
    queuedOperations: number;
    totalExecutionsToday: number;
    successRate: number;
  };
  
  // Recommendations for operators
  operatorRecommendations: {
    priority: 'low' | 'medium' | 'high' | 'critical';
    action: string;
    impact: string;
    estimatedFixTime?: number;
  }[];
}

/**
 * Event types for fallback system events
 */
export type FallbackEventType = 
  | 'strategy_registered'
  | 'strategy_executed'
  | 'strategy_failed'
  | 'degradation_triggered'
  | 'service_recovered'
  | 'chain_executed'
  | 'user_notification_sent'
  | 'metrics_collected';

/**
 * Event data for fallback system monitoring
 */
export interface FallbackEvent {
  type: FallbackEventType;
  timestamp: string;
  serviceType: ServiceType;
  strategyId?: string;
  degradationLevel?: DegradationLevel;
  context: Partial<FallbackContext>;
  result?: Partial<FallbackResult>;
  metadata?: Record<string, unknown>;
} 