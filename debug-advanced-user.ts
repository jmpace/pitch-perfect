/**
 * Debug script for advanced user test case
 */
import { RecommendationPrioritizer } from './lib/recommendation-prioritization';
import { Recommendation } from './lib/recommendation-engine';
import { ComprehensiveFrameworkScore } from './lib/scoring-framework';

// Exact same mock functions as the test
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

// Exact test case
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

const advancedContext = {
  userProfile: {
    experienceLevel: 'advanced' as const,
    timeToPresentation: 14,
    previousSessions: 5
  },
  presentationContext: {
    audienceType: 'investors' as const,
    presentationLength: 10,
    criticality: 'high' as const
  },
  frameworkScore: createMockFrameworkScore()
};

console.log('=== ADVANCED USER TEST DEBUG ===');
console.log('\nQuick Win Recommendation:');
console.log('- Type:', quickWin.type);
console.log('- Category:', quickWin.category);
console.log('- Framework Points:', quickWin.relatedFrameworkPoints);

console.log('\nAdvanced Recommendation:');
console.log('- Type:', advanced.type);
console.log('- Category:', advanced.category);
console.log('- Framework Points:', advanced.relatedFrameworkPoints);
console.log('- Estimated Impact:', advanced.estimatedImpact);

const prioritizer = new RecommendationPrioritizer();
const debugPrioritizer = prioritizer as any;

console.log('\n=== DETAILED SCORING ===');

// Quick Win scoring
console.log('\nQUICK WIN SCORING:');
const qwInvestorRelevance = debugPrioritizer.calculateInvestorImpact(quickWin, advancedContext);
const qwImplementationEase = debugPrioritizer.calculateImplementationEase(quickWin, advancedContext);
const qwScoreSeverity = debugPrioritizer.calculateScoreSeverity(quickWin, advancedContext);
const qwConfidenceScore = quickWin.confidence * 10;
const qwUserExperience = debugPrioritizer.calculateUserExperienceAdjustment(quickWin, advancedContext);
const qwImpactMultiplier = debugPrioritizer.calculateImpactMultiplier(quickWin, advancedContext);

console.log('  Investor Relevance:', qwInvestorRelevance);
console.log('  Implementation Ease:', qwImplementationEase);
console.log('  Score Severity:', qwScoreSeverity);
console.log('  Confidence Score:', qwConfidenceScore);
console.log('  User Experience:', qwUserExperience);
console.log('  Impact Multiplier:', qwImpactMultiplier);

// Advanced scoring
console.log('\nADVANCED OPTIMIZATION SCORING:');
const advInvestorRelevance = debugPrioritizer.calculateInvestorImpact(advanced, advancedContext);
const advImplementationEase = debugPrioritizer.calculateImplementationEase(advanced, advancedContext);
const advScoreSeverity = debugPrioritizer.calculateScoreSeverity(advanced, advancedContext);
const advConfidenceScore = advanced.confidence * 10;
const advUserExperience = debugPrioritizer.calculateUserExperienceAdjustment(advanced, advancedContext);
const advImpactMultiplier = debugPrioritizer.calculateImpactMultiplier(advanced, advancedContext);

console.log('  Investor Relevance:', advInvestorRelevance);
console.log('  Implementation Ease:', advImplementationEase);
console.log('  Score Severity:', advScoreSeverity);
console.log('  Confidence Score:', advConfidenceScore);
console.log('  User Experience:', advUserExperience);
console.log('  Impact Multiplier:', advImpactMultiplier);

// Final results
const result = prioritizer.prioritizeRecommendations([quickWin, advanced], advancedContext);

console.log('\n=== FINAL RESULTS ===');
console.log('1st place:', result[0].id, 'Priority Score:', result[0].priorityScore);
console.log('2nd place:', result[1].id, 'Priority Score:', result[1].priorityScore);

console.log('\n=== ANALYSIS ===');
console.log('Expected: advanced should win');
console.log('Actual:', result[0].id === 'advanced' ? 'PASS' : 'FAIL'); 