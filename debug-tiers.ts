/**
 * Debug script for priority tiers test
 */
import { RecommendationPrioritizer } from './lib/recommendation-prioritization';
import { Recommendation } from './lib/recommendation-engine';
import { ComprehensiveFrameworkScore } from './lib/scoring-framework';

// Mock data matching the test
const createMockFrameworkScore = (): ComprehensiveFrameworkScore => ({
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
  processingTime: 1000
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

const createMockContext = () => ({
  userProfile: {
    experienceLevel: 'intermediate' as const,
    timeToPresentation: 14,
    focusAreas: ['content' as const]
  },
  presentationContext: {
    audienceType: 'investors' as const,
    presentationLength: 10,
    criticality: 'high' as const
  },
  frameworkScore: createMockFrameworkScore()
});

console.log('=== PRIORITY TIERS DEBUG ===\n');

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

const prioritizer = new RecommendationPrioritizer();
const context = createMockContext();
const result = prioritizer.prioritizeRecommendations([criticalRec, highRec, mediumRec], context);

console.log('Results:');
result.forEach((rec, index) => {
  const tier = prioritizer.getPriorityTier(rec.priorityScore);
  console.log(`${index + 1}. ${rec.id}: Score ${rec.priorityScore}, Tier: ${tier}`);
});

console.log('\nTier Boundaries:');
console.log('Critical: >= 8.0');
console.log('High: 6.0 - 7.9');
console.log('Medium: 4.0 - 5.9');
console.log('Low: < 4.0'); 