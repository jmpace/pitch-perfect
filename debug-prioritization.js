/**
 * Debug script to trace prioritization algorithm issues
 */

// First, let's try to load the module using ES modules approach
import { RecommendationPrioritizer } from './lib/recommendation-prioritization.js';

// Mock data matching the test
const createMockFrameworkScore = () => ({
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

const createMockRecommendation = (overrides = {}) => ({
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

const createMockContext = (overrides = {}) => ({
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

const result1 = prioritizer.prioritizeRecommendations([highImpactRec, lowImpactRec], context);

console.log('\nResults:');
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

const result3 = customPrioritizer.prioritizeRecommendations([highInvestorImpactRec, easyImplementationRec], context);

console.log('With 50% investor impact weight:');
console.log('1st place:', result3[0].id, 'Priority Score:', result3[0].priorityScore);
console.log('2nd place:', result3[1].id, 'Priority Score:', result3[1].priorityScore);

console.log('\n=== DEBUG COMPLETE ==='); 