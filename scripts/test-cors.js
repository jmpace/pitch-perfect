#!/usr/bin/env node

/**
 * CORS Policy Test Suite
 * Tests CORS implementation for all API endpoints
 */

const https = require('https');
const http = require('http');

// Test configuration
const config = {
  baseUrl: 'https://localhost:3000',
  apiEndpoints: [
    '/api/health',
    '/api/openai',
    '/api/whisper', 
    '/api/video',
    '/api/storage',
    '/api/cleanup',
    '/api/upload'
  ],
  allowedOrigins: [
    'https://localhost:3000',
    'http://localhost:3000',
    'https://127.0.0.1:3000',
    'http://127.0.0.1:3000'
  ],
  blockedOrigins: [
    'https://malicious-site.com',
    'http://bad-actor.org',
    'https://attacker.net'
  ],
  timeout: 10000
};

// HTTPS agent that ignores self-signed certificates (for development only)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Make HTTP request with custom headers
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: isHttps ? httpsAgent : undefined,
      timeout: config.timeout
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Test CORS preflight request
 */
async function testPreflight(endpoint, origin) {
  console.log(`\n🔍 Testing CORS preflight: ${endpoint} from ${origin}`);
  
  try {
    const response = await makeRequest(`${config.baseUrl}${endpoint}`, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });

    const corsHeaders = {
      'access-control-allow-origin': response.headers['access-control-allow-origin'],
      'access-control-allow-methods': response.headers['access-control-allow-methods'],
      'access-control-allow-headers': response.headers['access-control-allow-headers'],
      'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
      'access-control-max-age': response.headers['access-control-max-age']
    };

    const result = {
      endpoint,
      origin,
      status: response.status,
      corsHeaders,
      success: response.status === 200 && corsHeaders['access-control-allow-origin']
    };

    if (result.success) {
      console.log(`✅ Preflight PASSED - Status: ${result.status}`);
      console.log(`   Allow-Origin: ${corsHeaders['access-control-allow-origin']}`);
      console.log(`   Allow-Methods: ${corsHeaders['access-control-allow-methods']}`);
    } else {
      console.log(`❌ Preflight FAILED - Status: ${result.status}`);
      if (!corsHeaders['access-control-allow-origin']) {
        console.log(`   Missing Access-Control-Allow-Origin header`);
      }
    }

    return result;
  } catch (error) {
    console.log(`❌ Preflight ERROR: ${error.message}`);
    return {
      endpoint,
      origin,
      status: 0,
      error: error.message,
      success: false
    };
  }
}

/**
 * Test actual CORS request
 */
async function testCorsRequest(endpoint, origin) {
  console.log(`\n🔍 Testing CORS request: ${endpoint} from ${origin}`);
  
  try {
    const response = await makeRequest(`${config.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Origin': origin
      }
    });

    const corsHeaders = {
      'access-control-allow-origin': response.headers['access-control-allow-origin'],
      'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
      'vary': response.headers['vary']
    };

    const result = {
      endpoint,
      origin,
      status: response.status,
      corsHeaders,
      success: response.status < 400 && corsHeaders['access-control-allow-origin']
    };

    if (result.success) {
      console.log(`✅ Request PASSED - Status: ${result.status}`);
      console.log(`   Allow-Origin: ${corsHeaders['access-control-allow-origin']}`);
      console.log(`   Vary: ${corsHeaders['vary']}`);
    } else {
      console.log(`❌ Request FAILED - Status: ${result.status}`);
    }

    return result;
  } catch (error) {
    console.log(`❌ Request ERROR: ${error.message}`);
    return {
      endpoint,
      origin,
      status: 0,
      error: error.message,
      success: false
    };
  }
}

/**
 * Test CORS blocking for unauthorized origins
 */
async function testCorsBlocking(endpoint, origin) {
  console.log(`\n🚫 Testing CORS blocking: ${endpoint} from ${origin}`);
  
  try {
    const response = await makeRequest(`${config.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Origin': origin
      }
    });

    const hasAllowOrigin = response.headers['access-control-allow-origin'];
    const isBlocked = !hasAllowOrigin || response.status === 403;

    const result = {
      endpoint,
      origin,
      status: response.status,
      blocked: isBlocked,
      success: isBlocked // For blocked origins, success means the request was properly blocked
    };

    if (result.success) {
      console.log(`✅ Blocking PASSED - Origin properly blocked`);
    } else {
      console.log(`❌ Blocking FAILED - Origin should be blocked but wasn't`);
      console.log(`   Allow-Origin: ${hasAllowOrigin}`);
    }

    return result;
  } catch (error) {
    console.log(`❌ Blocking ERROR: ${error.message}`);
    return {
      endpoint,
      origin,
      status: 0,
      error: error.message,
      success: false
    };
  }
}

/**
 * Main test runner
 */
async function runCorsTests() {
  console.log('🚀 Starting CORS Policy Test Suite');
  console.log('=====================================');
  
  const results = {
    preflightTests: [],
    corsRequests: [],
    blockingTests: [],
    summary: {}
  };

  // Test 1: Preflight requests for allowed origins
  console.log('\n📋 Phase 1: Testing CORS Preflight Requests (Allowed Origins)');
  for (const endpoint of config.apiEndpoints) {
    for (const origin of config.allowedOrigins) {
      const result = await testPreflight(endpoint, origin);
      results.preflightTests.push(result);
    }
  }

  // Test 2: Actual CORS requests for allowed origins
  console.log('\n📋 Phase 2: Testing CORS Requests (Allowed Origins)');
  for (const endpoint of config.apiEndpoints) {
    for (const origin of config.allowedOrigins) {
      const result = await testCorsRequest(endpoint, origin);
      results.corsRequests.push(result);
    }
  }

  // Test 3: CORS blocking for unauthorized origins
  console.log('\n📋 Phase 3: Testing CORS Blocking (Unauthorized Origins)');
  for (const endpoint of config.apiEndpoints) {
    for (const origin of config.blockedOrigins) {
      const result = await testCorsBlocking(endpoint, origin);
      results.blockingTests.push(result);
    }
  }

  // Generate summary
  results.summary = {
    preflightSuccess: results.preflightTests.filter(r => r.success).length,
    preflightTotal: results.preflightTests.length,
    corsRequestSuccess: results.corsRequests.filter(r => r.success).length,
    corsRequestTotal: results.corsRequests.length,
    blockingSuccess: results.blockingTests.filter(r => r.success).length,
    blockingTotal: results.blockingTests.length
  };

  // Print summary
  console.log('\n📊 CORS Test Summary');
  console.log('====================');
  console.log(`Preflight Tests: ${results.summary.preflightSuccess}/${results.summary.preflightTotal} passed`);
  console.log(`CORS Requests: ${results.summary.corsRequestSuccess}/${results.summary.corsRequestTotal} passed`);
  console.log(`Blocking Tests: ${results.summary.blockingSuccess}/${results.summary.blockingTotal} passed`);
  
  const allPassed = results.summary.preflightSuccess === results.summary.preflightTotal &&
                   results.summary.corsRequestSuccess === results.summary.corsRequestTotal &&
                   results.summary.blockingSuccess === results.summary.blockingTotal;

  if (allPassed) {
    console.log('\n✅ All CORS tests PASSED! CORS policy is working correctly.');
  } else {
    console.log('\n❌ Some CORS tests FAILED. Please review the configuration.');
  }

  // Save detailed results
  const fs = require('fs');
  const resultsPath = 'scripts/cors-test-results.json';
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed results saved to: ${resultsPath}`);

  return allPassed;
}

// Run tests if called directly
if (require.main === module) {
  runCorsTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = { runCorsTests, testPreflight, testCorsRequest, testCorsBlocking }; 