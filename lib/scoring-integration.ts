/**
 * Scoring Integration Module
 * 
 * This module provides integration between the scoring framework,
 * recommendation engine, and analysis pipeline for end-to-end
 * pitch evaluation and improvement recommendations.
 */

import { 
  FrameworkScore, 
  ComprehensiveFrameworkScore, 
  FRAMEWORK_POINTS 
} from './scoring-framework';
import { 
  MultimodalAnalysisInput,
  FrameworkScorer 
} from './scoring-logic';
import { 
  PromptTemplate,
  SPEECH_ANALYSIS_TEMPLATE,
  CONTENT_ANALYSIS_TEMPLATE 
} from './prompt-templates';
import { 
  normalizeFrameworkScore,
  ScoreComparison 
} from './score-normalization';
import { 
  RecommendationEngine,
  RecommendationSet,
  RecommendationContext,
  generatePitchRecommendations 
} from './recommendation-engine';

// Extended interfaces for integrated analysis
export interface AnalysisRequest {
  sessionId: string;
  multimodalInput: MultimodalAnalysisInput;
  options?: {
    includeRecommendations?: boolean;
    includeComparison?: boolean;
    includeGPTAnalysis?: boolean;
    benchmarkData?: {
      industryAverage?: number;
      topPerformerThreshold?: number;
    };
    userProfile?: {
      experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
      focusAreas?: string[];
    };
  };
}

export interface ComprehensiveAnalysisResult {
  sessionId: string;
  frameworkScore: ComprehensiveFrameworkScore;
  normalizedComparison?: ScoreComparison;
  recommendations?: RecommendationSet;
  gptAnalysis?: {
    speechAnalysis?: any;
    contentAnalysis?: any;
    visualAnalysis?: any;
  };
  processingMetadata: {
    analysisStartTime: Date;
    analysisEndTime: Date;
    totalProcessingTime: number;
    componentsProcessed: string[];
    errors?: string[];
  };
}

/**
 * Main Integration Service
 */
export class PitchAnalysisService {
  private recommendationEngine: RecommendationEngine;

  constructor() {
    this.recommendationEngine = new RecommendationEngine();
  }

  /**
   * Perform comprehensive analysis including scoring, normalization, and recommendations
   */
  async analyzeComprehensive(request: AnalysisRequest): Promise<ComprehensiveAnalysisResult> {
    const startTime = new Date();
    const componentsProcessed: string[] = [];
    const errors: string[] = [];

    try {
      // Step 1: Generate framework scores
      const frameworkScore = await this.generateFrameworkScore(request.multimodalInput, request.sessionId);
      componentsProcessed.push('framework_scoring');

      // Step 2: Generate normalized comparison if requested
      let normalizedComparison: ScoreComparison | undefined;
      if (request.options?.includeComparison) {
        normalizedComparison = normalizeFrameworkScore(frameworkScore);
        componentsProcessed.push('score_normalization');
      }

      // Step 3: Generate recommendations if requested
      let recommendations: RecommendationSet | undefined;
      if (request.options?.includeRecommendations) {
        recommendations = await generatePitchRecommendations(frameworkScore, {
          includeComparison: request.options.includeComparison,
          benchmarkData: request.options.benchmarkData,
          userProfile: request.options.userProfile
        });
        componentsProcessed.push('recommendation_generation');
      }

      // Step 4: Generate GPT analysis if requested
      let gptAnalysis: ComprehensiveAnalysisResult['gptAnalysis'];
      if (request.options?.includeGPTAnalysis) {
        gptAnalysis = await this.generateGPTAnalysis(request.multimodalInput);
        componentsProcessed.push('gpt_analysis');
      }

      const endTime = new Date();

      return {
        sessionId: request.sessionId,
        frameworkScore,
        normalizedComparison,
        recommendations,
        gptAnalysis,
        processingMetadata: {
          analysisStartTime: startTime,
          analysisEndTime: endTime,
          totalProcessingTime: endTime.getTime() - startTime.getTime(),
          componentsProcessed,
          errors: errors.length > 0 ? errors : undefined
        }
      };

    } catch (error) {
      errors.push(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Comprehensive analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate framework scores from multimodal input
   */
  async generateFrameworkScore(
    input: MultimodalAnalysisInput, 
    sessionId: string
  ): Promise<ComprehensiveFrameworkScore> {
    const startTime = Date.now();
    const individualScores: FrameworkScore[] = [];

    // Generate scores for each framework point
    for (const point of FRAMEWORK_POINTS) {
      try {
        let score: FrameworkScore;

        switch (point.id) {
          case 'speech_pace_rhythm':
            score = FrameworkScorer.scorePaceRhythm(input);
            break;
          case 'speech_volume_projection':
            score = FrameworkScorer.scoreVolumeProjection(input);
            break;
          case 'speech_clarity_articulation':
            score = FrameworkScorer.scoreClarityArticulation(input);
            break;
          case 'speech_filler_words':
            score = FrameworkScorer.scoreFillerWords(input);
            break;
          case 'speech_vocal_confidence':
            score = FrameworkScorer.scoreVocalConfidence(input);
            break;
          default:
            // For content, visual, and overall points that require GPT-4 analysis,
            // we'll provide placeholder scores. In a real implementation,
            // these would be generated through GPT-4 analysis.
            score = this.generatePlaceholderScore(point.id);
            break;
        }

        individualScores.push(score);
      } catch (error) {
        console.warn(`Failed to score ${point.id}:`, error);
        // Generate a fallback score
        individualScores.push(this.generateFallbackScore(point.id));
      }
    }

    // Calculate category scores
    const categoryScores = this.calculateCategoryScores(individualScores);

    // Calculate overall weighted score
    const overallScore = this.calculateOverallScore(categoryScores);

    return {
      sessionId,
      overallScore,
      categoryScores,
      individualScores,
      analysisTimestamp: new Date(),
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Generate GPT-4 analysis using prompt templates
   */
  async generateGPTAnalysis(input: MultimodalAnalysisInput): Promise<ComprehensiveAnalysisResult['gptAnalysis']> {
    // This is a placeholder for GPT-4 integration
    // In a real implementation, this would use the prompt templates
    // to generate detailed analysis via GPT-4 API calls
    
    return {
      speechAnalysis: {
        template: SPEECH_ANALYSIS_TEMPLATE.id,
        analysis: 'Placeholder GPT-4 speech analysis results',
        confidence: 0.8
      },
      contentAnalysis: {
        template: CONTENT_ANALYSIS_TEMPLATE.id,
        analysis: 'Placeholder GPT-4 content analysis results',
        confidence: 0.8
      }
    };
  }

  /**
   * Calculate category scores from individual scores
   */
  private calculateCategoryScores(individualScores: FrameworkScore[]): ComprehensiveFrameworkScore['categoryScores'] {
    const categories: { [key: string]: number } = { speech: 0, content: 0, visual: 0, overall: 0 };

    Object.keys(categories).forEach(category => {
      const categoryScores = individualScores
        .filter(score => score.pointId.startsWith(category))
        .map(score => score.score);
      
      if (categoryScores.length > 0) {
        categories[category] = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
      }
    });

    return {
      speech: categories.speech,
      content: categories.content,
      visual: categories.visual,
      overall: categories.overall
    };
  }

  /**
   * Calculate overall weighted score
   */
  private calculateOverallScore(categoryScores: ComprehensiveFrameworkScore['categoryScores']): number {
    const weights: { [key: string]: number } = { speech: 0.3, content: 0.4, visual: 0.2, overall: 0.1 };
    
    return Object.entries(categoryScores)
      .reduce((sum, [category, score]) => sum + (score * (weights[category] || 0)), 0);
  }

  /**
   * Generate placeholder score for points that require GPT-4
   */
  private generatePlaceholderScore(pointId: string): FrameworkScore {
    // Generate realistic placeholder scores
    const baseScore = 5 + Math.random() * 3; // 5-8 range
    
    return {
      pointId,
      score: Math.round(baseScore * 10) / 10,
      rationale: `Placeholder score for ${pointId}. In production, this would be generated via GPT-4 analysis.`,
      improvementSuggestions: [
        'This would contain GPT-4 generated suggestions',
        'Specific to the content analyzed'
      ],
      confidence: 0.5 // Lower confidence for placeholder
    };
  }

  /**
   * Generate fallback score for error cases
   */
  private generateFallbackScore(pointId: string): FrameworkScore {
    return {
      pointId,
      score: 5.0, // Neutral score
      rationale: `Fallback score due to analysis error for ${pointId}`,
      improvementSuggestions: ['Unable to generate specific suggestions due to analysis error'],
      confidence: 0.1 // Very low confidence
    };
  }
}

/**
 * Quick Analysis Functions
 */

/**
 * Quick scoring analysis without recommendations
 */
export async function quickFrameworkAnalysis(
  input: MultimodalAnalysisInput,
  sessionId: string
): Promise<ComprehensiveFrameworkScore> {
  const service = new PitchAnalysisService();
  return await service.generateFrameworkScore(input, sessionId);
}

/**
 * Quick analysis with recommendations
 */
export async function quickAnalysisWithRecommendations(
  input: MultimodalAnalysisInput,
  sessionId: string,
  benchmarkData?: { industryAverage?: number; topPerformerThreshold?: number }
): Promise<{ score: ComprehensiveFrameworkScore; recommendations: RecommendationSet }> {
  const service = new PitchAnalysisService();
  
  const score = await service.generateFrameworkScore(input, sessionId);
  const recommendations = await generatePitchRecommendations(score, {
    includeComparison: true,
    benchmarkData
  });

  return { score, recommendations };
}

/**
 * Batch analysis for multiple sessions
 */
export async function batchAnalysis(
  requests: Array<{ input: MultimodalAnalysisInput; sessionId: string }>,
  options?: {
    includeRecommendations?: boolean;
    includeComparison?: boolean;
    benchmarkData?: { industryAverage?: number; topPerformerThreshold?: number };
  }
): Promise<ComprehensiveAnalysisResult[]> {
  const service = new PitchAnalysisService();
  const results: ComprehensiveAnalysisResult[] = [];

  for (const request of requests) {
    try {
      const result = await service.analyzeComprehensive({
        sessionId: request.sessionId,
        multimodalInput: request.input,
        options: {
          includeRecommendations: options?.includeRecommendations ?? true,
          includeComparison: options?.includeComparison ?? true,
          benchmarkData: options?.benchmarkData
        }
      });
      results.push(result);
    } catch (error) {
      console.error(`Batch analysis failed for session ${request.sessionId}:`, error);
      // Continue with other analyses
    }
  }

  return results;
}

/**
 * Generate analysis summary report
 */
export function generateAnalysisSummary(result: ComprehensiveAnalysisResult): string {
  let summary = `Pitch Analysis Summary\n`;
  summary += `=====================\n\n`;
  summary += `Session: ${result.sessionId}\n`;
  summary += `Analysis Date: ${result.processingMetadata.analysisEndTime.toLocaleString()}\n`;
  summary += `Processing Time: ${result.processingMetadata.totalProcessingTime}ms\n`;
  summary += `Components: ${result.processingMetadata.componentsProcessed.join(', ')}\n\n`;

  // Framework Score Summary
  summary += `FRAMEWORK SCORE\n`;
  summary += `---------------\n`;
  summary += `Overall Score: ${result.frameworkScore.overallScore.toFixed(1)}/10\n\n`;
  
  summary += `Category Breakdown:\n`;
  Object.entries(result.frameworkScore.categoryScores).forEach(([category, score]) => {
    summary += `• ${category.charAt(0).toUpperCase() + category.slice(1)}: ${score.toFixed(1)}/10\n`;
  });

  // Top Strengths and Weaknesses
  const sortedScores = result.frameworkScore.individualScores
    .sort((a, b) => b.score - a.score);
  
  summary += `\nTop Strengths:\n`;
  sortedScores.slice(0, 3).forEach(score => {
    const point = FRAMEWORK_POINTS.find(p => p.id === score.pointId);
    summary += `• ${point?.title || score.pointId}: ${score.score.toFixed(1)}/10\n`;
  });

  summary += `\nTop Weaknesses:\n`;
  sortedScores.slice(-3).reverse().forEach(score => {
    const point = FRAMEWORK_POINTS.find(p => p.id === score.pointId);
    summary += `• ${point?.title || score.pointId}: ${score.score.toFixed(1)}/10\n`;
  });

  // Recommendations Summary
  if (result.recommendations) {
    summary += `\nRECOMMENDATIONS\n`;
    summary += `---------------\n`;
    summary += `Total Recommendations: ${result.recommendations.totalRecommendations}\n`;
    summary += `Critical Issues: ${result.recommendations.categorizedRecommendations.critical.length}\n`;
    summary += `High Priority: ${result.recommendations.categorizedRecommendations.high.length}\n`;
    summary += `Quick Wins: ${result.recommendations.quickWins.length}\n`;
    
    if (result.recommendations.quickWins.length > 0) {
      summary += `\nTop Quick Wins:\n`;
      result.recommendations.quickWins.slice(0, 3).forEach((rec, index) => {
        summary += `${index + 1}. ${rec.title}\n`;
      });
    }
  }

  // Normalized Comparison
  if (result.normalizedComparison) {
    summary += `\nCOMPARISON ANALYSIS\n`;
    summary += `-------------------\n`;
    if (result.normalizedComparison.percentileRank) {
      summary += `Percentile Rank: ${result.normalizedComparison.percentileRank.toFixed(1)}%\n`;
    }
    if (result.normalizedComparison.zScore) {
      summary += `Z-Score: ${result.normalizedComparison.zScore.toFixed(2)}\n`;
    }
  }

  // Errors
  if (result.processingMetadata.errors && result.processingMetadata.errors.length > 0) {
    summary += `\nERRORS\n`;
    summary += `------\n`;
    result.processingMetadata.errors.forEach(error => {
      summary += `• ${error}\n`;
    });
  }

  return summary;
}

/**
 * Export service instance for external use
 */
export const pitchAnalysisService = new PitchAnalysisService(); 