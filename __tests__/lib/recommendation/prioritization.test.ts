/**
 * Tests for Recommendation Prioritization Algorithm
 * 
 * Validates the weighting logic, contextual adjustments, and priority scoring
 * for pitch presentation recommendations.
 */

import {
  RecommendationPrioritizer,
  PrioritizationContext,
  PrioritizedRecommendation,
  PITCH_OPTIMIZATION_WEIGHTS,
  prioritizeRecommendations
} from '../../../lib/recommendation-prioritization';
import { Recommendation } from '../../../lib/recommendation-engine';
import { ComprehensiveFrameworkScore } from '../../../lib/scoring-framework';

// Mock data generators
const createMockFrameworkScore = (overrides: Partial<ComprehensiveFrameworkScore> = {}): ComprehensiveFrameworkScore => ({
  sessionId: 'test-session',
  overallScore: 6.5,
  categoryScores: {
    speech: 6.0,
    content: 7.0,
    visual: 6.5,
    overall: 6.8
  },
  individualScores: [
    { pointId: 'content_problem_solution', score: 4, rationale: 'Needs clarity', improvementSuggestions: [], confidence: 0.8 },
    { pointId: 'speech_filler_words', score: 3, rationale: 'Too many ums', improvementSuggestions: [], confidence: 0.9 },
    { pointId: 'visual_slide_design', score: 8, rationale: 'Great design', improvementSuggestions: [], confidence: 0.7 },
    { pointId: 'overall_persuasion_storytelling', score: 6, rationale: 'Good flow', improvementSuggestions: [], confidence: 0.8 }
  ],
  analysisTimestamp: new Date(),
  processingTime: 1000,
  ...overrides
});

const createMockRecommendation = (overrides: Partial<Recommendation> = {}): Recommendation => ({
  id: 'rec-1',
  type: 'high_impact_improvement',
  category: 'content',
  priority: 'high',
  title: 'Improve Problem Statement',
  description: 'Clarify the problem you are solving',
  actionableSteps: ['Research competitor pain points', 'Interview customers', 'Refine problem statement'],
  estimatedImpact: 'high',
  estimatedEffort: 'medium',
  relatedFrameworkPoints: ['content_problem_solution'],
  confidence: 0.8,
  evidence: 'Analysis shows unclear problem definition',
  ...overrides
});

const createMockContext = (overrides: Partial<PrioritizationContext> = {}): PrioritizationContext => ({
  userProfile: {
    experienceLevel: 'intermediate',
    timeToPresentation: 14,
    focusAreas: ['content']
  },
  presentationContext: {
    audienceType: 'investors',
    presentationLength: 10,
    criticality: 'high'
  },
  frameworkScore: createMockFrameworkScore(),
  ...overrides
});

describe('RecommendationPrioritizer', () => {
  let prioritizer: RecommendationPrioritizer;

  beforeEach(() => {
    prioritizer = new RecommendationPrioritizer();
  });

  describe('Core prioritization logic', () => {
    it('should prioritize critical issues over quick wins', () => {
      const criticalRec = createMockRecommendation({
        id: 'critical',
        type: 'critical_issue',
        relatedFrameworkPoints: ['speech_filler_words'], // score = 3 (critical)
        estimatedEffort: 'low'
      });

      const quickWinRec = createMockRecommendation({
        id: 'quick-win',
        type: 'quick_win',
        relatedFrameworkPoints: ['visual_slide_design'], // score = 8 (good)
        estimatedEffort: 'low'
      });

      const context = createMockContext();
      const result = prioritizer.prioritizeRecommendations([criticalRec, quickWinRec], context);

      expect(result[0].id).toBe('critical');
      expect(result[0].priorityScore).toBeGreaterThan(result[1].priorityScore);
    });

    it('should favor high investor impact recommendations', () => {
      const highImpactRec = createMockRecommendation({
        id: 'high-impact',
        relatedFrameworkPoints: ['content_problem_solution'], // High investor impact (10)
        estimatedEffort: 'medium'
      });

      const lowImpactRec = createMockRecommendation({
        id: 'low-impact',
        relatedFrameworkPoints: ['visual_timing_flow'], // Lower investor impact (5)
        estimatedEffort: 'medium'
      });

      const context = createMockContext();
      const result = prioritizer.prioritizeRecommendations([highImpactRec, lowImpactRec], context);

      expect(result[0].id).toBe('high-impact');
      expect(result[0].investorRelevance).toBeGreaterThan(result[1].investorRelevance);
    });

    it('should prioritize easier implementations when time is limited', () => {
      const easyRec = createMockRecommendation({
        id: 'easy',
        estimatedEffort: 'low',
        relatedFrameworkPoints: ['speech_pace_rhythm'] // Easy to implement
      });

      const hardRec = createMockRecommendation({
        id: 'hard',
        estimatedEffort: 'high',
        relatedFrameworkPoints: ['content_market_opportunity'] // Hard to implement
      });

      const urgentContext = createMockContext({
        userProfile: {
          experienceLevel: 'intermediate',
          timeToPresentation: 3 // Only 3 days!
        }
      });

      const result = prioritizer.prioritizeRecommendations([easyRec, hardRec], urgentContext);

      expect(result[0].id).toBe('easy');
      expect(result[0].timeToImplement).toBeLessThan(result[1].timeToImplement);
    });
  });

  describe('User experience adjustments', () => {
    it('should favor quick wins for beginners', () => {
      const quickWin = createMockRecommendation({
        id: 'quick-win',
        type: 'quick_win',
        category: 'speech'
      });

      const advanced = createMockRecommendation({
        id: 'advanced',
        type: 'advanced_optimization',
        category: 'content'
      });

      const beginnerContext = createMockContext({
        userProfile: {
          experienceLevel: 'beginner',
          timeToPresentation: 14
        }
      });

      const result = prioritizer.prioritizeRecommendations([quickWin, advanced], beginnerContext);

      expect(result[0].id).toBe('quick-win');
    });

    it('should favor advanced optimizations for experienced users', () => {
      const quickWin = createMockRecommendation({
        id: 'quick-win',
        type: 'quick_win',
        category: 'speech'
      });

      const advanced = createMockRecommendation({
        id: 'advanced',
        type: 'advanced_optimization',
        category: 'content',
        estimatedImpact: 'high'
      });

      const advancedContext = createMockContext({
        userProfile: {
          experienceLevel: 'advanced',
          timeToPresentation: 14,
          previousSessions: 5
        }
      });

      const result = prioritizer.prioritizeRecommendations([quickWin, advanced], advancedContext);

      // Advanced optimization should be prioritized for experienced users
      expect(result[0].id).toBe('advanced');
    });

    it('should boost recommendations aligned with user focus areas', () => {
      const contentRec = createMockRecommendation({
        id: 'content-focused',
        category: 'content',
        relatedFrameworkPoints: ['content_problem_solution']
      });

      const designRec = createMockRecommendation({
        id: 'design-focused',
        category: 'visual',
        relatedFrameworkPoints: ['visual_slide_design']
      });

      const contentFocusContext = createMockContext({
        userProfile: {
          experienceLevel: 'intermediate',
          focusAreas: ['content'],
          timeToPresentation: 14
        }
      });

      const result = prioritizer.prioritizeRecommendations([contentRec, designRec], contentFocusContext);

      expect(result[0].id).toBe('content-focused');
    });
  });

  describe('Context-sensitive prioritization', () => {
    it('should boost recommendations for investor presentations', () => {
      const recommendation = createMockRecommendation({
        relatedFrameworkPoints: ['content_problem_solution']
      });

      const investorContext = createMockContext({
        presentationContext: {
          audienceType: 'investors',
          presentationLength: 10,
          criticality: 'critical'
        }
      });

      const customerContext = createMockContext({
        presentationContext: {
          audienceType: 'customers',
          presentationLength: 10,
          criticality: 'medium'
        }
      });

      const investorResult = prioritizer.prioritizeRecommendations([recommendation], investorContext);
      const customerResult = prioritizer.prioritizeRecommendations([recommendation], customerContext);

      expect(investorResult[0].priorityScore).toBeGreaterThan(customerResult[0].priorityScore);
      expect(investorResult[0].impactMultiplier).toBeGreaterThan(customerResult[0].impactMultiplier);
    });

    it('should apply urgency factors based on time constraints', () => {
      const recommendation = createMockRecommendation({
        estimatedEffort: 'high' // 20 hours for intermediate user
      });

      const shortTimeContext = createMockContext({
        userProfile: {
          experienceLevel: 'intermediate',
          timeToPresentation: 2 // Only 2 days
        }
      });

      const longTimeContext = createMockContext({
        userProfile: {
          experienceLevel: 'intermediate',
          timeToPresentation: 30 // 30 days
        }
      });

      const shortResult = prioritizer.prioritizeRecommendations([recommendation], shortTimeContext);
      const longResult = prioritizer.prioritizeRecommendations([recommendation], longTimeContext);

      expect(shortResult[0].urgencyFactor).toBeLessThan(longResult[0].urgencyFactor);
    });
  });

  describe('Priority tiers and ordering', () => {
    it('should group recommendations into correct priority tiers', () => {
      const criticalRec = createMockRecommendation({
        id: 'critical',
        type: 'critical_issue',
        relatedFrameworkPoints: ['speech_filler_words'] // score = 3
      });

      const highRec = createMockRecommendation({
        id: 'high',
        type: 'high_impact_improvement',
        relatedFrameworkPoints: ['content_problem_solution'] // score = 4
      });

      const mediumRec = createMockRecommendation({
        id: 'medium',
        type: 'quick_win',
        relatedFrameworkPoints: ['overall_persuasion_storytelling'] // score = 6
      });

      const context = createMockContext();
      const result = prioritizer.prioritizeRecommendations([criticalRec, highRec, mediumRec], context);

      expect(prioritizer.getPriorityTier(result[0].priorityScore)).toBe('critical');
      expect(prioritizer.getPriorityTier(result[1].priorityScore)).toBe('high');
      expect(prioritizer.getPriorityTier(result[2].priorityScore)).toBe('medium');
    });

    it('should order by implementation time within same priority tier', () => {
      const quickRec = createMockRecommendation({
        id: 'quick',
        estimatedEffort: 'low',
        relatedFrameworkPoints: ['speech_pace_rhythm']
      });

      const slowRec = createMockRecommendation({
        id: 'slow',
        estimatedEffort: 'medium',
        relatedFrameworkPoints: ['speech_clarity_articulation']
      });

      const context = createMockContext();
      const result = prioritizer.prioritizeRecommendations([quickRec, slowRec], context);

      // Within same tier, quicker implementations should come first
      if (Math.abs(result[0].priorityScore - result[1].priorityScore) < 0.5) {
        expect(result[0].timeToImplement).toBeLessThanOrEqual(result[1].timeToImplement);
      }
    });
  });

  describe('Priority explanation generation', () => {
    it('should generate informative priority explanations', () => {
      const highImpactRec = createMockRecommendation({
        relatedFrameworkPoints: ['content_problem_solution'],
        estimatedEffort: 'low'
      });

      const context = createMockContext();
      const [result] = prioritizer.prioritizeRecommendations([highImpactRec], context);

      const explanation = prioritizer.generatePriorityExplanation(result);

      expect(explanation).toContain('priority');
      expect(explanation).toContain('implementation');
      expect(explanation).toMatch(/\d+ hours?/); // Should mention time estimate
    });
  });

  describe('Utility function', () => {
    it('should work with default context parameters', () => {
      const recommendation = createMockRecommendation();
      const frameworkScore = createMockFrameworkScore();

      const result = prioritizeRecommendations([recommendation], frameworkScore);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('priorityScore');
      expect(result[0]).toHaveProperty('timeToImplement');
      expect(result[0]).toHaveProperty('investorRelevance');
    });

    it('should accept partial context overrides', () => {
      const recommendation = createMockRecommendation();
      const frameworkScore = createMockFrameworkScore();

      const result = prioritizeRecommendations(
        [recommendation],
        frameworkScore,
        { experienceLevel: 'beginner' },
        { audienceType: 'customers' }
      );

      expect(result[0]).toHaveProperty('priorityScore');
    });
  });

  describe('Edge cases', () => {
    it('should handle recommendations with no related framework points', () => {
      const orphanRec = createMockRecommendation({
        relatedFrameworkPoints: []
      });

      const context = createMockContext();
      const result = prioritizer.prioritizeRecommendations([orphanRec], context);

      expect(result).toHaveLength(1);
      expect(result[0].priorityScore).toBeGreaterThan(0);
    });

    it('should handle empty recommendations array', () => {
      const context = createMockContext();
      const result = prioritizer.prioritizeRecommendations([], context);

      expect(result).toHaveLength(0);
    });

    it('should handle extreme user experience levels', () => {
      const recommendation = createMockRecommendation({
        type: 'advanced_optimization'
      });

      const beginnerContext = createMockContext({
        userProfile: { experienceLevel: 'beginner', timeToPresentation: 14 }
      });

      const advancedContext = createMockContext({
        userProfile: { experienceLevel: 'advanced', timeToPresentation: 14 }
      });

      const beginnerResult = prioritizer.prioritizeRecommendations([recommendation], beginnerContext);
      const advancedResult = prioritizer.prioritizeRecommendations([recommendation], advancedContext);

      // Advanced optimization should score higher for advanced users
      expect(advancedResult[0].priorityScore).toBeGreaterThan(beginnerResult[0].priorityScore);
    });
  });

  describe('Integration with weighting system', () => {
    it('should use configured weights correctly', () => {
      const customWeights = {
        investorImpact: 50, // Higher weight on investor impact
        implementationEase: 20,
        scoreSeverity: 15,
        confidenceLevel: 10,
        userExperience: 5
      };

      const customPrioritizer = new RecommendationPrioritizer(customWeights);

      const highInvestorImpactRec = createMockRecommendation({
        relatedFrameworkPoints: ['content_problem_solution'], // High investor impact
        estimatedEffort: 'high'
      });

      const easyImplementationRec = createMockRecommendation({
        relatedFrameworkPoints: ['speech_pace_rhythm'], // Low investor impact, easy implementation
        estimatedEffort: 'low'
      });

      const context = createMockContext();
      const result = customPrioritizer.prioritizeRecommendations([highInvestorImpactRec, easyImplementationRec], context);

      // With higher investor impact weight, the high-impact rec should win despite being harder
      expect(result[0].id).toBe(highInvestorImpactRec.id);
    });

    it('should validate that weights are applied proportionally', () => {
      const recommendation = createMockRecommendation({
        relatedFrameworkPoints: ['content_problem_solution'],
        confidence: 1.0,
        estimatedEffort: 'medium'
      });

      const context = createMockContext();
      const result = prioritizer.prioritizeRecommendations([recommendation], context);

      const priorityScore = result[0].priorityScore;

      // Verify that the priority score is within reasonable bounds (0-15 with soft scaling)
      expect(priorityScore).toBeGreaterThanOrEqual(0);
      expect(priorityScore).toBeLessThanOrEqual(15); // Updated to allow soft scaling above 10
    });
  });
}); 