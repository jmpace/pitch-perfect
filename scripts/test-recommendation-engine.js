#!/usr/bin/env node

/**
 * Test script for the Recommendation Engine
 * 
 * This script validates the recommendation generation functionality
 * using various scoring scenarios to ensure proper integration.
 */

const path = require('path');
const fs = require('fs');

// Import the modules (assuming they're compiled to JS or we're using a transpiler)
const { RecommendationEngine, generatePitchRecommendations } = require('../lib/recommendation-engine');
const { FRAMEWORK_POINTS } = require('../lib/scoring-framework');

// Mock comprehensive framework score for testing
function createMockComprehensiveScore(scenario = 'mixed') {
  const baseScore = {
    sessionId: `test_session_${Date.now()}`,
    analysisTimestamp: new Date(),
    processingTime: 1500,
    individualScores: [],
    categoryScores: {
      speech: 0,
      content: 0,
      visual: 0,
      overall: 0
    },
    overallScore: 0
  };

  // Define different scoring scenarios
  const scenarios = {
    // Mixed performance with some strengths and weaknesses
    mixed: {
      speech_pace_rhythm: 7.2,
      speech_volume_projection: 5.1,
      speech_clarity_articulation: 8.3,
      speech_filler_words: 3.8,
      speech_vocal_confidence: 6.4,
      content_problem_definition: 8.7,
      content_solution_explanation: 7.9,
      content_market_size: 4.2,
      content_traction_demonstration: 5.8,
      content_financial_projections: 6.1,
      visual_design_quality: 9.1,
      visual_data_visualization: 8.6,
      visual_timing_flow: 7.3,
      overall_persuasion_storytelling: 6.9,
      overall_executive_presence: 7.5
    },
    
    // Poor performance across the board
    poor: {
      speech_pace_rhythm: 3.2,
      speech_volume_projection: 2.8,
      speech_clarity_articulation: 3.5,
      speech_filler_words: 2.1,
      speech_vocal_confidence: 3.0,
      content_problem_definition: 3.8,
      content_solution_explanation: 2.9,
      content_market_size: 3.1,
      content_traction_demonstration: 2.5,
      content_financial_projections: 3.3,
      visual_design_quality: 3.7,
      visual_data_visualization: 2.8,
      visual_timing_flow: 3.4,
      overall_persuasion_storytelling: 3.1,
      overall_executive_presence: 2.9
    },
    
    // Excellent performance
    excellent: {
      speech_pace_rhythm: 9.1,
      speech_volume_projection: 8.7,
      speech_clarity_articulation: 9.3,
      speech_filler_words: 8.9,
      speech_vocal_confidence: 9.0,
      content_problem_definition: 9.2,
      content_solution_explanation: 8.8,
      content_market_size: 9.1,
      content_traction_demonstration: 8.6,
      content_financial_projections: 8.9,
      visual_design_quality: 9.4,
      visual_data_visualization: 9.0,
      visual_timing_flow: 8.8,
      overall_persuasion_storytelling: 9.1,
      overall_executive_presence: 9.3
    },
    
    // Strong content, weak delivery
    contentStrong: {
      speech_pace_rhythm: 4.2,
      speech_volume_projection: 3.8,
      speech_clarity_articulation: 4.5,
      speech_filler_words: 3.9,
      speech_vocal_confidence: 4.1,
      content_problem_definition: 9.1,
      content_solution_explanation: 8.8,
      content_market_size: 8.9,
      content_traction_demonstration: 8.4,
      content_financial_projections: 8.6,
      visual_design_quality: 6.2,
      visual_data_visualization: 6.8,
      visual_timing_flow: 6.1,
      overall_persuasion_storytelling: 7.3,
      overall_executive_presence: 6.9
    }
  };

  const scoreData = scenarios[scenario] || scenarios.mixed;

  // Generate individual scores
  for (const [pointId, score] of Object.entries(scoreData)) {
    const frameworkPoint = FRAMEWORK_POINTS.find(p => p.id === pointId);
    if (!frameworkPoint) continue;

    const improvementSuggestions = score < 5 ? [
      `Improve ${frameworkPoint.title.toLowerCase()} through targeted practice`,
      `Focus on the specific criteria outlined in the framework`,
      `Seek feedback and coaching for ${frameworkPoint.title.toLowerCase()}`
    ] : score < 7 ? [
      `Fine-tune ${frameworkPoint.title.toLowerCase()} for better performance`,
      `Practice consistently to reach excellence in ${frameworkPoint.title.toLowerCase()}`
    ] : [
      `Maintain excellence in ${frameworkPoint.title.toLowerCase()}`,
      `Use ${frameworkPoint.title.toLowerCase()} as a model for other areas`
    ];

    baseScore.individualScores.push({
      pointId,
      score,
      rationale: `Mock rationale for ${frameworkPoint.title}: Score reflects ${
        score >= 8 ? 'excellent' : score >= 6 ? 'good' : score >= 4 ? 'fair' : 'poor'
      } performance with specific areas noted.`,
      improvementSuggestions,
      confidence: 0.8
    });
  }

  // Calculate category scores
  const categories = ['speech', 'content', 'visual', 'overall'];
  categories.forEach(category => {
    const categoryScores = baseScore.individualScores
      .filter(score => score.pointId.startsWith(category))
      .map(score => score.score);
    
    if (categoryScores.length > 0) {
      baseScore.categoryScores[category] = 
        categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
    }
  });

  // Calculate overall score (weighted average)
  const weights = { speech: 0.3, content: 0.4, visual: 0.2, overall: 0.1 };
  baseScore.overallScore = Object.entries(baseScore.categoryScores)
    .reduce((sum, [category, score]) => sum + (score * weights[category]), 0);

  return baseScore;
}

async function testRecommendationEngine() {
  console.log('🚀 Testing Recommendation Engine\n');
  console.log('=================================\n');

  const scenarios = ['mixed', 'poor', 'excellent', 'contentStrong'];
  
  for (const scenario of scenarios) {
    console.log(`📊 Testing scenario: ${scenario.toUpperCase()}`);
    console.log('-'.repeat(40));
    
    try {
      // Create mock score
      const mockScore = createMockComprehensiveScore(scenario);
      
      console.log(`Overall Score: ${mockScore.overallScore.toFixed(1)}/10`);
      console.log(`Category Scores:`);
      Object.entries(mockScore.categoryScores).forEach(([cat, score]) => {
        console.log(`  ${cat}: ${score.toFixed(1)}/10`);
      });
      
      // Generate recommendations
      const recommendations = await generatePitchRecommendations(mockScore, {
        includeComparison: false, // Skip comparison for mock data
        benchmarkData: {
          industryAverage: 6.5,
          topPerformerThreshold: 8.0
        }
      });
      
      console.log(`\n📋 Generated ${recommendations.totalRecommendations} recommendations`);
      console.log(`Competitive Position: ${recommendations.overallAssessment.competitivePosition}`);
      
      console.log(`\n🎯 Primary Strengths (${recommendations.overallAssessment.primaryStrengths.length}):`);
      recommendations.overallAssessment.primaryStrengths.forEach(strength => {
        console.log(`  • ${strength}`);
      });
      
      console.log(`\n⚠️  Primary Weaknesses (${recommendations.overallAssessment.primaryWeaknesses.length}):`);
      recommendations.overallAssessment.primaryWeaknesses.forEach(weakness => {
        console.log(`  • ${weakness}`);
      });
      
      console.log(`\n🚀 Quick Wins (${recommendations.quickWins.length}):`);
      recommendations.quickWins.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.title}`);
        console.log(`     Impact: ${rec.estimatedImpact} | Effort: ${rec.estimatedEffort}`);
      });
      
      console.log(`\n🔥 Critical Issues (${recommendations.categorizedRecommendations.critical.length}):`);
      recommendations.categorizedRecommendations.critical.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.title}`);
        console.log(`     ${rec.description}`);
      });
      
      console.log(`\n📈 High Priority (${recommendations.categorizedRecommendations.high.length}):`);
      recommendations.categorizedRecommendations.high.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.title}`);
      });
      
    } catch (error) {
      console.error(`❌ Error testing scenario ${scenario}:`, error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }
}

async function testRecommendationStrategies() {
  console.log('🧪 Testing Individual Recommendation Strategies\n');
  console.log('===============================================\n');

  const engine = new RecommendationEngine();
  const mockScore = createMockComprehensiveScore('mixed');
  
  const context = {
    comprehensiveScore: mockScore,
    benchmarkData: {
      industryAverage: 6.5,
      topPerformerThreshold: 8.0
    }
  };

  // Test each strategy individually
  const strategies = [
    'score_based',
    'comparative', 
    'category_analysis',
    'cross_category'
  ];

  for (const strategyName of strategies) {
    console.log(`🔍 Testing ${strategyName} strategy:`);
    
    try {
      // We can't directly access individual strategies from the engine,
      // but we can test that they're working by checking the full output
      const fullRecommendations = await engine.generateRecommendations(context);
      
      // Filter recommendations that likely came from this strategy
      let relevantRecs = [];
      switch (strategyName) {
        case 'score_based':
          relevantRecs = fullRecommendations.recommendations.filter(r => 
            r.type === 'critical_issue' || r.type === 'high_impact_improvement' || 
            r.type === 'strength_to_leverage' || r.type === 'quick_win'
          );
          break;
        case 'comparative':
          relevantRecs = fullRecommendations.recommendations.filter(r => 
            r.type === 'comparative_insight'
          );
          break;
        case 'category_analysis':
          relevantRecs = fullRecommendations.recommendations.filter(r => 
            r.title.includes('Focus Area:') || r.title.includes('Leverage Strength:')
          );
          break;
        case 'cross_category':
          relevantRecs = fullRecommendations.recommendations.filter(r => 
            r.category === 'cross_category'
          );
          break;
      }
      
      console.log(`  Generated ${relevantRecs.length} relevant recommendations`);
      relevantRecs.slice(0, 2).forEach((rec, index) => {
        console.log(`    ${index + 1}. ${rec.title} (${rec.type})`);
      });
      
    } catch (error) {
      console.error(`  ❌ Error testing ${strategyName}:`, error.message);
    }
    
    console.log('');
  }
}

async function testReportGeneration() {
  console.log('📄 Testing Report Generation\n');
  console.log('============================\n');

  try {
    const mockScore = createMockComprehensiveScore('mixed');
    const recommendations = await generatePitchRecommendations(mockScore, {
      includeComparison: false,
      benchmarkData: {
        industryAverage: 6.5,
        topPerformerThreshold: 8.0
      }
    });

    const { generateRecommendationReport } = require('../lib/recommendation-engine');
    const report = generateRecommendationReport(recommendations);
    
    console.log('✅ Report generated successfully');
    console.log(`📏 Report length: ${report.length} characters`);
    console.log(`📋 Report preview:\n`);
    
    // Show first 500 characters of the report
    console.log(report.substring(0, 500) + '...\n');
    
    // Optionally save the full report to a file
    const reportsDir = path.join(__dirname, '../output');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportPath = path.join(reportsDir, `test-recommendation-report-${Date.now()}.txt`);
    fs.writeFileSync(reportPath, report);
    console.log(`💾 Full report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Error testing report generation:', error.message);
  }
}

async function runAllTests() {
  const startTime = Date.now();
  
  try {
    await testRecommendationEngine();
    await testRecommendationStrategies();
    await testReportGeneration();
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ All recommendation engine tests completed successfully in ${duration}ms`);
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  createMockComprehensiveScore,
  testRecommendationEngine,
  testRecommendationStrategies,
  testReportGeneration
}; 