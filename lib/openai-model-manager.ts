import { OPENAI_CONFIG } from './openai-config';
import { ModelDeprecatedError, ModelNotFoundError } from './openai-errors';
import { generateRequestId } from './errors/handlers';

export interface ModelInfo {
  id: string;
  name: string;
  type: 'vision' | 'transcription' | 'chat' | 'embedding';
  status: 'active' | 'deprecated' | 'unavailable';
  deprecatedSince?: Date;
  replacementModel?: string;
  maxTokens?: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

export interface ModelFallbackConfig {
  primary: string;
  fallbacks: string[];
  maxFallbackAttempts: number;
}

export interface ModelPerformanceMetrics {
  modelId: string;
  successRate: number;
  averageLatency: number;
  errorCount: number;
  lastUsed: Date;
  totalRequests: number;
}

export class OpenAIModelManager {
  private static instance: OpenAIModelManager;
  private modelRegistry: Map<string, ModelInfo> = new Map();
  private fallbackConfigs: Map<string, ModelFallbackConfig> = new Map();
  private performanceMetrics: Map<string, ModelPerformanceMetrics> = new Map();
  private deprecatedModels: Set<string> = new Set();

  private constructor() {
    this.initializeModelRegistry();
    this.setupFallbackConfigs();
  }

  static getInstance(): OpenAIModelManager {
    if (!OpenAIModelManager.instance) {
      OpenAIModelManager.instance = new OpenAIModelManager();
    }
    return OpenAIModelManager.instance;
  }

  /**
   * Initialize the model registry with known OpenAI models
   */
  private initializeModelRegistry(): void {
    // Vision models
    this.modelRegistry.set('gpt-4o', {
      id: 'gpt-4o',
      name: 'GPT-4 Omni',
      type: 'vision',
      status: 'active',
      maxTokens: 4096,
      costPerInputToken: 0.005 / 1000,
      costPerOutputToken: 0.015 / 1000
    });

    this.modelRegistry.set('gpt-4-vision-preview', {
      id: 'gpt-4-vision-preview',
      name: 'GPT-4 Vision Preview',
      type: 'vision',
      status: 'deprecated',
      deprecatedSince: new Date('2024-04-09'),
      replacementModel: 'gpt-4o',
      maxTokens: 4096
    });

    this.modelRegistry.set('gpt-4-turbo', {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      type: 'vision',
      status: 'active',
      maxTokens: 4096,
      costPerInputToken: 0.01 / 1000,
      costPerOutputToken: 0.03 / 1000
    });

    // Transcription models
    this.modelRegistry.set('whisper-1', {
      id: 'whisper-1',
      name: 'Whisper',
      type: 'transcription',
      status: 'active',
      costPerInputToken: 0.006 / 60 // per minute
    });

    // Chat models
    this.modelRegistry.set('gpt-4-turbo-preview', {
      id: 'gpt-4-turbo-preview',
      name: 'GPT-4 Turbo Preview',
      type: 'chat',
      status: 'active',
      maxTokens: 4096,
      costPerInputToken: 0.01 / 1000,
      costPerOutputToken: 0.03 / 1000
    });

    this.modelRegistry.set('gpt-3.5-turbo', {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      type: 'chat',
      status: 'active',
      maxTokens: 4096,
      costPerInputToken: 0.0015 / 1000,
      costPerOutputToken: 0.002 / 1000
    });

    // Embedding models
    this.modelRegistry.set('text-embedding-3-small', {
      id: 'text-embedding-3-small',
      name: 'Text Embedding 3 Small',
      type: 'embedding',
      status: 'active',
      costPerInputToken: 0.00002 / 1000
    });

    // Mark deprecated models
    this.deprecatedModels.add('gpt-4-vision-preview');
  }

  /**
   * Setup fallback configurations for different model types
   */
  private setupFallbackConfigs(): void {
    // Vision model fallbacks
    this.fallbackConfigs.set('vision', {
      primary: OPENAI_CONFIG.MODELS.VISION,
      fallbacks: ['gpt-4-turbo', 'gpt-4o'],
      maxFallbackAttempts: 2
    });

    // Chat model fallbacks
    this.fallbackConfigs.set('chat', {
      primary: OPENAI_CONFIG.MODELS.CHAT,
      fallbacks: ['gpt-4-turbo', 'gpt-3.5-turbo'],
      maxFallbackAttempts: 2
    });

    // Transcription model fallbacks
    this.fallbackConfigs.set('transcription', {
      primary: OPENAI_CONFIG.MODELS.TRANSCRIPTION,
      fallbacks: ['whisper-1'],
      maxFallbackAttempts: 1
    });

    // Embedding model fallbacks
    this.fallbackConfigs.set('embedding', {
      primary: OPENAI_CONFIG.MODELS.EMBEDDING,
      fallbacks: ['text-embedding-3-small'],
      maxFallbackAttempts: 1
    });
  }

  /**
   * Get the current active model for a specific type
   */
  getActiveModel(type: 'vision' | 'transcription' | 'chat' | 'embedding'): string {
    const config = this.fallbackConfigs.get(type);
    if (!config) {
      throw new Error(`No fallback configuration found for model type: ${type}`);
    }

    const primaryModel = this.modelRegistry.get(config.primary);
    if (primaryModel && primaryModel.status === 'active') {
      return config.primary;
    }

    // Find first active fallback
    for (const fallbackModel of config.fallbacks) {
      const model = this.modelRegistry.get(fallbackModel);
      if (model && model.status === 'active') {
        return fallbackModel;
      }
    }

    throw new ModelNotFoundError(
      `No active models available for type: ${type}`,
      { type, primaryModel: config.primary, fallbacks: config.fallbacks }
    );
  }

  /**
   * Validate and potentially replace a deprecated model
   */
  validateAndReplaceModel(modelId: string, requestId?: string): string {
    const model = this.modelRegistry.get(modelId);
    
    if (!model) {
      throw new ModelNotFoundError(
        `Model not found: ${modelId}`,
        { model: modelId },
        requestId
      );
    }

    if (model.status === 'deprecated') {
      const replacement = model.replacementModel || this.getActiveModel(model.type);
      console.warn(`[Model Manager] Deprecated model detected: ${modelId}, using replacement: ${replacement}`);
      
      throw new ModelDeprecatedError(
        `Model ${modelId} is deprecated since ${model.deprecatedSince?.toISOString()}`,
        { 
          model: modelId, 
          replacementModel: replacement,
          deprecatedSince: model.deprecatedSince 
        },
        requestId
      );
    }

    if (model.status === 'unavailable') {
      const fallback = this.getActiveModel(model.type);
      throw new ModelNotFoundError(
        `Model ${modelId} is currently unavailable`,
        { model: modelId, fallbackModel: fallback },
        requestId
      );
    }

    return modelId;
  }

  /**
   * Get the next fallback model for a failed request
   */
  getNextFallbackModel(originalModel: string, attemptCount: number): string | null {
    // Find the model type
    const originalModelInfo = this.modelRegistry.get(originalModel);
    if (!originalModelInfo) {
      return null;
    }

    const config = this.fallbackConfigs.get(originalModelInfo.type);
    if (!config || attemptCount >= config.maxFallbackAttempts) {
      return null;
    }

    const fallbacks = config.fallbacks.filter(model => {
      const modelInfo = this.modelRegistry.get(model);
      return modelInfo && modelInfo.status === 'active' && model !== originalModel;
    });

    return fallbacks[attemptCount] || null;
  }

  /**
   * Record model performance metrics
   */
  recordModelUsage(modelId: string, success: boolean, latency: number): void {
    const existing = this.performanceMetrics.get(modelId) || {
      modelId,
      successRate: 0,
      averageLatency: 0,
      errorCount: 0,
      lastUsed: new Date(),
      totalRequests: 0
    };

    existing.totalRequests++;
    existing.lastUsed = new Date();
    
    if (success) {
      // Update success rate using weighted average
      const successCount = Math.round(existing.successRate * (existing.totalRequests - 1));
      existing.successRate = (successCount + 1) / existing.totalRequests;
      
      // Update average latency
      existing.averageLatency = 
        (existing.averageLatency * (existing.totalRequests - 1) + latency) / existing.totalRequests;
    } else {
      existing.errorCount++;
      const successCount = Math.round(existing.successRate * (existing.totalRequests - 1));
      existing.successRate = successCount / existing.totalRequests;
    }

    this.performanceMetrics.set(modelId, existing);
  }

  /**
   * Get model information
   */
  getModelInfo(modelId: string): ModelInfo | null {
    return this.modelRegistry.get(modelId) || null;
  }

  /**
   * Get all models of a specific type
   */
  getModelsByType(type: ModelInfo['type']): ModelInfo[] {
    return Array.from(this.modelRegistry.values()).filter(model => model.type === type);
  }

  /**
   * Check if a model is deprecated
   */
  isModelDeprecated(modelId: string): boolean {
    return this.deprecatedModels.has(modelId);
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics(modelId: string): ModelPerformanceMetrics | null {
    return this.performanceMetrics.get(modelId) || null;
  }

  /**
   * Get system health report for models
   */
  getModelHealthReport(): {
    activeModels: { [type: string]: string[] };
    deprecatedModels: string[];
    performanceIssues: { modelId: string; issue: string }[];
    recommendations: string[];
  } {
    const activeModels: { [type: string]: string[] } = {};
    const deprecatedModels: string[] = [];
    const performanceIssues: { modelId: string; issue: string }[] = [];
    const recommendations: string[] = [];

    // Categorize models by type and status
    for (const [modelId, model] of this.modelRegistry.entries()) {
      if (model.status === 'active') {
        if (!activeModels[model.type]) {
          activeModels[model.type] = [];
        }
        activeModels[model.type].push(modelId);
      } else if (model.status === 'deprecated') {
        deprecatedModels.push(modelId);
      }

      // Check performance metrics
      const metrics = this.performanceMetrics.get(modelId);
      if (metrics) {
        if (metrics.successRate < 0.95) {
          performanceIssues.push({
            modelId,
            issue: `Low success rate: ${(metrics.successRate * 100).toFixed(1)}%`
          });
        }
        if (metrics.averageLatency > 10000) {
          performanceIssues.push({
            modelId,
            issue: `High latency: ${metrics.averageLatency.toFixed(0)}ms`
          });
        }
      }
    }

    // Generate recommendations
    if (deprecatedModels.length > 0) {
      recommendations.push(`Update deprecated models: ${deprecatedModels.join(', ')}`);
    }
    if (performanceIssues.length > 0) {
      recommendations.push('Consider switching to better performing models for critical operations');
    }

    return {
      activeModels,
      deprecatedModels,
      performanceIssues,
      recommendations
    };
  }

  /**
   * Update model status (for dynamic updates)
   */
  updateModelStatus(modelId: string, status: ModelInfo['status'], replacementModel?: string): void {
    const model = this.modelRegistry.get(modelId);
    if (model) {
      model.status = status;
      if (status === 'deprecated' && replacementModel) {
        model.replacementModel = replacementModel;
        model.deprecatedSince = new Date();
        this.deprecatedModels.add(modelId);
      }
      this.modelRegistry.set(modelId, model);
    }
  }
}

// Export singleton instance
export const modelManager = OpenAIModelManager.getInstance(); 