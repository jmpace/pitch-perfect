const https = require('https');
const fs = require('fs');
const path = require('path');

// Create an agent that accepts self-signed certificates for testing
const agent = new https.Agent({
  rejectUnauthorized: false
});

console.log('🔒 Testing HTTPS Configuration...\n');

// Test HTTPS connection
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET',
  agent: agent
};

const req = https.request(options, (res) => {
  console.log('✅ HTTPS Connection Status:', res.statusCode);
  console.log('🔐 Protocol:', res.connection.getProtocol());
  console.log('🛡️  Security Headers:');
  
  const securityHeaders = [
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection',
    'strict-transport-security',
    'referrer-policy',
    'permissions-policy',
    'content-security-policy',
    'x-ratelimit-limit',
    'x-ratelimit-remaining'
  ];

  securityHeaders.forEach(header => {
    const value = res.headers[header];
    console.log(`   ${header}: ${value || 'Not set'}`);
  });

  console.log('\n🎉 HTTPS Configuration Test Complete!');
  
  // Test certificate details
  const cert = res.connection.getPeerCertificate();
  if (cert && cert.subject) {
    console.log('\n📜 Certificate Details:');
    console.log(`   Subject: ${cert.subject.CN}`);
    console.log(`   Issuer: ${cert.issuer.CN}`);
    console.log(`   Valid From: ${cert.valid_from}`);
    console.log(`   Valid To: ${cert.valid_to}`);
  }
});

req.on('error', (e) => {
  console.error('❌ HTTPS Test Failed:', e.message);
});

req.end(); 