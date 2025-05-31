/**
 * Debug script to trace prioritization algorithm issues
 */
import { RecommendationPrioritizer, PrioritizationContext } from './lib/recommendation-prioritization';
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

console.log('=== DEBUGGING PRIORITIZATION ALGORITHM ===\n');

// Test 1: High vs Low Investor Impact
console.log('1. TESTING INVESTOR IMPACT LOGIC:');
const highImpactRec = createMockRecommendation({
  id: 'high-impact',
  relatedFrameworkPoints: ['content_problem_solution'], // Should be score 10
  estimatedEffort: 'medium'
});

const lowImpactRec = createMockRecommendation({
  id: 'low-impact',
  relatedFrameworkPoints: ['visual_timing_flow'], // Should be score 5
  estimatedEffort: 'medium'
});

const prioritizer = new RecommendationPrioritizer();
const context = createMockContext();

console.log('High Impact Rec Framework Points:', highImpactRec.relatedFrameworkPoints);
console.log('Low Impact Rec Framework Points:', lowImpactRec.relatedFrameworkPoints);

// Add detailed tracing by calling private methods via any
const debugPrioritizer = prioritizer as any;

console.log('\nDetailed Score Breakdown:');

// High Impact Details
console.log('\nHIGH IMPACT REC:');
const highInvestorRelevance = debugPrioritizer.calculateInvestorImpact(highImpactRec, context);
const highImplementationEase = debugPrioritizer.calculateImplementationEase(highImpactRec, context);
const highScoreSeverity = debugPrioritizer.calculateScoreSeverity(highImpactRec, context);
const highConfidenceScore = highImpactRec.confidence * 10;
const highUserExperience = debugPrioritizer.calculateUserExperienceAdjustment(highImpactRec, context);
const highImpactMultiplier = debugPrioritizer.calculateImpactMultiplier(highImpactRec, context);

console.log('  Investor Relevance:', highInvestorRelevance);
console.log('  Implementation Ease:', highImplementationEase);
console.log('  Score Severity:', highScoreSeverity);
console.log('  Confidence Score:', highConfidenceScore);
console.log('  User Experience:', highUserExperience);
console.log('  Impact Multiplier:', highImpactMultiplier);

// Low Impact Details  
console.log('\nLOW IMPACT REC:');
const lowInvestorRelevance = debugPrioritizer.calculateInvestorImpact(lowImpactRec, context);
const lowImplementationEase = debugPrioritizer.calculateImplementationEase(lowImpactRec, context);
const lowScoreSeverity = debugPrioritizer.calculateScoreSeverity(lowImpactRec, context);
const lowConfidenceScore = lowImpactRec.confidence * 10;
const lowUserExperience = debugPrioritizer.calculateUserExperienceAdjustment(lowImpactRec, context);
const lowImpactMultiplier = debugPrioritizer.calculateImpactMultiplier(lowImpactRec, context);

console.log('  Investor Relevance:', lowInvestorRelevance);
console.log('  Implementation Ease:', lowImplementationEase);  
console.log('  Score Severity:', lowScoreSeverity);
console.log('  Confidence Score:', lowConfidenceScore);
console.log('  User Experience:', lowUserExperience);
console.log('  Impact Multiplier:', lowImpactMultiplier);

const result1 = prioritizer.prioritizeRecommendations([highImpactRec, lowImpactRec], context);

console.log('\nFinal Results:');
console.log('1st place:', result1[0].id, 'Priority Score:', result1[0].priorityScore, 'Investor Relevance:', result1[0].investorRelevance);
console.log('2nd place:', result1[1].id, 'Priority Score:', result1[1].priorityScore, 'Investor Relevance:', result1[1].investorRelevance);

// Test 2: Context Boost
console.log('\n2. TESTING CONTEXT BOOST:');
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

console.log('Investor Context Score:', investorResult[0].priorityScore, 'Impact Multiplier:', investorResult[0].impactMultiplier);
console.log('Customer Context Score:', customerResult[0].priorityScore, 'Impact Multiplier:', customerResult[0].impactMultiplier);

// Test 3: Custom Weights
console.log('\n3. TESTING CUSTOM WEIGHTS:');
const customWeights = {
  investorImpact: 50,
  implementationEase: 20,
  scoreSeverity: 15,
  confidenceLevel: 10,
  userExperience: 5
};

const customPrioritizer = new RecommendationPrioritizer(customWeights);

const highInvestorImpactRec = createMockRecommendation({
  id: 'high-investor-impact',
  relatedFrameworkPoints: ['content_problem_solution'], // High investor impact
  estimatedEffort: 'high'
});

const easyImplementationRec = createMockRecommendation({
  id: 'easy-implementation',
  relatedFrameworkPoints: ['speech_pace_rhythm'], // Low investor impact, easy implementation
  estimatedEffort: 'low'
});

// Debug custom weights calculations
const customDebugPrioritizer = customPrioritizer as any;

console.log('\nCustom Weights:', customWeights);

console.log('\nHIGH INVESTOR IMPACT REC (with custom weights):');
const customHighInvestorRelevance = customDebugPrioritizer.calculateInvestorImpact(highInvestorImpactRec, context);
const customHighImplementationEase = customDebugPrioritizer.calculateImplementationEase(highInvestorImpactRec, context);
const customHighScoreSeverity = customDebugPrioritizer.calculateScoreSeverity(highInvestorImpactRec, context);
const customHighConfidenceScore = highInvestorImpactRec.confidence * 10;
const customHighUserExperience = customDebugPrioritizer.calculateUserExperienceAdjustment(highInvestorImpactRec, context);
const customHighImpactMultiplier = customDebugPrioritizer.calculateImpactMultiplier(highInvestorImpactRec, context);

console.log('  Investor Relevance:', customHighInvestorRelevance);
console.log('  Implementation Ease:', customHighImplementationEase);
console.log('  Score Severity:', customHighScoreSeverity);
console.log('  Confidence Score:', customHighConfidenceScore);
console.log('  User Experience:', customHighUserExperience);
console.log('  Impact Multiplier:', customHighImpactMultiplier);

// Simulate effective weights calculation for high investor impact
let effectiveWeights1 = { ...customWeights };
if (customHighInvestorRelevance > 10) {
  const boostFactor = Math.min(customHighInvestorRelevance / 6, 3.0);
  effectiveWeights1.investorImpact *= boostFactor;
  const totalWeight = Object.values(effectiveWeights1).reduce((sum, w) => sum + w, 0);
  Object.keys(effectiveWeights1).forEach(key => {
    (effectiveWeights1 as any)[key] = (effectiveWeights1 as any)[key] * 100 / totalWeight;
  });
}
console.log('  Effective Weights:', effectiveWeights1);

const basePriority1 = (
  (Math.min(10, customHighInvestorRelevance) * effectiveWeights1.investorImpact) +
  (customHighImplementationEase * effectiveWeights1.implementationEase) +
  (customHighScoreSeverity * effectiveWeights1.scoreSeverity) +
  (customHighConfidenceScore * effectiveWeights1.confidenceLevel) +
  (customHighUserExperience * effectiveWeights1.userExperience)
) / 100;
console.log('  Base Priority Score (before impact multiplier):', basePriority1);

console.log('\nEASY IMPLEMENTATION REC (with custom weights):');
const customEasyInvestorRelevance = customDebugPrioritizer.calculateInvestorImpact(easyImplementationRec, context);
const customEasyImplementationEase = customDebugPrioritizer.calculateImplementationEase(easyImplementationRec, context);
const customEasyScoreSeverity = customDebugPrioritizer.calculateScoreSeverity(easyImplementationRec, context);
const customEasyConfidenceScore = easyImplementationRec.confidence * 10;
const customEasyUserExperience = customDebugPrioritizer.calculateUserExperienceAdjustment(easyImplementationRec, context);
const customEasyImpactMultiplier = customDebugPrioritizer.calculateImpactMultiplier(easyImplementationRec, context);

console.log('  Investor Relevance:', customEasyInvestorRelevance);
console.log('  Implementation Ease:', customEasyImplementationEase);
console.log('  Score Severity:', customEasyScoreSeverity);
console.log('  Confidence Score:', customEasyConfidenceScore);
console.log('  User Experience:', customEasyUserExperience);
console.log('  Impact Multiplier:', customEasyImpactMultiplier);

// Simulate effective weights calculation for easy implementation
let effectiveWeights2 = { ...customWeights };
if (customEasyInvestorRelevance > 10) {
  const boostFactor = Math.min(customEasyInvestorRelevance / 6, 3.0);
  effectiveWeights2.investorImpact *= boostFactor;
  const totalWeight = Object.values(effectiveWeights2).reduce((sum, w) => sum + w, 0);
  Object.keys(effectiveWeights2).forEach(key => {
    (effectiveWeights2 as any)[key] = (effectiveWeights2 as any)[key] * 100 / totalWeight;
  });
}
console.log('  Effective Weights:', effectiveWeights2);

const basePriority2 = (
  (Math.min(10, customEasyInvestorRelevance) * effectiveWeights2.investorImpact) +
  (customEasyImplementationEase * effectiveWeights2.implementationEase) +
  (customEasyScoreSeverity * effectiveWeights2.scoreSeverity) +
  (customEasyConfidenceScore * effectiveWeights2.confidenceLevel) +
  (customEasyUserExperience * effectiveWeights2.userExperience)
) / 100;
console.log('  Base Priority Score (before impact multiplier):', basePriority2);

const result3 = customPrioritizer.prioritizeRecommendations([highInvestorImpactRec, easyImplementationRec], context);

console.log('\nWith 50% investor impact weight:');
console.log('1st place:', result3[0].id, 'Priority Score:', result3[0].priorityScore);
console.log('2nd place:', result3[1].id, 'Priority Score:', result3[1].priorityScore);

console.log('\n=== DEBUG COMPLETE ==='); 