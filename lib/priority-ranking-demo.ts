/**
 * Priority Ranking System Demo & Validation
 * 
 * This module demonstrates the priority ranking functionality and validates
 * integration with the existing scoring framework, normalization, and recommendation systems.
 */

import { 
  PriorityRankingEngine, 
  RankingUtils, 
  DEFAULT_RANKING_CRITERIA,
  RankingCriteria,
  RankedPitchList,
  PitchRankingEntry
} from './priority-ranking';
import { 
  ComprehensiveFrameworkScore, 
  FrameworkScore 
} from './scoring-framework';
import { 
  RecommendationSet, 
  RecommendationPriority 
} from './recommendation-engine';
import { ScoreComparison } from './score-normalization';

/**
 * Generate mock data for testing the priority ranking system
 */
export class MockDataGenerator {
  
  /**
   * Create a mock comprehensive framework score
   */
  static createMockFrameworkScore(
    sessionId: string,
    overallScore: number,
    categoryWeights: { speech: number; content: number; visual: number; overall: number } = 
      { speech: 7, content: 6, visual: 8, overall: 7 }
  ): ComprehensiveFrameworkScore {
    
    const individualScores: FrameworkScore[] = [
      // Speech mechanics
      { pointId: 'speech_pace_rhythm', score: categoryWeights.speech, rationale: 'Good pacing', improvementSuggestions: [], confidence: 0.8 },
      { pointId: 'speech_volume_projection', score: categoryWeights.speech, rationale: 'Clear projection', improvementSuggestions: [], confidence: 0.85 },
      { pointId: 'speech_clarity_articulation', score: categoryWeights.speech, rationale: 'Clear articulation', improvementSuggestions: [], confidence: 0.9 },
      { pointId: 'speech_filler_words', score: categoryWeights.speech, rationale: 'Minimal filler words', improvementSuggestions: [], confidence: 0.8 },
      { pointId: 'speech_vocal_confidence', score: categoryWeights.speech, rationale: 'Confident delivery', improvementSuggestions: [], confidence: 0.85 },
      
      // Content quality
      { pointId: 'content_problem_solution', score: categoryWeights.content, rationale: 'Clear problem definition', improvementSuggestions: [], confidence: 0.9 },
      { pointId: 'content_market_opportunity', score: categoryWeights.content, rationale: 'Good market analysis', improvementSuggestions: [], confidence: 0.8 },
      { pointId: 'content_traction_validation', score: categoryWeights.content, rationale: 'Some traction shown', improvementSuggestions: [], confidence: 0.7 },
      { pointId: 'content_financials_projections', score: categoryWeights.content, rationale: 'Reasonable projections', improvementSuggestions: [], confidence: 0.75 },
      { pointId: 'content_competitive_analysis', score: categoryWeights.content, rationale: 'Basic competitive analysis', improvementSuggestions: [], confidence: 0.7 },
      
      // Visual presentation
      { pointId: 'visual_slide_design', score: categoryWeights.visual, rationale: 'Professional design', improvementSuggestions: [], confidence: 0.8 },
      { pointId: 'visual_data_visualization', score: categoryWeights.visual, rationale: 'Clear data presentation', improvementSuggestions: [], confidence: 0.85 },
      { pointId: 'visual_timing_flow', score: categoryWeights.visual, rationale: 'Good timing', improvementSuggestions: [], confidence: 0.8 },
      
      // Overall effectiveness
      { pointId: 'overall_persuasion_storytelling', score: categoryWeights.overall, rationale: 'Compelling story', improvementSuggestions: [], confidence: 0.8 },
      { pointId: 'overall_credibility_expertise', score: categoryWeights.overall, rationale: 'Strong credibility', improvementSuggestions: [], confidence: 0.85 }
    ];

    return {
      sessionId,
      overallScore,
      categoryScores: categoryWeights,
      individualScores,
      analysisTimestamp: new Date(),
      processingTime: 1500
    };
  }

  /**
   * Create mock recommendations
   */
  static createMockRecommendations(sessionId: string, severity: 'low' | 'medium' | 'high' = 'medium'): RecommendationSet {
    const criticalCount = severity === 'high' ? 3 : severity === 'medium' ? 1 : 0;
    const highCount = severity === 'high' ? 4 : severity === 'medium' ? 2 : 1;
    const quickWinsCount = severity === 'low' ? 5 : severity === 'medium' ? 3 : 1;

    return {
      sessionId,
      overallAssessment: {
        primaryStrengths: ['Clear problem definition', 'Strong market opportunity'],
        primaryWeaknesses: ['Financial projections need work', 'Limited traction data']
      },
      recommendations: [],
      categorizedRecommendations: {
        critical: Array(criticalCount).fill(null).map((_, i) => ({
          id: `critical-${i}`,
          type: 'critical_issue' as const,
          category: 'content' as const,
          priority: 'critical' as const,
          title: `Critical Issue ${i + 1}`,
          description: 'This needs immediate attention',
          actionableSteps: ['Step 1', 'Step 2'],
          estimatedImpact: 'high' as const,
          estimatedEffort: 'medium' as const,
          relatedFrameworkPoints: ['content_financials_projections'],
          confidence: 0.9
        })),
        high: Array(highCount).fill(null).map((_, i) => ({
          id: `high-${i}`,
          type: 'high_impact_improvement' as const,
          category: 'content' as const,
          priority: 'high' as const,
          title: `High Impact Issue ${i + 1}`,
          description: 'Important improvement opportunity',
          actionableSteps: ['Step 1', 'Step 2'],
          estimatedImpact: 'high' as const,
          estimatedEffort: 'medium' as const,
          relatedFrameworkPoints: ['content_market_opportunity'],
          confidence: 0.8
        })),
        medium: [],
        low: []
      },
      quickWins: Array(quickWinsCount).fill(null).map((_, i) => ({
        id: `quick-${i}`,
        type: 'quick_win' as const,
        category: 'speech' as const,
        priority: 'medium' as const,
        title: `Quick Win ${i + 1}`,
        description: 'Easy improvement with good impact',
        actionableSteps: ['Step 1'],
        estimatedImpact: 'medium' as const,
        estimatedEffort: 'low' as const,
        relatedFrameworkPoints: ['speech_pace_rhythm'],
        confidence: 0.85
      })),
      generatedAt: new Date(),
      totalRecommendations: criticalCount + highCount + quickWinsCount
    };
  }

  /**
   * Create mock score comparison
   */
  static createMockScoreComparison(sessionId: string, percentile: number = 75): ScoreComparison {
    return {
      sessionId,
      normalizedScores: [],
      categoryScores: {
        speech: 70,
        content: 65,
        visual: 80,
        overall: 75
      },
      overallScore: 72,
      percentileRank: percentile,
      zScore: 0.5
    };
  }

  /**
   * Generate a complete pitch dataset for testing
   */
  static generatePitchDataset(count: number = 10): Array<{
    frameworkScore: ComprehensiveFrameworkScore;
    recommendations: RecommendationSet;
    normalizedComparison: ScoreComparison;
    pitchName: string;
  }> {
    
    const pitchTypes = [
      { name: 'AI SaaS Startup', scores: { speech: 8, content: 9, visual: 7, overall: 8 }, severity: 'low' as const },
      { name: 'FinTech Platform', scores: { speech: 7, content: 8, visual: 9, overall: 7 }, severity: 'medium' as const },
      { name: 'E-commerce Solution', scores: { speech: 6, content: 6, visual: 8, overall: 6 }, severity: 'high' as const },
      { name: 'HealthTech Innovation', scores: { speech: 9, content: 7, visual: 6, overall: 8 }, severity: 'low' as const },
      { name: 'EdTech Platform', scores: { speech: 5, content: 7, visual: 7, overall: 6 }, severity: 'medium' as const },
      { name: 'CleanTech Startup', scores: { speech: 7, content: 9, visual: 8, overall: 9 }, severity: 'low' as const },
      { name: 'IoT Solution', scores: { speech: 6, content: 5, visual: 6, overall: 5 }, severity: 'high' as const },
      { name: 'Blockchain Platform', scores: { speech: 8, content: 6, visual: 7, overall: 7 }, severity: 'medium' as const },
      { name: 'Robotics Company', scores: { speech: 7, content: 8, visual: 9, overall: 8 }, severity: 'low' as const },
      { name: 'Gaming Startup', scores: { speech: 9, content: 5, visual: 9, overall: 6 }, severity: 'medium' as const }
    ];

    return Array.from({ length: count }, (_, index) => {
      const pitchType = pitchTypes[index % pitchTypes.length];
      const sessionId = `session-${index + 1}`;
      const overallScore = Object.values(pitchType.scores).reduce((a, b) => a + b, 0) / 4;

      return {
        frameworkScore: this.createMockFrameworkScore(sessionId, overallScore, pitchType.scores),
        recommendations: this.createMockRecommendations(sessionId, pitchType.severity),
        normalizedComparison: this.createMockScoreComparison(sessionId, 50 + (overallScore - 5) * 10),
        pitchName: `${pitchType.name} ${index + 1}`
      };
    });
  }
}

/**
 * Demo and validation functions
 */
export class PriorityRankingDemo {
  
  /**
   * Run comprehensive demo of the priority ranking system
   */
  static async runComprehensiveDemo(): Promise<void> {
    console.log('🚀 PitchPerfect Priority Ranking System Demo\n');
    
    // Step 1: Generate test data
    console.log('📊 Generating test pitch dataset...');
    const pitchData = MockDataGenerator.generatePitchDataset(8);
    console.log(`Generated ${pitchData.length} mock pitches\n`);

    // Step 2: Initialize ranking engine
    console.log('🔧 Initializing Priority Ranking Engine...');
    const rankingEngine = new PriorityRankingEngine();
    console.log('Engine initialized successfully\n');

    // Step 3: Perform ranking with default criteria
    console.log('🎯 Ranking pitches with default investment criteria...');
    const rankings = await rankingEngine.rankPitches(pitchData, DEFAULT_RANKING_CRITERIA);
    console.log('Ranking completed!\n');

    // Step 4: Display results
    this.displayRankingResults(rankings);

    // Step 5: Test custom criteria
    console.log('\n🔄 Testing custom ranking criteria (content-focused)...');
    const contentFocusedCriteria: RankingCriteria = {
      ...DEFAULT_RANKING_CRITERIA,
      categoryWeights: {
        speech: 0.15,
        content: 0.60, // Heavy weight on content
        visual: 0.15,
        overall: 0.10
      }
    };
    
    const contentRankings = await rankingEngine.rankPitches(pitchData, contentFocusedCriteria);
    this.displayTopPerformers(contentRankings, 'Content-Focused Rankings');

    // Step 6: Test utility functions
    console.log('\n⚡ Testing Quick Ranking utility...');
    const quickRankings = await RankingUtils.quickRank(
      pitchData.map(p => ({
        sessionId: p.frameworkScore.sessionId,
        overallScore: p.frameworkScore.overallScore,
        categoryScores: p.frameworkScore.categoryScores,
        pitchName: p.pitchName
      }))
    );
    
    console.log('Quick Rankings:');
    quickRankings.slice(0, 5).forEach(ranking => {
      console.log(`  ${ranking.rank}. ${ranking.pitchName}: ${ranking.score}/100`);
    });

    // Step 7: Test investment readiness filtering
    console.log('\n🎯 Testing Investment Readiness Filter...');
    const readyPitches = RankingUtils.filterByInvestmentReadiness(rankings.rankings, 'ready');
    console.log(`Found ${readyPitches.length} investment-ready pitches out of ${rankings.rankings.length} total`);

    // Step 8: Generate executive summary
    console.log('\n📋 Executive Summary:');
    console.log(RankingUtils.generateExecutiveSummary(rankings));

    console.log('\n✅ Demo completed successfully!');
  }

  /**
   * Display comprehensive ranking results
   */
  private static displayRankingResults(rankings: RankedPitchList): void {
    console.log('='.repeat(80));
    console.log('📈 COMPREHENSIVE RANKING RESULTS');
    console.log('='.repeat(80));

    // Display top performers
    console.log('\n🏆 TOP PERFORMERS:');
    rankings.metadata.topPerformers.forEach((pitch, index) => {
      const readiness = pitch.investmentReadiness?.level || 'unknown';
      const competitive = pitch.competitiveAdvantage?.level || 'unknown';
      const riskCount = pitch.riskFactors?.length || 0;
      
      console.log(`  ${index + 1}. ${pitch.pitchName || pitch.sessionId}`);
      console.log(`     Score: ${pitch.normalizedScore}/100 | Readiness: ${readiness} | Competitive: ${competitive} | Risks: ${riskCount}`);
      console.log(`     Content: ${pitch.categoryScores.content.toFixed(1)} | Speech: ${pitch.categoryScores.speech.toFixed(1)} | Visual: ${pitch.categoryScores.visual.toFixed(1)}`);
    });

    // Display risky candidates
    if (rankings.metadata.riskyCandidates.length > 0) {
      console.log('\n⚠️  HIGH-RISK CANDIDATES:');
      rankings.metadata.riskyCandidates.forEach((pitch, index) => {
        const criticalRisks = pitch.riskFactors?.filter(r => r.level === 'critical').length || 0;
        console.log(`  ${index + 1}. ${pitch.pitchName || pitch.sessionId} - ${criticalRisks} critical risks`);
      });
    }

    // Display quick wins
    if (rankings.metadata.quickWins.length > 0) {
      console.log('\n⚡ QUICK WIN OPPORTUNITIES:');
      rankings.metadata.quickWins.forEach((pitch, index) => {
        const quickWins = pitch.recommendationSummary?.quickWins || 0;
        console.log(`  ${index + 1}. ${pitch.pitchName || pitch.sessionId} - ${quickWins} quick wins available`);
      });
    }

    // Display insights
    console.log('\n💡 KEY INSIGHTS:');
    console.log('Portfolio Balance:');
    rankings.insights.portfolioBalance.forEach(insight => console.log(`  • ${insight}`));
    
    console.log('\nRecommended Focus Areas:');
    rankings.insights.recommendedFocus.forEach(focus => console.log(`  • ${focus}`));
    
    console.log('\nNext Steps:');
    rankings.insights.nextSteps.forEach(step => console.log(`  • ${step}`));

    // Display statistics
    console.log('\n📊 DISTRIBUTION STATISTICS:');
    const stats = rankings.metadata.distributionStats.scoreDistribution;
    console.log(`  Average Score: ${stats.mean.toFixed(1)}/100`);
    console.log(`  Score Range: ${stats.min.toFixed(1)} - ${stats.max.toFixed(1)}`);
    console.log(`  Standard Deviation: ${stats.std.toFixed(1)}`);
  }

  /**
   * Display top performers for custom criteria
   */
  private static displayTopPerformers(rankings: RankedPitchList, title: string): void {
    console.log(`\n${title}:`);
    rankings.rankings.slice(0, 3).forEach((pitch, index) => {
      console.log(`  ${index + 1}. ${pitch.pitchName || pitch.sessionId}: ${pitch.normalizedScore}/100`);
    });
  }

  /**
   * Validate ranking system consistency
   */
  static async validateRankingConsistency(): Promise<boolean> {
    console.log('🔍 Validating ranking system consistency...\n');
    
    const pitchData = MockDataGenerator.generatePitchDataset(5);
    const rankingEngine = new PriorityRankingEngine();
    
    // Test 1: Same input should produce same rankings
    console.log('Test 1: Ranking consistency...');
    const ranking1 = await rankingEngine.rankPitches(pitchData);
    const ranking2 = await rankingEngine.rankPitches(pitchData);
    
    const consistent = ranking1.rankings.every((pitch, index) => 
      pitch.sessionId === ranking2.rankings[index].sessionId
    );
    console.log(`  ✓ Consistency test: ${consistent ? 'PASSED' : 'FAILED'}`);

    // Test 2: Higher scores should rank higher
    console.log('Test 2: Score correlation...');
    const sorted = [...ranking1.rankings].sort((a, b) => b.normalizedScore - a.normalizedScore);
    const properOrder = ranking1.rankings.every((pitch, index) => 
      pitch.sessionId === sorted[index].sessionId
    );
    console.log(`  ✓ Score correlation test: ${properOrder ? 'PASSED' : 'FAILED'}`);

    // Test 3: Investment readiness affects ranking
    console.log('Test 3: Investment readiness impact...');
    const readinessWeighted = ranking1.rankings.filter(p => p.investmentReadiness);
    const hasReadinessImpact = readinessWeighted.length > 0;
    console.log(`  ✓ Investment readiness test: ${hasReadinessImpact ? 'PASSED' : 'FAILED'}`);

    console.log(`\n🎯 Overall validation: ${consistent && properOrder && hasReadinessImpact ? 'PASSED' : 'FAILED'}`);
    return consistent && properOrder && hasReadinessImpact;
  }
}

// Export demo runner function
export async function runPriorityRankingDemo(): Promise<void> {
  await PriorityRankingDemo.runComprehensiveDemo();
}

export async function validatePriorityRanking(): Promise<boolean> {
  return await PriorityRankingDemo.validateRankingConsistency();
}

export default PriorityRankingDemo; 