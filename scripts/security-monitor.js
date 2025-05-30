#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Security Monitoring Script for Pitch Perfect
 * 
 * This script performs automated security health checks and generates
 * monitoring reports for the security configurations.
 */

class SecurityMonitor {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      checks: {},
      overall: 'unknown',
      warnings: [],
      errors: []
    };
  }

  async runAllChecks() {
    console.log('🔒 Starting Security Monitoring Checks...\n');

    try {
      await this.checkHTTPSConfiguration();
      await this.checkSecurityHeaders();
      await this.checkDependencyVulnerabilities();
      await this.checkCertificateStatus();
      await this.checkEnvironmentSecurity();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Security monitoring failed:', error.message);
      this.results.errors.push(error.message);
    }

    this.determineOverallStatus();
    console.log(`\n🎯 Overall Security Status: ${this.getStatusEmoji()} ${this.results.overall.toUpperCase()}`);
    
    return this.results;
  }

  async checkHTTPSConfiguration() {
    console.log('📋 Checking HTTPS Configuration...');
    
    try {
      // Check if HTTPS development server script exists
      const httpsServerPath = path.join(__dirname, 'https-dev-server.js');
      const httpsServerExists = fs.existsSync(httpsServerPath);
      
      // Check if test script exists
      const testScriptPath = path.join(__dirname, 'test-https.js');
      const testScriptExists = fs.existsSync(testScriptPath);

      // Check middleware configuration
      const middlewarePath = path.join(__dirname, '..', 'middleware.ts');
      const middlewareExists = fs.existsSync(middlewarePath);
      let middlewareHasHTTPS = false;
      
      if (middlewareExists) {
        const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
        middlewareHasHTTPS = middlewareContent.includes('https:') && 
                           middlewareContent.includes('NextResponse.redirect');
      }

      // Check vercel.json for HSTS
      const vercelConfigPath = path.join(__dirname, '..', 'vercel.json');
      const vercelConfigExists = fs.existsSync(vercelConfigPath);
      let hasHSTS = false;
      
      if (vercelConfigExists) {
        const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
        hasHSTS = vercelConfig.headers?.some(header => 
          header.headers?.some(h => h.key === 'Strict-Transport-Security')
        );
      }

      this.results.checks.https = {
        status: 'pass',
        details: {
          httpsServerExists,
          testScriptExists,
          middlewareExists,
          middlewareHasHTTPS,
          vercelConfigExists,
          hasHSTS
        }
      };

      if (!httpsServerExists || !middlewareHasHTTPS || !hasHSTS) {
        this.results.warnings.push('HTTPS configuration incomplete');
        this.results.checks.https.status = 'warning';
      }

      console.log(`   ✅ HTTPS Server Script: ${httpsServerExists ? 'Found' : 'Missing'}`);
      console.log(`   ✅ Test Script: ${testScriptExists ? 'Found' : 'Missing'}`);
      console.log(`   ✅ Middleware HTTPS Redirect: ${middlewareHasHTTPS ? 'Configured' : 'Missing'}`);
      console.log(`   ✅ HSTS Header: ${hasHSTS ? 'Configured' : 'Missing'}`);

    } catch (error) {
      this.results.checks.https = { status: 'error', error: error.message };
      this.results.errors.push(`HTTPS check failed: ${error.message}`);
      console.log(`   ❌ HTTPS check failed: ${error.message}`);
    }
  }

  async checkSecurityHeaders() {
    console.log('\n📋 Checking Security Headers Configuration...');
    
    try {
      const requiredHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Strict-Transport-Security',
        'Referrer-Policy',
        'Permissions-Policy',
        'Content-Security-Policy'
      ];

      const middlewarePath = path.join(__dirname, '..', 'middleware.ts');
      const vercelConfigPath = path.join(__dirname, '..', 'vercel.json');
      
      let middlewareHeaders = [];
      let vercelHeaders = [];

      // Check middleware headers
      if (fs.existsSync(middlewarePath)) {
        const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
        middlewareHeaders = requiredHeaders.filter(header => 
          middlewareContent.includes(header)
        );
      }

      // Check vercel.json headers
      if (fs.existsSync(vercelConfigPath)) {
        const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
        const configuredHeaders = vercelConfig.headers?.[0]?.headers || [];
        vercelHeaders = requiredHeaders.filter(header =>
          configuredHeaders.some(h => h.key === header)
        );
      }

      const missingInMiddleware = requiredHeaders.filter(h => !middlewareHeaders.includes(h));
      const missingInVercel = requiredHeaders.filter(h => !vercelHeaders.includes(h));

      this.results.checks.securityHeaders = {
        status: 'pass',
        details: {
          middlewareHeaders: middlewareHeaders.length,
          vercelHeaders: vercelHeaders.length,
          totalRequired: requiredHeaders.length,
          missingInMiddleware,
          missingInVercel
        }
      };

      if (missingInMiddleware.length > 0 || missingInVercel.length > 0) {
        this.results.warnings.push('Some security headers missing');
        this.results.checks.securityHeaders.status = 'warning';
      }

      console.log(`   ✅ Middleware Headers: ${middlewareHeaders.length}/${requiredHeaders.length}`);
      console.log(`   ✅ Vercel Headers: ${vercelHeaders.length}/${requiredHeaders.length}`);
      
      if (missingInMiddleware.length > 0) {
        console.log(`   ⚠️  Missing in middleware: ${missingInMiddleware.join(', ')}`);
      }
      if (missingInVercel.length > 0) {
        console.log(`   ⚠️  Missing in vercel.json: ${missingInVercel.join(', ')}`);
      }

    } catch (error) {
      this.results.checks.securityHeaders = { status: 'error', error: error.message };
      this.results.errors.push(`Security headers check failed: ${error.message}`);
      console.log(`   ❌ Security headers check failed: ${error.message}`);
    }
  }

  async checkDependencyVulnerabilities() {
    console.log('\n📋 Checking Dependency Vulnerabilities...');
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --audit-level=moderate --json', { 
        encoding: 'utf8',
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const auditData = JSON.parse(auditResult);
      const vulnerabilities = auditData.vulnerabilities || {};
      const vulnerabilityCount = Object.keys(vulnerabilities).length;

      // Count severity levels
      const severityCounts = {
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0
      };

      Object.values(vulnerabilities).forEach(vuln => {
        if (vuln.severity && severityCounts.hasOwnProperty(vuln.severity)) {
          severityCounts[vuln.severity]++;
        }
      });

      this.results.checks.dependencies = {
        status: vulnerabilityCount === 0 ? 'pass' : 'warning',
        details: {
          totalVulnerabilities: vulnerabilityCount,
          severityCounts,
          auditOutput: auditData
        }
      };

      if (severityCounts.critical > 0 || severityCounts.high > 0) {
        this.results.checks.dependencies.status = 'error';
        this.results.errors.push(`Critical/High vulnerabilities found: ${severityCounts.critical + severityCounts.high}`);
      } else if (vulnerabilityCount > 0) {
        this.results.warnings.push(`${vulnerabilityCount} moderate/low vulnerabilities found`);
      }

      console.log(`   ✅ Total Vulnerabilities: ${vulnerabilityCount}`);
      console.log(`   ✅ Critical: ${severityCounts.critical}, High: ${severityCounts.high}`);
      console.log(`   ✅ Moderate: ${severityCounts.moderate}, Low: ${severityCounts.low}`);

    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities are found
      try {
        const auditResult = execSync('npm audit --json', { 
          encoding: 'utf8',
          cwd: path.join(__dirname, '..'),
          stdio: ['pipe', 'pipe', 'pipe']
        });
        // If we get here, there might be vulnerabilities but the command succeeded
        const auditData = JSON.parse(auditResult);
        // Process the audit data similar to above
      } catch (auditError) {
        this.results.checks.dependencies = { status: 'error', error: auditError.message };
        this.results.errors.push(`Dependency check failed: ${auditError.message}`);
        console.log(`   ❌ Dependency check failed: ${auditError.message}`);
      }
    }
  }

  async checkCertificateStatus() {
    console.log('\n📋 Checking Certificate Status...');
    
    try {
      const certificatesDir = path.join(__dirname, '..', 'certificates');
      const certPath = path.join(certificatesDir, 'localhost-cert.pem');
      const keyPath = path.join(certificatesDir, 'localhost-key.pem');

      const certExists = fs.existsSync(certPath);
      const keyExists = fs.existsSync(keyPath);
      
      let certDetails = null;
      if (certExists) {
        try {
          // Try to read certificate details (this is a simplified check)
          const certContent = fs.readFileSync(certPath, 'utf8');
          const certMatch = certContent.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
          certDetails = {
            exists: true,
            hasValidFormat: !!certMatch
          };
        } catch (readError) {
          certDetails = { exists: true, hasValidFormat: false, error: readError.message };
        }
      }

      this.results.checks.certificates = {
        status: (certExists && keyExists) ? 'pass' : 'warning',
        details: {
          certificateExists: certExists,
          privateKeyExists: keyExists,
          certificateDetails: certDetails
        }
      };

      if (!certExists || !keyExists) {
        this.results.warnings.push('Development SSL certificates missing');
      }

      console.log(`   ✅ Certificate File: ${certExists ? 'Found' : 'Missing'}`);
      console.log(`   ✅ Private Key File: ${keyExists ? 'Found' : 'Missing'}`);
      
      if (certDetails?.hasValidFormat === false) {
        console.log(`   ⚠️  Certificate format may be invalid`);
      }

    } catch (error) {
      this.results.checks.certificates = { status: 'error', error: error.message };
      this.results.errors.push(`Certificate check failed: ${error.message}`);
      console.log(`   ❌ Certificate check failed: ${error.message}`);
    }
  }

  async checkEnvironmentSecurity() {
    console.log('\n📋 Checking Environment Security...');
    
    try {
      const projectRoot = path.join(__dirname, '..');
      const gitignorePath = path.join(projectRoot, '.gitignore');
      const envExamplePath = path.join(projectRoot, '.env.example');
      const envPath = path.join(projectRoot, '.env');

      // Check .gitignore for security-sensitive patterns
      let gitignoreSecure = false;
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        const securityPatterns = ['.env', 'certificates/', '.cursor/mcp.json'];
        gitignoreSecure = securityPatterns.every(pattern => 
          gitignoreContent.includes(pattern)
        );
      }

      // Check if .env exists (should exist in development)
      const envExists = fs.existsSync(envPath);
      
      // Check if .env.example exists (good practice)
      const envExampleExists = fs.existsSync(envExamplePath);

      this.results.checks.environment = {
        status: gitignoreSecure ? 'pass' : 'warning',
        details: {
          gitignoreExists: fs.existsSync(gitignorePath),
          gitignoreSecure,
          envExists,
          envExampleExists
        }
      };

      if (!gitignoreSecure) {
        this.results.warnings.push('Security-sensitive files may not be properly excluded from git');
      }

      console.log(`   ✅ .gitignore exists: ${fs.existsSync(gitignorePath)}`);
      console.log(`   ✅ .gitignore secure: ${gitignoreSecure}`);
      console.log(`   ✅ .env exists: ${envExists}`);
      console.log(`   ✅ .env.example exists: ${envExampleExists}`);

    } catch (error) {
      this.results.checks.environment = { status: 'error', error: error.message };
      this.results.errors.push(`Environment security check failed: ${error.message}`);
      console.log(`   ❌ Environment security check failed: ${error.message}`);
    }
  }

  determineOverallStatus() {
    const statuses = Object.values(this.results.checks).map(check => check.status);
    
    if (statuses.includes('error') || this.results.errors.length > 0) {
      this.results.overall = 'error';
    } else if (statuses.includes('warning') || this.results.warnings.length > 0) {
      this.results.overall = 'warning';
    } else if (statuses.every(status => status === 'pass')) {
      this.results.overall = 'pass';
    } else {
      this.results.overall = 'unknown';
    }
  }

  getStatusEmoji() {
    switch (this.results.overall) {
      case 'pass': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '❓';
    }
  }

  async generateReport() {
    console.log('\n📋 Generating Security Report...');
    
    const reportPath = path.join(__dirname, 'security-report.json');
    const readableReportPath = path.join(__dirname, 'security-report.md');

    // Save detailed JSON report
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // Generate readable markdown report
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync(readableReportPath, markdownReport);

    console.log(`   ✅ Detailed report saved: ${reportPath}`);
    console.log(`   ✅ Readable report saved: ${readableReportPath}`);
  }

  generateMarkdownReport() {
    const date = new Date().toLocaleString();
    const status = this.results.overall.toUpperCase();
    const emoji = this.getStatusEmoji();

    let report = `# Security Monitoring Report\n\n`;
    report += `**Generated:** ${date}\n`;
    report += `**Overall Status:** ${emoji} ${status}\n\n`;

    if (this.results.errors.length > 0) {
      report += `## ❌ Errors\n\n`;
      this.results.errors.forEach(error => {
        report += `- ${error}\n`;
      });
      report += `\n`;
    }

    if (this.results.warnings.length > 0) {
      report += `## ⚠️ Warnings\n\n`;
      this.results.warnings.forEach(warning => {
        report += `- ${warning}\n`;
      });
      report += `\n`;
    }

    report += `## 📋 Check Details\n\n`;
    Object.entries(this.results.checks).forEach(([checkName, checkResult]) => {
      const statusEmoji = checkResult.status === 'pass' ? '✅' : 
                         checkResult.status === 'warning' ? '⚠️' : '❌';
      report += `### ${statusEmoji} ${checkName.charAt(0).toUpperCase() + checkName.slice(1)}\n\n`;
      report += `**Status:** ${checkResult.status}\n\n`;
      
      if (checkResult.details) {
        report += `**Details:**\n`;
        Object.entries(checkResult.details).forEach(([key, value]) => {
          if (typeof value === 'object' && !Array.isArray(value)) {
            report += `- ${key}: [Complex Object]\n`;
          } else if (Array.isArray(value)) {
            report += `- ${key}: ${value.length > 0 ? value.join(', ') : 'None'}\n`;
          } else {
            report += `- ${key}: ${value}\n`;
          }
        });
        report += `\n`;
      }

      if (checkResult.error) {
        report += `**Error:** ${checkResult.error}\n\n`;
      }
    });

    report += `---\n\n`;
    report += `*This report was generated automatically by the security monitoring script.*\n`;
    
    return report;
  }
}

// Run the security monitor if this script is called directly
if (require.main === module) {
  const monitor = new SecurityMonitor();
  monitor.runAllChecks().then(results => {
    process.exit(results.overall === 'error' ? 1 : 0);
  }).catch(error => {
    console.error('Security monitoring failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityMonitor; 