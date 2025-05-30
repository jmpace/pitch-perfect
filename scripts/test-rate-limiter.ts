#!/usr/bin/env tsx

/**
 * Test script for OpenAI Rate Limiter
 * 
 * This script tests various aspects of the rate limiting system:
 * - Basic rate limiting functionality
 * - Queue management and prioritization
 * - Token estimation
 * - Rate limit status tracking
 * - Error handling
 * 
 * Usage: npx tsx scripts/test-rate-limiter.ts
 */

import { OpenAIRateLimiter, rateLimiter, OpenAIEndpoint } from '../lib/openai-rate-limiter';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test basic rate limiting functionality
 */
async function testBasicRateLimiting() {
  log('\n🧪 Testing Basic Rate Limiting...', colors.bright);
  
  try {
    // Reset rate limiter for clean test
    rateLimiter.reset();
    
    // Test basic permission request
    await rateLimiter.requestPermission('transcription', 100, 'medium');
    logSuccess('Basic permission request succeeded');
    
    // Test token estimation
    const tokens = rateLimiter.estimateTokens('transcription', 'This is a test audio file', 1000);
    logInfo(`Token estimation for transcription: ${tokens} tokens`);
    
    if (tokens > 0) {
      logSuccess('Token estimation working');
    } else {
      logError('Token estimation failed');
    }
    
  } catch (error) {
    logError(`Basic rate limiting test failed: ${error}`);
  }
}

/**
 * Test queue management and prioritization
 */
async function testQueueManagement() {
  log('\n🧪 Testing Queue Management...', colors.bright);
  
  try {
    // Reset rate limiter
    rateLimiter.reset();
    
    // Create multiple requests with different priorities
    const promises = [
      rateLimiter.requestPermission('vision', 500, 'low'),
      rateLimiter.requestPermission('transcription', 200, 'high'),
      rateLimiter.requestPermission('chat', 300, 'medium'),
      rateLimiter.requestPermission('vision', 400, 'high'),
    ];
    
    // Get queue info before processing
    const queueInfoBefore = rateLimiter.getQueueInfo();
    logInfo(`Queue size before processing: ${queueInfoBefore.totalSize}`);
    logInfo(`Priority distribution: ${JSON.stringify(queueInfoBefore.byPriority)}`);
    
    // Wait for all requests to complete
    await Promise.all(promises);
    
    // Get queue info after processing
    const queueInfoAfter = rateLimiter.getQueueInfo();
    logInfo(`Queue size after processing: ${queueInfoAfter.totalSize}`);
    
    logSuccess('Queue management test completed');
    
  } catch (error) {
    logError(`Queue management test failed: ${error}`);
  }
}

/**
 * Test rate limit status tracking
 */
async function testStatusTracking() {
  log('\n🧪 Testing Status Tracking...', colors.bright);
  
  try {
    // Reset rate limiter
    rateLimiter.reset();
    
    // Make several requests
    await rateLimiter.requestPermission('transcription', 100);
    await rateLimiter.requestPermission('vision', 200);
    await rateLimiter.requestPermission('chat', 150);
    
    // Get status
    const status = rateLimiter.getStatus();
    
    logInfo('Rate limit status:');
    Object.entries(status).forEach(([endpoint, info]) => {
      log(`  ${endpoint}: ${info.requestsUsed}/${info.requestsUsed + info.requestsRemaining} requests, ${info.tokensUsed} tokens used`);
    });
    
    logSuccess('Status tracking test completed');
    
  } catch (error) {
    logError(`Status tracking test failed: ${error}`);
  }
}

/**
 * Test rate limit header updates
 */
async function testHeaderUpdates() {
  log('\n🧪 Testing Rate Limit Header Updates...', colors.bright);
  
  try {
    // Create mock headers
    const mockHeaders = new Headers();
    mockHeaders.set('x-ratelimit-limit-requests', '1000');
    mockHeaders.set('x-ratelimit-limit-tokens', '250000');
    mockHeaders.set('x-ratelimit-remaining-requests', '950');
    mockHeaders.set('x-ratelimit-remaining-tokens', '240000');
    
    // Update limits from headers
    rateLimiter.updateLimitsFromApiResponse(mockHeaders);
    
    logInfo('Updated rate limits from mock headers');
    logSuccess('Header update test completed');
    
  } catch (error) {
    logError(`Header update test failed: ${error}`);
  }
}

/**
 * Test error handling
 */
async function testErrorHandling() {
  log('\n🧪 Testing Error Handling...', colors.bright);
  
  try {
    // Test 429 error handling
    const mockError = {
      status: 429,
      message: 'Rate limit exceeded',
      headers: new Map([['retry-after', '60']])
    };
    
    // This should not throw but should handle the error gracefully
    await rateLimiter.handleRateLimitError('transcription', mockError, 60);
    
    logSuccess('Error handling test completed');
    
  } catch (error) {
    logError(`Error handling test failed: ${error}`);
  }
}

/**
 * Test concurrent requests
 */
async function testConcurrentRequests() {
  log('\n🧪 Testing Concurrent Requests...', colors.bright);
  
  try {
    // Reset rate limiter
    rateLimiter.reset();
    
    const startTime = Date.now();
    
    // Create multiple concurrent requests
    const promises = Array.from({ length: 20 }, (_, i) =>
      rateLimiter.requestPermission('transcription', 50 + i, i % 3 === 0 ? 'high' : 'medium')
    );
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logInfo(`Processed 20 concurrent requests in ${duration}ms`);
    logSuccess('Concurrent requests test completed');
    
  } catch (error) {
    logError(`Concurrent requests test failed: ${error}`);
  }
}

/**
 * Performance benchmark
 */
async function benchmarkPerformance() {
  log('\n🧪 Running Performance Benchmark...', colors.bright);
  
  try {
    // Reset rate limiter
    rateLimiter.reset();
    
    const requestCounts = [10, 50, 100];
    
    for (const count of requestCounts) {
      const startTime = Date.now();
      
      const promises = Array.from({ length: count }, (_, i) =>
        rateLimiter.requestPermission('chat', 100, 'medium')
      );
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const rps = Math.round((count / duration) * 1000);
      
      logInfo(`${count} requests: ${duration}ms (${rps} req/sec)`);
    }
    
    logSuccess('Performance benchmark completed');
    
  } catch (error) {
    logError(`Performance benchmark failed: ${error}`);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  log('🚀 Starting OpenAI Rate Limiter Tests...', colors.bright);
  
  await testBasicRateLimiting();
  await testQueueManagement();
  await testStatusTracking();
  await testHeaderUpdates();
  await testErrorHandling();
  await testConcurrentRequests();
  await benchmarkPerformance();
  
  log('\n🎉 All tests completed!', colors.bright);
  
  // Final status report
  const finalStatus = rateLimiter.getStatus();
  const finalQueue = rateLimiter.getQueueInfo();
  
  log('\n📊 Final Status Report:', colors.cyan);
  log(`Queue size: ${finalQueue.totalSize}`);
  
  Object.entries(finalStatus).forEach(([endpoint, info]) => {
    if (info.requestsUsed > 0 || info.tokensUsed > 0) {
      log(`${endpoint}: ${info.requestsUsed} requests, ${info.tokensUsed} tokens used`);
    }
  });
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    logError(`Test execution failed: ${error}`);
    process.exit(1);
  });
} 