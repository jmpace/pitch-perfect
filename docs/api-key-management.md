# API Key Management System

A comprehensive, enterprise-grade API key management system for secure handling, validation, and monitoring of API keys across multiple providers.

## Overview

This system provides:
- **Centralized Management**: Single source of truth for all API keys
- **Multi-Provider Support**: Support for 11+ major API providers
- **Advanced Security**: Encryption at rest, audit logging, compromise detection
- **Real-time Validation**: Format and security validation with caching
- **Environment Management**: Automatic .env file handling with templates
- **React Integration**: Custom hooks for seamless frontend integration
- **Middleware Protection**: Automatic API route protection and monitoring

## Quick Start

### 1. Installation

The API key management system is built into the application. No additional installation required.

### 2. Basic Setup

```typescript
import { initializeApiKeyManagement } from '@/lib/api-keys';

// Initialize the system
const apiKeySystem = initializeApiKeyManagement({
  encryptionEnabled: true,
  auditLoggingEnabled: true,
  rotationEnabled: true,
  defaultRotationDays: 90
});

// Get a security report
const report = apiKeySystem.getSecurityReport();
console.log('Security Status:', report);
```

### 3. Environment Configuration

The system automatically creates and manages your `.env` file:

```bash
# API Keys - Add your actual keys here
# OPENAI API Key
# Get your key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-key-here

# ANTHROPIC API Key
# Get your key from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Additional Configuration
API_KEY_ENCRYPTION_KEY=your_encryption_key_here
ENABLE_API_KEY_MONITORING=true
```

## Core Features

### Supported Providers

| Provider | Prefix | Example Format | Security Level |
|----------|--------|---------------|----------------|
| OpenAI | `sk-` | `sk-abc123...` | HIGH |
| Anthropic | `sk-ant-` | `sk-ant-abc123...` | HIGH |
| Perplexity | `pplx-` | `pplx-abc123...` | MEDIUM |
| Google AI | `AIza` | `AIzaabc123...` | MEDIUM |
| Vercel Blob | `vercel_blob_rw_` | `vercel_blob_rw_...` | HIGH |
| Azure OpenAI | hex | `a1b2c3d4...` | HIGH |
| OpenRouter | `sk-or-` | `sk-or-abc123...` | MEDIUM |
| Mistral | hex | `a1b2c3d4...` | MEDIUM |
| xAI | `xai-` | `xai-abc123...` | MEDIUM |
| Ollama | custom | `abc123...` | LOW |
| Custom | any | any format | LOW |

### Security Features

#### Encryption at Rest
```typescript
import { encryptApiKey, decryptApiKey } from '@/lib/api-keys';

// Encrypt an API key
const result = encryptApiKey('sk-my-secret-key', 'encryption-key');
if (result.success) {
  console.log('Encrypted:', result.data);
}

// Decrypt when needed
const decrypted = decryptApiKey(result.data!, 'encryption-key');
```

#### Validation and Security Scoring
```typescript
import { validateApiKey } from '@/lib/api-keys';

const validation = validateApiKey('sk-test-key', 'openai');
console.log('Valid:', validation.isValid);
console.log('Security Score:', validation.securityScore); // 0-100
console.log('Issues:', validation.issues);
console.log('Recommendations:', validation.recommendations);
```

#### Compromise Detection
```typescript
import { checkKeyCompromised } from '@/lib/api-keys';

const check = checkKeyCompromised('sk-demo-key');
if (check.isCompromised) {
  console.log('Key appears compromised:', check.reasons);
  console.log('Recommendations:', check.recommendations);
}
```

## React Integration

### Basic Validation Hook

```typescript
import { useApiKeyValidation } from '@/lib/api-keys';

function ApiKeyInput() {
  const { validateKey, validationResult, isValidating, error } = useApiKeyValidation();

  const handleKeyChange = (key: string) => {
    validateKey(key, 'openai');
  };

  return (
    <div>
      <input 
        onChange={(e) => handleKeyChange(e.target.value)}
        placeholder="Enter your API key"
      />
      {isValidating && <p>Validating...</p>}
      {validationResult && (
        <div>
          <p>Valid: {validationResult.isValid ? '✅' : '❌'}</p>
          <p>Security Score: {validationResult.securityScore}/100</p>
          {validationResult.issues.map(issue => (
            <p key={issue} style={{color: 'red'}}>{issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Debounced Validation

```typescript
import { useDebouncedApiKeyValidation } from '@/lib/api-keys';

function DebouncedApiKeyInput() {
  const { setApiKey, validationResult, isValidating } = useDebouncedApiKeyValidation(1000);

  return (
    <input 
      onChange={(e) => setApiKey(e.target.value)}
      placeholder="Enter API key (validates after 1s)"
    />
  );
}
```

### Security Monitoring

```typescript
import { useApiKeySecurity } from '@/lib/api-keys';

function SecurityDashboard() {
  const { securityReport, isLoading, refreshReport } = useApiKeySecurity();

  if (isLoading) return <div>Loading security report...</div>;

  return (
    <div>
      <h2>Security Status</h2>
      <p>Total Keys: {securityReport?.summary.totalKeys}</p>
      <p>Active Keys: {securityReport?.summary.activeKeys}</p>
      <p>Security Alerts: {securityReport?.summary.securityAlerts}</p>
      <button onClick={refreshReport}>Refresh Report</button>
    </div>
  );
}
```

## API Endpoints

### Validation Report
```bash
GET /api/security/api-keys?action=report
```

### Security Report
```bash
GET /api/security/api-keys?action=security-report
```

### Validate Specific Key
```bash
GET /api/security/api-keys?action=validate&key=sk-...&provider=openai
```

### Register New Key
```bash
POST /api/security/api-keys
{
  "action": "register",
  "provider": "openai",
  "key": "sk-...",
  "name": "Production OpenAI Key",
  "environment": "production"
}
```

### Revoke Key
```bash
DELETE /api/security/api-keys?keyId=abc123&reason=Security+breach
```

## Middleware Integration

### Automatic API Protection

```typescript
// middleware.ts
import { withApiKeyValidation } from '@/lib/api-keys';

export default withApiKeyValidation({
  enableValidation: true,
  securityLevel: 'HIGH',
  requireApiKey: true, // Require API key for all protected routes
  excludedPaths: ['/api/health', '/api/public/*']
});
```

### Custom Middleware Configuration

```typescript
import { createApiKeyMiddleware } from '@/lib/api-keys';

const middleware = createApiKeyMiddleware({
  enableValidation: true,
  enableUsageTracking: true,
  enableRateLimiting: true,
  securityLevel: 'HIGH',
  allowedProviders: ['openai', 'anthropic'],
  excludedPaths: ['/api/health']
});

export async function middleware(request: NextRequest) {
  return middleware.handle(request);
}
```

## Environment Management

### Automatic Environment Setup

```typescript
import { getEnvironmentManager } from '@/lib/api-keys';

const envManager = getEnvironmentManager();

// Validate current environment
const validation = envManager.validateEnvironment();
console.log('Environment Status:', validation);

// Add new API key
const result = envManager.setEnvironmentVariable(
  'OPENAI_API_KEY',
  'sk-new-key',
  'Production OpenAI API key'
);

// Get comprehensive report
const report = envManager.getEnvironmentReport();
console.log('Environment Report:', report);
```

### Backup and Restore

```typescript
// Environment changes are automatically backed up
// Backups are stored as .env.backup.{timestamp}
// Only the 5 most recent backups are kept

// Manual backup before major changes
envManager.setEnvironmentVariable('NEW_KEY', 'value'); // Auto-backup created
```

## Security Best Practices

### 1. Use Environment Variables
- Never hardcode API keys in your source code
- Use the provided environment management system
- Enable automatic backups for changes

### 2. Enable Encryption
```typescript
// Enable encryption for sensitive keys
const system = initializeApiKeyManagement({
  encryptionEnabled: true,
  encryptionKey: process.env.API_KEY_ENCRYPTION_KEY
});
```

### 3. Monitor Usage
```typescript
// Enable comprehensive monitoring
const system = initializeApiKeyManagement({
  auditLoggingEnabled: true,
  securityAlertsEnabled: true,
  rateLimitingEnabled: true
});
```

### 4. Regular Rotation
```typescript
// Enable automatic rotation reminders
const system = initializeApiKeyManagement({
  rotationEnabled: true,
  defaultRotationDays: 90 // Rotate every 3 months
});
```

### 5. Use High Security Levels
```typescript
// Use HIGH or CRITICAL security levels for production
import { validateApiKey, SecurityLevel } from '@/lib/api-keys';

const validation = validateApiKey(key, provider, SecurityLevel.CRITICAL);
```

## Troubleshooting

### Common Issues

#### API Key Not Found
```typescript
// Check if key is properly set
const envManager = getEnvironmentManager();
const report = envManager.getEnvironmentReport();
console.log('Missing keys:', report.validation.missingKeys);
```

#### Validation Failing
```typescript
// Get detailed validation information
const validation = validateApiKey(key, provider, SecurityLevel.HIGH);
console.log('Issues:', validation.issues);
console.log('Warnings:', validation.warnings);
console.log('Recommendations:', validation.recommendations);
```

#### High Security Score Issues
```typescript
// Check for common security issues
const compromiseCheck = checkKeyCompromised(key);
if (compromiseCheck.isCompromised) {
  console.log('Security issues:', compromiseCheck.reasons);
}
```

### Debug Mode

```typescript
// Enable detailed logging in development
process.env.NODE_ENV = 'development'; // Enables console logging
```

## Migration Guide

### From Manual API Key Management

1. **Backup Current Keys**: Export your current environment variables
2. **Initialize System**: Run `initializeApiKeyManagement()`
3. **Import Keys**: Use `envManager.setEnvironmentVariable()` for each key
4. **Validate**: Run `envManager.validateEnvironment()`
5. **Update Code**: Replace direct `process.env` access with manager calls

### Example Migration

```typescript
// Before
const openaiKey = process.env.OPENAI_API_KEY;

// After
import { getApiKeyManager } from '@/lib/api-keys';
const manager = getApiKeyManager();
const keyResult = manager.getApiKey('openai-key-id');
const openaiKey = keyResult.success ? keyResult.data : null;
```

## Performance Considerations

### Caching
- Validation results are cached for 5 minutes
- Client-side caching available with configurable TTL
- Request deduplication for identical validation requests

### Rate Limiting
- Automatic rate limiting on API endpoints
- Client-side request throttling
- Configurable limits per endpoint

### Memory Management
- Automatic cache cleanup
- Secure memory wiping for sensitive data
- Limited audit log retention (last 1000 entries)

## Advanced Configuration

### Custom Provider Support

```typescript
import { ApiProvider, PROVIDER_CONFIGS } from '@/lib/api-keys';

// Add custom provider configuration
PROVIDER_CONFIGS[ApiProvider.CUSTOM] = {
  provider: ApiProvider.CUSTOM,
  envVarName: 'MY_CUSTOM_API_KEY',
  keyFormat: /^custom-[a-zA-Z0-9]{32}$/,
  minLength: 39,
  maxLength: 39,
  prefix: 'custom-',
  defaultPermissions: {
    read: true,
    write: false,
    delete: false,
    admin: false,
    scopes: ['api-access']
  },
  securityLevel: SecurityLevel.MEDIUM,
  rotationSupported: true,
  encryptionRequired: false
};
```

### Custom Security Alerts

```typescript
// Custom alert handling
const manager = getApiKeyManager({
  securityAlertsEnabled: true
});

// Monitor security events
const report = manager.getSecurityReport();
report.securityAlerts.forEach(alert => {
  if (alert.severity === 'critical') {
    // Send to monitoring service
    console.error('CRITICAL SECURITY ALERT:', alert.message);
  }
});
```

## Contributing

When adding new providers or features:

1. Update the `ApiProvider` enum in `types.ts`
2. Add provider configuration to `PROVIDER_CONFIGS` in `validator.ts`
3. Add validation patterns and security rules
4. Update documentation and examples
5. Add comprehensive tests

## License

This API key management system is part of the Pitch Perfect application and follows the same license terms. 