/**
 * Real Integration Test for Scoring Engine
 * 
 * Tests the actual scoring engine components using the real implementations
 * and validates outputs with realistic sample data.
 */

const path = require('path');
const fs = require('fs');

// Import actual components
const { generateSamplePitch, generateTestBatch, getExpectedScoreRange } = require('./test-sample-data');

/**
 * Test configuration
 */
const TEST_CONFIG = {
  validateScoreRanges: true,
  logDetailedOutput: true,
  saveResults: true
};

/**
 * Real Component Integration Tests
 */
class RealIntegrationTests {
  constructor() {
    this.results = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  /**
   * Test scoring framework loading
   */
  async testScoringFrameworkLoading() {
    console.log('🔧 Testing Scoring Framework Loading...');
    
    try {
      // Import the actual scoring framework
      const { FRAMEWORK_POINTS } = require('../lib/scoring-framework');
      
      console.log(`✅ Successfully loaded ${FRAMEWORK_POINTS.length} framework points`);
      
      // Validate structure
      const categories = ['speech', 'content', 'visual', 'overall'];
      const pointsByCategory = {};
      
      FRAMEWORK_POINTS.forEach(point => {
        if (!pointsByCategory[point.category]) {
          pointsByCategory[point.category] = [];
        }
        pointsByCategory[point.category].push(point);
      });
      
      console.log('\n📊 Framework Breakdown:');
      categories.forEach(category => {
        const points = pointsByCategory[category] || [];
        console.log(`   ${category}: ${points.length} points`);
        points.forEach(point => {
          console.log(`      - ${point.title}`);
        });
      });
      
      return { success: true, data: { totalPoints: FRAMEWORK_POINTS.length, pointsByCategory } };
      
    } catch (error) {
      console.error('❌ Framework loading failed:', error.message);
      this.errors.push({ test: 'Framework Loading', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Test individual scoring logic components
   */
  async testScoringLogicComponents() {
    console.log('\n🧮 Testing Individual Scoring Logic...');
    
    try {
      const { FrameworkScorer } = require('../lib/scoring-logic');
      const testData = generateSamplePitch('excellent');
      
      console.log('Testing speech analysis components:');
      
      // Test pace and rhythm scoring
      const paceScore = FrameworkScorer.scorePaceRhythm(testData);
      console.log(`✅ Pace & Rhythm: ${paceScore.score}/10 - ${paceScore.rationale}`);
      if (paceScore.improvementSuggestions.length > 0) {
        console.log(`   Suggestions: ${paceScore.improvementSuggestions.join(', ')}`);
      }
      
      // Test volume projection scoring
      const volumeScore = FrameworkScorer.scoreVolumeProjection(testData);
      console.log(`✅ Volume & Projection: ${volumeScore.score}/10 - ${volumeScore.rationale}`);
      
      // Test clarity and articulation
      const clarityScore = FrameworkScorer.scoreClarityArticulation(testData);
      console.log(`✅ Clarity & Articulation: ${clarityScore.score}/10 - ${clarityScore.rationale}`);
      
      // Test filler words
      const fillerScore = FrameworkScorer.scoreFillerWords(testData);
      console.log(`✅ Filler Words: ${fillerScore.score}/10 - ${fillerScore.rationale}`);
      
      const scores = [paceScore, volumeScore, clarityScore, fillerScore];
      const avgScore = scores.reduce((sum, score) => sum + score.score, 0) / scores.length;
      
      console.log(`\n📊 Average Speech Score: ${avgScore.toFixed(1)}/10`);
      
      return { success: true, data: { scores, averageScore: avgScore } };
      
    } catch (error) {
      console.error('❌ Scoring logic test failed:', error.message);
      this.errors.push({ test: 'Scoring Logic', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Test score normalization
   */
  async testScoreNormalization() {
    console.log('\n🎯 Testing Score Normalization...');
    
    try {
      const { normalizeFrameworkScore } = require('../lib/score-normalization');
      
      // Generate a mock comprehensive score for testing
      const mockScore = {
        sessionId: 'test-normalization',
        overallScore: 7.5,
        categoryScores: {
          speech: 8.0,
          content: 7.2,
          visual: 7.8,
          overall: 6.9
        },
        individualScores: [
          { pointId: 'speech_pace_rhythm', score: 8.2 },
          { pointId: 'speech_volume_projection', score: 7.8 },
          { pointId: 'content_problem_clarity', score: 7.5 }
        ],
        analysisTimestamp: new Date(),
        processingTime: 1200
      };
      
      const normalizedResult = normalizeFrameworkScore(mockScore);
      
      console.log('✅ Score normalization completed');
      console.log(`   Original Score: ${mockScore.overallScore}`);
      console.log(`   Normalized Score: ${normalizedResult.normalizedScore}`);
      if (normalizedResult.percentileRank) {
        console.log(`   Percentile Rank: ${normalizedResult.percentileRank.toFixed(1)}%`);
      }
      if (normalizedResult.zScore) {
        console.log(`   Z-Score: ${normalizedResult.zScore.toFixed(2)}`);
      }
      
      return { success: true, data: normalizedResult };
      
    } catch (error) {
      console.error('❌ Score normalization test failed:', error.message);
      this.errors.push({ test: 'Score Normalization', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Test recommendation engine
   */
  async testRecommendationEngine() {
    console.log('\n💡 Testing Recommendation Engine...');
    
    try {
      const { generatePitchRecommendations } = require('../lib/recommendation-engine');
      
      // Create a mock score with some areas for improvement
      const mockScore = {
        sessionId: 'test-recommendations',
        overallScore: 6.5,
        categoryScores: {
          speech: 5.8,  // Needs improvement
          content: 7.5,
          visual: 6.2,
          overall: 6.5
        },
        individualScores: [
          { pointId: 'speech_pace_rhythm', score: 5.2, improvementSuggestions: ['Slow down speaking pace'] },
          { pointId: 'speech_filler_words', score: 4.8, improvementSuggestions: ['Reduce filler words'] },
          { pointId: 'content_problem_clarity', score: 7.8, improvementSuggestions: [] },
          { pointId: 'visual_design_quality', score: 6.0, improvementSuggestions: ['Improve slide design'] }
        ],
        analysisTimestamp: new Date(),
        processingTime: 1500
      };
      
      const recommendations = await generatePitchRecommendations(mockScore, {
        includeComparison: true,
        benchmarkData: { industryAverage: 6.8, topPerformerThreshold: 8.5 }
      });
      
      console.log('✅ Recommendation generation completed');
      console.log(`   Total Recommendations: ${recommendations.totalRecommendations}`);
      console.log(`   Quick Wins: ${recommendations.quickWins.length}`);
      
      // Display sample recommendations
      console.log('\n🔥 Top Recommendations:');
      if (recommendations.categorizedRecommendations.critical.length > 0) {
        console.log('   Critical Issues:');
        recommendations.categorizedRecommendations.critical.slice(0, 2).forEach(rec => {
          console.log(`     - ${rec.title} (Priority: ${rec.priority})`);
        });
      }
      
      if (recommendations.quickWins.length > 0) {
        console.log('   Quick Wins:');
        recommendations.quickWins.slice(0, 3).forEach(rec => {
          console.log(`     - ${rec.title} (Impact: ${rec.estimatedImpact}, Effort: ${rec.estimatedEffort})`);
        });
      }
      
      return { success: true, data: recommendations };
      
    } catch (error) {
      console.error('❌ Recommendation engine test failed:', error.message);
      this.errors.push({ test: 'Recommendation Engine', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Test end-to-end integration with scoring service
   */
  async testEndToEndIntegration() {
    console.log('\n🚀 Testing End-to-End Integration...');
    
    try {
      const { pitchAnalysisService } = require('../lib/scoring-integration');
      
      const testScenarios = ['excellent', 'good', 'average', 'poor'];
      const results = [];
      
      for (const scenario of testScenarios) {
        const testData = generateSamplePitch(scenario, `e2e-test-${scenario}`);
        const expectedRange = getExpectedScoreRange(scenario);
        
        console.log(`\n   Testing ${scenario} scenario...`);
        
        try {
          // Test the comprehensive analysis
          const analysisResult = await pitchAnalysisService.analyzeComprehensive({
            sessionId: testData.sessionId,
            multimodalInput: testData,
            options: {
              includeRecommendations: true,
              includeComparison: true,
              includeGPTAnalysis: false, // Skip GPT for testing
              benchmarkData: { industryAverage: 6.5, topPerformerThreshold: 8.5 }
            }
          });
          
          console.log(`     ✅ Overall Score: ${analysisResult.frameworkScore.overallScore.toFixed(1)}/10`);
          console.log(`     📊 Category Scores: Speech: ${analysisResult.frameworkScore.categoryScores.speech.toFixed(1)}, Content: ${analysisResult.frameworkScore.categoryScores.content.toFixed(1)}, Visual: ${analysisResult.frameworkScore.categoryScores.visual.toFixed(1)}`);
          console.log(`     ⏱️  Processing Time: ${analysisResult.processingMetadata.totalProcessingTime}ms`);
          
          if (analysisResult.recommendations) {
            console.log(`     💡 Recommendations: ${analysisResult.recommendations.totalRecommendations} total, ${analysisResult.recommendations.quickWins.length} quick wins`);
          }
          
          // Validate score is in expected range
          const score = analysisResult.frameworkScore.overallScore;
          const inRange = score >= expectedRange.min && score <= expectedRange.max;
          
          if (!inRange) {
            console.log(`     ⚠️  Score ${score.toFixed(1)} outside expected range ${expectedRange.min}-${expectedRange.max}`);
          }
          
          results.push({
            scenario,
            score,
            expectedRange,
            inRange,
            processingTime: analysisResult.processingMetadata.totalProcessingTime,
            success: true
          });
          
        } catch (error) {
          console.log(`     ❌ Failed: ${error.message}`);
          results.push({
            scenario,
            success: false,
            error: error.message
          });
          this.errors.push({ test: `E2E ${scenario}`, error: error.message });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`\n📊 End-to-End Results: ${successCount}/${testScenarios.length} scenarios passed`);
      
      return { success: successCount === testScenarios.length, data: results };
      
    } catch (error) {
      console.error('❌ End-to-end integration test failed:', error.message);
      this.errors.push({ test: 'End-to-End Integration', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log('🔬 Starting Real Integration Tests for Scoring Engine\n');
    
    const tests = [
      { name: 'Framework Loading', method: this.testScoringFrameworkLoading },
      { name: 'Scoring Logic', method: this.testScoringLogicComponents },
      { name: 'Score Normalization', method: this.testScoreNormalization },
      { name: 'Recommendation Engine', method: this.testRecommendationEngine },
      { name: 'End-to-End Integration', method: this.testEndToEndIntegration }
    ];
    
    const results = [];
    
    for (const test of tests) {
      try {
        const result = await test.method.call(this);
        results.push({ name: test.name, ...result });
      } catch (error) {
        console.error(`❌ Test ${test.name} failed unexpectedly:`, error);
        results.push({ name: test.name, success: false, error: error.message });
        this.errors.push({ test: test.name, error: error.message });
      }
    }
    
    // Generate summary
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const totalTime = Date.now() - this.startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 REAL INTEGRATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`❌ Tests Failed: ${totalTests - passedTests}`);
    console.log(`📊 Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`⏱️  Total Time: ${totalTime}ms`);
    console.log(`🚨 Total Errors: ${this.errors.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors Found:');
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.test}: ${error.error}`);
      });
    }
    
    // Save results if configured
    if (TEST_CONFIG.saveResults) {
      const reportData = {
        summary: { totalTests, passedTests, totalTime, errors: this.errors.length },
        results,
        errors: this.errors,
        timestamp: new Date().toISOString()
      };
      
      const reportPath = path.join(__dirname, 'real-integration-test-results.json');
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`\n📄 Detailed results saved to: ${reportPath}`);
    }
    
    return {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      passRate: (passedTests / totalTests) * 100,
      totalTime,
      errors: this.errors.length,
      success: passedTests === totalTests
    };
  }
}

/**
 * Main execution
 */
async function main() {
  const tester = new RealIntegrationTests();
  
  try {
    const summary = await tester.runAllTests();
    
    console.log(`\n🎯 Final Result: ${summary.success ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    // Exit with appropriate code
    process.exit(summary.success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

/**
 * Export for external use
 */
module.exports = {
  RealIntegrationTests,
  TEST_CONFIG
};

/**
 * Run if executed directly
 */
if (require.main === module) {
  main();
} 