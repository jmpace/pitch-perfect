/**
 * Recommendation Engine for PitchPerfect
 * 
 * This module integrates with the existing scoring framework to generate
 * actionable recommendations based on pitch evaluation results, leveraging
 * both quantitative scores and qualitative GPT-4 analysis.
 */

import { 
  FrameworkScore, 
  ComprehensiveFrameworkScore, 
  FRAMEWORK_POINTS, 
  FRAMEWORK_CATEGORIES,
  FrameworkPoint 
} from './scoring-framework';
import { 
  ScoreComparison, 
  NormalizedScore,
  normalizeFrameworkScore 
} from './score-normalization';
import { PromptTemplate, CONTENT_ANALYSIS_TEMPLATE } from './prompt-templates';

// Enhanced recommendation interfaces
export interface Recommendation {
  id: string;
  type: RecommendationType;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  description: string;
  actionableSteps: string[];
  estimatedImpact: 'low' | 'medium' | 'high';
  estimatedEffort: 'low' | 'medium' | 'high';
  relatedFrameworkPoints: string[];
  confidence: number; // 0-1
  evidence?: string;
}

export type RecommendationType = 
  | 'critical_issue'
  | 'high_impact_improvement'
  | 'strength_to_leverage'
  | 'quick_win'
  | 'comparative_insight'
  | 'advanced_optimization';

export type RecommendationCategory = 'speech' | 'content' | 'visual' | 'overall' | 'cross_category';

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface RecommendationSet {
  sessionId: string;
  overallAssessment: {
    primaryStrengths: string[];
    primaryWeaknesses: string[];
    scorePercentile?: number;
    competitivePosition?: string;
  };
  recommendations: Recommendation[];
  categorizedRecommendations: {
    critical: Recommendation[];
    high: Recommendation[];
    medium: Recommendation[];
    low: Recommendation[];
  };
  quickWins: Recommendation[];
  generatedAt: Date;
  totalRecommendations: number;
}

export interface RecommendationContext {
  comprehensiveScore: ComprehensiveFrameworkScore;
  normalizedComparison?: ScoreComparison;
  historicalPercentile?: number;
  benchmarkData?: {
    industryAverage?: number;
    topPerformerThreshold?: number;
  };
  userProfile?: {
    experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
    focusAreas?: string[];
    previousRecommendations?: Recommendation[];
  };
}

export interface RecommendationStrategy {
  name: string;
  description: string;
  generateRecommendations(context: RecommendationContext): Promise<Recommendation[]>;
}

/**
 * Main Recommendation Engine
 */
export class RecommendationEngine {
  private strategies: Map<string, RecommendationStrategy> = new Map();
  private nextRecommendationId = 1;

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * Generate comprehensive recommendations for a pitch
   */
  async generateRecommendations(context: RecommendationContext): Promise<RecommendationSet> {
    const allRecommendations: Recommendation[] = [];

    // Run all registered strategies
    for (const strategy of Array.from(this.strategies.values())) {
      try {
        const strategyRecommendations = await strategy.generateRecommendations(context);
        allRecommendations.push(...strategyRecommendations);
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error);
      }
    }

    // Remove duplicates and prioritize
    const uniqueRecommendations = this.deduplicateRecommendations(allRecommendations);
    const prioritizedRecommendations = this.prioritizeRecommendations(uniqueRecommendations, context);

    // Generate overall assessment
    const overallAssessment = this.generateOverallAssessment(context, prioritizedRecommendations);

    // Categorize recommendations
    const categorizedRecommendations = this.categorizeByPriority(prioritizedRecommendations);

    // Identify quick wins
    const quickWins = prioritizedRecommendations.filter(r => 
      r.estimatedEffort === 'low' && r.estimatedImpact !== 'low'
    ).slice(0, 5);

    return {
      sessionId: context.comprehensiveScore.sessionId,
      overallAssessment,
      recommendations: prioritizedRecommendations,
      categorizedRecommendations,
      quickWins,
      generatedAt: new Date(),
      totalRecommendations: prioritizedRecommendations.length
    };
  }

  /**
   * Register a new recommendation strategy
   */
  registerStrategy(strategy: RecommendationStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Register default strategies
   */
  private registerDefaultStrategies(): void {
    this.registerStrategy(new ScoreBasedRecommendationStrategy());
    this.registerStrategy(new ComparativeRecommendationStrategy());
    this.registerStrategy(new CategoryAnalysisStrategy());
    this.registerStrategy(new CrossCategoryOptimizationStrategy());
  }

  /**
   * Remove duplicate recommendations based on similarity
   */
  private deduplicateRecommendations(recommendations: Recommendation[]): Recommendation[] {
    const seen = new Set<string>();
    const unique: Recommendation[] = [];

    for (const rec of recommendations) {
      const key = `${rec.type}-${rec.category}-${rec.title.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rec);
      }
    }

    return unique;
  }

  /**
   * Prioritize recommendations based on impact, effort, and score severity
   */
  private prioritizeRecommendations(
    recommendations: Recommendation[], 
    context: RecommendationContext
  ): Recommendation[] {
    return recommendations
      .map(rec => ({
        ...rec,
        computedPriority: this.calculatePriorityScore(rec, context)
      }))
      .sort((a, b) => (b as any).computedPriority - (a as any).computedPriority)
      .slice(0, 20); // Limit to top 20 recommendations
  }

  /**
   * Calculate priority score for ranking
   */
  private calculatePriorityScore(rec: Recommendation, context: RecommendationContext): number {
    let score = 0;

    // Impact weighting
    switch (rec.estimatedImpact) {
      case 'high': score += 30; break;
      case 'medium': score += 20; break;
      case 'low': score += 10; break;
    }

    // Effort weighting (inverse - lower effort gets higher score)
    switch (rec.estimatedEffort) {
      case 'low': score += 25; break;
      case 'medium': score += 15; break;
      case 'high': score += 5; break;
    }

    // Type weighting
    switch (rec.type) {
      case 'critical_issue': score += 35; break;
      case 'quick_win': score += 25; break;
      case 'high_impact_improvement': score += 20; break;
      case 'strength_to_leverage': score += 15; break;
      case 'comparative_insight': score += 10; break;
      case 'advanced_optimization': score += 5; break;
    }

    // Confidence weighting
    score += rec.confidence * 10;

    // Score severity weighting
    const relatedScores = context.comprehensiveScore.individualScores
      .filter(s => rec.relatedFrameworkPoints.includes(s.pointId))
      .map(s => s.score);
    
    if (relatedScores.length > 0) {
      const avgScore = relatedScores.reduce((sum, s) => sum + s, 0) / relatedScores.length;
      if (avgScore <= 3) score += 20; // Critical scores
      else if (avgScore <= 5) score += 15; // Poor scores
      else if (avgScore <= 7) score += 10; // Average scores
    }

    return score;
  }

  /**
   * Generate overall assessment
   */
  private generateOverallAssessment(
    context: RecommendationContext, 
    recommendations: Recommendation[]
  ): RecommendationSet['overallAssessment'] {
    const { comprehensiveScore, normalizedComparison } = context;

    // Identify primary strengths (scores > 7)
    const strengths = comprehensiveScore.individualScores
      .filter(score => score.score > 7)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(score => {
        const point = FRAMEWORK_POINTS.find(p => p.id === score.pointId);
        return point ? point.title : score.pointId;
      });

    // Identify primary weaknesses (scores < 5)
    const weaknesses = comprehensiveScore.individualScores
      .filter(score => score.score < 5)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(score => {
        const point = FRAMEWORK_POINTS.find(p => p.id === score.pointId);
        return point ? point.title : score.pointId;
      });

    // Determine competitive position
    let competitivePosition = 'Average Performance';
    const overallScore = comprehensiveScore.overallScore;
    if (overallScore >= 8) competitivePosition = 'Excellent - Top Tier';
    else if (overallScore >= 7) competitivePosition = 'Good - Above Average';
    else if (overallScore >= 6) competitivePosition = 'Fair - Room for Improvement';
    else if (overallScore >= 4) competitivePosition = 'Needs Significant Work';
    else competitivePosition = 'Critical Issues - Major Overhaul Needed';

    return {
      primaryStrengths: strengths,
      primaryWeaknesses: weaknesses,
      scorePercentile: normalizedComparison?.percentileRank,
      competitivePosition
    };
  }

  /**
   * Categorize recommendations by priority
   */
  private categorizeByPriority(recommendations: Recommendation[]): RecommendationSet['categorizedRecommendations'] {
    return {
      critical: recommendations.filter(r => r.priority === 'critical'),
      high: recommendations.filter(r => r.priority === 'high'),
      medium: recommendations.filter(r => r.priority === 'medium'),
      low: recommendations.filter(r => r.priority === 'low')
    };
  }

  /**
   * Generate unique recommendation ID
   */
  generateRecommendationId(): string {
    return `rec_${this.nextRecommendationId++}_${Date.now()}`;
  }
}

/**
 * Score-Based Recommendation Strategy
 * Generates recommendations based on individual framework point scores
 */
export class ScoreBasedRecommendationStrategy implements RecommendationStrategy {
  name = 'score_based';
  description = 'Generates recommendations based on individual framework point scores';

  async generateRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { comprehensiveScore } = context;
    const engine = new RecommendationEngine();

    // Validate that we have individual scores to work with
    if (!comprehensiveScore?.individualScores || !Array.isArray(comprehensiveScore.individualScores)) {
      console.warn('ScoreBasedRecommendationStrategy: No valid individualScores found in comprehensiveScore');
      return recommendations;
    }

    for (const score of comprehensiveScore.individualScores) {
      const frameworkPoint = FRAMEWORK_POINTS.find(p => p.id === score.pointId);
      if (!frameworkPoint) continue;

      // Critical issues (score <= 3)
      if (score.score <= 3) {
        recommendations.push({
          id: engine.generateRecommendationId(),
          type: 'critical_issue',
          category: frameworkPoint.category,
          priority: 'critical',
          title: `Critical Issue: ${frameworkPoint.title}`,
          description: `Score of ${score.score}/10 indicates critical weakness in ${frameworkPoint.title.toLowerCase()}. Immediate attention required.`,
          actionableSteps: this.generateCriticalActionSteps(frameworkPoint, score),
          estimatedImpact: 'high',
          estimatedEffort: score.score <= 2 ? 'high' : 'medium',
          relatedFrameworkPoints: [score.pointId],
          confidence: 0.9,
          evidence: score.rationale
        });
      }
      // High impact improvements (score 4-6)
      else if (score.score <= 6) {
        recommendations.push({
          id: engine.generateRecommendationId(),
          type: 'high_impact_improvement',
          category: frameworkPoint.category,
          priority: score.score <= 4 ? 'high' : 'medium',
          title: `Improve ${frameworkPoint.title}`,
          description: `Score of ${score.score}/10 shows potential for significant improvement in ${frameworkPoint.title.toLowerCase()}.`,
          actionableSteps: this.generateImprovementActionSteps(frameworkPoint, score),
          estimatedImpact: 'high',
          estimatedEffort: 'medium',
          relatedFrameworkPoints: [score.pointId],
          confidence: 0.8,
          evidence: score.rationale
        });
      }
      // Strengths to leverage (score >= 8)
      else if (score.score >= 8) {
        recommendations.push({
          id: engine.generateRecommendationId(),
          type: 'strength_to_leverage',
          category: frameworkPoint.category,
          priority: 'medium',
          title: `Leverage Strength: ${frameworkPoint.title}`,
          description: `Excellent score of ${score.score}/10 in ${frameworkPoint.title.toLowerCase()}. Use this strength to enhance overall presentation.`,
          actionableSteps: this.generateLeverageActionSteps(frameworkPoint, score),
          estimatedImpact: 'medium',
          estimatedEffort: 'low',
          relatedFrameworkPoints: [score.pointId],
          confidence: 0.8,
          evidence: score.rationale
        });
      }
      // Quick wins (score 6-7)
      else if (score.score >= 6) {
        recommendations.push({
          id: engine.generateRecommendationId(),
          type: 'quick_win',
          category: frameworkPoint.category,
          priority: 'medium',
          title: `Quick Win: Enhance ${frameworkPoint.title}`,
          description: `Good score of ${score.score}/10 with opportunity for quick improvement in ${frameworkPoint.title.toLowerCase()}.`,
          actionableSteps: this.generateQuickWinActionSteps(frameworkPoint, score),
          estimatedImpact: 'medium',
          estimatedEffort: 'low',
          relatedFrameworkPoints: [score.pointId],
          confidence: 0.7,
          evidence: score.rationale
        });
      }
    }

    return recommendations;
  }

  private generateCriticalActionSteps(point: FrameworkPoint, score: FrameworkScore): string[] {
    const baseSteps = score.improvementSuggestions || [];
    const criticalSteps = [
      `Schedule dedicated practice sessions focusing specifically on ${point.title.toLowerCase()}`,
      `Consider professional coaching or training for ${point.title.toLowerCase()}`,
      `Record practice sessions to track improvement in ${point.title.toLowerCase()}`
    ];
    return [...baseSteps, ...criticalSteps];
  }

  private generateImprovementActionSteps(point: FrameworkPoint, score: FrameworkScore): string[] {
    const baseSteps = score.improvementSuggestions || [];
    const improvementSteps = [
      `Practice ${point.title.toLowerCase()} using the specific criteria in our framework`,
      `Seek feedback specifically on ${point.title.toLowerCase()} from trusted colleagues`
    ];
    return [...baseSteps, ...improvementSteps];
  }

  private generateLeverageActionSteps(point: FrameworkPoint, score: FrameworkScore): string[] {
    return [
      `Highlight your excellent ${point.title.toLowerCase()} as a signature strength`,
      `Use your ${point.title.toLowerCase()} skills to compensate for weaker areas`,
      `Share your ${point.title.toLowerCase()} techniques with others for peer learning`
    ];
  }

  private generateQuickWinActionSteps(point: FrameworkPoint, score: FrameworkScore): string[] {
    const baseSteps = score.improvementSuggestions || [];
    const quickSteps = [
      `Make small adjustments to ${point.title.toLowerCase()} before your next presentation`,
      `Practice ${point.title.toLowerCase()} for 15-20 minutes daily`
    ];
    return [...baseSteps, ...quickSteps];
  }
}

/**
 * Comparative Recommendation Strategy
 * Generates recommendations based on performance relative to benchmarks
 */
export class ComparativeRecommendationStrategy implements RecommendationStrategy {
  name = 'comparative';
  description = 'Generates recommendations based on performance relative to benchmarks';

  async generateRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { normalizedComparison, benchmarkData } = context;
    
    if (!normalizedComparison) return recommendations;

    const engine = new RecommendationEngine();

    // Generate percentile-based insights
    if (normalizedComparison.percentileRank !== undefined) {
      const percentile = normalizedComparison.percentileRank;
      
      if (percentile < 25) {
        recommendations.push({
          id: engine.generateRecommendationId(),
          type: 'comparative_insight',
          category: 'cross_category',
          priority: 'high',
          title: 'Performance Below Average - Focus on Fundamentals',
          description: `Your pitch scores in the ${percentile.toFixed(0)}th percentile. Focus on mastering fundamental presentation skills.`,
          actionableSteps: [
            'Prioritize the top 3 lowest-scoring framework points',
            'Consider presentation skills training or coaching',
            'Practice with the basic framework criteria until comfortable',
            'Schedule regular feedback sessions with experienced presenters'
          ],
          estimatedImpact: 'high',
          estimatedEffort: 'high',
          relatedFrameworkPoints: [],
          confidence: 0.85
        });
      } else if (percentile > 75) {
        recommendations.push({
          id: engine.generateRecommendationId(),
          type: 'strength_to_leverage',
          category: 'cross_category',
          priority: 'medium',
          title: 'Above Average Performance - Optimize for Excellence',
          description: `Your pitch scores in the ${percentile.toFixed(0)}th percentile. Focus on advanced optimization techniques.`,
          actionableSteps: [
            'Focus on perfecting your strongest areas for maximum impact',
            'Develop signature presentation techniques that set you apart',
            'Consider mentoring others to reinforce your own skills',
            'Experiment with advanced storytelling and persuasion techniques'
          ],
          estimatedImpact: 'medium',
          estimatedEffort: 'medium',
          relatedFrameworkPoints: [],
          confidence: 0.8
        });
      }
    }

    // Industry benchmark comparisons
    if (benchmarkData?.industryAverage) {
      const overallScore = normalizedComparison.overallScore;
      const diff = overallScore - benchmarkData.industryAverage;
      
      if (diff < -10) {
        recommendations.push({
          id: engine.generateRecommendationId(),
          type: 'critical_issue',
          category: 'cross_category',
          priority: 'critical',
          title: 'Below Industry Standards',
          description: `Your overall score is ${Math.abs(diff).toFixed(1)} points below industry average. Immediate improvement needed.`,
          actionableSteps: [
            'Analyze successful pitches in your industry',
            'Identify the 3 most critical gaps vs. industry standards',
            'Create a structured improvement plan with specific milestones',
            'Consider working with a presentation coach familiar with your industry'
          ],
          estimatedImpact: 'high',
          estimatedEffort: 'high',
          relatedFrameworkPoints: [],
          confidence: 0.9
        });
      }
    }

    return recommendations;
  }
}

/**
 * Category Analysis Strategy
 * Generates recommendations based on category-level performance patterns
 */
export class CategoryAnalysisStrategy implements RecommendationStrategy {
  name = 'category_analysis';
  description = 'Generates recommendations based on category-level performance patterns';

  async generateRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { comprehensiveScore } = context;
    const engine = new RecommendationEngine();

    // Analyze category performance
    const categoryScores = comprehensiveScore.categoryScores;
    const sortedCategories = Object.entries(categoryScores)
      .sort(([,a], [,b]) => a - b);

    // Identify weakest category
    const [weakestCategory, weakestScore] = sortedCategories[0];
    if (weakestScore < 6) {
      const categoryInfo = FRAMEWORK_CATEGORIES[weakestCategory];
      recommendations.push({
        id: engine.generateRecommendationId(),
        type: 'high_impact_improvement',
        category: weakestCategory as RecommendationCategory,
        priority: weakestScore < 4 ? 'critical' : 'high',
        title: `Focus Area: ${categoryInfo.title}`,
        description: `${categoryInfo.title} is your weakest category at ${weakestScore.toFixed(1)}/10. Concentrated improvement here will have significant impact.`,
        actionableSteps: [
          `Study the specific criteria for all ${categoryInfo.title.toLowerCase()} framework points`,
          `Practice each point in ${categoryInfo.title.toLowerCase()} systematically`,
          `Get targeted feedback on ${categoryInfo.title.toLowerCase()} from experts`,
          `Allocate 60% of practice time to ${categoryInfo.title.toLowerCase()} until improved`
        ],
        estimatedImpact: 'high',
        estimatedEffort: 'high',
        relatedFrameworkPoints: FRAMEWORK_POINTS
          .filter(p => p.category === weakestCategory)
          .map(p => p.id),
        confidence: 0.85
      });
    }

    // Identify strongest category for leverage
    const [strongestCategory, strongestScore] = sortedCategories[sortedCategories.length - 1];
    if (strongestScore > 7) {
      const categoryInfo = FRAMEWORK_CATEGORIES[strongestCategory];
      recommendations.push({
        id: engine.generateRecommendationId(),
        type: 'strength_to_leverage',
        category: strongestCategory as RecommendationCategory,
        priority: 'medium',
        title: `Leverage Strength: ${categoryInfo.title}`,
        description: `${categoryInfo.title} is your strongest category at ${strongestScore.toFixed(1)}/10. Use this as your competitive advantage.`,
        actionableSteps: [
          `Open your pitch highlighting your ${categoryInfo.title.toLowerCase()} strengths`,
          `Build confidence by starting practice sessions with ${categoryInfo.title.toLowerCase()}`,
          `Use your ${categoryInfo.title.toLowerCase()} skills to support weaker areas`,
          `Develop signature techniques in ${categoryInfo.title.toLowerCase()} that set you apart`
        ],
        estimatedImpact: 'medium',
        estimatedEffort: 'low',
        relatedFrameworkPoints: FRAMEWORK_POINTS
          .filter(p => p.category === strongestCategory)
          .map(p => p.id),
        confidence: 0.8
      });
    }

    return recommendations;
  }
}

/**
 * Cross-Category Optimization Strategy
 * Generates recommendations that address interactions between categories
 */
export class CrossCategoryOptimizationStrategy implements RecommendationStrategy {
  name = 'cross_category';
  description = 'Generates recommendations for optimizing interactions between framework categories';

  async generateRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { comprehensiveScore } = context;
    const engine = new RecommendationEngine();

    const categoryScores = comprehensiveScore.categoryScores;

    // Speech-Content alignment
    const speechContentGap = Math.abs(categoryScores.speech - categoryScores.content);
    if (speechContentGap > 2) {
      const stronger = categoryScores.speech > categoryScores.content ? 'speech' : 'content';
      const weaker = stronger === 'speech' ? 'content' : 'speech';
      
      recommendations.push({
        id: engine.generateRecommendationId(),
        type: 'high_impact_improvement',
        category: 'cross_category',
        priority: 'high',
        title: `Balance ${stronger.charAt(0).toUpperCase() + stronger.slice(1)} and ${weaker.charAt(0).toUpperCase() + weaker.slice(1)}`,
        description: `Large gap between ${stronger} (${categoryScores[stronger].toFixed(1)}) and ${weaker} (${categoryScores[weaker].toFixed(1)}) creates presentation imbalance.`,
        actionableSteps: [
          `Focus improvement efforts on ${weaker} to match your ${stronger} strength`,
          `Practice integrating strong ${stronger} with improved ${weaker}`,
          `Ensure your ${stronger} skills support rather than overshadow ${weaker}`,
          `Seek feedback on overall presentation balance and flow`
        ],
        estimatedImpact: 'high',
        estimatedEffort: 'medium',
        relatedFrameworkPoints: FRAMEWORK_POINTS
          .filter(p => p.category === weaker)
          .map(p => p.id),
        confidence: 0.75
      });
    }

    // Visual-Content integration
    if (categoryScores.visual > 7 && categoryScores.content < 6) {
      recommendations.push({
        id: engine.generateRecommendationId(),
        type: 'quick_win',
        category: 'cross_category',
        priority: 'medium',
        title: 'Leverage Strong Visuals to Support Content',
        description: 'Your excellent visual presentation can be used to strengthen content delivery.',
        actionableSteps: [
          'Use your strong visual design to better illustrate key content points',
          'Ensure slides directly support and reinforce your content narrative',
          'Practice seamless integration between what you say and what you show',
          'Use visual strengths to make complex content more accessible'
        ],
        estimatedImpact: 'medium',
        estimatedEffort: 'low',
        relatedFrameworkPoints: ['content_problem_definition', 'content_solution_explanation', 'visual_design_quality'],
        confidence: 0.7
      });
    }

    return recommendations;
  }
}

/**
 * Utility functions for working with recommendations
 */

/**
 * Generate recommendations for a comprehensive framework score
 */
export async function generatePitchRecommendations(
  comprehensiveScore: ComprehensiveFrameworkScore,
  options: {
    includeComparison?: boolean;
    benchmarkData?: RecommendationContext['benchmarkData'];
    userProfile?: RecommendationContext['userProfile'];
  } = {}
): Promise<RecommendationSet> {
  const engine = new RecommendationEngine();
  
  const context: RecommendationContext = {
    comprehensiveScore,
    benchmarkData: options.benchmarkData,
    userProfile: options.userProfile
  };

  // Add normalized comparison if requested
  if (options.includeComparison) {
    context.normalizedComparison = normalizeFrameworkScore(comprehensiveScore);
  }

  return await engine.generateRecommendations(context);
}

/**
 * Filter recommendations by category
 */
export function filterRecommendationsByCategory(
  recommendations: Recommendation[],
  category: RecommendationCategory
): Recommendation[] {
  return recommendations.filter(rec => rec.category === category);
}

/**
 * Get top recommendations by priority and impact
 */
export function getTopRecommendations(
  recommendations: Recommendation[],
  limit: number = 5
): Recommendation[] {
  return recommendations
    .filter(rec => rec.priority === 'critical' || rec.priority === 'high')
    .slice(0, limit);
}

/**
 * Generate recommendation summary report
 */
export function generateRecommendationReport(recommendationSet: RecommendationSet): string {
  let report = `Pitch Recommendation Report\n`;
  report += `===========================\n\n`;
  report += `Session: ${recommendationSet.sessionId}\n`;
  report += `Generated: ${recommendationSet.generatedAt.toLocaleString()}\n`;
  report += `Total Recommendations: ${recommendationSet.totalRecommendations}\n\n`;

  // Overall Assessment
  report += `OVERALL ASSESSMENT\n`;
  report += `------------------\n`;
  report += `Competitive Position: ${recommendationSet.overallAssessment.competitivePosition}\n`;
  
  if (recommendationSet.overallAssessment.scorePercentile) {
    report += `Score Percentile: ${recommendationSet.overallAssessment.scorePercentile.toFixed(1)}%\n`;
  }
  
  report += `\nPrimary Strengths:\n`;
  recommendationSet.overallAssessment.primaryStrengths.forEach(strength => {
    report += `• ${strength}\n`;
  });
  
  report += `\nPrimary Weaknesses:\n`;
  recommendationSet.overallAssessment.primaryWeaknesses.forEach(weakness => {
    report += `• ${weakness}\n`;
  });

  // Quick Wins
  if (recommendationSet.quickWins.length > 0) {
    report += `\nQUICK WINS (Low Effort, High Impact)\n`;
    report += `------------------------------------\n`;
    recommendationSet.quickWins.forEach((rec, index) => {
      report += `${index + 1}. ${rec.title}\n`;
      report += `   ${rec.description}\n`;
      report += `   Actions: ${rec.actionableSteps.slice(0, 2).join('; ')}\n\n`;
    });
  }

  // Critical Issues
  if (recommendationSet.categorizedRecommendations.critical.length > 0) {
    report += `CRITICAL ISSUES\n`;
    report += `---------------\n`;
    recommendationSet.categorizedRecommendations.critical.forEach((rec, index) => {
      report += `${index + 1}. ${rec.title}\n`;
      report += `   ${rec.description}\n`;
      report += `   Impact: ${rec.estimatedImpact} | Effort: ${rec.estimatedEffort}\n\n`;
    });
  }

  // High Priority
  if (recommendationSet.categorizedRecommendations.high.length > 0) {
    report += `HIGH PRIORITY IMPROVEMENTS\n`;
    report += `--------------------------\n`;
    recommendationSet.categorizedRecommendations.high.slice(0, 5).forEach((rec, index) => {
      report += `${index + 1}. ${rec.title}\n`;
      report += `   ${rec.description}\n\n`;
    });
  }

  return report;
} 