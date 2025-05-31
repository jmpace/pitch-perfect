/**
 * API Key Management Route
 * Secure endpoint for managing API keys with comprehensive validation and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyManager } from '@/lib/api-keys/manager';
import { ApiProvider, SecurityLevel } from '@/lib/api-keys/types';
import { validateApiKey, getValidationReport } from '@/lib/api-keys/validator';
import { sanitizeKeyForLogging } from '@/lib/api-keys/encryption';

// Rate limiting for API key management operations
const RATE_LIMITS = {
  VALIDATION: 10, // per minute
  REPORTS: 5,     // per minute
  MANAGEMENT: 3   // per minute
};

/**
 * GET /api/security/api-keys
 * Get API key validation report and security status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'report';

    const keyManager = getApiKeyManager();

    switch (action) {
      case 'report':
        return handleValidationReport();

      case 'security-report':
        return handleSecurityReport(keyManager);

      case 'validate':
        const keyToValidate = searchParams.get('key');
        const provider = searchParams.get('provider') as ApiProvider;
        return handleKeyValidation(keyToValidate, provider);

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('API key management error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/security/api-keys
 * Register or manage API keys
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    const keyManager = getApiKeyManager();

    switch (action) {
      case 'register':
        return handleKeyRegistration(keyManager, params);

      case 'validate':
        return handleKeyValidationPost(keyManager, params);

      case 'revoke':
        return handleKeyRevocation(keyManager, params);

      case 'rotate':
        return handleKeyRotation(keyManager, params);

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('API key management error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/security/api-keys
 * Revoke API keys
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');
    const reason = searchParams.get('reason') || 'Manual revocation via API';

    if (!keyId) {
      return NextResponse.json(
        { error: 'Key ID is required' },
        { status: 400 }
      );
    }

    const keyManager = getApiKeyManager();
    const result = keyManager.revokeApiKey(keyId, reason);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
      data: result.metadata
    });

  } catch (error) {
    console.error('API key revocation error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions

async function handleValidationReport() {
  try {
    const report = getValidationReport();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      report: {
        summary: report.summary,
        recommendations: report.recommendations,
        keyDetails: Object.keys(report.details).map(envVar => ({
          environmentVariable: envVar,
          isValid: report.details[envVar].isValid,
          provider: report.details[envVar].provider,
          securityScore: report.details[envVar].securityScore,
          issues: report.details[envVar].issues.length,
          warnings: report.details[envVar].warnings.length
        }))
      }
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to generate validation report',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function handleSecurityReport(keyManager: any) {
  try {
    const securityReport = keyManager.getSecurityReport();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      securityReport: {
        summary: securityReport.summary,
        recommendations: securityReport.recommendations,
        activeAlerts: securityReport.securityAlerts.length,
        keyStatus: Object.keys(securityReport.keyStatus).map(keyId => ({
          keyId,
          provider: securityReport.keyStatus[keyId].provider,
          status: securityReport.keyStatus[keyId].status,
          lastUsed: securityReport.keyStatus[keyId].lastUsed,
          usageCount: securityReport.keyStatus[keyId].usage.totalRequests,
          errorRate: securityReport.keyStatus[keyId].usage.errorCount / 
                    Math.max(1, securityReport.keyStatus[keyId].usage.totalRequests)
        }))
      }
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to generate security report',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function handleKeyValidation(key: string | null, provider?: ApiProvider) {
  if (!key) {
    return NextResponse.json(
      { error: 'API key is required for validation' },
      { status: 400 }
    );
  }

  try {
    const validation = validateApiKey(key, provider, SecurityLevel.HIGH);
    
    return NextResponse.json({
      success: true,
      validation: {
        isValid: validation.isValid,
        provider: validation.provider,
        securityScore: validation.securityScore,
        issues: validation.issues,
        warnings: validation.warnings,
        recommendations: validation.recommendations,
        sanitizedKey: sanitizeKeyForLogging(key)
      }
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function handleKeyRegistration(keyManager: any, params: any) {
  const { provider, key, name, description, environment, securityLevel } = params;

  // Validate required parameters
  if (!provider || !key || !name) {
    return NextResponse.json(
      { error: 'Provider, key, and name are required' },
      { status: 400 }
    );
  }

  // Validate provider
  if (!Object.values(ApiProvider).includes(provider)) {
    return NextResponse.json(
      { error: 'Invalid provider' },
      { status: 400 }
    );
  }

  // Validate security level if provided
  if (securityLevel && !Object.values(SecurityLevel).includes(securityLevel)) {
    return NextResponse.json(
      { error: 'Invalid security level' },
      { status: 400 }
    );
  }

  try {
    const result = keyManager.registerApiKey({
      provider,
      key,
      name,
      description,
      environment: environment || 'development',
      securityLevel: securityLevel || SecurityLevel.MEDIUM
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Registration failed',
          message: result.error,
          warnings: result.warnings
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key registered successfully',
      keyId: result.data,
      metadata: result.metadata
    }, { status: 201 });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function handleKeyValidationPost(keyManager: any, params: any) {
  const { keyId, forceRefresh } = params;

  if (!keyId) {
    return NextResponse.json(
      { error: 'Key ID is required' },
      { status: 400 }
    );
  }

  try {
    const result = await keyManager.validateKey(keyId, forceRefresh);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          message: result.error
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      isValid: result.data,
      metadata: result.metadata
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function handleKeyRevocation(keyManager: any, params: any) {
  const { keyId, reason } = params;

  if (!keyId) {
    return NextResponse.json(
      { error: 'Key ID is required' },
      { status: 400 }
    );
  }

  try {
    const result = keyManager.revokeApiKey(keyId, reason);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Revocation failed',
          message: result.error
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
      metadata: result.metadata
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Revocation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function handleKeyRotation(keyManager: any, params: any) {
  const { keyId, newKey } = params;

  if (!keyId || !newKey) {
    return NextResponse.json(
      { error: 'Key ID and new key are required' },
      { status: 400 }
    );
  }

  try {
    // For now, implement rotation as revoke old + register new
    // A more sophisticated implementation would handle this atomically
    const oldKeyResult = keyManager.getKeysMetadata().find((k: any) => k.id === keyId);
    
    if (!oldKeyResult) {
      return NextResponse.json(
        { error: 'Key not found' },
        { status: 404 }
      );
    }

    // Register new key
    const newKeyResult = keyManager.registerApiKey({
      provider: oldKeyResult.provider,
      key: newKey,
      name: `${oldKeyResult.name}_rotated`,
      description: `Rotated from ${oldKeyResult.name}`,
      environment: oldKeyResult.environment,
      securityLevel: oldKeyResult.securityLevel
    });

    if (!newKeyResult.success) {
      return NextResponse.json(
        { 
          error: 'Failed to register new key',
          message: newKeyResult.error
        },
        { status: 400 }
      );
    }

    // Revoke old key
    const revokeResult = keyManager.revokeApiKey(keyId, 'Key rotation');

    return NextResponse.json({
      success: true,
      message: 'API key rotated successfully',
      newKeyId: newKeyResult.data,
      oldKeyRevoked: revokeResult.success
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Rotation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 