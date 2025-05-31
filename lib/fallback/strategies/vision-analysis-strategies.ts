// Vision Analysis Fallback Strategies
// Specific implementations for vision processing with graceful degradation

import {
  FallbackStrategy,
  FallbackContext,
  FallbackResult,
  ServiceProfile,
  ServiceCapability,
  DegradationLevel
} from '../types';
import { fallbackRegistry } from '../strategy-registry';
import { VisionAnalysisService } from '../../vision-analysis';
import { BaseStorageError } from '../../errors/types';

/**
 * Vision Analysis Service Profile
 */
const visionAnalysisProfile: ServiceProfile = {
  serviceType: 'vision_analysis',
  serviceName: 'AI Vision Analysis',
  capabilities: [
    {
      id: 'slide_content_analysis',
      name: 'Slide Content Analysis',
      description: 'Extract and analyze slide content including text and structure',
      essential: true,
      degradationImpact: 'severe',
      dependencies: [],
      fallbackAvailable: true,
      estimatedLatency: 3000,
      resourceIntensive: true
    },
    {
      id: 'visual_quality_assessment',
      name: 'Visual Quality Assessment',
      description: 'Evaluate design consistency, typography, and visual appeal',
      essential: false,
      degradationImpact: 'partial',
      dependencies: ['slide_content_analysis'],
      fallbackAvailable: true,
      estimatedLatency: 2000,
      resourceIntensive: false
    },
    {
      id: 'engagement_analysis',
      name: 'Engagement Cues Analysis',
      description: 'Identify visual hierarchy and engagement elements',
      essential: false,
      degradationImpact: 'minimal',
      dependencies: ['slide_content_analysis'],
      fallbackAvailable: true,
      estimatedLatency: 1500,
      resourceIntensive: false
    },
    {
      id: 'presentation_flow',
      name: 'Presentation Flow Analysis',
      description: 'Analyze narrative flow and slide transitions',
      essential: false,
      degradationImpact: 'partial',
      dependencies: ['slide_content_analysis'],
      fallbackAvailable: true,
      estimatedLatency: 2500,
      resourceIntensive: false
    }
  ],
  minimalViableCapabilities: ['slide_content_analysis'],
  degradationPolicy: {
    allowAutomaticDegradation: true,
    maxDegradationLevel: 'partial',
    degradationTimeout: 10000,
    restoreConditions: ['model_availability', 'reduced_error_rate']
  },
  healthIndicators: {
    latencyThreshold: 15000,
    errorRateThreshold: 15,
    resourceUsageThreshold: 80
  }
};

/**
 * Cached Analysis Fallback Strategy
 * Uses previously successful analysis as baseline
 */
const cachedAnalysisFallback: FallbackStrategy = {
  id: 'vision_cached_analysis',
  name: 'Cached Analysis Fallback',
  description: 'Use cached analysis results with reduced quality',
  serviceType: 'vision_analysis',
  targetCapabilities: ['slide_content_analysis', 'visual_quality_assessment'],
  supportedDegradationLevels: ['minimal', 'partial'],
  
  triggerConditions: {
    errorCategories: ['external_service', 'network', 'rate_limiting'],
    severityLevels: ['medium', 'high'],
    degradationLevels: ['minimal', 'partial'],
    customConditions: (context: FallbackContext) => {
      // Check if we have cached data available
      return context.metadata?.hasCachedData === true;
    }
  },
  
  priority: 100,
  maxRetries: 1,
  retryDelay: 1000,
  timeout: 5000,
  
  resourceRequirements: {
    cpu: 'low',
    memory: 'low',
    network: 'low',
    external: false
  },
  
  expectedLatencyMultiplier: 0.1, // Very fast
  qualityDegradation: 0.7, // 30% quality reduction
  successProbability: 0.95,
  
  execute: async (context: FallbackContext, originalOperation: () => Promise<any>): Promise<FallbackResult> => {
    try {
      // Simulate retrieving cached analysis
      const cachedData = {
        slideContent: {
          bulletPoints: ['Cached analysis available'],
          keyMessages: ['Previous analysis results'],
          textReadability: 'medium' as const,
          informationDensity: 'medium' as const,
          visualElements: {
            charts: false,
            images: true,
            diagrams: false,
            logos: false
          }
        },
        confidence: 0.7
      };

      return {
        success: true,
        data: cachedData,
        strategyUsed: 'vision_cached_analysis',
        degradationLevel: 'minimal',
        executionTime: 0, // Will be set by execution engine
        qualityScore: 0.7,
        userMessage: 'Using cached analysis results with reduced accuracy',
        userActions: ['Retry for fresh analysis', 'Accept current results'],
        showDegradationNotice: true,
        canRetryOriginal: true,
        estimatedRecoveryTime: 30000,
        alternativeStrategiesAvailable: 2,
        technicalDetails: {
          fallbacksAttempted: ['cached_analysis'],
          resourcesUsed: ['local_cache'],
          performanceMetrics: {
            cacheHitRate: 1.0,
            dataFreshness: 0.8
          }
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error as BaseStorageError,
        strategyUsed: 'vision_cached_analysis',
        degradationLevel: 'complete',
        executionTime: 0,
        qualityScore: 0,
        userMessage: 'Cached analysis unavailable',
        userActions: ['Try again later', 'Contact support'],
        showDegradationNotice: true,
        canRetryOriginal: true,
        alternativeStrategiesAvailable: 1
      };
    }
  }
};

/**
 * Template-Based Analysis Fallback
 * Uses predefined templates for common slide types
 */
const templateBasedFallback: FallbackStrategy = {
  id: 'vision_template_based',
  name: 'Template-Based Analysis',
  description: 'Generate analysis using slide type templates',
  serviceType: 'vision_analysis',
  targetCapabilities: ['slide_content_analysis', 'visual_quality_assessment', 'engagement_analysis'],
  supportedDegradationLevels: ['partial', 'severe'],
  
  triggerConditions: {
    errorCategories: ['external_service', 'processing', 'rate_limiting'],
    severityLevels: ['medium', 'high', 'critical'],
    degradationLevels: ['partial', 'severe']
  },
  
  priority: 80,
  maxRetries: 2,
  retryDelay: 2000,
  timeout: 8000,
  
  resourceRequirements: {
    cpu: 'medium',
    memory: 'low',
    network: 'low',
    external: false
  },
  
  expectedLatencyMultiplier: 0.3,
  qualityDegradation: 0.5, // 50% quality reduction
  successProbability: 0.85,
  
  execute: async (context: FallbackContext, originalOperation: () => Promise<any>): Promise<FallbackResult> => {
    try {
      // Use existing fallback analysis from VisionAnalysisService
      const fallbackData = VisionAnalysisService['getFallbackAnalysis']('slide_content');
      
      // Enhance with template-based insights
      const enhancedData = {
        ...fallbackData,
        templateUsed: 'generic_business_slide',
        analysisMethod: 'template_based',
        confidence: 0.5,
        recommendations: [
          'Consider adding visual elements to improve engagement',
          'Review text density for better readability',
          'Ensure consistent formatting across slides'
        ]
      };

      return {
        success: true,
        data: enhancedData,
        strategyUsed: 'vision_template_based',
        degradationLevel: 'partial',
        executionTime: 0,
        qualityScore: 0.5,
        userMessage: 'Analysis completed using template-based approach with reduced detail',
        userActions: ['Retry for detailed analysis', 'Accept template results', 'Upload different image'],
        showDegradationNotice: true,
        canRetryOriginal: true,
        estimatedRecoveryTime: 60000,
        alternativeStrategiesAvailable: 1,
        technicalDetails: {
          fallbacksAttempted: ['template_based'],
          resourcesUsed: ['local_templates'],
          performanceMetrics: {
            templateMatchConfidence: 0.6,
            processingSpeed: 2.5
          }
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error as BaseStorageError,
        strategyUsed: 'vision_template_based',
        degradationLevel: 'severe',
        executionTime: 0,
        qualityScore: 0,
        userMessage: 'Template-based analysis failed',
        userActions: ['Try again later', 'Use simplified analysis mode'],
        showDegradationNotice: true,
        canRetryOriginal: true,
        alternativeStrategiesAvailable: 0
      };
    }
  }
};

/**
 * Basic Text Extraction Fallback
 * Minimal analysis focusing only on text extraction
 */
const basicTextExtractionFallback: FallbackStrategy = {
  id: 'vision_basic_text',
  name: 'Basic Text Extraction',
  description: 'Extract basic text content without advanced analysis',
  serviceType: 'vision_analysis',
  targetCapabilities: ['slide_content_analysis'],
  supportedDegradationLevels: ['severe', 'complete'],
  
  triggerConditions: {
    errorCategories: ['external_service', 'processing', 'network', 'rate_limiting'],
    severityLevels: ['high', 'critical'],
    degradationLevels: ['severe', 'complete']
  },
  
  priority: 60,
  maxRetries: 3,
  retryDelay: 5000,
  timeout: 15000,
  
  resourceRequirements: {
    cpu: 'low',
    memory: 'low',
    network: 'medium',
    external: true // Might use simpler OCR service
  },
  
  expectedLatencyMultiplier: 0.8,
  qualityDegradation: 0.2, // 80% quality reduction
  successProbability: 0.75,
  
  execute: async (context: FallbackContext, originalOperation: () => Promise<any>): Promise<FallbackResult> => {
    try {
      // Simulate basic text extraction
      const basicData = {
        slideContent: {
          extractedText: 'Basic text content extracted',
          textElements: ['Title text', 'Body content', 'Footer information'],
          basicStructure: {
            hasTitle: true,
            hasContent: true,
            estimatedWordCount: 50
          }
        },
        processingMethod: 'basic_ocr',
        confidence: 0.3
      };

      return {
        success: true,
        data: basicData,
        strategyUsed: 'vision_basic_text',
        degradationLevel: 'severe',
        executionTime: 0,
        qualityScore: 0.2,
        userMessage: 'Basic text extraction completed. Advanced analysis unavailable.',
        userActions: ['Retry for full analysis', 'Continue with basic results', 'Try different file format'],
        showDegradationNotice: true,
        canRetryOriginal: true,
        estimatedRecoveryTime: 120000,
        alternativeStrategiesAvailable: 0,
        technicalDetails: {
          fallbacksAttempted: ['basic_text_extraction'],
          resourcesUsed: ['ocr_service'],
          performanceMetrics: {
            textExtractionAccuracy: 0.4,
            processingComplexity: 1.0
          }
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error as BaseStorageError,
        strategyUsed: 'vision_basic_text',
        degradationLevel: 'complete',
        executionTime: 0,
        qualityScore: 0,
        userMessage: 'All vision analysis methods unavailable',
        userActions: ['Try again later', 'Contact support', 'Use manual analysis'],
        showDegradationNotice: true,
        canRetryOriginal: false,
        alternativeStrategiesAvailable: 0
      };
    }
  }
};

/**
 * Initialize vision analysis fallback strategies
 */
export function initializeVisionAnalysisStrategies(): void {
  // Register service profile
  fallbackRegistry.registerServiceProfile(visionAnalysisProfile);
  
  // Register fallback strategies
  fallbackRegistry.registerStrategy(cachedAnalysisFallback);
  fallbackRegistry.registerStrategy(templateBasedFallback);
  fallbackRegistry.registerStrategy(basicTextExtractionFallback);
}

/**
 * Vision analysis specific fallback helper
 */
export class VisionAnalysisFallbackHelper {
  /**
   * Get appropriate fallback strategy for vision analysis error
   */
  static getRecommendedStrategy(
    errorCode: string,
    degradationLevel: DegradationLevel,
    hasCachedData: boolean = false
  ): string | null {
    if (hasCachedData && ['minimal', 'partial'].includes(degradationLevel)) {
      return 'vision_cached_analysis';
    }
    
    if (['partial', 'severe'].includes(degradationLevel)) {
      return 'vision_template_based';
    }
    
    if (['severe', 'complete'].includes(degradationLevel)) {
      return 'vision_basic_text';
    }
    
    return null;
  }
  
  /**
   * Enhance context with vision-specific metadata
   */
  static enhanceContext(
    context: Partial<FallbackContext>,
    imageUrl?: string,
    analysisType?: string
  ): Partial<FallbackContext> {
    return {
      ...context,
      metadata: {
        ...context.metadata,
        imageUrl,
        analysisType,
        hasCachedData: false, // Would check cache in real implementation
        imageFormat: imageUrl?.split('.').pop(),
        requestedCapabilities: ['slide_content_analysis']
      }
    };
  }
  
  /**
   * Check if degradation is acceptable for user preferences
   */
  static isAcceptableDegradation(
    degradationLevel: DegradationLevel,
    userPreferences?: { qualityOverSpeed?: boolean; acceptDegradedService?: boolean }
  ): boolean {
    if (!userPreferences?.acceptDegradedService) {
      return degradationLevel === 'none' || degradationLevel === 'minimal';
    }
    
    if (userPreferences.qualityOverSpeed) {
      return degradationLevel !== 'complete';
    }
    
    return true; // Accept any degradation if user explicitly allows it
  }
} 