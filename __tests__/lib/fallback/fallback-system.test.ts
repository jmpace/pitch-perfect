/**
 * Unit Tests for Fallback Mechanism System
 * 
 * Tests the graceful degradation and fallback strategies including:
 * - Fallback strategy execution
 * - Service degradation levels
 * - Fallback chain execution
 * - Resource management and performance tracking
 * - Integration with error categorization
 */

import { FallbackManager, FallbackStrategy, ServiceProfile } from '@/lib/fallback';
import type { 
  FallbackContext, 
  FallbackResult, 
  DegradationLevel,
  ServiceType,
  ServiceCapability
} from '@/lib/fallback/types';
import { ErrorSimulator, MockFactory, TestHelpers, TestScenarioBuilder } from '../errors/test-utilities.helper';

describe('FallbackManager', () => {
  let fallbackManager: FallbackManager;

  beforeEach(() => {
    fallbackManager = FallbackManager.getInstance();
    fallbackManager.reset(); // Clear any previous state
  });

  describe('Strategy Registration and Retrieval', () => {
    test('should register and retrieve fallback strategies', () => {
      const strategy: FallbackStrategy = {
        id: 'test-cache-fallback',
        name: 'Cache Fallback',
        description: 'Use cached data when primary service fails',
        serviceType: 'vision_analysis',
        targetCapabilities: ['image_analysis'],
        supportedDegradationLevels: ['minimal', 'partial'],
        triggerConditions: {
          errorCategories: ['network', 'external_service'],
          severityLevels: ['medium', 'high'],
          degradationLevels: ['minimal', 'partial']
        },
        priority: 150,
        maxRetries: 2,
        retryDelay: 1000,
        timeout: 5000,
        resourceRequirements: {
          cpu: 'low',
          memory: 'low',
          external: false
        },
        expectedLatencyMultiplier: 0.1,
        qualityDegradation: 0.8,
        successProbability: 0.9,
        execute: async (context, originalOperation) => ({
          success: true,
          data: { cached: true, quality: 'reduced' },
          strategyUsed: 'test-cache-fallback',
          degradationLevel: 'minimal',
          executionTime: 50,
          qualityScore: 0.8,
          showDegradationNotice: true,
          canRetryOriginal: true,
          alternativeStrategiesAvailable: 0
        })
      };

      fallbackManager.registerStrategy(strategy);
      const retrieved = fallbackManager.getStrategy('test-cache-fallback');

      expect(retrieved).toEqual(strategy);
    });

    test('should get strategies by service type', () => {
      const visionStrategy: FallbackStrategy = {
        id: 'vision-cache',
        name: 'Vision Cache',
        description: 'Cached vision analysis',
        serviceType: 'vision_analysis',
        targetCapabilities: ['image_analysis'],
        supportedDegradationLevels: ['minimal'],
        triggerConditions: {
          errorCategories: ['network'],
          severityLevels: ['medium'],
          degradationLevels: ['minimal']
        },
        priority: 1,
        maxRetries: 1,
        retryDelay: 500,
        timeout: 2000,
        resourceRequirements: { cpu: 'low' },
        expectedLatencyMultiplier: 0.2,
        qualityDegradation: 0.7,
        successProbability: 0.85,
        execute: async () => ({
          success: true,
          data: {},
          strategyUsed: 'vision-cache',
          degradationLevel: 'minimal',
          executionTime: 100,
          qualityScore: 0.7,
          showDegradationNotice: false,
          canRetryOriginal: true,
          alternativeStrategiesAvailable: 0
        })
      };

      fallbackManager.registerStrategy(visionStrategy);
      const strategies = fallbackManager.getStrategiesForService('vision_analysis');

      expect(strategies).toHaveLength(1);
      expect(strategies[0].id).toBe('vision-cache');
    });

    test('should prioritize strategies correctly', () => {
      const lowPriorityStrategy: FallbackStrategy = {
        id: 'low-priority',
        name: 'Low Priority',
        description: 'Low priority fallback',
        serviceType: 'transcription',
        targetCapabilities: ['audio_transcription'],
        supportedDegradationLevels: ['partial'],
        triggerConditions: {
          errorCategories: ['processing'],
          severityLevels: ['low'],
          degradationLevels: ['partial']
        },
        priority: 1,
        maxRetries: 1,
        retryDelay: 1000,
        timeout: 3000,
        resourceRequirements: {},
        expectedLatencyMultiplier: 2.0,
        qualityDegradation: 0.5,
        successProbability: 0.6,
        execute: async () => ({
          success: true,
          data: {},
          strategyUsed: 'low-priority',
          degradationLevel: 'partial',
          executionTime: 200,
          qualityScore: 0.5,
          showDegradationNotice: true,
          canRetryOriginal: false,
          alternativeStrategiesAvailable: 0
        })
      };

      const highPriorityStrategy: FallbackStrategy = {
        ...lowPriorityStrategy,
        id: 'high-priority',
        name: 'High Priority',
        priority: 10
      };

      fallbackManager.registerStrategy(lowPriorityStrategy);
      fallbackManager.registerStrategy(highPriorityStrategy);

      const strategies = fallbackManager.getStrategiesForService('transcription');
      expect(strategies[0].id).toBe('high-priority');
      expect(strategies[1].id).toBe('low-priority');
    });
  });

  describe('Service Profile Management', () => {
    test('should register and manage service profiles', () => {
      const visionProfile: ServiceProfile = {
        serviceType: 'vision_analysis',
        serviceName: 'AI Vision Analysis',
        capabilities: [
          {
            id: 'image_analysis',
            name: 'Image Analysis',
            description: 'Analyze image content',
            essential: true,
            degradationImpact: 'severe',
            dependencies: [],
            fallbackAvailable: true,
            estimatedLatency: 2000,
            resourceIntensive: true
          },
          {
            id: 'object_detection',
            name: 'Object Detection',
            description: 'Detect objects in images',
            essential: false,
            degradationImpact: 'partial',
            dependencies: ['image_analysis'],
            fallbackAvailable: false,
            estimatedLatency: 1500,
            resourceIntensive: true
          }
        ],
        minimalViableCapabilities: ['image_analysis'],
        degradationPolicy: {
          allowAutomaticDegradation: true,
          maxDegradationLevel: 'partial',
          degradationTimeout: 5000,
          restoreConditions: ['error_rate_below_5%', 'latency_below_3s']
        },
        healthIndicators: {
          latencyThreshold: 3000,
          errorRateThreshold: 0.05,
          resourceUsageThreshold: 0.8
        }
      };

      fallbackManager.registerServiceProfile(visionProfile);
      const retrieved = fallbackManager.getServiceProfile('vision_analysis');

      expect(retrieved).toEqual(visionProfile);
      expect(retrieved?.capabilities).toHaveLength(2);
      expect(retrieved?.minimalViableCapabilities).toContain('image_analysis');
    });

    test('should determine degradation level based on capabilities', () => {
      const serviceProfile: ServiceProfile = {
        serviceType: 'video_processing',
        serviceName: 'Video Processing',
        capabilities: [
          {
            id: 'frame_extraction',
            name: 'Frame Extraction',
            description: 'Extract frames from video',
            essential: true,
            degradationImpact: 'severe',
            dependencies: [],
            fallbackAvailable: true,
            estimatedLatency: 1000,
            resourceIntensive: false
          }
        ],
        minimalViableCapabilities: ['frame_extraction'],
        degradationPolicy: {
          allowAutomaticDegradation: true,
          maxDegradationLevel: 'complete',
          degradationTimeout: 10000,
          restoreConditions: []
        },
        healthIndicators: {
          latencyThreshold: 5000,
          errorRateThreshold: 0.1,
          resourceUsageThreshold: 0.9
        }
      };

      fallbackManager.registerServiceProfile(serviceProfile);

      const degradationLevel = fallbackManager.determineDegradationLevel(
        'video_processing',
        ['frame_extraction']
      );

      expect(degradationLevel).toBe('none');

      const degradationWithoutEssential = fallbackManager.determineDegradationLevel(
        'video_processing',
        []
      );

      expect(degradationWithoutEssential).toBe('complete');
    });
  });

  describe('Fallback Execution', () => {
    test('should execute fallback strategy successfully', async () => {
      const mockStrategy: FallbackStrategy = {
        id: 'test-execution',
        name: 'Test Execution',
        description: 'Test strategy execution',
        serviceType: 'external_apis',
        targetCapabilities: ['api_call'],
        supportedDegradationLevels: ['minimal'],
        triggerConditions: {
          errorCategories: ['network'],
          severityLevels: ['medium'],
          degradationLevels: ['minimal']
        },
        priority: 150,
        maxRetries: 1,
        retryDelay: 100,
        timeout: 1000,
        resourceRequirements: {},
        expectedLatencyMultiplier: 1.5,
        qualityDegradation: 0.9,
        successProbability: 0.95,
        execute: async (context, originalOperation) => {
          expect(context.serviceType).toBe('external_apis');
          expect(context.operation).toBe('api_call');
          return {
            success: true,
            data: { fallback: true, timestamp: Date.now() },
            strategyUsed: 'test-execution',
            degradationLevel: 'minimal',
            executionTime: 150,
            qualityScore: 0.9,
            showDegradationNotice: false,
            canRetryOriginal: true,
            alternativeStrategiesAvailable: 0
          };
        }
      };

      fallbackManager.registerStrategy(mockStrategy);

      const context: FallbackContext = {
        ...MockFactory.createErrorContext(),
        serviceType: 'external_apis',
        operation: 'api_call',
        currentDegradationLevel: 'none',
        maxAcceptableDegradation: 'partial',
        attemptCount: 1,
        maxAttempts: 3,
        resourcesAvailable: true,
        alternativeResourcesCount: 2
      };

      const originalOperation = jest.fn().mockRejectedValue(
        ErrorSimulator.createNetworkError()
      );

      const result = await fallbackManager.executeStrategy(
        'test-execution',
        context,
        originalOperation
      );

      expect(result.success).toBe(true);
      expect(result.strategyUsed).toBe('test-execution');
      expect(result.data).toHaveProperty('fallback', true);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should handle strategy execution failure', async () => {
      const failingStrategy: FallbackStrategy = {
        id: 'failing-strategy',
        name: 'Failing Strategy',
        description: 'Strategy that fails',
        serviceType: 'storage_operations',
        targetCapabilities: ['file_storage'],
        supportedDegradationLevels: ['severe'],
        triggerConditions: {
          errorCategories: ['storage'],
          severityLevels: ['high'],
          degradationLevels: ['severe']
        },
        priority: 1,
        maxRetries: 2,
        retryDelay: 50,
        timeout: 500,
        resourceRequirements: {},
        expectedLatencyMultiplier: 3.0,
        qualityDegradation: 0.3,
        successProbability: 0.1,
        execute: async () => {
          throw ErrorSimulator.createStorageError('write');
        }
      };

      fallbackManager.registerStrategy(failingStrategy);

      const context: FallbackContext = {
        ...MockFactory.createErrorContext(),
        serviceType: 'storage_operations',
        operation: 'file_storage',
        currentDegradationLevel: 'none',
        maxAcceptableDegradation: 'complete',
        attemptCount: 1,
        maxAttempts: 3,
        resourcesAvailable: true,
        alternativeResourcesCount: 0
      };

      const originalOperation = jest.fn().mockRejectedValue(
        ErrorSimulator.createStorageError()
      );

      const result = await fallbackManager.executeStrategy(
        'failing-strategy',
        context,
        originalOperation
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.strategyUsed).toBe('failing-strategy');
    });

    test('should respect strategy timeout', async () => {
      const slowStrategy: FallbackStrategy = {
        id: 'slow-strategy',
        name: 'Slow Strategy',
        description: 'Strategy that takes too long',
        serviceType: 'video_processing',
        targetCapabilities: ['data_processing'],
        supportedDegradationLevels: ['partial'],
        triggerConditions: {
          errorCategories: ['processing'],
          severityLevels: ['medium'],
          degradationLevels: ['partial']
        },
        priority: 1,
        maxRetries: 1,
        retryDelay: 10,
        timeout: 100, // Short timeout
        resourceRequirements: {},
        expectedLatencyMultiplier: 2.0,
        qualityDegradation: 0.6,
        successProbability: 0.8,
        execute: async () => {
          // Simulate slow operation
          await new Promise(resolve => setTimeout(resolve, 200));
          return {
            success: true,
            data: {},
            strategyUsed: 'slow-strategy',
            degradationLevel: 'partial',
            executionTime: 200,
            qualityScore: 0.6,
            showDegradationNotice: true,
            canRetryOriginal: false,
            alternativeStrategiesAvailable: 0
          };
        }
      };

      fallbackManager.registerStrategy(slowStrategy);

      const context: FallbackContext = {
        ...MockFactory.createErrorContext(),
        serviceType: 'video_processing',
        operation: 'data_processing',
        currentDegradationLevel: 'none',
        maxAcceptableDegradation: 'partial',
        attemptCount: 1,
        maxAttempts: 2,
        resourcesAvailable: true,
        alternativeResourcesCount: 1
      };

      const originalOperation = jest.fn().mockRejectedValue(
        ErrorSimulator.createTimeoutError()
      );

      const startTime = Date.now();
      const result = await fallbackManager.executeStrategy(
        'slow-strategy',
        context,
        originalOperation
      );
      const endTime = Date.now();

      expect(result.success).toBe(false);
      expect(endTime - startTime).toBeLessThan(150); // Should timeout before 200ms
    });
  });

  describe('Fallback Chain Execution', () => {
    test('should execute fallback chain in order', async () => {
      const strategies = [
        {
          id: 'first-strategy',
          execute: jest.fn().mockRejectedValue(new Error('First strategy failed'))
        },
        {
          id: 'second-strategy',
          execute: jest.fn().mockResolvedValue({
            success: true,
            data: { source: 'second' },
            strategyUsed: 'second-strategy',
            degradationLevel: 'minimal',
            executionTime: 100,
            qualityScore: 0.8,
            showDegradationNotice: false,
            canRetryOriginal: true,
            alternativeStrategiesAvailable: 0
          })
        }
      ];

      // Register strategies (simplified for test)
      strategies.forEach((strategy, index) => {
        const fullStrategy: FallbackStrategy = {
          id: strategy.id,
          name: `Strategy ${index + 1}`,
          description: `Test strategy ${index + 1}`,
          serviceType: 'chat_completion',
          targetCapabilities: ['text_generation'],
          supportedDegradationLevels: ['minimal'],
          triggerConditions: {
            errorCategories: ['external_service'],
            severityLevels: ['medium'],
            degradationLevels: ['minimal']
          },
          priority: 10 - index, // Higher priority for earlier strategies
          maxRetries: 1,
          retryDelay: 100,
          timeout: 1000,
          resourceRequirements: {},
          expectedLatencyMultiplier: 1.0,
          qualityDegradation: 0.8,
          successProbability: 0.7,
          execute: strategy.execute
        };
        fallbackManager.registerStrategy(fullStrategy);
      });

      const context: FallbackContext = {
        ...MockFactory.createErrorContext(),
        serviceType: 'chat_completion',
        operation: 'text_generation',
        currentDegradationLevel: 'none',
        maxAcceptableDegradation: 'partial',
        attemptCount: 1,
        maxAttempts: 3,
        resourcesAvailable: true,
        alternativeResourcesCount: 2
      };

      const result = await fallbackManager.executeWithFallback(
        'chat_completion',
        async () => {
          throw ErrorSimulator.createNetworkError();
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data.source).toBe('second');
      expect(result.strategyUsed).toBe('second-strategy');
      expect(strategies[0].execute).toHaveBeenCalled();
      expect(strategies[1].execute).toHaveBeenCalled();
    });

    test('should stop chain execution on success', async () => {
      const strategies = [
        {
          id: 'successful-strategy',
          execute: jest.fn().mockResolvedValue({
            success: true,
            data: { source: 'first' },
            strategyUsed: 'successful-strategy',
            degradationLevel: 'none',
            executionTime: 50,
            qualityScore: 1.0,
            showDegradationNotice: false,
            canRetryOriginal: false,
            alternativeStrategiesAvailable: 1
          })
        },
        {
          id: 'unused-strategy',
          execute: jest.fn().mockResolvedValue({
            success: true,
            data: { source: 'second' },
            strategyUsed: 'unused-strategy',
            degradationLevel: 'minimal',
            executionTime: 100,
            qualityScore: 0.8,
            showDegradationNotice: false,
            canRetryOriginal: true,
            alternativeStrategiesAvailable: 0
          })
        }
      ];

      strategies.forEach((strategy, index) => {
        const fullStrategy: FallbackStrategy = {
          id: strategy.id,
          name: `Strategy ${index + 1}`,
          description: `Test strategy ${index + 1}`,
          serviceType: 'authentication',
          targetCapabilities: ['user_auth'],
          supportedDegradationLevels: ['none', 'minimal'],
          triggerConditions: {
            errorCategories: ['authentication'],
            severityLevels: ['high'],
            degradationLevels: ['none', 'minimal']
          },
          priority: 10 - index,
          maxRetries: 1,
          retryDelay: 100,
          timeout: 1000,
          resourceRequirements: {},
          expectedLatencyMultiplier: 1.0,
          qualityDegradation: index === 0 ? 1.0 : 0.8,
          successProbability: 0.9,
          execute: strategy.execute
        };
        fallbackManager.registerStrategy(fullStrategy);
      });

      const context: FallbackContext = {
        ...MockFactory.createErrorContext(),
        serviceType: 'authentication',
        operation: 'user_auth',
        currentDegradationLevel: 'none',
        maxAcceptableDegradation: 'minimal',
        attemptCount: 1,
        maxAttempts: 2,
        resourcesAvailable: true,
        alternativeResourcesCount: 1
      };

      const result = await fallbackManager.executeWithFallback(
        'authentication',
        async () => {
          throw ErrorSimulator.createAuthenticationError();
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data.source).toBe('first');
      expect(result.strategyUsed).toBe('successful-strategy');
      expect(strategies[0].execute).toHaveBeenCalled();
      expect(strategies[1].execute).not.toHaveBeenCalled(); // Should not be called
    });
  });

  describe('Performance and Resource Management', () => {
    test('should track resource usage during fallback execution', async () => {
      const resourceIntensiveStrategy: FallbackStrategy = {
        id: 'resource-intensive',
        name: 'Resource Intensive Strategy',
        description: 'Strategy that uses significant resources',
        serviceType: 'video_processing',
        targetCapabilities: ['video_analysis'],
        supportedDegradationLevels: ['partial'],
        triggerConditions: {
          errorCategories: ['processing'],
          severityLevels: ['medium'],
          degradationLevels: ['partial']
        },
        priority: 1,
        maxRetries: 1,
        retryDelay: 100,
        timeout: 2000,
        resourceRequirements: {
          cpu: 'high',
          memory: 'high',
          network: 'medium'
        },
        expectedLatencyMultiplier: 2.5,
        qualityDegradation: 0.7,
        successProbability: 0.8,
        execute: async (context) => {
          // Simulate resource usage
          const memoryUsage = process.memoryUsage();
          
          return {
            success: true,
            data: { processed: true, resourceUsage: memoryUsage },
            strategyUsed: 'resource-intensive',
            degradationLevel: 'partial',
            executionTime: 500,
            qualityScore: 0.7,
            technicalDetails: {
              fallbacksAttempted: ['resource-intensive'],
              resourcesUsed: ['cpu_high', 'memory_high'],
              performanceMetrics: {
                cpuUsage: 0.8,
                memoryUsage: memoryUsage.heapUsed
              }
            },
            showDegradationNotice: true,
            canRetryOriginal: false,
            alternativeStrategiesAvailable: 0
          };
        }
      };

      fallbackManager.registerStrategy(resourceIntensiveStrategy);

      const context: FallbackContext = {
        ...MockFactory.createErrorContext(),
        serviceType: 'video_processing',
        operation: 'video_analysis',
        currentDegradationLevel: 'none',
        maxAcceptableDegradation: 'partial',
        attemptCount: 1,
        maxAttempts: 2,
        resourcesAvailable: true,
        alternativeResourcesCount: 0
      };

      const { result, memoryDelta } = await TestHelpers.measureMemoryUsage(async () => {
        return fallbackManager.executeStrategy(
          'resource-intensive',
          context,
          async () => {
            throw ErrorSimulator.createTimeoutError();
          }
        );
      });

      expect(result.success).toBe(true);
      expect(result.technicalDetails?.performanceMetrics).toBeDefined();
      expect(memoryDelta).toBeGreaterThan(0); // Should use some memory
    });

    test('should handle degradation level progression', () => {
      const degradationLevels: DegradationLevel[] = [
        'none', 'minimal', 'partial', 'severe', 'complete'
      ];

      degradationLevels.forEach((level, index) => {
        const nextLevel = fallbackManager.getNextDegradationLevel(level);
        if (index < degradationLevels.length - 1) {
          expect(nextLevel).toBe(degradationLevels[index + 1]);
        } else {
          expect(nextLevel).toBe('complete'); // Should stay at complete
        }
      });
    });
  });
});

describe('Integration Tests', () => {
  test('should integrate with error categorization system', async () => {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.reset();

    // Register a fallback strategy that works with categorized errors
    const networkFallbackStrategy: FallbackStrategy = {
      id: 'network-error-fallback',
      name: 'Network Error Fallback',
      description: 'Handle network errors with cached data',
      serviceType: 'external_apis',
      targetCapabilities: ['api_call'],
      supportedDegradationLevels: ['minimal'],
      triggerConditions: {
        errorCategories: ['network', 'external_service'],
        severityLevels: ['medium', 'high'],
        degradationLevels: ['minimal']
      },
      priority: 8,
      maxRetries: 2,
      retryDelay: 500,
      timeout: 3000,
      resourceRequirements: {
        cpu: 'low',
        memory: 'medium',
        external: false
      },
      expectedLatencyMultiplier: 0.3,
      qualityDegradation: 0.85,
      successProbability: 0.95,
      execute: async (context) => ({
        success: true,
        data: { 
          fromCache: true, 
          timestamp: context.lastError?.timestamp || new Date().toISOString(),
          degraded: true 
        },
        strategyUsed: 'network-error-fallback',
        degradationLevel: 'minimal',
        executionTime: 150,
        qualityScore: 0.85,
        userMessage: 'Using cached data due to network issues',
        showDegradationNotice: true,
        canRetryOriginal: true,
        estimatedRecoveryTime: 5000,
        alternativeStrategiesAvailable: 0
      })
    };

    fallbackManager.registerStrategy(networkFallbackStrategy);

    const context: FallbackContext = {
      ...MockFactory.createErrorContext(),
      serviceType: 'external_apis',
      operation: 'api_call',
      currentDegradationLevel: 'none',
      maxAcceptableDegradation: 'partial',
      attemptCount: 1,
      maxAttempts: 3,
      lastError: ErrorSimulator.createNetworkError(503, 'Service temporarily unavailable'),
      resourcesAvailable: true,
      alternativeResourcesCount: 1
    };

    const result = await fallbackManager.executeWithFallback(
      'external_apis',
      async () => {
        throw ErrorSimulator.createNetworkError(503);
      },
      context
    );

    expect(result.success).toBe(true);
    expect(result.data.fromCache).toBe(true);
    expect(result.userMessage).toContain('cached data');
    expect(result.showDegradationNotice).toBe(true);
    expect(result.canRetryOriginal).toBe(true);
  });

  test('should handle complex multi-service fallback scenario', async () => {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.reset();

    // Set up multiple fallback strategies for different services
    const strategies: FallbackStrategy[] = [
      {
        id: 'test-vision-local-cache', // Use different ID to avoid conflict
        name: 'Vision Local Cache',
        description: 'Use locally cached vision analysis',
        serviceType: 'vision_analysis',
        targetCapabilities: ['image_analysis'],
        supportedDegradationLevels: ['minimal'],
        triggerConditions: {
          errorCategories: ['external_service', 'rate_limiting'],
          severityLevels: ['medium', 'high'],
          degradationLevels: ['partial', 'severe']
        },
        priority: 10,
        maxRetries: 1,
        retryDelay: 100,
        timeout: 1000,
        resourceRequirements: { cpu: 'low', memory: 'low' },
        expectedLatencyMultiplier: 0.1,
        qualityDegradation: 0.7,
        successProbability: 0.9,
        execute: async () => ({
          success: true,
          data: { analysis: 'cached_result', confidence: 0.7 },
          strategyUsed: 'test-vision-local-cache',
          degradationLevel: 'minimal',
          executionTime: 50,
          qualityScore: 0.7,
          showDegradationNotice: true,
          canRetryOriginal: true,
          alternativeStrategiesAvailable: 1
        })
      },
      {
        id: 'test-vision-template-based', // Use different ID to avoid conflict
        name: 'Vision Template Analysis',
        description: 'Use template-based image analysis',
        serviceType: 'vision_analysis',
        targetCapabilities: ['image_analysis'],
        supportedDegradationLevels: ['partial', 'severe'],
        triggerConditions: {
          errorCategories: ['external_service', 'processing'],
          severityLevels: ['medium', 'high'],
          degradationLevels: ['partial', 'severe']
        },
        priority: 5,
        maxRetries: 2,
        retryDelay: 200,
        timeout: 2000,
        resourceRequirements: { cpu: 'medium', memory: 'low' },
        expectedLatencyMultiplier: 0.5,
        qualityDegradation: 0.4,
        successProbability: 0.8,
        execute: async () => ({
          success: true,
          data: { analysis: 'template_based', confidence: 0.4 },
          strategyUsed: 'test-vision-template-based',
          degradationLevel: 'partial',
          executionTime: 100,
          qualityScore: 0.4,
          showDegradationNotice: true,
          canRetryOriginal: false,
          alternativeStrategiesAvailable: 0
        })
      }
    ];

    strategies.forEach(strategy => fallbackManager.registerStrategy(strategy));

    const visionContext: FallbackContext = {
      ...MockFactory.createErrorContext(),
      serviceType: 'vision_analysis',
      operation: 'image_analysis',
      currentDegradationLevel: 'none',
      maxAcceptableDegradation: 'severe',
      attemptCount: 1,
      maxAttempts: 3,
      resourcesAvailable: true,
      alternativeResourcesCount: 2
    };

    // Simulate primary service failure
    const result = await fallbackManager.executeWithFallback(
      'vision_analysis',
      async () => {
        throw ErrorSimulator.createRateLimitError();
      },
      visionContext
    );

    expect(result.success).toBe(true);
    expect(result.strategyUsed).toBe('vision_cached_analysis'); // The auto-initialized strategy
    expect(result.data).toBeDefined(); // Check that we get data back
    expect(result.degradationLevel).toBe('minimal');
  });
});

describe('Performance Tests', () => {
  test('should handle high-frequency fallback operations', async () => {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.reset();

    const fastFallbackStrategy: FallbackStrategy = {
      id: 'fast-fallback',
      name: 'Fast Fallback',
      description: 'Quick fallback strategy',
      serviceType: 'search_functionality',
      targetCapabilities: ['search'],
      supportedDegradationLevels: ['minimal'],
      triggerConditions: {
        errorCategories: ['network'],
        severityLevels: ['medium'],
        degradationLevels: ['minimal']
      },
      priority: 1,
      maxRetries: 1,
      retryDelay: 1,
      timeout: 100,
      resourceRequirements: {},
      expectedLatencyMultiplier: 0.1,
      qualityDegradation: 0.9,
      successProbability: 0.99,
      execute: async () => ({
        success: true,
        data: { results: ['cached_result_1', 'cached_result_2'] },
        strategyUsed: 'fast-fallback',
        degradationLevel: 'minimal',
        executionTime: 5,
        qualityScore: 0.9,
        showDegradationNotice: false,
        canRetryOriginal: true,
        alternativeStrategiesAvailable: 0
      })
    };

    fallbackManager.registerStrategy(fastFallbackStrategy);

    const { duration, result } = await TestHelpers.measureExecutionTime(async () => {
      const operations = Array.from({ length: 50 }, () => 
        fallbackManager.executeWithFallback(
          'search_functionality',
          async () => {
            throw ErrorSimulator.createNetworkError();
          },
          {
            ...MockFactory.createErrorContext(),
            serviceType: 'search_functionality',
            operation: 'search',
            currentDegradationLevel: 'none',
            maxAcceptableDegradation: 'minimal',
            attemptCount: 1,
            maxAttempts: 2,
            resourcesAvailable: true,
            alternativeResourcesCount: 0
          }
        )
      );

      return Promise.all(operations);
    });

    expect(result).toHaveLength(50);
    result.forEach(res => {
      expect(res.success).toBe(true);
      expect(res.strategyUsed).toBe('fast-fallback');
    });

    // Should handle 50 fallback operations quickly
    expect(duration).toBeLessThan(200);
  });
}); 