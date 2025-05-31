/**
 * API Key Management Types and Interfaces
 * Comprehensive type definitions for secure API key handling
 */

// Supported API providers
export enum ApiProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  PERPLEXITY = 'perplexity',
  VERCEL_BLOB = 'vercel_blob',
  GOOGLE = 'google',
  MISTRAL = 'mistral',
  AZURE_OPENAI = 'azure_openai',
  OPENROUTER = 'openrouter',
  XAI = 'xai',
  OLLAMA = 'ollama',
  CUSTOM = 'custom'
}

// API key security levels
export enum SecurityLevel {
  LOW = 'low',           // Basic validation only
  MEDIUM = 'medium',     // Format validation + basic checks
  HIGH = 'high',         // Comprehensive validation + monitoring
  CRITICAL = 'critical'  // All security features + encryption
}

// API key status
export enum ApiKeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
  ROTATION_PENDING = 'rotation_pending',
  VALIDATION_FAILED = 'validation_failed'
}

// API key permissions and scopes
export interface ApiKeyPermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  admin: boolean;
  scopes: string[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

// Core API key metadata
export interface ApiKeyMetadata {
  id: string;
  provider: ApiProvider;
  name: string;
  description?: string;
  environment: 'development' | 'staging' | 'production';
  securityLevel: SecurityLevel;
  status: ApiKeyStatus;
  permissions: ApiKeyPermissions;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
  rotationSchedule?: {
    enabled: boolean;
    intervalDays: number;
    nextRotation?: Date;
    warningDays: number;
  };
  usage: {
    totalRequests: number;
    lastRequestAt?: Date;
    errorCount: number;
    successCount: number;
    avgResponseTime?: number;
  };
  encryption: {
    encrypted: boolean;
    algorithm?: string;
    keyId?: string;
  };
}

// API key configuration for different providers
export interface ProviderConfig {
  provider: ApiProvider;
  envVarName: string;
  keyFormat: RegExp;
  minLength: number;
  maxLength: number;
  prefix?: string;
  testEndpoint?: string;
  defaultPermissions: ApiKeyPermissions;
  securityLevel: SecurityLevel;
  rotationSupported: boolean;
  encryptionRequired: boolean;
}

// API key validation result
export interface KeyValidationResult {
  isValid: boolean;
  provider: ApiProvider;
  issues: string[];
  warnings: string[];
  recommendations: string[];
  securityScore: number; // 0-100
  metadata?: {
    format: boolean;
    length: boolean;
    checksum: boolean;
    prefix: boolean;
    entropy: number;
    containsPersonalInfo: boolean;
    isRevoked: boolean;
    isExpired: boolean;
  };
}

// Audit log entry for API key activities
export interface ApiKeyAuditLog {
  id: string;
  keyId: string;
  action: 'created' | 'updated' | 'used' | 'rotated' | 'revoked' | 'validated' | 'failed';
  timestamp: Date;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// Security alert for API key issues
export interface SecurityAlert {
  id: string;
  keyId: string;
  alertType: 'suspicious_usage' | 'key_exposure' | 'rotation_due' | 'validation_failure' | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  metadata?: Record<string, any>;
}

// Configuration for the API key manager
export interface ApiKeyManagerConfig {
  encryptionEnabled: boolean;
  encryptionKey?: string;
  auditLoggingEnabled: boolean;
  rotationEnabled: boolean;
  defaultRotationDays: number;
  validationCacheTime: number; // in seconds
  securityAlertsEnabled: boolean;
  rateLimitingEnabled: boolean;
  environments: ('development' | 'staging' | 'production')[];
}

// Response interface for API key operations
export interface ApiKeyOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

// Interface for encrypted key storage
export interface EncryptedKey {
  encryptedValue: string;
  keyId: string;
  algorithm: string;
  iv: string;
  createdAt: Date;
}

// Runtime API key information
export interface RuntimeKeyInfo {
  keyId: string;
  provider: ApiProvider;
  isValid: boolean;
  lastValidated: Date;
  usageCount: number;
  errorCount: number;
  isNearingLimit: boolean;
  permissions: ApiKeyPermissions;
}

export default {
  ApiProvider,
  SecurityLevel,
  ApiKeyStatus
}; 