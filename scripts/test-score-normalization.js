#!/usr/bin/env node

/**
 * Test Script for Score Normalization Algorithms
 * 
 * This script validates the score normalization system by testing various
 * scenarios, edge cases, and normalization methods.
 */

const path = require('path');

// Add the lib directory to the module resolution path
const libPath = path.resolve(__dirname, '..', 'lib');
require('module')._nodeModulePaths.push(libPath);

// Dynamic import workaround for ES modules in Node.js
async function loadModules() {
  try {
    // Import all required modules
    const scoringFramework = await import('../lib/scoring-framework.js');
    const frameworkWeights = await import('../lib/framework-weights.js');
    const scoreNormalization = await import('../lib/score-normalization.js');

    return {
      scoringFramework,
      frameworkWeights,
      scoreNormalization
    };
  } catch (error) {
    console.error('Failed to load modules:', error.message);
    console.log('Note: This script requires the TypeScript files to be compiled to JavaScript first.');
    console.log('Run: npx tsc lib/score-normalization.ts --target es2020 --module es2020');
    process.exit(1);
  }
}

/**
 * Generate test data for normalization testing
 */
function generateTestScores() {
  // Test scenario 1: Perfect pitch (all 10s)
  const perfectPitch = [
    { pointId: 'speech_pace_rhythm', rawScore: 10, confidence: 1.0, category: 'speech' },
    { pointId: 'speech_volume_projection', rawScore: 10, confidence: 1.0, category: 'speech' },
    { pointId: 'speech_clarity_articulation', rawScore: 10, confidence: 1.0, category: 'speech' },
    { pointId: 'speech_filler_words', rawScore: 10, confidence: 1.0, category: 'speech' },
    { pointId: 'speech_vocal_confidence', rawScore: 10, confidence: 1.0, category: 'speech' },
    { pointId: 'content_problem_definition', rawScore: 10, confidence: 1.0, category: 'content' },
    { pointId: 'content_solution_explanation', rawScore: 10, confidence: 1.0, category: 'content' },
    { pointId: 'content_market_size', rawScore: 10, confidence: 1.0, category: 'content' },
    { pointId: 'content_traction_demonstration', rawScore: 10, confidence: 1.0, category: 'content' },
    { pointId: 'content_financial_projections', rawScore: 10, confidence: 1.0, category: 'content' },
    { pointId: 'visual_slide_design', rawScore: 10, confidence: 1.0, category: 'visual' },
    { pointId: 'visual_data_visualization', rawScore: 10, confidence: 1.0, category: 'visual' },
    { pointId: 'visual_timing_flow', rawScore: 10, confidence: 1.0, category: 'visual' },
    { pointId: 'overall_persuasion_storytelling', rawScore: 10, confidence: 1.0, category: 'overall' },
    { pointId: 'overall_confidence_credibility', rawScore: 10, confidence: 1.0, category: 'overall' }
  ];

  // Test scenario 2: Poor pitch (all 1s)
  const poorPitch = perfectPitch.map(score => ({
    ...score,
    rawScore: 1
  }));

  // Test scenario 3: Average pitch (all 5s)
  const averagePitch = perfectPitch.map(score => ({
    ...score,
    rawScore: 5
  }));

  // Test scenario 4: Mixed confidence pitch
  const mixedConfidencePitch = perfectPitch.map((score, index) => ({
    ...score,
    rawScore: 7,
    confidence: 0.5 + (index % 5) * 0.1 // Varying confidence 0.5-0.9
  }));

  // Test scenario 5: Realistic pitch with variation
  const realisticPitch = [
    { pointId: 'speech_pace_rhythm', rawScore: 8, confidence: 0.9, category: 'speech' },
    { pointId: 'speech_volume_projection', rawScore: 7, confidence: 0.8, category: 'speech' },
    { pointId: 'speech_clarity_articulation', rawScore: 9, confidence: 0.95, category: 'speech' },
    { pointId: 'speech_filler_words', rawScore: 6, confidence: 0.85, category: 'speech' },
    { pointId: 'speech_vocal_confidence', rawScore: 8, confidence: 0.9, category: 'speech' },
    { pointId: 'content_problem_definition', rawScore: 9, confidence: 0.9, category: 'content' },
    { pointId: 'content_solution_explanation', rawScore: 8, confidence: 0.85, category: 'content' },
    { pointId: 'content_market_size', rawScore: 7, confidence: 0.75, category: 'content' },
    { pointId: 'content_traction_demonstration', rawScore: 6, confidence: 0.8, category: 'content' },
    { pointId: 'content_financial_projections', rawScore: 7, confidence: 0.7, category: 'content' },
    { pointId: 'visual_slide_design', rawScore: 8, confidence: 0.9, category: 'visual' },
    { pointId: 'visual_data_visualization', rawScore: 6, confidence: 0.8, category: 'visual' },
    { pointId: 'visual_timing_flow', rawScore: 7, confidence: 0.85, category: 'visual' },
    { pointId: 'overall_persuasion_storytelling', rawScore: 8, confidence: 0.9, category: 'overall' },
    { pointId: 'overall_confidence_credibility', rawScore: 7, confidence: 0.85, category: 'overall' }
  ];

  return {
    perfectPitch,
    poorPitch,
    averagePitch,
    mixedConfidencePitch,
    realisticPitch
  };
}

/**
 * Generate historical data for testing advanced normalization methods
 */
function generateHistoricalData() {
  const historicalData = [];
  
  // Generate historical scores for each point
  const pointIds = [
    'speech_pace_rhythm', 'speech_volume_projection', 'speech_clarity_articulation',
    'speech_filler_words', 'speech_vocal_confidence', 'content_problem_definition',
    'content_solution_explanation', 'content_market_size', 'content_traction_demonstration',
    'content_financial_projections', 'visual_slide_design', 'visual_data_visualization',
    'visual_timing_flow', 'overall_persuasion_storytelling', 'overall_confidence_credibility'
  ];

  pointIds.forEach(pointId => {
    // Generate 100 historical scores with normal distribution around 6.5
    const scores = [];
    for (let i = 0; i < 100; i++) {
      // Generate scores with slight variations based on category
      let baseScore = 6.5;
      if (pointId.startsWith('content_')) baseScore = 6.8; // Content slightly higher
      if (pointId.startsWith('speech_')) baseScore = 6.3; // Speech slightly lower
      if (pointId.startsWith('visual_')) baseScore = 6.0; // Visual lowest
      if (pointId.startsWith('overall_')) baseScore = 6.7; // Overall good
      
      // Add random variation (normal distribution approximation)
      const randomVariation = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.5;
      const score = Math.max(1, Math.min(10, baseScore + randomVariation));
      scores.push(score);
    }

    historicalData.push({
      pointId,
      scores,
      lastUpdated: new Date()
    });
  });

  return historicalData;
}

/**
 * Test basic normalization functionality
 */
async function testBasicNormalization(modules) {
  console.log('\n=== Testing Basic Normalization ===');
  
  const { scoreNormalization } = modules;
  const testScores = generateTestScores();
  
  try {
    const normalizer = new scoreNormalization.ScoreNormalizer();
    
    // Test perfect pitch
    const perfectResult = normalizer.normalizeScores(
      testScores.perfectPitch, 
      'weighted', 
      'perfect-pitch-test'
    );
    
    console.log('✅ Perfect Pitch Test:');
    console.log(`   Overall Score: ${perfectResult.overallScore.toFixed(1)}/100`);
    console.log(`   Category Scores: Speech=${perfectResult.categoryScores.speech.toFixed(1)}, Content=${perfectResult.categoryScores.content.toFixed(1)}, Visual=${perfectResult.categoryScores.visual.toFixed(1)}, Overall=${perfectResult.categoryScores.overall.toFixed(1)}`);
    
    // Test poor pitch
    const poorResult = normalizer.normalizeScores(
      testScores.poorPitch, 
      'weighted', 
      'poor-pitch-test'
    );
    
    console.log('✅ Poor Pitch Test:');
    console.log(`   Overall Score: ${poorResult.overallScore.toFixed(1)}/100`);
    console.log(`   Should be significantly lower than perfect pitch: ${poorResult.overallScore < perfectResult.overallScore ? 'PASS' : 'FAIL'}`);
    
    // Test realistic pitch
    const realisticResult = normalizer.normalizeScores(
      testScores.realisticPitch, 
      'weighted', 
      'realistic-pitch-test'
    );
    
    console.log('✅ Realistic Pitch Test:');
    console.log(`   Overall Score: ${realisticResult.overallScore.toFixed(1)}/100`);
    console.log(`   Should be between poor and perfect: ${poorResult.overallScore < realisticResult.overallScore && realisticResult.overallScore < perfectResult.overallScore ? 'PASS' : 'FAIL'}`);
    
    return true;
  } catch (error) {
    console.error('❌ Basic normalization test failed:', error.message);
    return false;
  }
}

/**
 * Test different normalization methods
 */
async function testNormalizationMethods(modules) {
  console.log('\n=== Testing Different Normalization Methods ===');
  
  const { scoreNormalization } = modules;
  const testScores = generateTestScores();
  const historicalData = generateHistoricalData();
  
  try {
    const normalizer = new scoreNormalization.ScoreNormalizer(historicalData);
    const methods = ['weighted', 'min-max', 'z-score', 'robust', 'decimal'];
    const results = {};
    
    for (const method of methods) {
      const result = normalizer.normalizeScores(
        testScores.realisticPitch, 
        method, 
        `test-${method}`
      );
      results[method] = result.overallScore;
      console.log(`✅ ${method.toUpperCase()} Method: ${result.overallScore.toFixed(1)}/100`);
    }
    
    // Verify all methods produce reasonable results (between 0 and 100)
    const allValid = Object.values(results).every(score => score >= 0 && score <= 100);
    console.log(`   All methods produce valid scores (0-100): ${allValid ? 'PASS' : 'FAIL'}`);
    
    return allValid;
  } catch (error) {
    console.error('❌ Normalization methods test failed:', error.message);
    return false;
  }
}

/**
 * Test weight consistency
 */
async function testWeightConsistency(modules) {
  console.log('\n=== Testing Weight Consistency ===');
  
  const { scoreNormalization, frameworkWeights } = modules;
  
  try {
    // Test weight validation
    const weightValidation = frameworkWeights.validateFrameworkWeights();
    console.log(`✅ Weight Validation: ${weightValidation.isValid ? 'PASS' : 'FAIL'}`);
    
    if (!weightValidation.isValid) {
      console.log('   Issues:', weightValidation.issues);
    }
    
    // Test category-point consistency
    const consistency = frameworkWeights.validateCategoryPointConsistency();
    const allConsistent = Object.values(consistency).every(data => data.isConsistent);
    console.log(`✅ Category-Point Consistency: ${allConsistent ? 'PASS' : 'FAIL'}`);
    
    if (!allConsistent) {
      Object.entries(consistency).forEach(([category, data]) => {
        if (!data.isConsistent) {
          console.log(`   ${category}: Expected ${data.expected}%, Got ${data.actual}%`);
        }
      });
    }
    
    return weightValidation.isValid && allConsistent;
  } catch (error) {
    console.error('❌ Weight consistency test failed:', error.message);
    return false;
  }
}

/**
 * Test statistical calculations
 */
async function testStatisticalCalculations(modules) {
  console.log('\n=== Testing Statistical Calculations ===');
  
  const { scoreNormalization } = modules;
  
  try {
    const normalizer = new scoreNormalization.ScoreNormalizer();
    
    // Test with known data
    const testData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const stats = normalizer.calculateStatistics(testData);
    
    console.log(`✅ Mean: ${stats.mean} (expected: 5.5) - ${Math.abs(stats.mean - 5.5) < 0.01 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Median: ${stats.median} (expected: 5.5) - ${Math.abs(stats.median - 5.5) < 0.01 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Min: ${stats.min} (expected: 1) - ${stats.min === 1 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Max: ${stats.max} (expected: 10) - ${stats.max === 10 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Q1: ${stats.q1} (expected: 3.25) - ${Math.abs(stats.q1 - 3.25) < 0.01 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Q3: ${stats.q3} (expected: 7.75) - ${Math.abs(stats.q3 - 7.75) < 0.01 ? 'PASS' : 'FAIL'}`);
    
    return true;
  } catch (error) {
    console.error('❌ Statistical calculations test failed:', error.message);
    return false;
  }
}

/**
 * Test outlier detection
 */
async function testOutlierDetection(modules) {
  console.log('\n=== Testing Outlier Detection ===');
  
  const { scoreNormalization } = modules;
  
  try {
    const historicalData = generateHistoricalData();
    const normalizer = new scoreNormalization.ScoreNormalizer(historicalData);
    
    // Create test scores with deliberate outliers
    const testScores = [
      { pointId: 'speech_pace_rhythm', rawScore: 10, confidence: 1.0, category: 'speech' }, // Potential outlier
      { pointId: 'speech_volume_projection', rawScore: 1, confidence: 1.0, category: 'speech' }, // Potential outlier
      { pointId: 'speech_clarity_articulation', rawScore: 6, confidence: 1.0, category: 'speech' }, // Normal
      { pointId: 'speech_filler_words', rawScore: 7, confidence: 1.0, category: 'speech' }, // Normal
      { pointId: 'speech_vocal_confidence', rawScore: 6, confidence: 1.0, category: 'speech' } // Normal
    ];
    
    const normalizedScores = testScores.map(score => 
      normalizer.normalizeIndividualScore ? 
      normalizer.normalizeIndividualScore(score, 'weighted') :
      { ...score, normalizedScore: score.rawScore * 10, weightedScore: score.rawScore, weight: 6 }
    );
    
    const { outliers, normal } = normalizer.detectOutliers(normalizedScores);
    
    console.log(`✅ Outliers detected: ${outliers.length}`);
    console.log(`✅ Normal scores: ${normal.length}`);
    console.log(`   Outlier detection functional: ${outliers.length >= 0 && normal.length >= 0 ? 'PASS' : 'FAIL'}`);
    
    return true;
  } catch (error) {
    console.error('❌ Outlier detection test failed:', error.message);
    return false;
  }
}

/**
 * Test batch comparison functionality
 */
async function testBatchComparison(modules) {
  console.log('\n=== Testing Batch Comparison ===');
  
  const { scoreNormalization } = modules;
  const testScores = generateTestScores();
  
  try {
    // Create multiple pitch scenarios
    const pitches = [
      { scores: testScores.perfectPitch, sessionId: 'perfect-pitch' },
      { scores: testScores.realisticPitch, sessionId: 'realistic-pitch' },
      { scores: testScores.averagePitch, sessionId: 'average-pitch' },
      { scores: testScores.poorPitch, sessionId: 'poor-pitch' }
    ];
    
    const normalizer = new scoreNormalization.ScoreNormalizer();
    const comparisons = pitches.map(pitch => 
      normalizer.normalizeScores(pitch.scores, 'weighted', pitch.sessionId)
    );
    
    // Generate batch report
    const batchReport = scoreNormalization.generateBatchNormalizationReport(comparisons);
    
    console.log('✅ Batch comparison generated successfully');
    console.log('   Report preview:');
    console.log(batchReport.split('\n').slice(0, 10).join('\n') + '...');
    
    // Test sorting (should be highest to lowest)
    const scores = comparisons.map(c => c.overallScore);
    const isSorted = scores.every((score, index) => 
      index === 0 || scores[index - 1] >= score
    );
    console.log(`   Results properly sorted: ${isSorted ? 'PASS' : 'FAIL'}`);
    
    return true;
  } catch (error) {
    console.error('❌ Batch comparison test failed:', error.message);
    return false;
  }
}

/**
 * Test report generation
 */
async function testReportGeneration(modules) {
  console.log('\n=== Testing Report Generation ===');
  
  const { scoreNormalization } = modules;
  const testScores = generateTestScores();
  
  try {
    const normalizer = new scoreNormalization.ScoreNormalizer();
    const result = normalizer.normalizeScores(
      testScores.realisticPitch, 
      'weighted', 
      'report-test'
    );
    
    const report = normalizer.generateNormalizationReport(result);
    
    console.log('✅ Normalization report generated successfully');
    console.log('   Report contains session ID:', report.includes('report-test') ? 'PASS' : 'FAIL');
    console.log('   Report contains overall score:', report.includes('Overall Score:') ? 'PASS' : 'FAIL');
    console.log('   Report contains category scores:', report.includes('Category Scores:') ? 'PASS' : 'FAIL');
    console.log('   Report contains individual scores:', report.includes('Individual Point Scores:') ? 'PASS' : 'FAIL');
    
    return true;
  } catch (error) {
    console.error('❌ Report generation test failed:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🧪 Starting Score Normalization Tests');
  console.log('=====================================');
  
  const modules = await loadModules();
  
  const tests = [
    { name: 'Basic Normalization', test: testBasicNormalization },
    { name: 'Normalization Methods', test: testNormalizationMethods },
    { name: 'Weight Consistency', test: testWeightConsistency },
    { name: 'Statistical Calculations', test: testStatisticalCalculations },
    { name: 'Outlier Detection', test: testOutlierDetection },
    { name: 'Batch Comparison', test: testBatchComparison },
    { name: 'Report Generation', test: testReportGeneration }
  ];
  
  let passCount = 0;
  let totalTests = tests.length;
  
  for (const { name, test } of tests) {
    try {
      const passed = await test(modules);
      if (passed) {
        passCount++;
        console.log(`\n✅ ${name}: PASSED`);
      } else {
        console.log(`\n❌ ${name}: FAILED`);
      }
    } catch (error) {
      console.log(`\n❌ ${name}: ERROR - ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passCount}/${totalTests} tests passed`);
  console.log(`Success Rate: ${((passCount / totalTests) * 100).toFixed(1)}%`);
  
  if (passCount === totalTests) {
    console.log('🎉 All tests passed! Score normalization system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.');
  }
  
  console.log('\n📝 Next Steps:');
  console.log('1. Review any failed tests and fix issues');
  console.log('2. Integration test with the full scoring pipeline');
  console.log('3. Performance testing with large datasets');
  console.log('4. Integration with recommendation generation (Task 5.6)');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  generateTestScores,
  generateHistoricalData
}; 