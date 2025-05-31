/**
 * Enhanced Recommendation Prioritization Algorithm
 * 
 * Optimized for pitch presentation improvement with focus on investor impact
 * and user actionability. Uses hybrid weighted scoring with contextual adjustments.
 */

import { 
  Recommendation, 
  RecommendationSet,
  RecommendationPriority,
  RecommendationCategory 
} from './recommendation-engine';
import { 
  ComprehensiveFrameworkScore, 
  FrameworkScore 
} from './scoring-framework';
import { TranscriptAnalysis } from './scoring-logic';
import { FrameAnalysisResult } from './vision-analysis';

// Prioritization context and configuration
export interface PrioritizationContext {
  userProfile: {
    experienceLevel: 'beginner' | 'intermediate' | 'advanced';
    focusAreas?: ('content' | 'delivery' | 'design')[];
    previousSessions?: number;
    timeToPresentation?: number; // days until presentation
  };
  presentationContext: {
    audienceType: 'investors' | 'customers' | 'internal' | 'conference';
    presentationLength: number; // minutes
    criticality: 'low' | 'medium' | 'high' | 'critical';
  };
  frameworkScore: ComprehensiveFrameworkScore;
  slideAnalysis?: FrameAnalysisResult[];
  transcriptAnalysis?: TranscriptAnalysis;
}

export interface PrioritizedRecommendation extends Recommendation {
  priorityScore: number;
  impactMultiplier: number;
  urgencyFactor: number;
  implementationDifficulty: number;
  investorRelevance: number;
  timeToImplement: number; // estimated hours
  prerequisiteRecommendations?: string[]; // IDs of recommendations that should be done first
}

export interface PrioritizationWeights {
  // Core weighting factors (total = 100)
  investorImpact: number;        // 35% - How much this affects investor perception
  implementationEase: number;    // 25% - How easy it is to implement
  scoreSeverity: number;        // 20% - How critical the underlying issue is
  confidenceLevel: number;      // 10% - How confident we are in the recommendation
  userExperience: number;       // 10% - Adjustments based on user experience level
}

// Optimized weights for pitch presentation context
export const PITCH_OPTIMIZATION_WEIGHTS: PrioritizationWeights = {
  investorImpact: 35,
  implementationEase: 25,
  scoreSeverity: 20,
  confidenceLevel: 10,
  userExperience: 10
};

// Investor impact scoring matrix
const INVESTOR_IMPACT_MATRIX: Record<string, number> = {
  // Content quality has highest investor impact
  'content_problem_solution': 10,
  'content_market_opportunity': 10,
  'content_traction_validation': 9,
  'content_financials_projections': 9,
  'content_team_expertise': 8,
  
  // Overall effectiveness is critical for investor perception
  'overall_persuasion_storytelling': 10,
  'overall_credibility_expertise': 9,
  
  // Speech mechanics affect credibility
  'speech_vocal_confidence': 8,
  'speech_clarity_articulation': 7,
  'speech_pace_rhythm': 6,
  'speech_volume_projection': 6,
  'speech_filler_words': 5,
  
  // Visual presentation supports but doesn't drive decisions
  'visual_slide_design': 6,
  'visual_data_visualization': 7,
  'visual_timing_flow': 5
};

// Implementation difficulty matrix (1-10, lower = easier)
const IMPLEMENTATION_DIFFICULTY_MATRIX: Record<string, number> = {
  // Content changes require significant work
  'content_problem_solution': 8,
  'content_market_opportunity': 7,
  'content_traction_validation': 6,
  'content_financials_projections': 7,
  'content_team_expertise': 5,
  
  // Storytelling requires practice but is achievable
  'overall_persuasion_storytelling': 6,
  'overall_credibility_expertise': 7,
  
  // Speech improvements can be practiced quickly
  'speech_vocal_confidence': 4,
  'speech_clarity_articulation': 3,
  'speech_pace_rhythm': 2,
  'speech_volume_projection': 2,
  'speech_filler_words': 3,
  
  // Visual changes are technical but straightforward
  'visual_slide_design': 4,
  'visual_data_visualization': 5,
  'visual_timing_flow': 3
};

export class RecommendationPrioritizer {
  private weights: PrioritizationWeights;
  
  constructor(weights: PrioritizationWeights = PITCH_OPTIMIZATION_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Prioritize a set of recommendations using the enhanced algorithm
   */
  prioritizeRecommendations(
    recommendations: Recommendation[],
    context: PrioritizationContext
  ): PrioritizedRecommendation[] {
    
    const prioritizedRecs = recommendations.map(rec => 
      this.calculatePriorityScore(rec, context)
    );

    // Sort by priority score (highest first)
    const sorted = prioritizedRecs.sort((a, b) => b.priorityScore - a.priorityScore);

    // Apply contextual ordering adjustments
    return this.applyContextualOrdering(sorted, context);
  }

  /**
   * Calculate comprehensive priority score for a recommendation
   */
  private calculatePriorityScore(
    recommendation: Recommendation,
    context: PrioritizationContext
  ): PrioritizedRecommendation {
    
    // 1. Calculate investor impact score (0-10)
    const investorRelevance = this.calculateInvestorImpact(recommendation, context);
    
    // 2. Calculate implementation ease score (0-10, higher = easier)
    const implementationEase = this.calculateImplementationEase(recommendation, context);
    
    // 3. Calculate score severity impact (0-10)
    const scoreSeverity = this.calculateScoreSeverity(recommendation, context);
    
    // 4. Apply confidence weighting (0-10)
    const confidenceScore = recommendation.confidence * 10;
    
    // 5. Apply user experience adjustments (0-10)
    const userExperienceScore = this.calculateUserExperienceAdjustment(recommendation, context);

    // Calculate base weighted priority score with dynamic weight adjustment
    // When investor relevance is very high (>10), increase its effective weight
    let effectiveWeights = { ...this.weights };
    
    if (investorRelevance > 10) {
      // Boost investor weight proportionally to how much it exceeds 10
      const boostFactor = Math.min(investorRelevance / 6, 3.0); // Much more aggressive: divide by 6, cap at 3x
      effectiveWeights.investorImpact *= boostFactor;
      
      // Normalize other weights to maintain 100% total
      const totalWeight = Object.values(effectiveWeights).reduce((sum, w) => sum + w, 0);
      Object.keys(effectiveWeights).forEach(key => {
        if (key !== 'investorImpact') {
          (effectiveWeights as any)[key] = (effectiveWeights as any)[key] * 100 / totalWeight;
        } else {
          effectiveWeights.investorImpact = effectiveWeights.investorImpact * 100 / totalWeight;
        }
      });
    }
    
    const basePriorityScore = (
      (Math.min(10, investorRelevance) * effectiveWeights.investorImpact) +
      (implementationEase * effectiveWeights.implementationEase) +
      (scoreSeverity * effectiveWeights.scoreSeverity) +
      (confidenceScore * effectiveWeights.confidenceLevel) +
      (userExperienceScore * effectiveWeights.userExperience)
    ) / 100;

    // Calculate additional metrics
    const impactMultiplier = this.calculateImpactMultiplier(recommendation, context);
    const urgencyFactor = this.calculateUrgencyFactor(recommendation, context);
    const implementationDifficulty = IMPLEMENTATION_DIFFICULTY_MATRIX[recommendation.relatedFrameworkPoints[0]] || 5;
    const timeToImplement = this.estimateImplementationTime(recommendation, context);

    // Apply impact multiplier and scale to 0-10 range with better differentiation
    const rawPriorityScore = basePriorityScore * impactMultiplier;
    
    // Use a softer scaling that preserves differences but keeps scores reasonable
    // This maps scores to roughly 0-10 range but allows some overflow for differentiation
    const finalPriorityScore = rawPriorityScore > 10 ? 
      10 + Math.log(rawPriorityScore - 9) * 0.5 : // Soft scaling above 10
      rawPriorityScore;

    return {
      ...recommendation,
      priorityScore: Math.round(finalPriorityScore * 10) / 10,
      impactMultiplier,
      urgencyFactor,
      implementationDifficulty,
      investorRelevance: Math.min(10, investorRelevance),
      timeToImplement,
      prerequisiteRecommendations: this.identifyPrerequisites(recommendation, context)
    };
  }

  /**
   * Calculate investor impact based on framework points and recommendation type
   */
  private calculateInvestorImpact(
    recommendation: Recommendation,
    context: PrioritizationContext
  ): number {
    let baseImpact = 5; // Default moderate impact

    // Get impact from framework points
    if (recommendation.relatedFrameworkPoints.length > 0) {
      const frameworkImpacts = recommendation.relatedFrameworkPoints.map(
        pointId => INVESTOR_IMPACT_MATRIX[pointId] || 5
      );
      baseImpact = frameworkImpacts.reduce((sum, impact) => sum + impact, 0) / frameworkImpacts.length;
    }

    // Boost impact based on recommendation type
    const typeMultipliers: Record<string, number> = {
      'critical_issue': 1.5,
      'high_impact_improvement': 1.3,
      'advanced_optimization': 1.2,  // was 0.8 - now higher than quick_win
      'strength_to_leverage': 1.1,
      'quick_win': 1.0,
      'comparative_insight': 0.9
    };

    baseImpact *= typeMultipliers[recommendation.type] || 1.0;

    // Adjust for presentation context
    if (context.presentationContext.audienceType === 'investors') {
      baseImpact *= 1.2; // Boost investor-specific recommendations
    }

    // Don't cap at 10 - let high impact items maintain their advantage after boosts
    return baseImpact;
  }

  /**
   * Calculate implementation ease (higher score = easier to implement)
   */
  private calculateImplementationEase(
    recommendation: Recommendation,
    context: PrioritizationContext
  ): number {
    let easeScore = 5; // Default moderate ease

    // Get difficulty from framework points and convert to ease with softer curve
    if (recommendation.relatedFrameworkPoints.length > 0) {
      const frameworkDifficulties = recommendation.relatedFrameworkPoints.map(
        pointId => IMPLEMENTATION_DIFFICULTY_MATRIX[pointId] || 5
      );
      const avgDifficulty = frameworkDifficulties.reduce((sum, diff) => sum + diff, 0) / frameworkDifficulties.length;
      
      // Use a softer curve: ease = 5 + (5 - difficulty) * 0.6
      // This maps difficulty 1-10 to ease 7.4-2.6 instead of ease 9-0
      easeScore = 5 + (5 - avgDifficulty) * 0.6;
    }

    // Adjust based on estimated effort (smaller adjustments)
    const effortAdjustments: Record<string, number> = {
      'low': 1.5,      // was 3
      'medium': 0,
      'high': -1.5     // was -3
    };
    easeScore += effortAdjustments[recommendation.estimatedEffort] || 0;

    // Adjust for user experience level
    const experienceMultipliers: Record<string, number> = {
      'beginner': 0.9,  // was 0.8
      'intermediate': 1.0,
      'advanced': 1.1   // was 1.2
    };
    easeScore *= experienceMultipliers[context.userProfile.experienceLevel];

    // Time pressure adjustment - stronger boost for easier implementations when time is limited
    if (context.userProfile.timeToPresentation && context.userProfile.timeToPresentation <= 7) {
      // If presentation is within a week, significantly favor easier implementations
      const timeBoost = recommendation.estimatedEffort === 'low' ? 2.0 : 
                       recommendation.estimatedEffort === 'medium' ? 1.3 : 1.0;
      easeScore *= timeBoost;
    }

    return Math.max(0, Math.min(10, easeScore));
  }

  /**
   * Calculate score severity impact (how critical the underlying issue is)
   */
  private calculateScoreSeverity(
    recommendation: Recommendation,
    context: PrioritizationContext
  ): number {
    if (recommendation.relatedFrameworkPoints.length === 0) {
      return 5; // Default moderate severity
    }

    // Get scores for related framework points
    const relatedScores = recommendation.relatedFrameworkPoints
      .map(pointId => {
        const scoreData = context.frameworkScore.individualScores.find(s => s.pointId === pointId);
        return scoreData ? scoreData.score : 5;
      })
      .filter(score => score !== undefined);

    if (relatedScores.length === 0) return 5;

    const avgScore = relatedScores.reduce((sum, score) => sum + score, 0) / relatedScores.length;
    
    // Convert framework score (1-10) to severity impact (10-0, where lower scores = higher severity)
    let severityScore;
    if (avgScore <= 3) severityScore = 10; // Critical
    else if (avgScore <= 5) severityScore = 8;  // High
    else if (avgScore <= 7) severityScore = 6;  // Medium
    else if (avgScore <= 8) severityScore = 4;  // Low
    else severityScore = 2; // Very low

    return severityScore;
  }

  /**
   * Calculate user experience adjustments
   */
  private calculateUserExperienceAdjustment(
    recommendation: Recommendation,
    context: PrioritizationContext
  ): number {
    let adjustmentScore = 5; // Default neutral

    const { experienceLevel, focusAreas, previousSessions } = context.userProfile;

    // Experience level adjustments (stronger preferences to overcome type differences)
    if (experienceLevel === 'beginner') {
      // Beginners benefit more from foundational improvements
      if (recommendation.category === 'speech' || recommendation.type === 'quick_win') {
        adjustmentScore += 3; 
      }
      if (recommendation.type === 'advanced_optimization') {
        adjustmentScore -= 3; 
      }
    } else if (experienceLevel === 'advanced') {
      // Advanced users benefit more from optimization - stronger boost needed
      if (recommendation.type === 'advanced_optimization') {
        adjustmentScore += 4; // was 3 - stronger boost for advanced optimizations
      }
      if (recommendation.type === 'strength_to_leverage') {
        adjustmentScore += 2; // was 3 - reduced to focus on advanced_optimization
      }
      if (recommendation.type === 'quick_win') {
        adjustmentScore -= 2; 
      }
    }

    // Focus area alignment
    if (focusAreas && focusAreas.length > 0) {
      const categoryMapping: Record<string, string[]> = {
        'content': ['content'],
        'delivery': ['speech', 'overall'],
        'design': ['visual']
      };

      const isAligned = focusAreas.some(area => 
        categoryMapping[area]?.includes(recommendation.category)
      );

      if (isAligned) adjustmentScore += 1.5;
    }

    // Previous sessions adjustment (more sessions = favor advanced recommendations)
    if (previousSessions && previousSessions > 3) {
      if (recommendation.type === 'advanced_optimization') {
        adjustmentScore += 1.5; // was 1 - stronger boost for experienced users
      }
    }

    return Math.max(0, Math.min(10, adjustmentScore));
  }

  /**
   * Calculate impact multiplier for business metrics
   */
  private calculateImpactMultiplier(
    recommendation: Recommendation,
    context: PrioritizationContext
  ): number {
    let multiplier = 1.0;

    // Base multiplier based on recommendation type (adjusted for better balance)
    const typeMultipliers: Record<string, number> = {
      'critical_issue': 1.4,  
      'high_impact_improvement': 1.2,  
      'strength_to_leverage': 1.1,
      'advanced_optimization': 1.05,  // was 0.9 - now slightly favored
      'quick_win': 1.0,
      'comparative_insight': 0.95
    };

    multiplier *= typeMultipliers[recommendation.type] || 1.0;

    // Investor relevance boost (reduced impact)
    const investorRelevance = this.calculateInvestorImpact(recommendation, context);
    const normalizedRelevance = Math.min(10, investorRelevance);
    const relevanceBoost = 0.9 + (normalizedRelevance / 10) * 0.2; // Maps 0-10 to 0.9-1.1x (was 0.8-1.2x)
    multiplier *= relevanceBoost;

    // Audience type specific boosts (reduced)
    const audienceMultipliers: Record<string, number> = {
      'investors': 1.1,  // was 1.2
      'customers': 1.0,
      'internal': 0.95,  // was 0.9
      'conference': 1.05  // was 1.1
    };
    multiplier *= audienceMultipliers[context.presentationContext.audienceType] || 1.0;

    // Presentation criticality boost (reduced)
    const criticalityMultipliers: Record<string, number> = {
      'critical': 1.3,  // was 1.5
      'high': 1.2,      // was 1.3
      'medium': 1.0,
      'low': 0.9        // was 0.8
    };

    multiplier *= criticalityMultipliers[context.presentationContext.criticality];

    return Math.round(multiplier * 10) / 10;
  }

  /**
   * Calculate urgency factor based on time constraints
   */
  private calculateUrgencyFactor(
    recommendation: Recommendation,
    context: PrioritizationContext
  ): number {
    const timeToPresentation = context.userProfile.timeToPresentation || 30;
    const implementationTime = this.estimateImplementationTime(recommendation, context);

    // If implementation time is close to or exceeds available time
    if (implementationTime >= timeToPresentation * 0.8) {
      return 0.5; // Low urgency due to time constraints
    } else if (implementationTime <= timeToPresentation * 0.3) {
      return 1.5; // High urgency - plenty of time
    }

    return 1.0; // Normal urgency
  }

  /**
   * Estimate implementation time in hours
   */
  private estimateImplementationTime(
    recommendation: Recommendation,
    context: PrioritizationContext
  ): number {
    const baseHours: Record<string, number> = {
      'low': 2,
      'medium': 8,
      'high': 20
    };

    let hours = baseHours[recommendation.estimatedEffort] || 8;

    // Adjust for user experience
    const experienceMultipliers: Record<string, number> = {
      'beginner': 1.5,
      'intermediate': 1.0,
      'advanced': 0.7
    };

    hours *= experienceMultipliers[context.userProfile.experienceLevel];

    return Math.round(hours);
  }

  /**
   * Identify prerequisite recommendations
   */
  private identifyPrerequisites(
    recommendation: Recommendation,
    context: PrioritizationContext
  ): string[] {
    const prerequisites: string[] = [];

    // Content recommendations often require foundational work
    if (recommendation.category === 'content' && recommendation.type === 'high_impact_improvement') {
      // Check if there are critical issues in the same category that should be addressed first
      const criticalInSameCategory = context.frameworkScore.individualScores
        .filter(score => 
          score.score <= 3 && 
          recommendation.relatedFrameworkPoints.includes(score.pointId)
        );

      if (criticalInSameCategory.length > 0) {
        prerequisites.push('address_critical_content_issues');
      }
    }

    return prerequisites;
  }

  /**
   * Apply contextual ordering adjustments after priority scoring
   */
  private applyContextualOrdering(
    recommendations: PrioritizedRecommendation[],
    context: PrioritizationContext
  ): PrioritizedRecommendation[] {
    
    // Group by priority tiers for better organization
    const tiers = {
      critical: recommendations.filter(r => r.priorityScore >= 11.0),  
      high: recommendations.filter(r => r.priorityScore >= 10.6 && r.priorityScore < 11.0),  // was 10.5
      medium: recommendations.filter(r => r.priorityScore >= 9.0 && r.priorityScore < 10.6),  // was 10.5
      low: recommendations.filter(r => r.priorityScore < 9.0)  
    };

    // Within each tier, apply logical ordering
    (Object.keys(tiers) as Array<keyof typeof tiers>).forEach(tierKey => {
      tiers[tierKey] = tiers[tierKey].sort((a: PrioritizedRecommendation, b: PrioritizedRecommendation) => {
        // First sort by prerequisites (items with no prerequisites come first)
        const aHasPrereqs = a.prerequisiteRecommendations && a.prerequisiteRecommendations.length > 0;
        const bHasPrereqs = b.prerequisiteRecommendations && b.prerequisiteRecommendations.length > 0;
        
        if (aHasPrereqs && !bHasPrereqs) return 1;
        if (!aHasPrereqs && bHasPrereqs) return -1;
        
        // Then by investor relevance if investor impact weight is high (>40%)
        if (Math.abs(a.priorityScore - b.priorityScore) < 0.5) {
          if (this.weights.investorImpact > 40) {
            // When investor impact is heavily weighted, break ties by investor relevance
            const relevanceDiff = b.investorRelevance - a.investorRelevance;
            if (Math.abs(relevanceDiff) > 0.5) {
              return relevanceDiff;
            }
          }
          // Otherwise, fall back to implementation time (quicker wins first)
          return a.timeToImplement - b.timeToImplement;
        }
        
        // Finally by priority score
        return b.priorityScore - a.priorityScore;
      });
    });

    // Combine tiers back into single array
    return [...tiers.critical, ...tiers.high, ...tiers.medium, ...tiers.low];
  }

  /**
   * Get priority tier for a recommendation
   */
  getPriorityTier(priorityScore: number): 'critical' | 'high' | 'medium' | 'low' {
    if (priorityScore >= 11.0) return 'critical';  
    if (priorityScore >= 10.6) return 'high';      // was 10.5 - slightly higher to exclude 10.5
    if (priorityScore >= 9.0) return 'medium';     
    return 'low';
  }

  /**
   * Generate priority explanation for a recommendation
   */
  generatePriorityExplanation(recommendation: PrioritizedRecommendation): string {
    const tier = this.getPriorityTier(recommendation.priorityScore);
    const timeStr = recommendation.timeToImplement === 1 ? '1 hour' : `${recommendation.timeToImplement} hours`;
    
    let explanation = `${tier.charAt(0).toUpperCase() + tier.slice(1)} priority (${recommendation.priorityScore}/10). `;
    explanation += `Estimated implementation: ${timeStr}. `;
    
    if (recommendation.investorRelevance >= 8) {
      explanation += 'High investor impact. ';
    }
    
    if (recommendation.implementationDifficulty <= 3) {
      explanation += 'Quick to implement. ';
    }
    
    if (recommendation.urgencyFactor > 1.2) {
      explanation += 'Time-sensitive improvement.';
    } else if (recommendation.urgencyFactor < 0.8) {
      explanation += 'Consider for future sessions due to time constraints.';
    }

    return explanation.trim();
  }
}

/**
 * Utility function to prioritize recommendations with default context
 */
export function prioritizeRecommendations(
  recommendations: Recommendation[],
  frameworkScore: ComprehensiveFrameworkScore,
  userProfile?: Partial<PrioritizationContext['userProfile']>,
  presentationContext?: Partial<PrioritizationContext['presentationContext']>
): PrioritizedRecommendation[] {
  
  const context: PrioritizationContext = {
    userProfile: {
      experienceLevel: 'intermediate',
      timeToPresentation: 14,
      ...userProfile
    },
    presentationContext: {
      audienceType: 'investors',
      presentationLength: 10,
      criticality: 'high',
      ...presentationContext
    },
    frameworkScore
  };

  const prioritizer = new RecommendationPrioritizer();
  return prioritizer.prioritizeRecommendations(recommendations, context);
} 