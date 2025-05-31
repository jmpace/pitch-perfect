/**
 * API Key Manager
 * Centralized management for all API keys with security, monitoring, and lifecycle management
 */

import { 
  ApiProvider,
  SecurityLevel, 
  ApiKeyStatus,
  ApiKeyMetadata,
  ApiKeyManagerConfig,
  ApiKeyOperationResult,
  ApiKeyAuditLog,
  SecurityAlert,
  RuntimeKeyInfo,
  EncryptedKey
} from './types';

import { 
  encryptApiKey, 
  decryptApiKey, 
  sanitizeKeyForLogging,
  generateSecureRandom,
  hashApiKey,
  verifyApiKeyHash
} from './encryption';

import { 
  validateApiKey,
  validateEnvironmentKeys,
  getValidationReport,
  checkKeyCompromised,
  PROVIDER_CONFIGS
} from './validator';

/**
 * Centralized API Key Manager
 */
export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private config: ApiKeyManagerConfig;
  private keyMetadata: Map<string, ApiKeyMetadata> = new Map();
  private encryptedKeys: Map<string, EncryptedKey> = new Map();
  private auditLogs: ApiKeyAuditLog[] = [];
  private securityAlerts: SecurityAlert[] = [];
  private runtimeInfo: Map<string, RuntimeKeyInfo> = new Map();
  private validationCache: Map<string, { result: any; timestamp: number }> = new Map();

  private constructor(config: Partial<ApiKeyManagerConfig> = {}) {
    this.config = {
      encryptionEnabled: true,
      auditLoggingEnabled: true,
      rotationEnabled: true,
      defaultRotationDays: 90,
      validationCacheTime: 300, // 5 minutes
      securityAlertsEnabled: true,
      rateLimitingEnabled: true,
      environments: ['development', 'staging', 'production'],
      ...config
    };

    this.initializeFromEnvironment();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<ApiKeyManagerConfig>): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager(config);
    }
    return ApiKeyManager.instance;
  }

  /**
   * Initialize manager with environment variables
   */
  private initializeFromEnvironment(): void {
    try {
      // Check if we're in an edge runtime environment where crypto operations may be limited
      const isEdgeRuntime = typeof process === 'undefined' ||
                           (typeof process !== 'undefined' && process.env?.NEXT_RUNTIME === 'edge');
      
      if (isEdgeRuntime) {
        console.warn('[ApiKeyManager] Running in edge runtime - limited crypto operations available');
        // Still try to register keys but with reduced functionality
      }

      Object.values(PROVIDER_CONFIGS).forEach(providerConfig => {
        const envValue = process.env[providerConfig.envVarName];
        if (envValue) {
          this.registerApiKey({
            provider: providerConfig.provider,
            key: envValue,
            name: `${providerConfig.provider}_primary`,
            description: `Primary ${providerConfig.provider} API key from environment`,
            environment: (process.env.NODE_ENV as any) || 'development',
            securityLevel: providerConfig.securityLevel
          });
        }
      });

      // Only create audit log if not in edge runtime to avoid crypto issues
      if (!isEdgeRuntime) {
        this.logAudit({
          id: generateSecureRandom(16),
          keyId: 'system',
          action: 'created',
          timestamp: new Date(),
          success: true,
          metadata: { source: 'environment_initialization' }
        });
      }

    } catch (error) {
      console.error('Failed to initialize API key manager from environment:', error);
      // Continue silently in edge runtime
    }
  }

  /**
   * Register a new API key
   */
  public registerApiKey(params: {
    provider: ApiProvider;
    key: string;
    name: string;
    description?: string;
    environment?: 'development' | 'staging' | 'production';
    securityLevel?: SecurityLevel;
    permissions?: any;
  }): ApiKeyOperationResult<string> {
    try {
      const keyId = generateSecureRandom(16);
      const providerConfig = PROVIDER_CONFIGS[params.provider];
      
      // Validate the API key
      const validation = validateApiKey(params.key, params.provider, params.securityLevel);
      if (!validation.isValid) {
        this.createSecurityAlert({
          keyId,
          alertType: 'validation_failure',
          severity: 'high',
          message: `API key registration failed validation: ${validation.issues.join(', ')}`
        });

        return {
          success: false,
          error: `Key validation failed: ${validation.issues.join(', ')}`,
          warnings: validation.warnings
        };
      }

      // Check for compromise
      const compromiseCheck = checkKeyCompromised(params.key);
      if (compromiseCheck.isCompromised) {
        this.createSecurityAlert({
          keyId,
          alertType: 'key_exposure',
          severity: 'critical',
          message: `Potentially compromised key detected: ${compromiseCheck.reasons.join(', ')}`
        });

        return {
          success: false,
          error: `Key appears compromised: ${compromiseCheck.reasons.join(', ')}`,
          warnings: compromiseCheck.recommendations
        };
      }

      // Encrypt key if required
      let encryptedKey: EncryptedKey | undefined;
      if (this.config.encryptionEnabled && providerConfig.encryptionRequired) {
        const encryptionResult = encryptApiKey(params.key, this.getEncryptionKey(), keyId);
        if (!encryptionResult.success) {
          return {
            success: false,
            error: `Failed to encrypt API key: ${encryptionResult.error}`
          };
        }
        encryptedKey = encryptionResult.data!;
        this.encryptedKeys.set(keyId, encryptedKey);
      }

      // Create metadata
      const metadata: ApiKeyMetadata = {
        id: keyId,
        provider: params.provider,
        name: params.name,
        description: params.description,
        environment: params.environment || 'development',
        securityLevel: params.securityLevel || providerConfig.securityLevel,
        status: ApiKeyStatus.ACTIVE,
        permissions: params.permissions || providerConfig.defaultPermissions,
        createdAt: new Date(),
        updatedAt: new Date(),
        rotationSchedule: this.config.rotationEnabled ? {
          enabled: true,
          intervalDays: this.config.defaultRotationDays,
          nextRotation: new Date(Date.now() + this.config.defaultRotationDays * 24 * 60 * 60 * 1000),
          warningDays: 7
        } : undefined,
        usage: {
          totalRequests: 0,
          errorCount: 0,
          successCount: 0
        },
        encryption: {
          encrypted: !!encryptedKey,
          algorithm: encryptedKey?.algorithm,
          keyId: encryptedKey?.keyId
        }
      };

      this.keyMetadata.set(keyId, metadata);

      // Create runtime info
      const runtimeInfo: RuntimeKeyInfo = {
        keyId,
        provider: params.provider,
        isValid: true,
        lastValidated: new Date(),
        usageCount: 0,
        errorCount: 0,
        isNearingLimit: false,
        permissions: metadata.permissions
      };

      this.runtimeInfo.set(keyId, runtimeInfo);

      // Log registration
      this.logAudit({
        id: generateSecureRandom(16),
        keyId,
        action: 'created',
        timestamp: new Date(),
        success: true,
        metadata: {
          provider: params.provider,
          name: params.name,
          environment: params.environment,
          encrypted: !!encryptedKey
        }
      });

      return {
        success: true,
        data: keyId,
        metadata: {
          provider: params.provider,
          securityScore: validation.securityScore,
          encrypted: !!encryptedKey
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to register API key: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get API key by ID (decrypted if necessary)
   */
  public getApiKey(keyId: string): ApiKeyOperationResult<string> {
    try {
      const metadata = this.keyMetadata.get(keyId);
      if (!metadata) {
        return {
          success: false,
          error: 'API key not found'
        };
      }

      if (metadata.status !== ApiKeyStatus.ACTIVE) {
        return {
          success: false,
          error: `API key status is ${metadata.status}`
        };
      }

      // Update runtime info
      this.updateRuntimeInfo(keyId, { lastValidated: new Date() });

      // If encrypted, decrypt it
      if (metadata.encryption.encrypted) {
        const encryptedKey = this.encryptedKeys.get(keyId);
        if (!encryptedKey) {
          return {
            success: false,
            error: 'Encrypted key data not found'
          };
        }

        const decryptionResult = decryptApiKey(encryptedKey, this.getEncryptionKey());
        if (!decryptionResult.success) {
          this.createSecurityAlert({
            keyId,
            alertType: 'validation_failure',
            severity: 'high',
            message: `Failed to decrypt API key: ${decryptionResult.error}`
          });

          return {
            success: false,
            error: `Failed to decrypt API key: ${decryptionResult.error}`
          };
        }

        return {
          success: true,
          data: decryptionResult.data!,
          metadata: {
            provider: metadata.provider,
            decrypted: true
          }
        };
      } else {
        // Return from environment variable
        const providerConfig = PROVIDER_CONFIGS[metadata.provider];
        const envValue = process.env[providerConfig.envVarName];
        
        if (!envValue) {
          return {
            success: false,
            error: 'API key not found in environment variables'
          };
        }

        return {
          success: true,
          data: envValue,
          metadata: {
            provider: metadata.provider,
            decrypted: false
          }
        };
      }

    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve API key: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate an API key and update its status
   */
  public async validateKey(keyId: string, forceRefresh: boolean = false): Promise<ApiKeyOperationResult<boolean>> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = this.validationCache.get(keyId);
        if (cached && Date.now() - cached.timestamp < this.config.validationCacheTime * 1000) {
          return {
            success: true,
            data: cached.result.isValid,
            metadata: { cached: true, ...cached.result }
          };
        }
      }

      const keyResult = this.getApiKey(keyId);
      if (!keyResult.success) {
        return {
          success: false,
          error: keyResult.error
        };
      }

      const metadata = this.keyMetadata.get(keyId)!;
      const validation = validateApiKey(keyResult.data!, metadata.provider, metadata.securityLevel);

      // Update cache
      this.validationCache.set(keyId, {
        result: validation,
        timestamp: Date.now()
      });

      // Update runtime info
      this.updateRuntimeInfo(keyId, {
        isValid: validation.isValid,
        lastValidated: new Date()
      });

      // Update metadata status if validation failed
      if (!validation.isValid) {
        metadata.status = ApiKeyStatus.VALIDATION_FAILED;
        metadata.updatedAt = new Date();

        this.createSecurityAlert({
          keyId,
          alertType: 'validation_failure',
          severity: 'medium',
          message: `API key validation failed: ${validation.issues.join(', ')}`
        });
      }

      // Log validation
      this.logAudit({
        id: generateSecureRandom(16),
        keyId,
        action: 'validated',
        timestamp: new Date(),
        success: validation.isValid,
        error: validation.isValid ? undefined : validation.issues.join(', '),
        metadata: {
          securityScore: validation.securityScore,
          issues: validation.issues.length,
          warnings: validation.warnings.length
        }
      });

      return {
        success: true,
        data: validation.isValid,
        metadata: validation
      };

    } catch (error) {
      return {
        success: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Revoke an API key
   */
  public revokeApiKey(keyId: string, reason?: string): ApiKeyOperationResult<boolean> {
    try {
      const metadata = this.keyMetadata.get(keyId);
      if (!metadata) {
        return {
          success: false,
          error: 'API key not found'
        };
      }

      // Update status
      metadata.status = ApiKeyStatus.REVOKED;
      metadata.updatedAt = new Date();

      // Remove from runtime info
      this.runtimeInfo.delete(keyId);

      // Remove from encrypted keys
      this.encryptedKeys.delete(keyId);

      // Remove from cache
      this.validationCache.delete(keyId);

      // Log revocation
      this.logAudit({
        id: generateSecureRandom(16),
        keyId,
        action: 'revoked',
        timestamp: new Date(),
        success: true,
        metadata: {
          reason: reason || 'Manual revocation',
          provider: metadata.provider
        }
      });

      // Create security alert
      this.createSecurityAlert({
        keyId,
        alertType: 'key_exposure',
        severity: 'medium',
        message: `API key revoked: ${reason || 'Manual revocation'}`
      });

      return {
        success: true,
        data: true,
        metadata: {
          revokedAt: metadata.updatedAt,
          reason: reason || 'Manual revocation'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to revoke API key: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get all registered API keys metadata
   */
  public getKeysMetadata(): ApiKeyMetadata[] {
    return Array.from(this.keyMetadata.values());
  }

  /**
   * Get comprehensive security report
   */
  public getSecurityReport(): {
    summary: {
      totalKeys: number;
      activeKeys: number;
      revokedKeys: number;
      expiredKeys: number;
      pendingRotation: number;
      securityAlerts: number;
    };
    keyStatus: Record<string, ApiKeyMetadata>;
    securityAlerts: SecurityAlert[];
    validationReport: any;
    recommendations: string[];
  } {
    const keys = this.getKeysMetadata();
    const activeKeys = keys.filter(k => k.status === ApiKeyStatus.ACTIVE);
    const revokedKeys = keys.filter(k => k.status === ApiKeyStatus.REVOKED);
    const expiredKeys = keys.filter(k => k.status === ApiKeyStatus.EXPIRED);
    const pendingRotation = keys.filter(k => 
      k.rotationSchedule?.enabled && 
      k.rotationSchedule.nextRotation && 
      k.rotationSchedule.nextRotation <= new Date()
    );

    const validationReport = getValidationReport();
    const recommendations: string[] = [];

    if (pendingRotation.length > 0) {
      recommendations.push(`Rotate ${pendingRotation.length} API keys that are due for rotation`);
    }

    if (this.securityAlerts.filter(a => !a.resolved).length > 0) {
      recommendations.push(`Address ${this.securityAlerts.filter(a => !a.resolved).length} unresolved security alerts`);
    }

    if (validationReport.summary.invalidKeys > 0) {
      recommendations.push(`Fix ${validationReport.summary.invalidKeys} invalid API keys`);
    }

    return {
      summary: {
        totalKeys: keys.length,
        activeKeys: activeKeys.length,
        revokedKeys: revokedKeys.length,
        expiredKeys: expiredKeys.length,
        pendingRotation: pendingRotation.length,
        securityAlerts: this.securityAlerts.filter(a => !a.resolved).length
      },
      keyStatus: Object.fromEntries(keys.map(k => [k.id, k])),
      securityAlerts: this.securityAlerts.filter(a => !a.resolved),
      validationReport,
      recommendations
    };
  }

  /**
   * Record API key usage
   */
  public recordUsage(keyId: string, success: boolean, responseTime?: number): void {
    const metadata = this.keyMetadata.get(keyId);
    const runtimeInfo = this.runtimeInfo.get(keyId);

    if (metadata) {
      metadata.usage.totalRequests++;
      metadata.usage.lastRequestAt = new Date();
      metadata.lastUsed = new Date();
      
      if (success) {
        metadata.usage.successCount++;
      } else {
        metadata.usage.errorCount++;
      }

      if (responseTime) {
        const currentAvg = metadata.usage.avgResponseTime || 0;
        const totalRequests = metadata.usage.totalRequests;
        metadata.usage.avgResponseTime = (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;
      }
    }

    if (runtimeInfo) {
      runtimeInfo.usageCount++;
      if (!success) {
        runtimeInfo.errorCount++;
      }

      // Check rate limiting
      const providerConfig = PROVIDER_CONFIGS[runtimeInfo.provider];
      if (providerConfig.defaultPermissions.rateLimit) {
        const rateLimit = providerConfig.defaultPermissions.rateLimit;
        // Simple rate limit check (could be enhanced with time windows)
        if (runtimeInfo.usageCount > rateLimit.requestsPerHour / 60) { // per minute approximation
          runtimeInfo.isNearingLimit = true;
        }
      }
    }
  }

  // Private helper methods

  private getEncryptionKey(): string {
    return this.config.encryptionKey || process.env.API_KEY_ENCRYPTION_KEY || generateSecureRandom(32);
  }

  private updateRuntimeInfo(keyId: string, updates: Partial<RuntimeKeyInfo>): void {
    const current = this.runtimeInfo.get(keyId);
    if (current) {
      this.runtimeInfo.set(keyId, { ...current, ...updates });
    }
  }

  private logAudit(log: ApiKeyAuditLog): void {
    if (this.config.auditLoggingEnabled) {
      this.auditLogs.push(log);
      
      // Keep only last 1000 logs to prevent memory issues
      if (this.auditLogs.length > 1000) {
        this.auditLogs = this.auditLogs.slice(-1000);
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API Key Audit] ${log.action}: ${log.keyId} - ${log.success ? 'SUCCESS' : 'FAILED'}`);
      }
    }
  }

  private createSecurityAlert(params: {
    keyId: string;
    alertType: SecurityAlert['alertType'];
    severity: SecurityAlert['severity'];
    message: string;
    metadata?: Record<string, any>;
  }): void {
    if (this.config.securityAlertsEnabled) {
      const alert: SecurityAlert = {
        id: generateSecureRandom(16),
        keyId: params.keyId,
        alertType: params.alertType,
        severity: params.severity,
        message: params.message,
        timestamp: new Date(),
        resolved: false,
        metadata: params.metadata
      };

      this.securityAlerts.push(alert);

      // Log critical alerts
      if (params.severity === 'critical') {
        console.error(`[CRITICAL SECURITY ALERT] ${params.message}`);
      }
    }
  }
}

// Export singleton instance getter
export const getApiKeyManager = (config?: Partial<ApiKeyManagerConfig>) => 
  ApiKeyManager.getInstance(config);

export default ApiKeyManager; 