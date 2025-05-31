#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Security Penetration Testing Script
 * 
 * This script performs comprehensive security testing including:
 * - XSS injection attempts
 * - SQL injection testing
 * - Rate limiting verification
 * - Input validation testing
 * - Security header verification
 * - CORS policy testing
 */

class SecurityPenetrationTester {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {},
      vulnerabilities: [],
      warnings: [],
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  async runAllTests() {
    console.log('🔥 Starting Security Penetration Testing...\n');
    console.log(`Target: ${this.baseUrl}\n`);

    try {
      await this.testSecurityHeaders();
      await this.testXSSProtection();
      await this.testInputValidation();
      await this.testRateLimiting();
      await this.testFileUploadSecurity();
      await this.testAPIEndpointSecurity();
      await this.testCORSPolicyCorrectly();
      
      this.generateSummary();
    } catch (error) {
      console.error('❌ Penetration testing failed:', error.message);
    }

    return this.results;
  }

  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const requestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'SecurityTester/1.0',
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

      req.on('error', reject);
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  async testSecurityHeaders() {
    console.log('🛡️  Testing Security Headers...');
    this.total++;

    try {
      const response = await this.makeRequest('/');
      
      const requiredHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block',
        'referrer-policy': 'strict-origin-when-cross-origin'
      };

      const missing = [];
      const present = [];

      for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
        if (response.headers[header]) {
          if (response.headers[header].includes(expectedValue) || expectedValue === true) {
            present.push(header);
          } else {
            missing.push(`${header} (incorrect value: ${response.headers[header]})`);
          }
        } else {
          missing.push(header);
        }
      }

      this.results.tests.securityHeaders = {
        passed: missing.length === 0,
        present: present.length,
        missing: missing.length,
        details: { present, missing }
      };

      if (missing.length > 0) {
        this.results.warnings.push(`Missing security headers: ${missing.join(', ')}`);
        this.failed++;
        console.log(`   ❌ Missing headers: ${missing.join(', ')}`);
      } else {
        this.passed++;
        console.log('   ✅ All required security headers present');
      }

      // Check for additional security headers
      const bonusHeaders = ['strict-transport-security', 'content-security-policy', 'permissions-policy'];
      const bonusPresent = bonusHeaders.filter(h => response.headers[h]);
      if (bonusPresent.length > 0) {
        console.log(`   ✅ Bonus headers: ${bonusPresent.join(', ')}`);
      }

    } catch (error) {
      this.failed++;
      this.results.tests.securityHeaders = { passed: false, error: error.message };
      console.log(`   ❌ Security headers test failed: ${error.message}`);
    }
  }

  async testXSSProtection() {
    console.log('\n🚫 Testing XSS Protection...');
    this.total++;

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      '"><img src=x onerror=alert("XSS")>'
    ];

    try {
      let blocked = 0;
      let vulnerable = 0;

      for (const payload of xssPayloads) {
        try {
          // Test XSS in query parameters
          const response = await this.makeRequest(`/api/health?test=${encodeURIComponent(payload)}`);
          
          // Check if payload is reflected without sanitization
          if (response.body && response.body.includes(payload.replace(/[<>"]/g, ''))) {
            vulnerable++;
            this.results.vulnerabilities.push(`XSS vulnerability found with payload: ${payload}`);
          } else {
            blocked++;
          }
        } catch (error) {
          blocked++; // Request blocked/failed is good
        }
      }

      this.results.tests.xssProtection = {
        passed: vulnerable === 0,
        blocked,
        vulnerable,
        totalPayloads: xssPayloads.length
      };

      if (vulnerable > 0) {
        this.failed++;
        console.log(`   ❌ XSS vulnerabilities found: ${vulnerable}/${xssPayloads.length}`);
      } else {
        this.passed++;
        console.log(`   ✅ All XSS payloads blocked: ${blocked}/${xssPayloads.length}`);
      }

    } catch (error) {
      this.failed++;
      this.results.tests.xssProtection = { passed: false, error: error.message };
      console.log(`   ❌ XSS protection test failed: ${error.message}`);
    }
  }

  async testInputValidation() {
    console.log('\n📝 Testing Input Validation...');
    this.total++;

    const maliciousInputs = [
      { name: 'SQL Injection', payload: "'; DROP TABLE users; --" },
      { name: 'NoSQL Injection', payload: '{"$where": "this.username == this.password"}' },
      { name: 'Command Injection', payload: '; cat /etc/passwd' },
      { name: 'Path Traversal', payload: '../../../etc/passwd' },
      { name: 'Null Bytes', payload: 'test\x00.txt' },
      { name: 'Unicode Bypass', payload: '<script>alert("XSS")</script>' },
      { name: 'Large Input', payload: 'A'.repeat(10000) }
    ];

    try {
      let blocked = 0;
      let passed = 0;

      for (const input of maliciousInputs) {
        try {
          const response = await this.makeRequest('/api/health', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ test: input.payload })
          });

          // Check if dangerous input is processed or reflected
          if (response.status >= 400 || !response.body.includes(input.payload)) {
            blocked++;
          } else {
            passed++;
            this.results.vulnerabilities.push(`Input validation bypass: ${input.name}`);
          }
        } catch (error) {
          blocked++; // Request blocked is good
        }
      }

      this.results.tests.inputValidation = {
        passed: passed === 0,
        blocked,
        passed: passed,
        totalInputs: maliciousInputs.length
      };

      if (passed > 0) {
        this.failed++;
        console.log(`   ❌ Input validation bypassed: ${passed}/${maliciousInputs.length}`);
      } else {
        this.passed++;
        console.log(`   ✅ All malicious inputs blocked: ${blocked}/${maliciousInputs.length}`);
      }

    } catch (error) {
      this.failed++;
      this.results.tests.inputValidation = { passed: false, error: error.message };
      console.log(`   ❌ Input validation test failed: ${error.message}`);
    }
  }

  async testRateLimiting() {
    console.log('\n⚡ Testing Rate Limiting...');
    this.total++;

    try {
      const requests = [];
      const rapidRequests = 15; // Try to exceed rate limit

      // Make rapid requests
      for (let i = 0; i < rapidRequests; i++) {
        requests.push(this.makeRequest('/api/health'));
      }

      const responses = await Promise.allSettled(requests);
      
      const statusCodes = responses.map(r => 
        r.status === 'fulfilled' ? r.value.status : 'error'
      );

      const rateLimitedRequests = statusCodes.filter(code => code === 429).length;
      const successfulRequests = statusCodes.filter(code => code === 200).length;

      this.results.tests.rateLimiting = {
        passed: rateLimitedRequests > 0,
        totalRequests: rapidRequests,
        rateLimited: rateLimitedRequests,
        successful: successfulRequests,
        statusCodes
      };

      if (rateLimitedRequests > 0) {
        this.passed++;
        console.log(`   ✅ Rate limiting active: ${rateLimitedRequests}/${rapidRequests} requests limited`);
      } else {
        this.failed++;
        this.results.warnings.push('Rate limiting may not be properly configured');
        console.log(`   ❌ No rate limiting detected: ${successfulRequests}/${rapidRequests} requests succeeded`);
      }

    } catch (error) {
      this.failed++;
      this.results.tests.rateLimiting = { passed: false, error: error.message };
      console.log(`   ❌ Rate limiting test failed: ${error.message}`);
    }
  }

  async testFileUploadSecurity() {
    console.log('\n📁 Testing File Upload Security...');
    this.total++;

    const maliciousFiles = [
      { name: 'script.js', content: 'alert("XSS")' },
      { name: 'shell.php', content: '<?php system($_GET["cmd"]); ?>' },
      { name: '../../../evil.txt', content: 'path traversal' },
      { name: 'virus.exe', content: 'MZ\x90\x00' }, // Fake PE header
    ];

    try {
      let blocked = 0;
      let allowed = 0;

      for (const file of maliciousFiles) {
        try {
          const formData = `--boundary123\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n${file.content}\r\n--boundary123--`;
          
          const response = await this.makeRequest('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'multipart/form-data; boundary=boundary123',
              'Content-Length': formData.length
            },
            body: formData
          });

          if (response.status >= 400) {
            blocked++;
          } else {
            allowed++;
            this.results.vulnerabilities.push(`Dangerous file upload allowed: ${file.name}`);
          }
        } catch (error) {
          blocked++; // Request blocked is good
        }
      }

      this.results.tests.fileUploadSecurity = {
        passed: allowed === 0,
        blocked,
        allowed,
        totalFiles: maliciousFiles.length
      };

      if (allowed > 0) {
        this.failed++;
        console.log(`   ❌ Dangerous uploads allowed: ${allowed}/${maliciousFiles.length}`);
      } else {
        this.passed++;
        console.log(`   ✅ All dangerous uploads blocked: ${blocked}/${maliciousFiles.length}`);
      }

    } catch (error) {
      this.failed++;
      this.results.tests.fileUploadSecurity = { passed: false, error: error.message };
      console.log(`   ❌ File upload security test failed: ${error.message}`);
    }
  }

  async testAPIEndpointSecurity() {
    console.log('\n🔌 Testing API Endpoint Security...');
    this.total++;

    const endpoints = [
      '/api/health',
      '/api/openai',
      '/api/whisper', 
      '/api/video',
      '/api/storage',
      '/api/upload',
      '/api/cleanup'
    ];

    try {
      let secure = 0;
      let insecure = 0;

      for (const endpoint of endpoints) {
        try {
          // Test without authentication
          const response = await this.makeRequest(endpoint);
          
          // Check if endpoint requires authentication or has proper error handling
          if (response.status === 401 || response.status === 403 || response.status === 400 || response.status === 405) {
            secure++;
          } else if (response.status === 200 && response.body.includes('error')) {
            secure++; // Proper error handling
          } else {
            insecure++;
            this.results.warnings.push(`API endpoint may be unsecured: ${endpoint}`);
          }
        } catch (error) {
          secure++; // Request blocked is good
        }
      }

      this.results.tests.apiSecurity = {
        passed: insecure === 0,
        secure,
        insecure,
        totalEndpoints: endpoints.length
      };

      if (insecure > 0) {
        this.failed++;
        console.log(`   ❌ Insecure endpoints found: ${insecure}/${endpoints.length}`);
      } else {
        this.passed++;
        console.log(`   ✅ All endpoints properly secured: ${secure}/${endpoints.length}`);
      }

    } catch (error) {
      this.failed++;
      this.results.tests.apiSecurity = { passed: false, error: error.message };
      console.log(`   ❌ API endpoint security test failed: ${error.message}`);
    }
  }

  async testCORSPolicyCorrectly() {
    console.log('\n🌐 Testing CORS Policy (Correct Port)...');
    this.total++;

    try {
      const maliciousOrigins = [
        'https://malicious-site.com',
        'http://evil.org',
        'https://attacker.net'
      ];

      let blocked = 0;
      let allowed = 0;

      for (const origin of maliciousOrigins) {
        try {
          const response = await this.makeRequest('/api/health', {
            headers: {
              'Origin': origin,
              'Access-Control-Request-Method': 'GET'
            }
          });

          // Check if CORS headers allow the malicious origin
          const allowOrigin = response.headers['access-control-allow-origin'];
          if (allowOrigin === origin || allowOrigin === '*') {
            allowed++;
            this.results.vulnerabilities.push(`CORS policy allows malicious origin: ${origin}`);
          } else {
            blocked++;
          }
        } catch (error) {
          blocked++; // Request blocked is good
        }
      }

      this.results.tests.corsPolicy = {
        passed: allowed === 0,
        blocked,
        allowed,
        totalOrigins: maliciousOrigins.length
      };

      if (allowed > 0) {
        this.failed++;
        console.log(`   ❌ CORS policy too permissive: ${allowed}/${maliciousOrigins.length} malicious origins allowed`);
      } else {
        this.passed++;
        console.log(`   ✅ CORS policy secure: ${blocked}/${maliciousOrigins.length} malicious origins blocked`);
      }

    } catch (error) {
      this.failed++;
      this.results.tests.corsPolicy = { passed: false, error: error.message };
      console.log(`   ❌ CORS policy test failed: ${error.message}`);
    }
  }

  generateSummary() {
    console.log('\n📊 Security Penetration Test Summary');
    console.log('=====================================');
    console.log(`Tests Passed: ${this.passed}/${this.total}`);
    console.log(`Tests Failed: ${this.failed}/${this.total}`);
    console.log(`Success Rate: ${((this.passed / this.total) * 100).toFixed(1)}%`);
    
    if (this.results.vulnerabilities.length > 0) {
      console.log('\n🚨 VULNERABILITIES FOUND:');
      this.results.vulnerabilities.forEach((vuln, i) => {
        console.log(`   ${i + 1}. ${vuln}`);
      });
    }

    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.results.warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }

    if (this.results.vulnerabilities.length === 0 && this.results.warnings.length === 0) {
      console.log('\n✅ No major security issues found!');
    }

    console.log(`\n📄 Detailed results saved to: scripts/penetration-test-results.json`);
  }
}

// Run the tests
if (require.main === module) {
  const tester = new SecurityPenetrationTester();
  tester.runAllTests()
    .then(results => {
      const fs = require('fs');
      fs.writeFileSync(
        './scripts/penetration-test-results.json',
        JSON.stringify(results, null, 2)
      );
      process.exit(results.vulnerabilities.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = SecurityPenetrationTester; 