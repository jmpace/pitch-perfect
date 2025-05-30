/**
 * Priority Ranking Methodology for PitchPerfect
 * 
 * This module provides sophisticated algorithms to rank pitches by priority using
 * normalized scores, weighted criteria, and intelligent tie-breaking rules.
 * Designed for decision-makers to quickly identify top performers and investment opportunities.
 */

import { 
  ComprehensiveFrameworkScore, 
  FrameworkScore 
} from './scoring-framework';
import { 
  ScoreComparison, 
  NormalizedScore,
  ScoreNormalizer
} from './score-normalization';
import { 
  RecommendationSet, 
  Recommendation,
  RecommendationPriority 
} from './recommendation-engine';
import { INDIVIDUAL_POINT_WEIGHTS } from './framework-weights';

// Core ranking interfaces
export interface PitchRankingEntry {
  sessionId: string;
  pitchName?: string;
  overallScore: number;
  categoryScores: {
    speech: number;
    content: number;
    visual: number;
    overall: number;
  };
  normalizedScore: number; // 0-100 scale
  percentileRank?: number;
  zScore?: number;
  recommendationSummary?: {
    criticalIssues: number;
    highImpactImprovements: number;
    quickWins: number;
    overallPriority: RecommendationPriority;
  };
  investmentReadiness?: InvestmentReadinessScore;
  competitiveAdvantage?: CompetitiveAdvantageScore;
  riskFactors?: RiskFactor[];
  timestamp: Date;
}

export interface InvestmentReadinessScore {
  score: number; // 0-100
  level: 'not-ready' | 'early-stage' | 'ready' | 'highly-ready';
  keyFactors: {
    marketOpportunity: number;
    productViability: number;
    teamStrength: number;
    financialProjections: number;
    traction: number;
  };
  readinessBarriers: string[];
  accelerators: string[];
}

export interface CompetitiveAdvantageScore {
  score: number; // 0-100
  level: 'weak' | 'moderate' | 'strong' | 'exceptional';
  advantages: string[];
  differentiators: string[];
  moatStrength: number; // 0-100
  marketPosition: 'follower' | 'contender' | 'leader' | 'pioneer';
}

export interface RiskFactor {
  category: 'market' | 'product' | 'team' | 'financial' | 'operational' | 'competitive';
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: number; // 0-100
  likelihood: number; // 0-100
  mitigation?: string;
}

export interface RankingCriteria {
  primaryWeight: number; // Weight for overall score (default: 0.6)
  categoryWeights: {
    speech: number;
    content: number;
    visual: number;
    overall: number;
  };
  modifiers: {
    investmentReadinessWeight: number; // default: 0.2
    competitiveAdvantageWeight: number; // default: 0.1
    riskPenaltyWeight: number; // default: 0.1
  };
  tieBreakingRules: TieBreakingRule[];
  filters?: RankingFilter[];
}

export interface TieBreakingRule {
  order: number;
  criterion: 'content_score' | 'investment_readiness' | 'competitive_advantage' | 
            'risk_score' | 'recent_performance' | 'quick_wins' | 'critical_issues';
  direction: 'ascending' | 'descending';
  weight: number;
}

export interface RankingFilter {
  type: 'minimum_score' | 'investment_stage' | 'risk_level' | 'category_threshold';
  value: any;
  inclusive: boolean;
}

export interface RankedPitchList {
  rankings: PitchRankingEntry[];
  metadata: {
    totalPitches: number;
    rankingCriteria: RankingCriteria;
    generatedAt: Date;
    topPerformers: PitchRankingEntry[]; // Top 3-5 pitches
    riskyCandidates: PitchRankingEntry[]; // High-risk pitches
    quickWins: PitchRankingEntry[]; // High potential, low complexity
    distributionStats: {
      scoreDistribution: { min: number; max: number; mean: number; std: number; };
      categoryDistribution: Record<string, { min: number; max: number; mean: number; }>;
    };
  };
  insights: {
    recommendedFocus: string[];
    marketTrends: string[];
    portfolioBalance: string[];
    nextSteps: string[];
  };
}

/**
 * Default ranking criteria optimized for investment decision-making
 */
export const DEFAULT_RANKING_CRITERIA: RankingCriteria = {
  primaryWeight: 0.6,
  categoryWeights: {
    speech: 0.25, // Important for founder assessment
    content: 0.45, // Most critical for investment decisions
    visual: 0.20, // Professional presentation matters
    overall: 0.10  // Tie-breaker category
  },
  modifiers: {
    investmentReadinessWeight: 0.25,
    competitiveAdvantageWeight: 0.10,
    riskPenaltyWeight: 0.05
  },
  tieBreakingRules: [
    { order: 1, criterion: 'content_score', direction: 'descending', weight: 0.4 },
    { order: 2, criterion: 'investment_readiness', direction: 'descending', weight: 0.3 },
    { order: 3, criterion: 'competitive_advantage', direction: 'descending', weight: 0.2 },
    { order: 4, criterion: 'risk_score', direction: 'ascending', weight: 0.1 }
  ]
};

/**
 * Main Priority Ranking Engine
 */
export class PriorityRankingEngine {
  private scoreNormalizer: ScoreNormalizer;
  private rankingHistory: Map<string, PitchRankingEntry[]> = new Map();

  constructor(historicalData?: any[]) {
    this.scoreNormalizer = new ScoreNormalizer(historicalData);
  }

  /**
   * Generate comprehensive ranking for multiple pitches
   */
  async rankPitches(
    pitches: Array<{
      frameworkScore: ComprehensiveFrameworkScore;
      recommendations?: RecommendationSet;
      normalizedComparison?: ScoreComparison;
      pitchName?: string;
    }>,
    criteria: RankingCriteria = DEFAULT_RANKING_CRITERIA
  ): Promise<RankedPitchList> {
    
    // Step 1: Create ranking entries with all scoring data
    const rankingEntries: PitchRankingEntry[] = await Promise.all(
      pitches.map(pitch => this.createRankingEntry(pitch, criteria))
    );

    // Step 2: Calculate composite rankings
    const rankedEntries = this.calculateCompositeRankings(rankingEntries, criteria);

    // Step 3: Apply filters if specified
    const filteredEntries = this.applyFilters(rankedEntries, criteria.filters);

    // Step 4: Sort by composite score with tie-breaking
    const sortedEntries = this.sortWithTieBreaking(filteredEntries, criteria);

    // Step 5: Generate insights and metadata
    const metadata = this.generateRankingMetadata(sortedEntries, criteria);
    const insights = await this.generateRankingInsights(sortedEntries, criteria);

    return {
      rankings: sortedEntries,
      metadata,
      insights
    };
  }

  /**
   * Create a comprehensive ranking entry for a single pitch
   */
  private async createRankingEntry(
    pitch: {
      frameworkScore: ComprehensiveFrameworkScore;
      recommendations?: RecommendationSet;
      normalizedComparison?: ScoreComparison;
      pitchName?: string;
    },
    criteria: RankingCriteria
  ): Promise<PitchRankingEntry> {
    
    const { frameworkScore, recommendations, normalizedComparison, pitchName } = pitch;

    // Extract recommendation summary
    const recommendationSummary = recommendations ? {
      criticalIssues: recommendations.categorizedRecommendations.critical.length,
      highImpactImprovements: recommendations.categorizedRecommendations.high.length,
      quickWins: recommendations.quickWins.length,
      overallPriority: this.determineOverallRecommendationPriority(recommendations)
    } : undefined;

    // Calculate investment readiness
    const investmentReadiness = this.calculateInvestmentReadiness(frameworkScore, recommendations);

    // Calculate competitive advantage
    const competitiveAdvantage = this.calculateCompetitiveAdvantage(frameworkScore, recommendations);

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(frameworkScore, recommendations);

    return {
      sessionId: frameworkScore.sessionId,
      pitchName,
      overallScore: frameworkScore.overallScore,
      categoryScores: frameworkScore.categoryScores,
      normalizedScore: this.calculateNormalizedScore(frameworkScore),
      percentileRank: normalizedComparison?.percentileRank,
      zScore: normalizedComparison?.zScore,
      recommendationSummary,
      investmentReadiness,
      competitiveAdvantage,
      riskFactors,
      timestamp: new Date()
    };
  }

  /**
   * Calculate composite ranking scores incorporating all factors
   */
  private calculateCompositeRankings(
    entries: PitchRankingEntry[],
    criteria: RankingCriteria
  ): Array<PitchRankingEntry & { compositeScore: number; scoreBreakdown: any }> {
    
    return entries.map(entry => {
      // Base score from normalized framework score
      const baseScore = entry.normalizedScore * criteria.primaryWeight;

      // Investment readiness modifier
      const investmentModifier = (entry.investmentReadiness?.score || 0) * 
                                criteria.modifiers.investmentReadinessWeight;

      // Competitive advantage modifier
      const competitiveModifier = (entry.competitiveAdvantage?.score || 0) * 
                                 criteria.modifiers.competitiveAdvantageWeight;

      // Risk penalty (subtract from score)
      const riskPenalty = this.calculateRiskPenalty(entry.riskFactors || []) * 
                         criteria.modifiers.riskPenaltyWeight;

      // Calculate composite score
      const compositeScore = Math.max(0, Math.min(100, 
        baseScore + investmentModifier + competitiveModifier - riskPenalty
      ));

      const scoreBreakdown = {
        baseScore,
        investmentModifier,
        competitiveModifier,
        riskPenalty,
        finalScore: compositeScore
      };

      return {
        ...entry,
        compositeScore,
        scoreBreakdown
      };
    });
  }

  /**
   * Apply filtering criteria to ranking entries
   */
  private applyFilters(
    entries: Array<PitchRankingEntry & { compositeScore: number }>,
    filters?: RankingFilter[]
  ): Array<PitchRankingEntry & { compositeScore: number }> {
    
    if (!filters || filters.length === 0) return entries;

    return entries.filter(entry => {
      return filters.every(filter => {
        switch (filter.type) {
          case 'minimum_score':
            return filter.inclusive ? 
              entry.compositeScore >= filter.value : 
              entry.compositeScore > filter.value;
          
          case 'investment_stage':
            return entry.investmentReadiness?.level === filter.value;
          
          case 'risk_level':
            const maxRisk = Math.max(...(entry.riskFactors?.map(r => r.impact * r.likelihood) || [0]));
            return filter.inclusive ? maxRisk <= filter.value : maxRisk < filter.value;
          
          case 'category_threshold':
            const categoryScore = entry.categoryScores[filter.value.category as keyof typeof entry.categoryScores];
            return filter.inclusive ? 
              categoryScore >= filter.value.threshold : 
              categoryScore > filter.value.threshold;
          
          default:
            return true;
        }
      });
    });
  }

  /**
   * Sort entries by composite score with intelligent tie-breaking
   */
  private sortWithTieBreaking(
    entries: Array<PitchRankingEntry & { compositeScore: number }>,
    criteria: RankingCriteria
  ): Array<PitchRankingEntry & { compositeScore: number; finalRank: number }> {
    
    const sorted = [...entries].sort((a, b) => {
      // Primary sort by composite score
      if (Math.abs(a.compositeScore - b.compositeScore) > 0.1) {
        return b.compositeScore - a.compositeScore;
      }

      // Tie-breaking using defined rules
      for (const rule of criteria.tieBreakingRules) {
        const valueA = this.getTieBreakingValue(a, rule.criterion);
        const valueB = this.getTieBreakingValue(b, rule.criterion);

        if (Math.abs(valueA - valueB) > 0.01) {
          return rule.direction === 'descending' ? 
            (valueB - valueA) * rule.weight : 
            (valueA - valueB) * rule.weight;
        }
      }

      // Final fallback: timestamp (newer pitches win)
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    // Assign final ranks
    return sorted.map((entry, index) => ({
      ...entry,
      finalRank: index + 1
    }));
  }

  /**
   * Get value for tie-breaking criterion
   */
  private getTieBreakingValue(entry: PitchRankingEntry, criterion: string): number {
    switch (criterion) {
      case 'content_score':
        return entry.categoryScores.content;
      case 'investment_readiness':
        return entry.investmentReadiness?.score || 0;
      case 'competitive_advantage':
        return entry.competitiveAdvantage?.score || 0;
      case 'risk_score':
        return this.calculateRiskPenalty(entry.riskFactors || []);
      case 'quick_wins':
        return entry.recommendationSummary?.quickWins || 0;
      case 'critical_issues':
        return -(entry.recommendationSummary?.criticalIssues || 0); // Negative because fewer is better
      default:
        return 0;
    }
  }

  /**
   * Calculate investment readiness score
   */
  private calculateInvestmentReadiness(
    score: ComprehensiveFrameworkScore,
    recommendations?: RecommendationSet
  ): InvestmentReadinessScore {
    
    // Extract key factors from framework scores
    const contentScore = score.categoryScores.content;
    const overallScore = score.categoryScores.overall;
    
    // Get content-related individual scores
    const problemSolutionScore = this.getIndividualScore(score, 'content_problem_solution');
    const marketOpportunityScore = this.getIndividualScore(score, 'content_market_opportunity');
    const tractionScore = this.getIndividualScore(score, 'content_traction_validation');
    const financialsScore = this.getIndividualScore(score, 'content_financials_projections');
    const teamScore = this.getIndividualScore(score, 'overall_credibility_expertise');

    const keyFactors = {
      marketOpportunity: this.normalize1to10To0to100(marketOpportunityScore),
      productViability: this.normalize1to10To0to100(problemSolutionScore),
      teamStrength: this.normalize1to10To0to100(teamScore),
      financialProjections: this.normalize1to10To0to100(financialsScore),
      traction: this.normalize1to10To0to100(tractionScore)
    };

    // Calculate weighted average
    const weightedScore = (
      keyFactors.marketOpportunity * 0.25 +
      keyFactors.productViability * 0.25 +
      keyFactors.teamStrength * 0.20 +
      keyFactors.financialProjections * 0.15 +
      keyFactors.traction * 0.15
    );

    // Determine readiness level
    let level: InvestmentReadinessScore['level'];
    if (weightedScore >= 80) level = 'highly-ready';
    else if (weightedScore >= 65) level = 'ready';
    else if (weightedScore >= 45) level = 'early-stage';
    else level = 'not-ready';

    // Identify barriers and accelerators from recommendations
    const readinessBarriers: string[] = [];
    const accelerators: string[] = [];

    if (recommendations) {
      recommendations.categorizedRecommendations.critical.forEach(rec => {
        if (rec.relatedFrameworkPoints.some(p => p.startsWith('content_'))) {
          readinessBarriers.push(rec.title);
        }
      });

      recommendations.quickWins.forEach(rec => {
        if (rec.estimatedImpact === 'high') {
          accelerators.push(rec.title);
        }
      });
    }

    return {
      score: Math.round(weightedScore),
      level,
      keyFactors,
      readinessBarriers,
      accelerators
    };
  }

  /**
   * Calculate competitive advantage score
   */
  private calculateCompetitiveAdvantage(
    score: ComprehensiveFrameworkScore,
    recommendations?: RecommendationSet
  ): CompetitiveAdvantageScore {
    
    const problemSolutionScore = this.getIndividualScore(score, 'content_problem_solution');
    const marketScore = this.getIndividualScore(score, 'content_market_opportunity');
    const overallScore = score.categoryScores.overall;

    // Base competitive score
    const baseScore = (problemSolutionScore * 0.4 + marketScore * 0.4 + overallScore * 0.2) * 10;

    let level: CompetitiveAdvantageScore['level'];
    if (baseScore >= 80) level = 'exceptional';
    else if (baseScore >= 65) level = 'strong';
    else if (baseScore >= 50) level = 'moderate';
    else level = 'weak';

    // Extract advantages and differentiators from recommendations
    const advantages: string[] = [];
    const differentiators: string[] = [];

    if (recommendations) {
      recommendations.recommendations
        .filter(rec => rec.type === 'strength_to_leverage')
        .forEach(rec => {
          if (rec.relatedFrameworkPoints.includes('content_problem_solution')) {
            differentiators.push(rec.title);
          } else {
            advantages.push(rec.title);
          }
        });
    }

    // Calculate moat strength based on problem uniqueness and market position
    const moatStrength = Math.min(100, problemSolutionScore * 8 + marketScore * 2);
    
    // Determine market position
    let marketPosition: CompetitiveAdvantageScore['marketPosition'];
    if (baseScore >= 85) marketPosition = 'pioneer';
    else if (baseScore >= 70) marketPosition = 'leader';
    else if (baseScore >= 55) marketPosition = 'contender';
    else marketPosition = 'follower';

    return {
      score: Math.round(baseScore),
      level,
      advantages,
      differentiators,
      moatStrength: Math.round(moatStrength),
      marketPosition
    };
  }

  /**
   * Identify risk factors from scoring and recommendations
   */
  private identifyRiskFactors(
    score: ComprehensiveFrameworkScore,
    recommendations?: RecommendationSet
  ): RiskFactor[] {
    
    const riskFactors: RiskFactor[] = [];

    // Market risks
    const marketScore = this.getIndividualScore(score, 'content_market_opportunity');
    if (marketScore < 6) {
      riskFactors.push({
        category: 'market',
        level: marketScore < 4 ? 'high' : 'medium',
        description: 'Market opportunity concerns identified in content analysis',
        impact: (6 - marketScore) * 15,
        likelihood: 70
      });
    }

    // Financial risks
    const financialScore = this.getIndividualScore(score, 'content_financials_projections');
    if (financialScore < 6) {
      riskFactors.push({
        category: 'financial',
        level: financialScore < 4 ? 'critical' : 'high',
        description: 'Financial projections or model concerns',
        impact: (6 - financialScore) * 20,
        likelihood: 80
      });
    }

    // Team risks
    const teamScore = this.getIndividualScore(score, 'overall_credibility_expertise');
    if (teamScore < 6) {
      riskFactors.push({
        category: 'team',
        level: teamScore < 4 ? 'high' : 'medium',
        description: 'Team credibility or expertise gaps',
        impact: (6 - teamScore) * 18,
        likelihood: 60
      });
    }

    // Add risks from critical recommendations
    if (recommendations) {
      recommendations.categorizedRecommendations.critical.forEach(rec => {
        const category = this.mapRecommendationToRiskCategory(rec);
        riskFactors.push({
          category,
          level: 'high',
          description: rec.title,
          impact: rec.estimatedImpact === 'high' ? 80 : 60,
          likelihood: rec.confidence * 100,
          mitigation: rec.actionableSteps[0]
        });
      });
    }

    return riskFactors;
  }

  /**
   * Helper methods for calculations
   */
  private getIndividualScore(score: ComprehensiveFrameworkScore, pointId: string): number {
    const point = score.individualScores.find(s => s.pointId === pointId);
    return point?.score || 5; // Default to middle score if not found
  }

  private normalize1to10To0to100(score: number): number {
    return Math.round((score - 1) / 9 * 100);
  }

  private calculateNormalizedScore(score: ComprehensiveFrameworkScore): number {
    return this.normalize1to10To0to100(score.overallScore);
  }

  private calculateRiskPenalty(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 0;
    
    const totalRisk = riskFactors.reduce((sum, risk) => {
      const riskValue = (risk.impact / 100) * (risk.likelihood / 100);
      return sum + riskValue;
    }, 0);
    
    return Math.min(30, totalRisk * 100); // Cap penalty at 30 points
  }

  private determineOverallRecommendationPriority(recommendations: RecommendationSet): RecommendationPriority {
    if (recommendations.categorizedRecommendations.critical.length > 0) return 'critical';
    if (recommendations.categorizedRecommendations.high.length > 2) return 'high';
    if (recommendations.categorizedRecommendations.medium.length > 3) return 'medium';
    return 'low';
  }

  private mapRecommendationToRiskCategory(recommendation: Recommendation): RiskFactor['category'] {
    const point = recommendation.relatedFrameworkPoints[0];
    if (point?.startsWith('content_market')) return 'market';
    if (point?.startsWith('content_financials')) return 'financial';
    if (point?.includes('credibility')) return 'team';
    if (point?.startsWith('content_')) return 'product';
    return 'operational';
  }

  /**
   * Generate ranking metadata and statistics
   */
  private generateRankingMetadata(
    rankings: Array<PitchRankingEntry & { compositeScore: number; finalRank: number }>,
    criteria: RankingCriteria
  ): RankedPitchList['metadata'] {
    
    const scores = rankings.map(r => r.compositeScore);
    const categories = ['speech', 'content', 'visual', 'overall'] as const;

    const distributionStats = {
      scoreDistribution: {
        min: Math.min(...scores),
        max: Math.max(...scores),
        mean: scores.reduce((a, b) => a + b, 0) / scores.length,
        std: Math.sqrt(scores.reduce((sum, score) => sum + Math.pow(score - (scores.reduce((a, b) => a + b, 0) / scores.length), 2), 0) / scores.length)
      },
      categoryDistribution: categories.reduce((acc, category) => {
        const categoryScores = rankings.map(r => r.categoryScores[category]);
        acc[category] = {
          min: Math.min(...categoryScores),
          max: Math.max(...categoryScores),
          mean: categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length
        };
        return acc;
      }, {} as Record<string, { min: number; max: number; mean: number; }>)
    };

    return {
      totalPitches: rankings.length,
      rankingCriteria: criteria,
      generatedAt: new Date(),
      topPerformers: rankings.slice(0, Math.min(5, rankings.length)),
      riskyCandidates: rankings
        .filter(r => r.riskFactors && r.riskFactors.some(rf => rf.level === 'critical' || rf.level === 'high'))
        .slice(0, 5),
      quickWins: rankings
        .filter(r => r.recommendationSummary && r.recommendationSummary.quickWins > 2)
        .slice(0, 5),
      distributionStats
    };
  }

  /**
   * Generate strategic insights from ranking results
   */
  private async generateRankingInsights(
    rankings: Array<PitchRankingEntry & { compositeScore: number; finalRank: number }>,
    criteria: RankingCriteria
  ): Promise<RankedPitchList['insights']> {
    
    const topPerformers = rankings.slice(0, 3);
    const averagePerformers = rankings.slice(Math.floor(rankings.length * 0.3), Math.floor(rankings.length * 0.7));
    
    const recommendedFocus: string[] = [];
    const marketTrends: string[] = [];
    const portfolioBalance: string[] = [];
    const nextSteps: string[] = [];

    // Analyze focus areas
    const lowCategoryScores = ['speech', 'content', 'visual', 'overall'] as const;
    lowCategoryScores.forEach(category => {
      const avgScore = rankings.reduce((sum, r) => sum + r.categoryScores[category], 0) / rankings.length;
      if (avgScore < 6) {
        recommendedFocus.push(`Improve ${category} quality across portfolio - average score: ${avgScore.toFixed(1)}/10`);
      }
    });

    // Market trends analysis
    const investmentReadyCount = rankings.filter(r => 
      r.investmentReadiness && ['ready', 'highly-ready'].includes(r.investmentReadiness.level)
    ).length;
    
    if (investmentReadyCount < rankings.length * 0.3) {
      marketTrends.push('Low investment readiness across portfolio - focus on early-stage development');
    }

    const strongCompetitiveAdvantage = rankings.filter(r =>
      r.competitiveAdvantage && ['strong', 'exceptional'].includes(r.competitiveAdvantage.level)
    ).length;

    if (strongCompetitiveAdvantage > rankings.length * 0.4) {
      marketTrends.push('Strong competitive differentiation in pipeline');
    }

    // Portfolio balance analysis
    const readinessLevels = rankings.reduce((acc, r) => {
      const level = r.investmentReadiness?.level || 'not-ready';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(readinessLevels).forEach(([level, count]) => {
      const percentage = (count / rankings.length * 100).toFixed(1);
      portfolioBalance.push(`${level}: ${count} pitches (${percentage}%)`);
    });

    // Next steps
    if (topPerformers.length > 0) {
      nextSteps.push(`Prioritize due diligence for top ${topPerformers.length} performers`);
    }

    const criticalRiskPitches = rankings.filter(r => 
      r.riskFactors && r.riskFactors.some(rf => rf.level === 'critical')
    ).length;

    if (criticalRiskPitches > 0) {
      nextSteps.push(`Address critical risks in ${criticalRiskPitches} pitches before proceeding`);
    }

    const quickWinOpportunities = rankings.filter(r => 
      r.recommendationSummary && r.recommendationSummary.quickWins > 2
    ).length;

    if (quickWinOpportunities > 0) {
      nextSteps.push(`Implement quick wins for ${quickWinOpportunities} pitches to accelerate development`);
    }

    return {
      recommendedFocus,
      marketTrends,
      portfolioBalance,
      nextSteps
    };
  }
}

/**
 * Utility functions for common ranking operations
 */
export class RankingUtils {
  /**
   * Create a quick ranking for decision-makers (simplified interface)
   */
  static async quickRank(
    pitches: Array<{
      sessionId: string;
      overallScore: number;
      categoryScores: any;
      pitchName?: string;
    }>
  ): Promise<Array<{ sessionId: string; rank: number; score: number; pitchName?: string }>> {
    
    return pitches
      .map((pitch, index) => ({
        ...pitch,
        normalizedScore: (pitch.overallScore - 1) / 9 * 100
      }))
      .sort((a, b) => b.normalizedScore - a.normalizedScore)
      .map((pitch, index) => ({
        sessionId: pitch.sessionId,
        rank: index + 1,
        score: Math.round(pitch.normalizedScore),
        pitchName: pitch.pitchName
      }));
  }

  /**
   * Filter pitches by investment readiness threshold
   */
  static filterByInvestmentReadiness(
    rankings: PitchRankingEntry[],
    minimumLevel: InvestmentReadinessScore['level'] = 'early-stage'
  ): PitchRankingEntry[] {
    
    const levelOrder = { 'not-ready': 0, 'early-stage': 1, 'ready': 2, 'highly-ready': 3 };
    const minOrder = levelOrder[minimumLevel];
    
    return rankings.filter(pitch => {
      const pitchLevel = pitch.investmentReadiness?.level || 'not-ready';
      return levelOrder[pitchLevel] >= minOrder;
    });
  }

  /**
   * Generate executive summary for top pitches
   */
  static generateExecutiveSummary(rankings: RankedPitchList): string {
    const topThree = rankings.rankings.slice(0, 3);
    const totalPitches = rankings.metadata.totalPitches;
    const avgScore = rankings.metadata.distributionStats.scoreDistribution.mean.toFixed(1);
    
    let summary = `Executive Summary: Analyzed ${totalPitches} pitches with average score of ${avgScore}/100.\n\n`;
    
    summary += "Top 3 Recommendations:\n";
    topThree.forEach((pitch, index) => {
      const readiness = pitch.investmentReadiness?.level || 'unknown';
      const score = (pitch as any).compositeScore?.toFixed(1) || pitch.normalizedScore.toFixed(1);
      summary += `${index + 1}. ${pitch.pitchName || pitch.sessionId}: ${score}/100 (${readiness})\n`;
    });
    
    summary += `\nKey Insights:\n${rankings.insights.nextSteps.join('\n')}`;
    
    return summary;
  }
}

export default PriorityRankingEngine; 