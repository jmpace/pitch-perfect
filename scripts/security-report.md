# Security Monitoring Report

**Generated:** 5/30/2025, 2:20:35 PM
**Overall Status:** ❓ UNKNOWN

## ⚠️ Warnings

- Some security headers missing

## 📋 Check Details

### ✅ Https

**Status:** pass

**Details:**
- httpsServerExists: true
- testScriptExists: true
- middlewareExists: true
- middlewareHasHTTPS: true
- vercelConfigExists: true
- hasHSTS: true

### ⚠️ SecurityHeaders

**Status:** warning

**Details:**
- middlewareHeaders: 6
- vercelHeaders: 7
- totalRequired: 7
- missingInMiddleware: Strict-Transport-Security
- missingInVercel: None

### ✅ Dependencies

**Status:** pass

**Details:**
- totalVulnerabilities: 0
- severityCounts: [Complex Object]
- auditOutput: [Complex Object]

### ✅ Certificates

**Status:** pass

**Details:**
- certificateExists: true
- privateKeyExists: true
- certificateDetails: [Complex Object]

### ✅ Environment

**Status:** pass

**Details:**
- gitignoreExists: true
- gitignoreSecure: true
- envExists: true
- envExampleExists: true

---

*This report was generated automatically by the security monitoring script.*
