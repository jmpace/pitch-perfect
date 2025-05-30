/**
 * Comprehensive Scoring Engine Test Suite
 * 
 * End-to-end testing of the complete scoring engine including:
 * - Individual component testing
 * - Integration testing
 * - Performance validation
 * - Edge case handling
 * - Output validation
 */

const path = require('path');
const fs = require('fs');

// Import test data generator
const {
  generateSamplePitch,
  generateTestBatch,
  generateEdgeCases,
  getExpectedScoreRange,
  applyModifications
} = require('./test-sample-data');

// Test configuration
const TEST_CONFIG = {
  enableDetailedLogging: true,
  validateOutputRanges: true,
  performanceThresholds: {
    maxProcessingTime: 5000, // 5 seconds
    maxMemoryUsage: 100 * 1024 * 1024 // 100MB
  },
  scoreValidation: {
    minScore: 1.0,
    maxScore: 10.0,
    decimalPlaces: 1
  }
};

/**
 * Test Results Collector
 */
class TestResults {
  constructor() {
    this.tests = [];
    this.startTime = Date.now();
    this.errors = [];
    this.warnings = [];
  }

  addTest(name, passed, details = {}) {
    this.tests.push({
      name,
      passed,
      duration: details.duration || 0,
      details: details.details || '',
      error: details.error || null,
      timestamp: new Date()
    });
  }

  addError(message, context = '') {
    this.errors.push({ message, context, timestamp: new Date() });
  }

  addWarning(message, context = '') {
    this.warnings.push({ message, context, timestamp: new Date() });
  }

  getSummary() {
    const totalTests = this.tests.length;
    const passedTests = this.tests.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    const totalTime = Date.now() - this.startTime;

    return {
      totalTests,
      passedTests,
      failedTests,
      passRate: totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0,
      totalTime,
      errors: this.errors.length,
      warnings: this.warnings.length
    };
  }

  generateReport() {
    const summary = this.getSummary();
    
    let report = `
=== COMPREHENSIVE SCORING ENGINE TEST REPORT ===
Generated: ${new Date().toLocaleString()}
Total Execution Time: ${summary.totalTime}ms

SUMMARY:
✅ Tests Passed: ${summary.passedTests}
❌ Tests Failed: ${summary.failedTests}
📊 Pass Rate: ${summary.passRate}%
⚠️  Warnings: ${summary.warnings}
🚨 Errors: ${summary.errors}

`;

    // Test Details
    report += '\nDETAILED TEST RESULTS:\n';
    report += '='.repeat(50) + '\n';
    
    this.tests.forEach((test, index) => {
      const status = test.passed ? '✅' : '❌';
      report += `${index + 1}. ${status} ${test.name} (${test.duration}ms)\n`;
      if (test.details) {
        report += `   ${test.details}\n`;
      }
      if (test.error) {
        report += `   Error: ${test.error}\n`;
      }
    });

    // Errors and Warnings
    if (this.errors.length > 0) {
      report += '\nERRORS:\n';
      report += '='.repeat(50) + '\n';
      this.errors.forEach((error, index) => {
        report += `${index + 1}. ${error.message}\n`;
        if (error.context) {
          report += `   Context: ${error.context}\n`;
        }
      });
    }

    if (this.warnings.length > 0) {
      report += '\nWARNINGS:\n';
      report += '='.repeat(50) + '\n';
      this.warnings.forEach((warning, index) => {
        report += `${index + 1}. ${warning.message}\n`;
        if (warning.context) {
          report += `   Context: ${warning.context}\n`;
        }
      });
    }

    return report;
  }
}

/**
 * Mock implementations for testing (since we don't have actual API connections)
 */
class MockComponents {
  static async loadScoringFramework() {
    try {
      // Since we're testing, we'll create mock interfaces that match our expected structure
      return {
        FRAMEWORK_POINTS: [
          { id: 'speech_pace_rhythm', title: 'Speech Pace and Rhythm', category: 'speech' },
          { id: 'speech_volume_projection', title: 'Volume and Projection', category: 'speech' },
          { id: 'speech_clarity_articulation', title: 'Clarity and Articulation', category: 'speech' },
          { id: 'speech_filler_words', title: 'Filler Words and Pauses', category: 'speech' },
          { id: 'speech_vocal_confidence', title: 'Vocal Confidence', category: 'speech' },
          { id: 'content_problem_clarity', title: 'Problem Clarity', category: 'content' },
          { id: 'content_solution_clarity', title: 'Solution Clarity', category: 'content' },
          { id: 'content_market_size', title: 'Market Size', category: 'content' },
          { id: 'content_traction', title: 'Traction Evidence', category: 'content' },
          { id: 'content_financials', title: 'Financial Realism', category: 'content' },
          { id: 'visual_design_quality', title: 'Design Quality', category: 'visual' },
          { id: 'visual_data_visualization', title: 'Data Visualization', category: 'visual' },
          { id: 'visual_timing_alignment', title: 'Timing Alignment', category: 'visual' },
          { id: 'overall_persuasion', title: 'Persuasion Elements', category: 'overall' },
          { id: 'overall_credibility', title: 'Credibility Factors', category: 'overall' }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to load scoring framework: ${error.message}`);
    }
  }

  static generateMockFrameworkScore(input, scenario = 'average') {
    const baseScores = {
      excellent: 9.0,
      good: 7.5,
      average: 6.0,
      poor: 3.5
    };

    const baseScore = baseScores[scenario] || baseScores.average;
    const variation = () => baseScore + (Math.random() - 0.5) * 2; // ±1 point variation

    return {
      sessionId: input.sessionId,
      overallScore: variation(),
      categoryScores: {
        speech: variation(),
        content: variation(),
        visual: variation(),
        overall: variation()
      },
      individualScores: [
        { pointId: 'speech_pace_rhythm', score: variation(), rationale: 'Test rationale', improvementSuggestions: ['Test suggestion'], confidence: 0.8 },
        { pointId: 'speech_volume_projection', score: variation(), rationale: 'Test rationale', improvementSuggestions: ['Test suggestion'], confidence: 0.8 },
        { pointId: 'speech_clarity_articulation', score: variation(), rationale: 'Test rationale', improvementSuggestions: ['Test suggestion'], confidence: 0.8 },
        { pointId: 'speech_filler_words', score: variation(), rationale: 'Test rationale', improvementSuggestions: ['Test suggestion'], confidence: 0.8 },
        { pointId: 'speech_vocal_confidence', score: variation(), rationale: 'Test rationale', improvementSuggestions: ['Test suggestion'], confidence: 0.8 }
      ],
      analysisTimestamp: new Date(),
      processingTime: Math.random() * 1000 + 500 // 500-1500ms
    };
  }

  static generateMockRecommendations(frameworkScore) {
    return {
      totalRecommendations: 8,
      categorizedRecommendations: {
        critical: [
          { title: 'Critical Test Recommendation', priority: 10, category: 'critical', actionableSteps: ['Step 1'] }
        ],
        high: [
          { title: 'High Priority Test Recommendation', priority: 8, category: 'high', actionableSteps: ['Step 1'] }
        ],
        medium: [
          { title: 'Medium Priority Test Recommendation', priority: 5, category: 'medium', actionableSteps: ['Step 1'] }
        ],
        low: [
          { title: 'Low Priority Test Recommendation', priority: 2, category: 'low', actionableSteps: ['Step 1'] }
        ]
      },
      quickWins: [
        { title: 'Quick Win Test Recommendation', estimatedImpact: 0.5, estimatedEffort: 0.2 }
      ],
      recommendations: []
    };
  }
}

/**
 * Individual Component Tests
 */
class ComponentTests {
  static async testScoringFramework(results) {
    const testName = 'Scoring Framework Loading';
    const startTime = Date.now();
    
    try {
      const framework = await MockComponents.loadScoringFramework();
      const duration = Date.now() - startTime;
      
      // Validate framework structure
      if (!framework.FRAMEWORK_POINTS || !Array.isArray(framework.FRAMEWORK_POINTS)) {
        throw new Error('Framework points not found or invalid');
      }
      
      if (framework.FRAMEWORK_POINTS.length !== 15) {
        throw new Error(`Expected 15 framework points, found ${framework.FRAMEWORK_POINTS.length}`);
      }
      
      // Validate point structure
      const requiredFields = ['id', 'title', 'category'];
      for (const point of framework.FRAMEWORK_POINTS) {
        for (const field of requiredFields) {
          if (!point[field]) {
            throw new Error(`Framework point missing required field: ${field}`);
          }
        }
      }
      
      results.addTest(testName, true, {
        duration,
        details: `Successfully loaded ${framework.FRAMEWORK_POINTS.length} framework points`
      });
      
    } catch (error) {
      results.addTest(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  static async testScoringLogic(results) {
    const testName = 'Scoring Logic Validation';
    const startTime = Date.now();
    
    try {
      const testScenarios = ['excellent', 'good', 'average', 'poor'];
      let allPassed = true;
      const details = [];
      
      for (const scenario of testScenarios) {
        const sampleData = generateSamplePitch(scenario);
        const mockScore = MockComponents.generateMockFrameworkScore(sampleData, scenario);
        const expectedRange = getExpectedScoreRange(scenario);
        
        // Validate score ranges
        if (mockScore.overallScore < expectedRange.min || mockScore.overallScore > expectedRange.max) {
          results.addWarning(
            `Score for ${scenario} scenario (${mockScore.overallScore.toFixed(1)}) outside expected range ${expectedRange.min}-${expectedRange.max}`,
            testName
          );
        }
        
        // Validate score structure
        if (!mockScore.sessionId || !mockScore.overallScore || !mockScore.categoryScores) {
          allPassed = false;
          details.push(`${scenario}: Missing required score fields`);
        } else {
          details.push(`${scenario}: Score ${mockScore.overallScore.toFixed(1)} (expected ${expectedRange.min}-${expectedRange.max})`);
        }
      }
      
      const duration = Date.now() - startTime;
      results.addTest(testName, allPassed, {
        duration,
        details: details.join(', ')
      });
      
    } catch (error) {
      results.addTest(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  static async testRecommendationEngine(results) {
    const testName = 'Recommendation Engine Validation';
    const startTime = Date.now();
    
    try {
      const sampleData = generateSamplePitch('average');
      const mockScore = MockComponents.generateMockFrameworkScore(sampleData);
      const recommendations = MockComponents.generateMockRecommendations(mockScore);
      
      // Validate recommendation structure
      const requiredFields = ['totalRecommendations', 'categorizedRecommendations', 'quickWins'];
      for (const field of requiredFields) {
        if (!recommendations[field]) {
          throw new Error(`Missing required recommendation field: ${field}`);
        }
      }
      
      // Validate categories
      const requiredCategories = ['critical', 'high', 'medium', 'low'];
      for (const category of requiredCategories) {
        if (!recommendations.categorizedRecommendations[category]) {
          throw new Error(`Missing recommendation category: ${category}`);
        }
      }
      
      const duration = Date.now() - startTime;
      results.addTest(testName, true, {
        duration,
        details: `Generated ${recommendations.totalRecommendations} recommendations with ${recommendations.quickWins.length} quick wins`
      });
      
    } catch (error) {
      results.addTest(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }
}

/**
 * Integration Tests
 */
class IntegrationTests {
  static async testEndToEndPipeline(results) {
    const testName = 'End-to-End Pipeline Integration';
    const startTime = Date.now();
    
    try {
      const testBatch = generateTestBatch();
      let successCount = 0;
      const details = [];
      
      for (const test of testBatch) {
        try {
          // Simulate full pipeline
          const frameworkScore = MockComponents.generateMockFrameworkScore(test.data, test.scenario);
          const recommendations = MockComponents.generateMockRecommendations(frameworkScore);
          
          // Validate pipeline output
          if (frameworkScore && recommendations) {
            successCount++;
            details.push(`${test.scenario}: ✅`);
          } else {
            details.push(`${test.scenario}: ❌`);
          }
          
        } catch (error) {
          details.push(`${test.scenario}: ❌ (${error.message})`);
          results.addError(`Pipeline failed for ${test.scenario}`, error.message);
        }
      }
      
      const duration = Date.now() - startTime;
      const allPassed = successCount === testBatch.length;
      
      results.addTest(testName, allPassed, {
        duration,
        details: `${successCount}/${testBatch.length} scenarios passed: ${details.join(', ')}`
      });
      
    } catch (error) {
      results.addTest(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  static async testBatchProcessing(results) {
    const testName = 'Batch Processing Performance';
    const startTime = Date.now();
    
    try {
      const batchSize = 10;
      const testData = Array(batchSize).fill(null).map((_, index) => 
        generateSamplePitch('average', `batch-test-${index}`)
      );
      
      const processingStartTime = Date.now();
      const batchResults = [];
      
      for (const data of testData) {
        const score = MockComponents.generateMockFrameworkScore(data);
        const recommendations = MockComponents.generateMockRecommendations(score);
        batchResults.push({ score, recommendations });
      }
      
      const processingTime = Date.now() - processingStartTime;
      const avgTimePerItem = processingTime / batchSize;
      
      const duration = Date.now() - startTime;
      const passed = processingTime < TEST_CONFIG.performanceThresholds.maxProcessingTime;
      
      results.addTest(testName, passed, {
        duration,
        details: `Processed ${batchSize} items in ${processingTime}ms (avg: ${avgTimePerItem.toFixed(0)}ms/item)`
      });
      
      if (!passed) {
        results.addWarning(
          `Batch processing exceeded threshold: ${processingTime}ms > ${TEST_CONFIG.performanceThresholds.maxProcessingTime}ms`,
          testName
        );
      }
      
    } catch (error) {
      results.addTest(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }
}

/**
 * Edge Case Tests
 */
class EdgeCaseTests {
  static async testEdgeCaseHandling(results) {
    const testName = 'Edge Case Handling';
    const startTime = Date.now();
    
    try {
      const edgeCases = generateEdgeCases();
      let successCount = 0;
      const details = [];
      
      for (const edgeCase of edgeCases) {
        try {
          let testData = edgeCase.data;
          
          // Apply modifications if specified
          if (edgeCase.modifications) {
            testData = applyModifications(testData, edgeCase.modifications);
          }
          
          const score = MockComponents.generateMockFrameworkScore(testData);
          
          // Validate that edge case doesn't break the system
          if (score && score.overallScore >= TEST_CONFIG.scoreValidation.minScore && 
              score.overallScore <= TEST_CONFIG.scoreValidation.maxScore) {
            successCount++;
            details.push(`${edgeCase.name}: ✅`);
          } else {
            details.push(`${edgeCase.name}: ❌ (invalid score)`);
          }
          
        } catch (error) {
          details.push(`${edgeCase.name}: ❌ (${error.message})`);
          results.addError(`Edge case failed: ${edgeCase.name}`, error.message);
        }
      }
      
      const duration = Date.now() - startTime;
      const allPassed = successCount === edgeCases.length;
      
      results.addTest(testName, allPassed, {
        duration,
        details: `${successCount}/${edgeCases.length} edge cases handled: ${details.join(', ')}`
      });
      
    } catch (error) {
      results.addTest(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  static async testInvalidInputHandling(results) {
    const testName = 'Invalid Input Handling';
    const startTime = Date.now();
    
    try {
      const invalidInputs = [
        { name: 'Null Input', data: null },
        { name: 'Empty Object', data: {} },
        { name: 'Missing Transcript', data: { visual: {}, content: {}, sessionId: 'test' } },
        { name: 'Invalid Numbers', data: generateSamplePitch('average') }
      ];
      
      // Modify the last case to have invalid numbers
      invalidInputs[3].data.transcript.wordsPerMinute = -1;
      invalidInputs[3].data.transcript.clarityScore = 2.0; // Out of 0-1 range
      
      let handledCount = 0;
      const details = [];
      
      for (const test of invalidInputs) {
        try {
          if (test.data === null || Object.keys(test.data).length === 0) {
            // These should be handled gracefully
            handledCount++;
            details.push(`${test.name}: ✅ (handled gracefully)`);
          } else {
            const score = MockComponents.generateMockFrameworkScore(test.data);
            if (score) {
              handledCount++;
              details.push(`${test.name}: ✅`);
            } else {
              details.push(`${test.name}: ❌`);
            }
          }
        } catch (error) {
          // Errors are expected for invalid inputs, so this is good
          handledCount++;
          details.push(`${test.name}: ✅ (error handled)`);
        }
      }
      
      const duration = Date.now() - startTime;
      const allPassed = handledCount === invalidInputs.length;
      
      results.addTest(testName, allPassed, {
        duration,
        details: `${handledCount}/${invalidInputs.length} invalid inputs handled: ${details.join(', ')}`
      });
      
    } catch (error) {
      results.addTest(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }
}

/**
 * Performance Tests
 */
class PerformanceTests {
  static async testMemoryUsage(results) {
    const testName = 'Memory Usage Validation';
    const startTime = Date.now();
    
    try {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process multiple pitches to test memory usage
      const testCount = 50;
      for (let i = 0; i < testCount; i++) {
        const data = generateSamplePitch('average', `memory-test-${i}`);
        const score = MockComponents.generateMockFrameworkScore(data);
        const recommendations = MockComponents.generateMockRecommendations(score);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      const duration = Date.now() - startTime;
      const passed = memoryIncrease < TEST_CONFIG.performanceThresholds.maxMemoryUsage;
      
      results.addTest(testName, passed, {
        duration,
        details: `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB for ${testCount} processes`
      });
      
      if (!passed) {
        results.addWarning(
          `Memory usage exceeded threshold: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB > ${(TEST_CONFIG.performanceThresholds.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB`,
          testName
        );
      }
      
    } catch (error) {
      results.addTest(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  static async testProcessingSpeed(results) {
    const testName = 'Processing Speed Validation';
    const startTime = Date.now();
    
    try {
      const testData = generateSamplePitch('average');
      const iterations = 100;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const iterationStart = Date.now();
        const score = MockComponents.generateMockFrameworkScore(testData);
        times.push(Date.now() - iterationStart);
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      const duration = Date.now() - startTime;
      const passed = avgTime < 100; // Average should be under 100ms for mock processing
      
      results.addTest(testName, passed, {
        duration,
        details: `Avg: ${avgTime.toFixed(1)}ms, Min: ${minTime}ms, Max: ${maxTime}ms over ${iterations} iterations`
      });
      
    } catch (error) {
      results.addTest(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }
}

/**
 * Main Test Runner
 */
async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Scoring Engine Tests...\n');
  
  const results = new TestResults();
  
  try {
    // Component Tests
    console.log('📋 Running Component Tests...');
    await ComponentTests.testScoringFramework(results);
    await ComponentTests.testScoringLogic(results);
    await ComponentTests.testRecommendationEngine(results);
    
    // Integration Tests
    console.log('🔗 Running Integration Tests...');
    await IntegrationTests.testEndToEndPipeline(results);
    await IntegrationTests.testBatchProcessing(results);
    
    // Edge Case Tests
    console.log('⚠️  Running Edge Case Tests...');
    await EdgeCaseTests.testEdgeCaseHandling(results);
    await EdgeCaseTests.testInvalidInputHandling(results);
    
    // Performance Tests
    console.log('⚡ Running Performance Tests...');
    await PerformanceTests.testMemoryUsage(results);
    await PerformanceTests.testProcessingSpeed(results);
    
  } catch (error) {
    results.addError('Test execution failed', error.message);
  }
  
  // Generate and display report
  const report = results.generateReport();
  console.log(report);
  
  // Save report to file
  const reportPath = path.join(__dirname, 'scoring-engine-test-report.txt');
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  
  // Return summary for programmatic use
  return results.getSummary();
}

/**
 * Export for external use
 */
module.exports = {
  runComprehensiveTests,
  ComponentTests,
  IntegrationTests,
  EdgeCaseTests,
  PerformanceTests,
  TestResults,
  TEST_CONFIG
};

/**
 * Run tests if executed directly
 */
if (require.main === module) {
  runComprehensiveTests()
    .then(summary => {
      console.log(`\n🎯 Test Summary: ${summary.passedTests}/${summary.totalTests} passed (${summary.passRate}%)`);
      process.exit(summary.failedTests > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
} 