// OpenAI API usage tracking and storage system
export interface OpenAIUsageRecord {
  id: string;
  timestamp: Date;
  endpoint: 'chat' | 'transcription' | 'vision' | 'embedding' | 'tts';
  model: string;
  operation: string;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  duration: number; // milliseconds
  success: boolean;
  errorType?: string;
  metadata?: {
    fileSize?: number;
    contentType?: string;
    sessionId?: string;
    userId?: string;
    [key: string]: unknown;
  };
}

export interface UsageAggregation {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  successRate: number;
  averageDuration: number;
  byModel: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
    successRate: number;
  }>;
  byEndpoint: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
    successRate: number;
  }>;
  byHour: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

export interface UsageStats {
  totalRecords: number;
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  successRate: number;
  averageCostPerRequest: number;
  averageTokensPerRequest: number;
  oldestRecord?: Date;
  newestRecord?: Date;
  byEndpoint: Record<string, number>;
  byModel: Record<string, number>;
  last24Hours: {
    cost: number;
    requests: number;
    tokens: number;
  };
  last7Days: {
    cost: number;
    requests: number;
    tokens: number;
  };
}

// In-memory store for usage records (production should use Redis/database)
const usageRegistry = new Map<string, OpenAIUsageRecord>();

export class OpenAIUsageStore {
  
  /**
   * Record a new API usage event
   */
  static recordUsage(record: Omit<OpenAIUsageRecord, 'id'>): OpenAIUsageRecord {
    const usageRecord: OpenAIUsageRecord = {
      id: this.generateUsageId(),
      ...record
    };

    usageRegistry.set(usageRecord.id, usageRecord);
    
    // Cleanup old records if we have too many (keep last 10,000)
    if (usageRegistry.size > 10000) {
      this.cleanupOldRecords();
    }

    return usageRecord;
  }

  /**
   * Get usage records with optional filtering
   */
  static getUsageRecords(options: {
    startDate?: Date;
    endDate?: Date;
    endpoint?: string;
    model?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  } = {}): OpenAIUsageRecord[] {
    let records = Array.from(usageRegistry.values());

    // Apply filters
    if (options.startDate) {
      records = records.filter(record => record.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      records = records.filter(record => record.timestamp <= options.endDate!);
    }
    if (options.endpoint) {
      records = records.filter(record => record.endpoint === options.endpoint);
    }
    if (options.model) {
      records = records.filter(record => record.model === options.model);
    }
    if (options.success !== undefined) {
      records = records.filter(record => record.success === options.success);
    }

    // Sort by timestamp (newest first)
    records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 1000;
    return records.slice(offset, offset + limit);
  }

  /**
   * Get aggregated usage statistics
   */
  static getUsageStats(): UsageStats {
    const records = Array.from(usageRegistry.values());
    
    if (records.length === 0) {
      return {
        totalRecords: 0,
        totalCost: 0,
        totalTokens: 0,
        totalRequests: 0,
        successRate: 0,
        averageCostPerRequest: 0,
        averageTokensPerRequest: 0,
        byEndpoint: {},
        byModel: {},
        last24Hours: { cost: 0, requests: 0, tokens: 0 },
        last7Days: { cost: 0, requests: 0, tokens: 0 }
      };
    }

    const totalCost = records.reduce((sum, record) => sum + record.totalCost, 0);
    const totalTokens = records.reduce((sum, record) => sum + record.totalTokens, 0);
    const successfulRequests = records.filter(record => record.success).length;
    
    // Calculate time-based stats
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recent24h = records.filter(record => record.timestamp >= last24Hours);
    const recent7d = records.filter(record => record.timestamp >= last7Days);

    // Group by endpoint and model
    const byEndpoint: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    
    records.forEach(record => {
      byEndpoint[record.endpoint] = (byEndpoint[record.endpoint] || 0) + 1;
      byModel[record.model] = (byModel[record.model] || 0) + 1;
    });

    // Find oldest and newest records
    const timestamps = records.map(r => r.timestamp);
    const oldestRecord = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const newestRecord = new Date(Math.max(...timestamps.map(t => t.getTime())));

    return {
      totalRecords: records.length,
      totalCost,
      totalTokens,
      totalRequests: records.length,
      successRate: records.length > 0 ? successfulRequests / records.length : 0,
      averageCostPerRequest: records.length > 0 ? totalCost / records.length : 0,
      averageTokensPerRequest: records.length > 0 ? totalTokens / records.length : 0,
      oldestRecord,
      newestRecord,
      byEndpoint,
      byModel,
      last24Hours: {
        cost: recent24h.reduce((sum, r) => sum + r.totalCost, 0),
        requests: recent24h.length,
        tokens: recent24h.reduce((sum, r) => sum + r.totalTokens, 0)
      },
      last7Days: {
        cost: recent7d.reduce((sum, r) => sum + r.totalCost, 0),
        requests: recent7d.length,
        tokens: recent7d.reduce((sum, r) => sum + r.totalTokens, 0)
      }
    };
  }

  /**
   * Get usage aggregation for a specific time period
   */
  static getUsageAggregation(
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' | 'model' | 'endpoint' = 'hour'
  ): UsageAggregation {
    const records = this.getUsageRecords({ startDate, endDate });
    
    if (records.length === 0) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        successRate: 0,
        averageDuration: 0,
        byModel: {},
        byEndpoint: {},
        byHour: {}
      };
    }

    const totalRequests = records.length;
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalCost = records.reduce((sum, r) => sum + r.totalCost, 0);
    const successfulRequests = records.filter(r => r.success).length;
    const averageDuration = records.reduce((sum, r) => sum + r.duration, 0) / totalRequests;

    // Group by model
    const byModel: Record<string, { requests: number; tokens: number; cost: number; successRate: number; }> = {};
    records.forEach(record => {
      if (!byModel[record.model]) {
        byModel[record.model] = { requests: 0, tokens: 0, cost: 0, successRate: 0 };
      }
      byModel[record.model].requests++;
      byModel[record.model].tokens += record.totalTokens;
      byModel[record.model].cost += record.totalCost;
    });

    // Calculate success rates for models
    Object.keys(byModel).forEach(model => {
      const modelRecords = records.filter(r => r.model === model);
      const successful = modelRecords.filter(r => r.success).length;
      byModel[model].successRate = successful / modelRecords.length;
    });

    // Group by endpoint
    const byEndpoint: Record<string, { requests: number; tokens: number; cost: number; successRate: number; }> = {};
    records.forEach(record => {
      if (!byEndpoint[record.endpoint]) {
        byEndpoint[record.endpoint] = { requests: 0, tokens: 0, cost: 0, successRate: 0 };
      }
      byEndpoint[record.endpoint].requests++;
      byEndpoint[record.endpoint].tokens += record.totalTokens;
      byEndpoint[record.endpoint].cost += record.totalCost;
    });

    // Calculate success rates for endpoints
    Object.keys(byEndpoint).forEach(endpoint => {
      const endpointRecords = records.filter(r => r.endpoint === endpoint);
      const successful = endpointRecords.filter(r => r.success).length;
      byEndpoint[endpoint].successRate = successful / endpointRecords.length;
    });

    // Group by hour
    const byHour: Record<string, { requests: number; tokens: number; cost: number; }> = {};
    records.forEach(record => {
      const hourKey = record.timestamp.toISOString().slice(0, 13) + ':00:00';
      if (!byHour[hourKey]) {
        byHour[hourKey] = { requests: 0, tokens: 0, cost: 0 };
      }
      byHour[hourKey].requests++;
      byHour[hourKey].tokens += record.totalTokens;
      byHour[hourKey].cost += record.totalCost;
    });

    return {
      totalRequests,
      totalTokens,
      totalCost,
      successRate: successfulRequests / totalRequests,
      averageDuration,
      byModel,
      byEndpoint,
      byHour
    };
  }

  /**
   * Get cost breakdown for dashboard
   */
  static getCostBreakdown(days: number = 7): {
    total: number;
    byModel: Array<{ model: string; cost: number; percentage: number; }>;
    byEndpoint: Array<{ endpoint: string; cost: number; percentage: number; }>;
    daily: Array<{ date: string; cost: number; requests: number; }>;
  } {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const records = this.getUsageRecords({ startDate });
    
    const totalCost = records.reduce((sum, r) => sum + r.totalCost, 0);
    
    // By model
    const modelCosts: Record<string, number> = {};
    records.forEach(record => {
      modelCosts[record.model] = (modelCosts[record.model] || 0) + record.totalCost;
    });
    
    const byModel = Object.entries(modelCosts).map(([model, cost]) => ({
      model,
      cost,
      percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0
    })).sort((a, b) => b.cost - a.cost);

    // By endpoint
    const endpointCosts: Record<string, number> = {};
    records.forEach(record => {
      endpointCosts[record.endpoint] = (endpointCosts[record.endpoint] || 0) + record.totalCost;
    });
    
    const byEndpoint = Object.entries(endpointCosts).map(([endpoint, cost]) => ({
      endpoint,
      cost,
      percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0
    })).sort((a, b) => b.cost - a.cost);

    // Daily breakdown
    const dailyCosts: Record<string, { cost: number; requests: number; }> = {};
    records.forEach(record => {
      const dateKey = record.timestamp.toISOString().slice(0, 10);
      if (!dailyCosts[dateKey]) {
        dailyCosts[dateKey] = { cost: 0, requests: 0 };
      }
      dailyCosts[dateKey].cost += record.totalCost;
      dailyCosts[dateKey].requests++;
    });
    
    const daily = Object.entries(dailyCosts).map(([date, data]) => ({
      date,
      cost: data.cost,
      requests: data.requests
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      total: totalCost,
      byModel,
      byEndpoint,
      daily
    };
  }

  /**
   * Clear all usage records (for testing or reset)
   */
  static clearAll(): number {
    const count = usageRegistry.size;
    usageRegistry.clear();
    return count;
  }

  /**
   * Generate unique usage ID
   */
  private static generateUsageId(): string {
    return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old records to prevent memory bloat
   */
  private static cleanupOldRecords(): void {
    const records = Array.from(usageRegistry.entries());
    
    // Sort by timestamp and keep only the newest 8000 records
    records.sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime());
    
    // Clear the registry
    usageRegistry.clear();
    
    // Add back the newest records
    records.slice(0, 8000).forEach(([id, record]) => {
      usageRegistry.set(id, record);
    });
  }

  /**
   * Export usage data for backup or analysis
   */
  static exportUsageData(): OpenAIUsageRecord[] {
    return Array.from(usageRegistry.values());
  }

  /**
   * Import usage data from backup
   */
  static importUsageData(records: OpenAIUsageRecord[]): number {
    records.forEach(record => {
      usageRegistry.set(record.id, record);
    });
    return records.length;
  }
} 