// OpenAI Cost Tracking Service
import { OpenAIUsageStore, OpenAIUsageRecord } from './openai-usage-store';
import { OpenAIModelManager } from './openai-model-manager';
import { generateRequestId } from './errors/handlers';

export interface CostTrackingOptions {
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  model: string;
  tokens: TokenUsage;
}

export class OpenAICostTracker {
  private static instance: OpenAICostTracker;

  /**
   * Get singleton instance
   */
  static getInstance(): OpenAICostTracker {
    if (!this.instance) {
      this.instance = new OpenAICostTracker();
    }
    return this.instance;
  }

  /**
   * Track a completed API call with cost calculation
   */
  async trackApiCall(
    endpoint: 'chat' | 'transcription' | 'vision' | 'embedding' | 'tts',
    model: string,
    operation: string,
    tokenUsage: TokenUsage,
    duration: number,
    success: boolean,
    requestId?: string,
    errorType?: string,
    options: CostTrackingOptions = {}
  ): Promise<OpenAIUsageRecord> {
    const finalRequestId = requestId || generateRequestId();
    
    try {
      // Get cost calculation from model manager
      const costCalculation = this.calculateCost(model, tokenUsage);
      
      // Create usage record
      const usageRecord = OpenAIUsageStore.recordUsage({
        timestamp: new Date(),
        endpoint,
        model,
        operation,
        requestId: finalRequestId,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        inputCost: costCalculation.inputCost,
        outputCost: costCalculation.outputCost,
        totalCost: costCalculation.totalCost,
        duration,
        success,
        errorType,
        metadata: {
          ...options.metadata,
          sessionId: options.sessionId,
          userId: options.userId
        }
      });

      return usageRecord;

    } catch (error) {
      console.error('[Cost Tracker] Error tracking API call:', error);
      
      // Create a minimal record even if cost calculation fails
      return OpenAIUsageStore.recordUsage({
        timestamp: new Date(),
        endpoint,
        model,
        operation,
        requestId: finalRequestId,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        duration,
        success: false,
        errorType: 'cost_tracking_error',
        metadata: {
          ...options.metadata,
          sessionId: options.sessionId,
          userId: options.userId,
          trackingError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Track OpenAI chat completion
   */
  async trackChatCompletion(
    model: string,
    inputTokens: number,
    outputTokens: number,
    duration: number,
    success: boolean,
    operation: string = 'chat_completion',
    requestId?: string,
    errorType?: string,
    options: CostTrackingOptions = {}
  ): Promise<OpenAIUsageRecord> {
    return this.trackApiCall(
      'chat',
      model,
      operation,
      {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      },
      duration,
      success,
      requestId,
      errorType,
      options
    );
  }

  /**
   * Track OpenAI transcription (Whisper)
   */
  async trackTranscription(
    model: string,
    audioDurationMinutes: number,
    outputTokens: number,
    duration: number,
    success: boolean,
    operation: string = 'transcription',
    requestId?: string,
    errorType?: string,
    options: CostTrackingOptions = {}
  ): Promise<OpenAIUsageRecord> {
    // For Whisper, pricing is per minute of audio, not input tokens
    return this.trackApiCall(
      'transcription',
      model,
      operation,
      {
        inputTokens: audioDurationMinutes, // Store minutes as "input tokens" for Whisper
        outputTokens,
        totalTokens: audioDurationMinutes + outputTokens
      },
      duration,
      success,
      requestId,
      errorType,
      {
        ...options,
        metadata: {
          ...options.metadata,
          audioDurationMinutes
        }
      }
    );
  }

  /**
   * Track OpenAI vision analysis
   */
  async trackVisionAnalysis(
    model: string,
    inputTokens: number,
    outputTokens: number,
    duration: number,
    success: boolean,
    imageCount: number = 1,
    operation: string = 'vision_analysis',
    requestId?: string,
    errorType?: string,
    options: CostTrackingOptions = {}
  ): Promise<OpenAIUsageRecord> {
    return this.trackApiCall(
      'vision',
      model,
      operation,
      {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      },
      duration,
      success,
      requestId,
      errorType,
      {
        ...options,
        metadata: {
          ...options.metadata,
          imageCount
        }
      }
    );
  }

  /**
   * Track OpenAI embedding generation
   */
  async trackEmbedding(
    model: string,
    inputTokens: number,
    duration: number,
    success: boolean,
    operation: string = 'embedding',
    requestId?: string,
    errorType?: string,
    options: CostTrackingOptions = {}
  ): Promise<OpenAIUsageRecord> {
    return this.trackApiCall(
      'embedding',
      model,
      operation,
      {
        inputTokens,
        outputTokens: 0, // Embeddings don't have output tokens
        totalTokens: inputTokens
      },
      duration,
      success,
      requestId,
      errorType,
      options
    );
  }

  /**
   * Calculate cost for a given model and token usage
   */
  private calculateCost(model: string, tokenUsage: TokenUsage): CostCalculation {
    const modelManager = OpenAIModelManager.getInstance();
    const modelInfo = modelManager.getModelInfo(model);

    if (!modelInfo) {
      console.warn(`[Cost Tracker] Model info not found for: ${model}`);
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        model,
        tokens: tokenUsage
      };
    }

    // Calculate input cost
    const inputCost = (modelInfo.costPerInputToken || 0) * tokenUsage.inputTokens;
    
    // Calculate output cost
    const outputCost = (modelInfo.costPerOutputToken || 0) * tokenUsage.outputTokens;
    
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      model,
      tokens: tokenUsage
    };
  }

  /**
   * Get current cost statistics
   */
  getCostStatistics() {
    return OpenAIUsageStore.getUsageStats();
  }

  /**
   * Get cost breakdown for a specific period
   */
  getCostBreakdown(days: number = 7) {
    return OpenAIUsageStore.getCostBreakdown(days);
  }

  /**
   * Get usage aggregation for a time period
   */
  getUsageAggregation(startDate: Date, endDate: Date) {
    return OpenAIUsageStore.getUsageAggregation(startDate, endDate);
  }

  /**
   * Estimate cost for a planned API call
   */
  estimateCost(
    model: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number = 0
  ): CostCalculation {
    const tokenUsage: TokenUsage = {
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      totalTokens: estimatedInputTokens + estimatedOutputTokens
    };

    return this.calculateCost(model, tokenUsage);
  }

  /**
   * Get total costs for current billing period (current month)
   */
  getCurrentMonthCosts(): {
    totalCost: number;
    totalTokens: number;
    totalRequests: number;
    byModel: Record<string, { cost: number; tokens: number; requests: number; }>;
    byEndpoint: Record<string, { cost: number; tokens: number; requests: number; }>;
  } {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const records = OpenAIUsageStore.getUsageRecords({
      startDate: startOfMonth,
      endDate: endOfMonth
    });

    const totalCost = records.reduce((sum, r) => sum + r.totalCost, 0);
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalRequests = records.length;

    // Group by model
    const byModel: Record<string, { cost: number; tokens: number; requests: number; }> = {};
    records.forEach(record => {
      if (!byModel[record.model]) {
        byModel[record.model] = { cost: 0, tokens: 0, requests: 0 };
      }
      byModel[record.model].cost += record.totalCost;
      byModel[record.model].tokens += record.totalTokens;
      byModel[record.model].requests++;
    });

    // Group by endpoint
    const byEndpoint: Record<string, { cost: number; tokens: number; requests: number; }> = {};
    records.forEach(record => {
      if (!byEndpoint[record.endpoint]) {
        byEndpoint[record.endpoint] = { cost: 0, tokens: 0, requests: 0 };
      }
      byEndpoint[record.endpoint].cost += record.totalCost;
      byEndpoint[record.endpoint].tokens += record.totalTokens;
      byEndpoint[record.endpoint].requests++;
    });

    return {
      totalCost,
      totalTokens,
      totalRequests,
      byModel,
      byEndpoint
    };
  }

  /**
   * Set up cost alerts (placeholder for future implementation)
   */
  setupCostAlerts(thresholds: {
    dailyLimit?: number;
    monthlyLimit?: number;
    perRequestLimit?: number;
  }) {
    // TODO: Implement cost alert system
    console.log('[Cost Tracker] Cost alerts configured:', thresholds);
    return thresholds;
  }

  /**
   * Export cost data for analysis
   */
  exportCostData(startDate?: Date, endDate?: Date) {
    return OpenAIUsageStore.getUsageRecords({
      startDate,
      endDate
    });
  }
}

// Singleton instance
export const costTracker = OpenAICostTracker.getInstance(); 