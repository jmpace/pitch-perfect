#!/usr/bin/env node

const http = require('http');

/**
 * Aggressive Rate Limiting Test
 * 
 * This script tests rate limiting by exceeding the configured limits:
 * - Health endpoint: 60 requests/minute (test with 70)
 * - Upload endpoint: 10 requests/minute (test with 15)
 * - General API: 100 requests/minute (test with 120)
 */

class AggressiveRateLimitTester {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.results = {};
  }

  async makeRequest(path, options = {}) {
    return new Promise((resolve) => {
      const url = new URL(path, this.baseUrl);
      const requestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'RateLimitTester/1.0',
          ...options.headers
        }
      };

      const req = http.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          status: 'error',
          error: error.message
        });
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  async testEndpoint(endpoint, limit, testCount, description) {
    console.log(`\n🚀 Testing ${description}`);
    console.log(`   Configured Limit: ${limit}/minute`);
    console.log(`   Test Count: ${testCount} requests`);
    console.log(`   Expected: First ${limit} should pass, remaining should be rate limited\n`);

    const requests = [];
    const startTime = Date.now();

    // Create all requests
    for (let i = 0; i < testCount; i++) {
      requests.push(this.makeRequest(endpoint));
    }

    // Execute all requests concurrently
    const responses = await Promise.all(requests);
    const endTime = Date.now();

    // Analyze responses
    const statusCounts = {};
    const rateLimitHeaders = [];
    
    responses.forEach((response, index) => {
      const status = response.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Capture rate limit headers from first few responses
      if (index < 5 && response.headers) {
        rateLimitHeaders.push({
          request: index + 1,
          limit: response.headers['x-ratelimit-limit'],
          remaining: response.headers['x-ratelimit-remaining'],
          reset: response.headers['x-ratelimit-reset']
        });
      }
    });

    const rateLimited = statusCounts[429] || 0;
    const successful = statusCounts[200] || 0;
    const duration = endTime - startTime;

    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log(`   ✅ Successful (200): ${successful}`);
    console.log(`   🚫 Rate Limited (429): ${rateLimited}`);
    console.log(`   ❓ Other Statuses:`, Object.entries(statusCounts).filter(([status]) => status !== '200' && status !== '429'));

    if (rateLimitHeaders.length > 0) {
      console.log(`\n   📊 Rate Limit Headers Sample:`);
      rateLimitHeaders.forEach(header => {
        console.log(`      Request ${header.request}: Limit=${header.limit}, Remaining=${header.remaining}`);
      });
    }

    // Determine if rate limiting is working correctly
    const isWorking = rateLimited > 0 && successful <= limit;
    const status = isWorking ? '✅ PASS' : '❌ FAIL';
    
    console.log(`\n   ${status} - Rate limiting ${isWorking ? 'working correctly' : 'not working as expected'}`);

    return {
      endpoint,
      description,
      limit,
      testCount,
      successful,
      rateLimited,
      duration,
      statusCounts,
      rateLimitHeaders,
      isWorking
    };
  }

  async runAllTests() {
    console.log('🔥 Starting Aggressive Rate Limiting Tests...\n');
    console.log(`Target: ${this.baseUrl}\n`);

    const tests = [
      {
        endpoint: '/api/health',
        limit: 60,
        testCount: 70,
        description: 'Health Endpoint (60/min limit)'
      },
      {
        endpoint: '/api/upload',
        limit: 10,
        testCount: 15,
        description: 'Upload Endpoint (10/min limit)',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      },
      {
        endpoint: '/api/openai',
        limit: 20,
        testCount: 25,
        description: 'AI Processing Endpoint (20/min limit)'
      }
    ];

    console.log('⚠️  Note: This test will make many rapid requests to verify rate limiting.');
    console.log('⚠️  If rate limiting is working, you should see 429 responses.\n');

    const results = [];

    for (const test of tests) {
      const result = await this.testEndpoint(
        test.endpoint, 
        test.limit, 
        test.testCount, 
        test.description
      );
      results.push(result);

      // Wait a bit between tests to avoid interference
      if (tests.indexOf(test) < tests.length - 1) {
        console.log('\n⏳ Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    this.generateSummary(results);
    return results;
  }

  generateSummary(results) {
    console.log('\n📊 Rate Limiting Test Summary');
    console.log('===============================');
    
    let passedTests = 0;
    let totalTests = results.length;

    results.forEach((result, index) => {
      const status = result.isWorking ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${result.description}: ${status}`);
      console.log(`   ${result.successful} successful, ${result.rateLimited} rate limited`);
      
      if (result.isWorking) {
        passedTests++;
      }
    });

    console.log(`\nOverall Rate Limiting Status: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All rate limiting tests PASSED - Security is working correctly!');
    } else {
      console.log('⚠️  Some rate limiting tests FAILED - Review configuration needed');
    }

    console.log('\n💡 Rate limiting protects against:');
    console.log('   - Brute force attacks');
    console.log('   - API abuse and DoS attempts');
    console.log('   - Resource exhaustion');
    console.log('   - Unauthorized scraping');
  }
}

// Run the tests
if (require.main === module) {
  const tester = new AggressiveRateLimitTester();
  tester.runAllTests()
    .then(results => {
      const fs = require('fs');
      fs.writeFileSync(
        './scripts/aggressive-rate-limit-results.json',
        JSON.stringify(results, null, 2)
      );
      
      const allPassed = results.every(r => r.isWorking);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = AggressiveRateLimitTester; 