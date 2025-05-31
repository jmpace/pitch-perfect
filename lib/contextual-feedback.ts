/**
 * Contextual Feedback Generation System
 * 
 * Generates personalized, context-aware feedback for recommendations based on:
 * - Specific slide content and timing
 * - User performance data and progress
 * - Historical interactions and improvement areas
 */

import { 
  PrioritizedRecommendation
} from './recommendation-prioritization';
import { 
  Recommendation, 
  RecommendationSet
} from './recommendation-engine';
import { 
  FrameAnalysisResult, 
  SlideContentAnalysis, 
  VisualQualityAnalysis,
  EngagementCuesAnalysis 
} from './vision-analysis';
import { 
  TranscriptAnalysis, 
  MultimodalAnalysisInput,
  FrameworkScorer 
} from './scoring-logic';
import { 
  ComprehensiveFrameworkScore, 
  FrameworkScore,
  FRAMEWORK_POINTS 
} from './scoring-framework';
import { TimelineRecommendation } from './recommendation-timeline';

// Core interfaces for contextual feedback
export interface ContextualFeedback {
  id: string;
  recommendationId: string;
  contextType: ContextType;
  personalizationLevel: PersonalizationLevel;
  content: FeedbackContent;
  triggers: FeedbackTriggers;
  displayMetadata: FeedbackDisplayMetadata;
  generatedAt: Date;
  lastUpdated: Date;
}

export type ContextType = 
  | 'slide_specific'     // Tied to specific slide content
  | 'timestamp_based'    // Tied to specific timing in presentation
  | 'performance_based'  // Based on user's score patterns
  | 'progress_based'     // Based on user's improvement journey
  | 'comparative'        // Based on benchmarks/comparisons
  | 'behavioral';        // Based on user interaction patterns

export type PersonalizationLevel = 
  | 'basic'      // General feedback
  | 'adaptive'   // Tailored to user level
  | 'contextual' // Considers current state
  | 'predictive' // Anticipates user needs
  | 'dynamic';   // Real-time adaptation

export interface FeedbackContent {
  primaryMessage: string;
  contextualExplanation: string;
  actionableInsights: string[];
  progressIndicators?: ProgressIndicator[];
  slideReferences?: SlideReference[];
  timingCues?: TimingCue[];
  performanceComparisons?: PerformanceComparison[];
  nextSteps: NextStep[];
}

export interface FeedbackTriggers {
  slideIndex?: number;
  timestampRange?: [number, number]; // [start, end] in seconds
  performanceThresholds?: {
    minScore?: number;
    maxScore?: number;
    categoryScores?: Record<string, [number, number]>;
  };
  userBehavior?: {
    sessionCount?: number;
    timeSpent?: number;
    interactionPatterns?: string[];
  };
  contextualConditions?: {
    slideType?: string;
    frameworkPoints?: string[];
    improvementAreas?: string[];
  };
}

export interface FeedbackDisplayMetadata {
  priority: 'critical' | 'high' | 'medium' | 'low';
  displayDuration?: number; // seconds
  interactionRequired: boolean;
  visualStyle: {
    backgroundColor?: string;
    iconType?: string;
    emphasisLevel?: 'subtle' | 'moderate' | 'prominent';
  };
  placement: {
    context: 'timeline' | 'slide_overlay' | 'sidebar' | 'modal' | 'inline';
    position?: string;
  };
}

export interface ProgressIndicator {
  metric: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  trend: 'improving' | 'declining' | 'stable';
  confidenceLevel: number;
}

export interface SlideReference {
  slideIndex: number;
  slideTitle?: string;
  specificElement?: string; // e.g., "bullet point 3", "chart title"
  timestamp?: number;
  analysisConfidence: number;
}

export interface TimingCue {
  timestamp: number;
  description: string;
  suggestedAction: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface PerformanceComparison {
  metric: string;
  userValue: number;
  benchmarkValue: number;
  percentileRank?: number;
  improvementPotential: number;
  contextualNote: string;
}

export interface NextStep {
  action: string;
  estimatedTimeMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  expectedImpact: 'low' | 'medium' | 'high';
  dependencies?: string[];
  resources?: Resource[];
}

export interface Resource {
  type: 'article' | 'video' | 'exercise' | 'template' | 'tool';
  title: string;
  description: string;
  url?: string;
  duration?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

// User context for personalization
export interface UserFeedbackContext {
  userId?: string;
  sessionHistory: SessionSummary[];
  currentSession: CurrentSessionState;
  userProfile: UserProfile;
  learningPreferences: LearningPreferences;
}

export interface SessionSummary {
  sessionId: string;
  date: Date;
  overallScore: number;
  categoryScores: Record<string, number>;
  completedRecommendations: string[];
  timeSpent: number;
  improvementAreas: string[];
}

export interface CurrentSessionState {
  sessionId: string;
  currentSlide?: number;
  currentTimestamp?: number;
  activeRecommendations: string[];
  completedActions: string[];
  strugglingAreas: string[];
  progressMetrics: Record<string, number>;
}

export interface UserProfile {
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  focusAreas: string[];
  strengthCategories: string[];
  improvementPriorities: string[];
  presentationContext: {
    audienceType: string;
    timeToPresentation?: number;
    stakesLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface LearningPreferences {
  feedbackStyle: 'direct' | 'encouraging' | 'detailed' | 'concise';
  preferredContentTypes: ('text' | 'visual' | 'interactive' | 'examples')[];
  notificationFrequency: 'minimal' | 'moderate' | 'frequent';
  progressTrackingLevel: 'basic' | 'detailed' | 'comprehensive';
}

// Analysis context for feedback generation
export interface AnalysisContext {
  comprehensiveScore: ComprehensiveFrameworkScore;
  slideAnalysis: FrameAnalysisResult[];
  transcriptAnalysis: TranscriptAnalysis;
  timelineData?: TimelineRecommendation[];
  benchmarkData?: {
    industryAverage: number;
    topPerformerThreshold: number;
    categoryBenchmarks: Record<string, number>;
  };
}

/**
 * Main Contextual Feedback Generator
 */
export class ContextualFeedbackGenerator {
  private feedbackId = 1;

  /**
   * Generate comprehensive contextual feedback for a set of recommendations
   */
  async generateContextualFeedback(
    recommendations: PrioritizedRecommendation[],
    analysisContext: AnalysisContext,
    userContext: UserFeedbackContext
  ): Promise<ContextualFeedback[]> {
    const feedback: ContextualFeedback[] = [];

    for (const recommendation of recommendations) {
      // Generate multiple feedback variants for different contexts
      const contextualVariants = await this.generateFeedbackVariants(
        recommendation,
        analysisContext,
        userContext
      );
      
      feedback.push(...contextualVariants);
    }

    // Sort by priority and personalization relevance
    return this.prioritizeFeedback(feedback, userContext);
  }

  /**
   * Generate feedback variants for different contexts
   */
  private async generateFeedbackVariants(
    recommendation: PrioritizedRecommendation,
    analysisContext: AnalysisContext,
    userContext: UserFeedbackContext
  ): Promise<ContextualFeedback[]> {
    const variants: ContextualFeedback[] = [];

    // Slide-specific feedback
    const slideSpecific = await this.generateSlideSpecificFeedback(
      recommendation,
      analysisContext,
      userContext
    );
    if (slideSpecific) variants.push(slideSpecific);

    // Performance-based feedback
    const performanceBased = await this.generatePerformanceBasedFeedback(
      recommendation,
      analysisContext,
      userContext
    );
    if (performanceBased) variants.push(performanceBased);

    // Progress-based feedback
    const progressBased = await this.generateProgressBasedFeedback(
      recommendation,
      analysisContext,
      userContext
    );
    if (progressBased) variants.push(progressBased);

    // Timing-based feedback
    const timingBased = await this.generateTimingBasedFeedback(
      recommendation,
      analysisContext,
      userContext
    );
    if (timingBased) variants.push(timingBased);

    return variants;
  }

  /**
   * Generate slide-specific contextual feedback
   */
  private async generateSlideSpecificFeedback(
    recommendation: PrioritizedRecommendation,
    analysisContext: AnalysisContext,
    userContext: UserFeedbackContext
  ): Promise<ContextualFeedback | null> {
    // Find slides related to this recommendation's framework points
    const relatedSlides = this.findRelatedSlides(
      recommendation.relatedFrameworkPoints,
      analysisContext.slideAnalysis
    );

    if (relatedSlides.length === 0) return null;

    const slideReferences: SlideReference[] = relatedSlides.map(slide => ({
      slideIndex: slide.timestamp, // Using timestamp as proxy for slide index
      slideTitle: slide.analysis.slideContent?.title,
      timestamp: slide.timestamp,
      analysisConfidence: slide.confidence
    }));

    const contextualExplanation = this.generateSlideContextExplanation(
      recommendation,
      relatedSlides,
      userContext
    );

    const actionableInsights = this.generateSlideSpecificInsights(
      recommendation,
      relatedSlides,
      analysisContext
    );

    return {
      id: this.generateFeedbackId(),
      recommendationId: recommendation.id,
      contextType: 'slide_specific',
      personalizationLevel: 'contextual',
      content: {
        primaryMessage: `Improve ${recommendation.title} on specific slides`,
        contextualExplanation,
        actionableInsights,
        slideReferences,
        nextSteps: this.generateSlideSpecificNextSteps(recommendation, relatedSlides)
      },
      triggers: {
        slideIndex: relatedSlides[0]?.timestamp,
        contextualConditions: {
          frameworkPoints: recommendation.relatedFrameworkPoints
        }
      },
      displayMetadata: {
        priority: recommendation.priority,
        interactionRequired: false,
        visualStyle: {
          iconType: 'slide',
          emphasisLevel: 'moderate'
        },
        placement: {
          context: 'slide_overlay'
        }
      },
      generatedAt: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Generate performance-based contextual feedback
   */
  private async generatePerformanceBasedFeedback(
    recommendation: PrioritizedRecommendation,
    analysisContext: AnalysisContext,
    userContext: UserFeedbackContext
  ): Promise<ContextualFeedback | null> {
    const { comprehensiveScore } = analysisContext;
    
    // Find relevant performance metrics
    const relevantScores = comprehensiveScore.individualScores.filter(score =>
      recommendation.relatedFrameworkPoints.includes(score.pointId)
    );

    if (relevantScores.length === 0) return null;

    const performanceComparisons = this.generatePerformanceComparisons(
      relevantScores,
      analysisContext.benchmarkData,
      userContext
    );

    const progressIndicators = this.generateProgressIndicators(
      relevantScores,
      userContext.sessionHistory
    );

    const contextualExplanation = this.generatePerformanceContextExplanation(
      recommendation,
      relevantScores,
      userContext
    );

    return {
      id: this.generateFeedbackId(),
      recommendationId: recommendation.id,
      contextType: 'performance_based',
      personalizationLevel: 'adaptive',
      content: {
        primaryMessage: `Based on your ${relevantScores[0]?.score.toFixed(1)}/10 score in ${this.getFrameworkPointTitle(relevantScores[0]?.pointId)}`,
        contextualExplanation,
        actionableInsights: this.generatePerformanceInsights(relevantScores, recommendation),
        performanceComparisons,
        progressIndicators,
        nextSteps: this.generatePerformanceBasedNextSteps(recommendation, relevantScores)
      },
      triggers: {
        performanceThresholds: {
          minScore: Math.min(...relevantScores.map(s => s.score)),
          maxScore: Math.max(...relevantScores.map(s => s.score))
        },
        contextualConditions: {
          frameworkPoints: recommendation.relatedFrameworkPoints,
          improvementAreas: relevantScores
            .filter(s => s.score < 6)
            .map(s => s.pointId)
        }
      },
      displayMetadata: {
        priority: relevantScores.some(s => s.score < 4) ? 'critical' : 
                 relevantScores.some(s => s.score < 6) ? 'high' : 'medium',
        interactionRequired: true,
        visualStyle: {
          iconType: 'performance',
          emphasisLevel: relevantScores.some(s => s.score < 5) ? 'prominent' : 'moderate'
        },
        placement: {
          context: 'sidebar'
        }
      },
      generatedAt: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Generate progress-based contextual feedback
   */
  private async generateProgressBasedFeedback(
    recommendation: PrioritizedRecommendation,
    analysisContext: AnalysisContext,
    userContext: UserFeedbackContext
  ): Promise<ContextualFeedback | null> {
    if (userContext.sessionHistory.length < 2) return null;

    const progressData = this.analyzeProgressTrends(
      recommendation.relatedFrameworkPoints,
      userContext.sessionHistory
    );

    if (!progressData.hasSignificantTrends) return null;

    const contextualExplanation = this.generateProgressContextExplanation(
      recommendation,
      progressData,
      userContext
    );

    return {
      id: this.generateFeedbackId(),
      recommendationId: recommendation.id,
      contextType: 'progress_based',
      personalizationLevel: 'predictive',
      content: {
        primaryMessage: `${progressData.trend === 'improving' ? 'Keep building on' : 'Focus on improving'} your ${recommendation.category} skills`,
        contextualExplanation,
        actionableInsights: this.generateProgressInsights(progressData, recommendation),
        progressIndicators: progressData.indicators,
        nextSteps: this.generateProgressBasedNextSteps(recommendation, progressData)
      },
      triggers: {
        userBehavior: {
          sessionCount: userContext.sessionHistory.length,
          timeSpent: userContext.sessionHistory.reduce((sum, s) => sum + s.timeSpent, 0)
        },
        contextualConditions: {
          improvementAreas: progressData.strugglingAreas
        }
      },
      displayMetadata: {
        priority: progressData.trend === 'declining' ? 'high' : 'medium',
        interactionRequired: false,
        visualStyle: {
          iconType: 'progress',
          emphasisLevel: 'moderate'
        },
        placement: {
          context: 'timeline'
        }
      },
      generatedAt: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Generate timing-based contextual feedback
   */
  private async generateTimingBasedFeedback(
    recommendation: PrioritizedRecommendation,
    analysisContext: AnalysisContext,
    userContext: UserFeedbackContext
  ): Promise<ContextualFeedback | null> {
    const { transcriptAnalysis } = analysisContext;
    
    // Find timing issues related to this recommendation
    const timingCues = this.extractTimingCues(
      recommendation,
      transcriptAnalysis,
      analysisContext.slideAnalysis
    );

    if (timingCues.length === 0) return null;

    const contextualExplanation = this.generateTimingContextExplanation(
      recommendation,
      timingCues,
      transcriptAnalysis
    );

    return {
      id: this.generateFeedbackId(),
      recommendationId: recommendation.id,
      contextType: 'timestamp_based',
      personalizationLevel: 'contextual',
      content: {
        primaryMessage: `Timing optimization for ${recommendation.title}`,
        contextualExplanation,
        actionableInsights: this.generateTimingInsights(timingCues, recommendation),
        timingCues,
        nextSteps: this.generateTimingBasedNextSteps(recommendation, timingCues)
      },
      triggers: {
        timestampRange: [
          Math.min(...timingCues.map(c => c.timestamp)),
          Math.max(...timingCues.map(c => c.timestamp))
        ],
        contextualConditions: {
          frameworkPoints: recommendation.relatedFrameworkPoints
        }
      },
      displayMetadata: {
        priority: timingCues.some(c => c.importance === 'critical') ? 'critical' : 'medium',
        interactionRequired: false,
        visualStyle: {
          iconType: 'timing',
          emphasisLevel: 'subtle'
        },
        placement: {
          context: 'timeline'
        }
      },
      generatedAt: new Date(),
      lastUpdated: new Date()
    };
  }

  // Helper methods
  private findRelatedSlides(
    frameworkPoints: string[],
    slideAnalysis: FrameAnalysisResult[]
  ): FrameAnalysisResult[] {
    // Implementation to match framework points to slides
    return slideAnalysis.filter(slide => {
      // Check if slide content relates to framework points
      const content = slide.analysis.slideContent;
      const visual = slide.analysis.visualQuality;
      
      // Simple keyword matching - could be enhanced with NLP
      const slideText = [
        content?.title || '',
        ...(content?.bulletPoints || []),
        ...(content?.keyMessages || [])
      ].join(' ').toLowerCase();

      return frameworkPoints.some(point => {
        const pointConfig = FRAMEWORK_POINTS.find(p => p.id === point);
        if (!pointConfig) return false;
        
        // Match based on point category and content
        const keywords = pointConfig.category.toLowerCase();
        return slideText.includes(keywords);
      });
    });
  }

  private generateSlideContextExplanation(
    recommendation: PrioritizedRecommendation,
    relatedSlides: FrameAnalysisResult[],
    userContext: UserFeedbackContext
  ): string {
    const slideCount = relatedSlides.length;
    const slideNumbers = relatedSlides.map((_, i) => i + 1).join(', ');
    
    return `This recommendation applies specifically to ${slideCount} slide${slideCount > 1 ? 's' : ''} (${slideNumbers}) in your presentation. Based on your ${userContext.userProfile.experienceLevel} experience level, these slides show opportunities for ${recommendation.category} improvement.`;
  }

  private generateSlideSpecificInsights(
    recommendation: PrioritizedRecommendation,
    relatedSlides: FrameAnalysisResult[],
    analysisContext: AnalysisContext
  ): string[] {
    const insights: string[] = [];
    
    relatedSlides.forEach((slide, index) => {
      const content = slide.analysis.slideContent;
      const visual = slide.analysis.visualQuality;
      
      if (content?.informationDensity === 'high') {
        insights.push(`Slide ${index + 1}: Reduce information density for better comprehension`);
      }
      
      if (visual?.overallProfessionalism && visual.overallProfessionalism < 6) {
        insights.push(`Slide ${index + 1}: Improve visual professionalism (current: ${visual.overallProfessionalism}/10)`);
      }
      
      if (content?.textReadability === 'low') {
        insights.push(`Slide ${index + 1}: Enhance text readability for audience engagement`);
      }
    });

    return insights.slice(0, 3); // Limit to top 3 insights
  }

  private generateSlideSpecificNextSteps(
    recommendation: PrioritizedRecommendation,
    relatedSlides: FrameAnalysisResult[]
  ): NextStep[] {
    return [
      {
        action: `Review and optimize ${relatedSlides.length} identified slide${relatedSlides.length > 1 ? 's' : ''}`,
        estimatedTimeMinutes: relatedSlides.length * 10,
        difficulty: 'medium',
        expectedImpact: 'high'
      },
      {
        action: 'Practice presenting the improved slides',
        estimatedTimeMinutes: 15,
        difficulty: 'easy',
        expectedImpact: 'medium'
      }
    ];
  }

  private generatePerformanceComparisons(
    scores: FrameworkScore[],
    benchmarkData: AnalysisContext['benchmarkData'],
    userContext: UserFeedbackContext
  ): PerformanceComparison[] {
    if (!benchmarkData) return [];

    return scores.map(score => ({
      metric: this.getFrameworkPointTitle(score.pointId),
      userValue: score.score,
      benchmarkValue: benchmarkData.categoryBenchmarks?.[score.pointId] || benchmarkData.industryAverage,
      improvementPotential: Math.max(0, (benchmarkData.topPerformerThreshold - score.score)),
      contextualNote: score.score < benchmarkData.industryAverage ? 
        'Below industry average - high improvement opportunity' :
        'Above average - focus on optimization'
    }));
  }

  private generateProgressIndicators(
    currentScores: FrameworkScore[],
    sessionHistory: SessionSummary[]
  ): ProgressIndicator[] {
    if (sessionHistory.length < 2) return [];

    const previousSession = sessionHistory[sessionHistory.length - 2];
    
    return currentScores.map(score => {
      const previousScore = previousSession.categoryScores[score.pointId] || score.score;
      const trend = score.score > previousScore ? 'improving' : 
                   score.score < previousScore ? 'declining' : 'stable';
      
      return {
        metric: this.getFrameworkPointTitle(score.pointId),
        currentValue: score.score,
        targetValue: Math.min(10, score.score + 2),
        unit: 'points',
        trend,
        confidenceLevel: 0.8
      };
    });
  }

  private generatePerformanceContextExplanation(
    recommendation: PrioritizedRecommendation,
    scores: FrameworkScore[],
    userContext: UserFeedbackContext
  ): string {
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const experienceContext = this.getExperienceContext(userContext.userProfile.experienceLevel);
    
    return `Your current performance in ${recommendation.category} (${avgScore.toFixed(1)}/10) ${experienceContext}. This recommendation is tailored to your specific strengths and improvement areas.`;
  }

  private generatePerformanceInsights(
    scores: FrameworkScore[],
    recommendation: PrioritizedRecommendation
  ): string[] {
    const insights: string[] = [];
    
    scores.forEach(score => {
      if (score.improvementSuggestions.length > 0) {
        insights.push(`${this.getFrameworkPointTitle(score.pointId)}: ${score.improvementSuggestions[0]}`);
      }
    });

    return insights.slice(0, 3);
  }

  private generatePerformanceBasedNextSteps(
    recommendation: PrioritizedRecommendation,
    scores: FrameworkScore[]
  ): NextStep[] {
    const lowestScore = Math.min(...scores.map(s => s.score));
    
    return [
      {
        action: `Focus on improving lowest-scoring area (${lowestScore.toFixed(1)}/10)`,
        estimatedTimeMinutes: 30,
        difficulty: lowestScore < 4 ? 'hard' : 'medium',
        expectedImpact: 'high'
      },
      {
        action: 'Track progress with follow-up practice session',
        estimatedTimeMinutes: 20,
        difficulty: 'easy',
        expectedImpact: 'medium'
      }
    ];
  }

  private analyzeProgressTrends(
    frameworkPoints: string[],
    sessionHistory: SessionSummary[]
  ): {
    hasSignificantTrends: boolean;
    trend: 'improving' | 'declining' | 'stable';
    indicators: ProgressIndicator[];
    strugglingAreas: string[];
  } {
    if (sessionHistory.length < 2) {
      return {
        hasSignificantTrends: false,
        trend: 'stable',
        indicators: [],
        strugglingAreas: []
      };
    }

    const recentSessions = sessionHistory.slice(-3);
    const indicators: ProgressIndicator[] = [];
    const strugglingAreas: string[] = [];
    
    frameworkPoints.forEach(pointId => {
      const scores = recentSessions.map(session => 
        session.categoryScores[pointId] || 0
      ).filter(score => score > 0);
      
      if (scores.length >= 2) {
        const trend = scores[scores.length - 1] > scores[0] ? 'improving' : 
                     scores[scores.length - 1] < scores[0] ? 'declining' : 'stable';
        
        indicators.push({
          metric: this.getFrameworkPointTitle(pointId),
          currentValue: scores[scores.length - 1],
          targetValue: Math.min(10, scores[scores.length - 1] + 1),
          unit: 'points',
          trend,
          confidenceLevel: 0.7
        });

        if (trend === 'declining' || scores[scores.length - 1] < 5) {
          strugglingAreas.push(pointId);
        }
      }
    });

    const overallTrend = indicators.length > 0 ? 
      (indicators.filter(i => i.trend === 'improving').length > indicators.filter(i => i.trend === 'declining').length ? 'improving' : 'declining') : 'stable';

    return {
      hasSignificantTrends: indicators.length > 0,
      trend: overallTrend,
      indicators,
      strugglingAreas
    };
  }

  private generateProgressContextExplanation(
    recommendation: PrioritizedRecommendation,
    progressData: any,
    userContext: UserFeedbackContext
  ): string {
    const sessionCount = userContext.sessionHistory.length;
    const trendText = progressData.trend === 'improving' ? 'improvement' : 
                     progressData.trend === 'declining' ? 'some challenges' : 'steady progress';
    
    return `Over your ${sessionCount} practice sessions, you've shown ${trendText} in ${recommendation.category}. This personalized feedback builds on your progress patterns.`;
  }

  private generateProgressInsights(progressData: any, recommendation: PrioritizedRecommendation): string[] {
    const insights: string[] = [];
    
    if (progressData.trend === 'improving') {
      insights.push('Continue building on your recent improvements');
      insights.push('Focus on consistency to maintain momentum');
    } else if (progressData.trend === 'declining') {
      insights.push('Address recent performance dips with focused practice');
      insights.push('Consider revisiting fundamental concepts');
    }
    
    if (progressData.strugglingAreas.length > 0) {
      insights.push(`Pay special attention to: ${progressData.strugglingAreas.map(this.getFrameworkPointTitle).join(', ')}`);
    }

    return insights.slice(0, 3);
  }

  private generateProgressBasedNextSteps(
    recommendation: PrioritizedRecommendation,
    progressData: any
  ): NextStep[] {
    const steps: NextStep[] = [];
    
    if (progressData.trend === 'improving') {
      steps.push({
        action: 'Continue current practice approach',
        estimatedTimeMinutes: 20,
        difficulty: 'easy',
        expectedImpact: 'medium'
      });
    } else {
      steps.push({
        action: 'Revisit fundamentals and adjust practice strategy',
        estimatedTimeMinutes: 40,
        difficulty: 'medium',
        expectedImpact: 'high'
      });
    }

    return steps;
  }

  private extractTimingCues(
    recommendation: PrioritizedRecommendation,
    transcriptAnalysis: TranscriptAnalysis,
    slideAnalysis: FrameAnalysisResult[]
  ): TimingCue[] {
    const cues: TimingCue[] = [];
    
    // Extract timing issues based on recommendation type
    if (recommendation.relatedFrameworkPoints.includes('speech_pace_rhythm')) {
      if (transcriptAnalysis.wordsPerMinute > 200) {
        cues.push({
          timestamp: transcriptAnalysis.duration * 0.3, // Example: 30% through
          description: 'Speaking pace too fast for comprehension',
          suggestedAction: 'Slow down to 160-180 WPM',
          importance: 'high'
        });
      }
    }

    if (recommendation.relatedFrameworkPoints.includes('visual_timing_flow')) {
      slideAnalysis.forEach((slide, index) => {
        const slideTime = slide.timestamp;
        if (index > 0) {
          const previousSlide = slideAnalysis[index - 1];
          const timeOnSlide = slideTime - previousSlide.timestamp;
          
          if (timeOnSlide < 30) { // Less than 30 seconds
            cues.push({
              timestamp: slideTime,
              description: `Slide ${index + 1} shown too briefly`,
              suggestedAction: 'Spend 45-60 seconds per slide',
              importance: 'medium'
            });
          }
        }
      });
    }

    return cues;
  }

  private generateTimingContextExplanation(
    recommendation: PrioritizedRecommendation,
    timingCues: TimingCue[],
    transcriptAnalysis: TranscriptAnalysis
  ): string {
    const avgTime = transcriptAnalysis.duration / 60;
    const cueCount = timingCues.length;
    
    return `Throughout your ${avgTime.toFixed(1)}-minute presentation, we identified ${cueCount} timing optimization${cueCount > 1 ? 's' : ''} for ${recommendation.title}.`;
  }

  private generateTimingInsights(timingCues: TimingCue[], recommendation: PrioritizedRecommendation): string[] {
    return timingCues
      .filter(cue => cue.importance === 'critical' || cue.importance === 'high')
      .map(cue => cue.suggestedAction)
      .slice(0, 3);
  }

  private generateTimingBasedNextSteps(
    recommendation: PrioritizedRecommendation,
    timingCues: TimingCue[]
  ): NextStep[] {
    const criticalCues = timingCues.filter(cue => cue.importance === 'critical' || cue.importance === 'high');
    
    return [
      {
        action: `Address ${criticalCues.length} critical timing issue${criticalCues.length > 1 ? 's' : ''}`,
        estimatedTimeMinutes: criticalCues.length * 10,
        difficulty: 'medium',
        expectedImpact: 'high'
      },
      {
        action: 'Practice with improved timing',
        estimatedTimeMinutes: 25,
        difficulty: 'medium',
        expectedImpact: 'high'
      }
    ];
  }

  private prioritizeFeedback(
    feedback: ContextualFeedback[],
    userContext: UserFeedbackContext
  ): ContextualFeedback[] {
    return feedback.sort((a, b) => {
      // Priority order: critical > high > medium > low
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.displayMetadata.priority] - priorityOrder[a.displayMetadata.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Secondary sort by personalization level
      const personalizationOrder = { dynamic: 5, predictive: 4, contextual: 3, adaptive: 2, basic: 1 };
      return personalizationOrder[b.personalizationLevel] - personalizationOrder[a.personalizationLevel];
    });
  }

  private getFrameworkPointTitle(pointId: string): string {
    const point = FRAMEWORK_POINTS.find(p => p.id === pointId);
    return point?.title || pointId;
  }

  private getExperienceContext(level: 'beginner' | 'intermediate' | 'advanced'): string {
    const contexts = {
      beginner: 'shows good foundation building with room for structured improvement',
      intermediate: 'demonstrates solid skills with opportunities for refinement',
      advanced: 'reflects strong capabilities with potential for optimization'
    };
    return contexts[level];
  }

  private generateFeedbackId(): string {
    return `feedback_${this.feedbackId++}_${Date.now()}`;
  }
}

/**
 * Utility functions for contextual feedback
 */
export class ContextualFeedbackUtils {
  /**
   * Filter feedback by context type
   */
  static filterByContext(
    feedback: ContextualFeedback[],
    contextType: ContextType
  ): ContextualFeedback[] {
    return feedback.filter(f => f.contextType === contextType);
  }

  /**
   * Filter feedback by current user state
   */
  static filterByCurrentState(
    feedback: ContextualFeedback[],
    currentState: {
      slideIndex?: number;
      timestamp?: number;
      activeRecommendations?: string[];
    }
  ): ContextualFeedback[] {
    return feedback.filter(f => {
      // Check slide-based triggers
      if (f.triggers.slideIndex !== undefined && currentState.slideIndex !== undefined) {
        if (f.triggers.slideIndex !== currentState.slideIndex) return false;
      }

      // Check timestamp-based triggers
      if (f.triggers.timestampRange && currentState.timestamp !== undefined) {
        const [start, end] = f.triggers.timestampRange;
        if (currentState.timestamp < start || currentState.timestamp > end) return false;
      }

      // Check active recommendations
      if (currentState.activeRecommendations) {
        if (!currentState.activeRecommendations.includes(f.recommendationId)) return false;
      }

      return true;
    });
  }

  /**
   * Get feedback summary for display
   */
  static generateFeedbackSummary(feedback: ContextualFeedback[]): {
    totalCount: number;
    byContext: Record<ContextType, number>;
    byPriority: Record<string, number>;
    topInsights: string[];
  } {
    const byContext = feedback.reduce((acc, f) => {
      acc[f.contextType] = (acc[f.contextType] || 0) + 1;
      return acc;
    }, {} as Record<ContextType, number>);

    const byPriority = feedback.reduce((acc, f) => {
      acc[f.displayMetadata.priority] = (acc[f.displayMetadata.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topInsights = feedback
      .slice(0, 5)
      .map(f => f.content.primaryMessage);

    return {
      totalCount: feedback.length,
      byContext,
      byPriority,
      topInsights
    };
  }
}

/**
 * Demo data for testing contextual feedback
 */
export const DEMO_USER_CONTEXT: UserFeedbackContext = {
  userId: 'demo_user_001',
  sessionHistory: [
    {
      sessionId: 'session_001',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      overallScore: 6.2,
      categoryScores: {
        speech: 5.8,
        content: 6.5,
        visual: 6.0,
        overall: 6.2
      },
      completedRecommendations: ['rec_001'],
      timeSpent: 1800, // 30 minutes
      improvementAreas: ['speech_pace_rhythm', 'speech_filler_words']
    },
    {
      sessionId: 'session_002',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      overallScore: 6.8,
      categoryScores: {
        speech: 6.5,
        content: 7.0,
        visual: 6.5,
        overall: 6.8
      },
      completedRecommendations: ['rec_001', 'rec_002'],
      timeSpent: 2100, // 35 minutes
      improvementAreas: ['visual_design_quality']
    }
  ],
  currentSession: {
    sessionId: 'session_003',
    currentSlide: 3,
    currentTimestamp: 180, // 3 minutes in
    activeRecommendations: ['rec_003', 'rec_004'],
    completedActions: ['review_slide_1', 'practice_intro'],
    strugglingAreas: ['visual_timing_flow'],
    progressMetrics: {
      timeSpent: 900, // 15 minutes so far
      slidesReviewed: 3,
      practiceAttempts: 2
    }
  },
  userProfile: {
    experienceLevel: 'intermediate',
    focusAreas: ['content', 'visual'],
    strengthCategories: ['content'],
    improvementPriorities: ['speech', 'visual'],
    presentationContext: {
      audienceType: 'investors',
      timeToPresentation: 5, // 5 days
      stakesLevel: 'high'
    }
  },
  learningPreferences: {
    feedbackStyle: 'detailed',
    preferredContentTypes: ['text', 'examples'],
    notificationFrequency: 'moderate',
    progressTrackingLevel: 'comprehensive'
  }
}; 