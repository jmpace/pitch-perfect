import { OpenAIError, getOpenAIErrorRecoveryStrategy, ModelDeprecatedError } from './openai-errors';
import { modelManager } from './openai-model-manager';
import { withRetry } from './errors/handlers';
import { EnhancedErrorHandler } from './enhanced-error-handling';
import { withRateLimit, rateLimiter } from './openai-rate-limiter';
import { generateRequestId, logError } from './errors/handlers';

export interface OpenAIOperationContext {
  operation: string;
  model: string;
  endpoint: string;
  requestId?: string;
  maxRetries?: number;
  enableModelFallback?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface OpenAIOperationResult<T> {
  data: T;
  model: string;
  requestId: string;
  retryCount: number;
  totalTime: number;
  fallbackUsed: boolean;
}

export class OpenAIErrorHandler {
  private static instance: OpenAIErrorHandler;
  private enhancedErrorHandler: EnhancedErrorHandler;

  private constructor() {
    this.enhancedErrorHandler = new EnhancedErrorHandler();
  }

  static getInstance(): OpenAIErrorHandler {
    if (!OpenAIErrorHandler.instance) {
      OpenAIErrorHandler.instance = new OpenAIErrorHandler();
    }
    return OpenAIErrorHandler.instance;
  }

  /**
   * Execute an OpenAI operation with comprehensive error handling
   */
  async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: OpenAIOperationContext
  ): Promise<OpenAIOperationResult<T>> {
    const startTime = Date.now();
    const requestId = context.requestId || generateRequestId();
    let currentModel = context.model;
    let retryCount = 0;
    let fallbackUsed = false;

    // Validate model before starting
    try {
      currentModel = modelManager.validateAndReplaceModel(currentModel, requestId);
    } catch (error) {
      if (error instanceof ModelDeprecatedError && context.enableModelFallback) {
        const replacement = error.context.replacementModel as string;
        if (replacement) {
          currentModel = replacement;
          fallbackUsed = true;
          console.warn(`[OpenAI Error Handler] Using replacement model: ${replacement} for deprecated ${context.model}`);
        }
      } else {
        throw error;
      }
    }

    const executeOperation = async (): Promise<T> => {
      const operationStartTime = Date.now();
      
      try {
        // Execute the operation with rate limiting
        const result = await withRateLimit(
          context.endpoint as any,
          operation,
          1000, // Default token estimation
          context.priority || 'medium'
        );
        
        // Record successful usage
        const latency = Date.now() - operationStartTime;
        modelManager.recordModelUsage(currentModel, true, latency);
        
        return result;
        
      } catch (error) {
        const latency = Date.now() - operationStartTime;
        modelManager.recordModelUsage(currentModel, false, latency);
        
        // Convert to OpenAI error if needed
        const openaiError = error instanceof OpenAIError 
          ? error 
          : OpenAIError.fromOpenAIResponse(error, requestId);
        
        // Check if we should attempt model fallback
        if (context.enableModelFallback && this.shouldAttemptModelFallback(openaiError)) {
          const nextModel = modelManager.getNextFallbackModel(currentModel, retryCount);
          if (nextModel) {
            console.warn(`[OpenAI Error Handler] Attempting fallback to model: ${nextModel}`);
            currentModel = nextModel;
            fallbackUsed = true;
            retryCount++;
            throw openaiError; // Let retry mechanism handle this
          }
        }
        
        logError(openaiError, { 
          context: context.operation,
          model: currentModel,
          endpoint: context.endpoint,
          retryCount 
        });
        
        throw openaiError;
      }
    };

    try {
      // Execute with enhanced error handling and circuit breaker
      const result = await this.enhancedErrorHandler.executeWithProtection(
        executeOperation,
        `openai-${context.endpoint}`,
        requestId,
        context.operation
      );

      const totalTime = Date.now() - startTime;

      return {
        data: result,
        model: currentModel,
        requestId,
        retryCount,
        totalTime,
        fallbackUsed
      };

    } catch (error) {
      // Final error handling - provide user-friendly response
      if (error instanceof OpenAIError) {
        const recovery = getOpenAIErrorRecoveryStrategy(error);
        
        // Log the final error with recovery strategy
        logError(error, {
          context: context.operation,
          model: currentModel,
          endpoint: context.endpoint,
          retryCount,
          recoveryStrategy: recovery,
          fallbackUsed
        });

        // Create new error with additional context (immutable approach)
        const enhancedError = new (error.constructor as any)(
          error.message,
          {
            ...error.context,
            finalModel: currentModel,
            totalRetries: retryCount,
            fallbackUsed,
            operation: context.operation
          },
          error.requestId
        );
        
        throw enhancedError;
      }
      
      // Handle unexpected errors
      throw OpenAIError.fromOpenAIResponse(error, requestId);
    }
  }

  /**
   * Determine if we should attempt model fallback for this error
   */
  private shouldAttemptModelFallback(error: OpenAIError): boolean {
    return [
      'MODEL_DEPRECATED',
      'MODEL_NOT_FOUND',
      'MODEL_OVERLOADED',
      'CONTEXT_LENGTH_EXCEEDED'
    ].includes(error.code);
  }

  /**
   * Execute vision analysis with specialized error handling
   */
  async executeVisionAnalysis<T>(
    operation: () => Promise<T>,
    frameUrl: string,
    analysisType: string,
    requestId?: string
  ): Promise<OpenAIOperationResult<T>> {
    return this.executeWithErrorHandling(operation, {
      operation: `vision-analysis-${analysisType}`,
      model: modelManager.getActiveModel('vision'),
      endpoint: 'vision',
      requestId,
      enableModelFallback: true,
      priority: 'medium'
    });
  }

  /**
   * Execute transcription with specialized error handling
   */
  async executeTranscription<T>(
    operation: () => Promise<T>,
    audioUrl?: string,
    requestId?: string
  ): Promise<OpenAIOperationResult<T>> {
    return this.executeWithErrorHandling(operation, {
      operation: 'audio-transcription',
      model: modelManager.getActiveModel('transcription'),
      endpoint: 'transcription',
      requestId,
      enableModelFallback: false, // Whisper doesn't have fallbacks
      priority: 'high'
    });
  }

  /**
   * Execute chat completion with specialized error handling
   */
  async executeChatCompletion<T>(
    operation: () => Promise<T>,
    requestId?: string
  ): Promise<OpenAIOperationResult<T>> {
    return this.executeWithErrorHandling(operation, {
      operation: 'chat-completion',
      model: modelManager.getActiveModel('chat'),
      endpoint: 'chat',
      requestId,
      enableModelFallback: true,
      priority: 'medium'
    });
  }

  /**
   * Get comprehensive error handler health status
   */
  getHealthStatus(): {
    circuitBreakers: Record<string, any>;
    rateLimiter: Record<string, any>;
    modelHealth: ReturnType<typeof modelManager.getModelHealthReport>;
    errorStats: Record<string, { count: number; rate: number }>;
  } {
    return {
      circuitBreakers: this.enhancedErrorHandler.getSystemHealth().circuitBreakers,
      rateLimiter: rateLimiter.getStatus(),
      modelHealth: modelManager.getModelHealthReport(),
      errorStats: this.enhancedErrorHandler.getSystemHealth().errorStats
    };
  }

  /**
   * Create user-friendly error response for API endpoints
   */
  createUserErrorResponse(error: unknown, requestId?: string): {
    success: false;
    error: {
      code: string;
      message: string;
      userMessage: string;
      suggestedAction: string;
      retryable: boolean;
      requestId: string;
      timestamp: string;
    };
  } {
    const openaiError = error instanceof OpenAIError 
      ? error 
      : OpenAIError.fromOpenAIResponse(error, requestId);

    return {
      success: false,
      error: {
        code: openaiError.code,
        message: openaiError.message,
        userMessage: openaiError.userMessage,
        suggestedAction: openaiError.suggestedAction,
        retryable: openaiError.retryable,
        requestId: openaiError.requestId || generateRequestId(),
        timestamp: openaiError.timestamp
      }
    };
  }

  /**
   * Graceful service degradation for different scenarios
   */
  async handleServiceDegradation(serviceType: 'vision' | 'transcription' | 'chat'): Promise<{
    degradationLevel: 'none' | 'partial' | 'severe' | 'complete';
    availableFeatures: string[];
    unavailableFeatures: string[];
    estimatedRecoveryTime?: string;
    recommendations: string[];
  }> {
    const modelHealth = modelManager.getModelHealthReport();
    const systemHealth = this.getHealthStatus();
    
    const availableModels = modelHealth.activeModels[serviceType] || [];
    const degradationLevel = this.calculateDegradationLevel(serviceType, systemHealth);
    
    const features = this.getFeaturesByService(serviceType);
    const availableFeatures = availableModels.length > 0 ? features : [];
    const unavailableFeatures = availableModels.length === 0 ? features : [];
    
    const recommendations = this.generateDegradationRecommendations(degradationLevel, serviceType);
    
    return {
      degradationLevel,
      availableFeatures,
      unavailableFeatures,
      estimatedRecoveryTime: this.estimateRecoveryTime(degradationLevel),
      recommendations
    };
  }

  private calculateDegradationLevel(serviceType: string, systemHealth: any): 'none' | 'partial' | 'severe' | 'complete' {
    const modelHealth = modelManager.getModelHealthReport();
    const availableModels = modelHealth.activeModels[serviceType]?.length || 0;
    const openCircuitBreakers = Object.keys(systemHealth.circuitBreakers).filter(
      key => key.includes(serviceType) && systemHealth.circuitBreakers[key].state === 'OPEN'
    ).length;

    if (availableModels === 0) return 'complete';
    if (openCircuitBreakers > 0) return 'severe';
    if (modelHealth.performanceIssues.some(issue => issue.modelId.includes(serviceType))) return 'partial';
    return 'none';
  }

  private getFeaturesByService(serviceType: string): string[] {
    const features: Record<string, string[]> = {
      vision: ['Slide content analysis', 'Visual quality assessment', 'Engagement analysis'],
      transcription: ['Audio transcription', 'Speaker identification', 'Timestamp extraction'],
      chat: ['Text generation', 'Content summarization', 'Question answering']
    };
    return features[serviceType] || [];
  }

  private generateDegradationRecommendations(level: string, serviceType: string): string[] {
    const recommendations: string[] = [];
    
    switch (level) {
      case 'complete':
        recommendations.push(`${serviceType} service is completely unavailable. Please try again later.`);
        recommendations.push('Consider using alternative analysis methods if available.');
        break;
      case 'severe':
        recommendations.push(`${serviceType} service is experiencing severe issues. Functionality may be limited.`);
        recommendations.push('Consider reducing request frequency or trying again later.');
        break;
      case 'partial':
        recommendations.push(`${serviceType} service is experiencing minor issues. Some features may be slower.`);
        recommendations.push('Consider using simpler analysis types for better performance.');
        break;
      default:
        recommendations.push(`${serviceType} service is operating normally.`);
    }
    
    return recommendations;
  }

  private estimateRecoveryTime(level: string): string | undefined {
    switch (level) {
      case 'complete': return '15-30 minutes';
      case 'severe': return '5-15 minutes';
      case 'partial': return '2-5 minutes';
      default: return undefined;
    }
  }
}

// Export singleton instance
export const openaiErrorHandler = OpenAIErrorHandler.getInstance();