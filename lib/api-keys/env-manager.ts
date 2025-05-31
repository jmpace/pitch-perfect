/**
 * Environment File Manager for API Keys
 * Secure management of environment variables and API key configurations
 */

import fs from 'fs';
import path from 'path';
import { ApiProvider, ApiKeyOperationResult, ProviderConfig } from './types';
import { validateApiKey, PROVIDER_CONFIGS } from './validator';
import { sanitizeKeyForLogging } from './encryption';

// Environment file configuration
interface EnvFileConfig {
  path: string;
  encoding: 'utf8';
  createIfMissing: boolean;
  backupOnChange: boolean;
}

// Environment variable entry
interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
  provider?: ApiProvider;
  isSecure: boolean;
}

// Environment validation result
interface EnvValidationResult {
  totalKeys: number;
  validKeys: number;
  invalidKeys: number;
  missingKeys: string[];
  invalidEntries: Array<{
    key: string;
    issues: string[];
  }>;
  recommendations: string[];
}

/**
 * Environment File Manager
 */
export class EnvironmentManager {
  private config: EnvFileConfig;
  private envCache: Map<string, EnvEntry> = new Map();
  private lastModified: number = 0;

  constructor(config: Partial<EnvFileConfig> = {}) {
    this.config = {
      path: path.join(process.cwd(), '.env'),
      encoding: 'utf8',
      createIfMissing: true,
      backupOnChange: true,
      ...config
    };

    this.loadEnvironmentFile();
  }

  /**
   * Load and parse environment file
   */
  private loadEnvironmentFile(): void {
    try {
      if (!fs.existsSync(this.config.path)) {
        if (this.config.createIfMissing) {
          this.createDefaultEnvFile();
        }
        return;
      }

      const stats = fs.statSync(this.config.path);
      if (stats.mtime.getTime() === this.lastModified) {
        return; // No changes since last load
      }

      const content = fs.readFileSync(this.config.path, this.config.encoding);
      this.parseEnvironmentContent(content);
      this.lastModified = stats.mtime.getTime();

    } catch (error) {
      console.error('Failed to load environment file:', error);
    }
  }

  /**
   * Parse environment file content
   */
  private parseEnvironmentContent(content: string): void {
    this.envCache.clear();
    const lines = content.split('\n');

    let currentComment = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Handle comments
      if (trimmedLine.startsWith('#')) {
        currentComment = trimmedLine.substring(1).trim();
        continue;
      }

      // Skip empty lines
      if (!trimmedLine) {
        currentComment = '';
        continue;
      }

      // Parse key=value pairs
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex === -1) {
        continue;
      }

      const key = trimmedLine.substring(0, equalIndex).trim();
      const value = trimmedLine.substring(equalIndex + 1).trim();

      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');

      // Determine if this is an API key
      const provider = this.detectProviderFromKey(key);
      const isSecure = this.isSecureKey(key, cleanValue);

      this.envCache.set(key, {
        key,
        value: cleanValue,
        comment: currentComment || undefined,
        provider,
        isSecure
      });

      currentComment = '';
    }
  }

  /**
   * Create default environment file with template
   */
  private createDefaultEnvFile(): void {
    const template = this.generateEnvTemplate();
    
    try {
      fs.writeFileSync(this.config.path, template, this.config.encoding);
      console.log(`Created default environment file: ${this.config.path}`);
    } catch (error) {
      console.error('Failed to create default environment file:', error);
    }
  }

  /**
   * Generate environment file template
   */
  private generateEnvTemplate(): string {
    const lines: string[] = [
      '# API Key Configuration',
      '# Secure API keys for various services',
      '# Never commit this file to version control',
      '',
      '# Node.js Environment',
      'NODE_ENV=development',
      '',
      '# API Keys - Add your actual keys here',
      '# Format: PROVIDER_API_KEY=your_actual_key_here',
      ''
    ];

    // Add template entries for each provider
    Object.values(PROVIDER_CONFIGS).forEach(config => {
      lines.push(`# ${config.provider.toUpperCase()} API Key`);
      lines.push(`# Get your key from: ${this.getProviderUrl(config.provider)}`);
      lines.push(`${config.envVarName}=`);
      lines.push('');
    });

    lines.push('# Additional Configuration');
    lines.push('# API_KEY_ENCRYPTION_KEY=your_encryption_key_here');
    lines.push('# ENABLE_API_KEY_MONITORING=true');
    lines.push('# API_KEY_ROTATION_DAYS=90');

    return lines.join('\n');
  }

  /**
   * Get provider documentation URL
   */
  private getProviderUrl(provider: ApiProvider): string {
    const urls: Record<ApiProvider, string> = {
      [ApiProvider.OPENAI]: 'https://platform.openai.com/api-keys',
      [ApiProvider.ANTHROPIC]: 'https://console.anthropic.com/settings/keys',
      [ApiProvider.PERPLEXITY]: 'https://www.perplexity.ai/settings/api',
      [ApiProvider.VERCEL_BLOB]: 'https://vercel.com/docs/storage/vercel-blob',
      [ApiProvider.GOOGLE]: 'https://cloud.google.com/docs/authentication/api-keys',
      [ApiProvider.MISTRAL]: 'https://docs.mistral.ai/api/',
      [ApiProvider.AZURE_OPENAI]: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service',
      [ApiProvider.OPENROUTER]: 'https://openrouter.ai/keys',
      [ApiProvider.XAI]: 'https://x.ai/api',
      [ApiProvider.OLLAMA]: 'https://ollama.ai/docs',
      [ApiProvider.CUSTOM]: 'Custom API provider'
    };

    return urls[provider] || 'Unknown provider';
  }

  /**
   * Detect API provider from environment variable name
   */
  private detectProviderFromKey(key: string): ApiProvider | undefined {
    for (const config of Object.values(PROVIDER_CONFIGS)) {
      if (config.envVarName === key) {
        return config.provider;
      }
    }
    return undefined;
  }

  /**
   * Check if a key/value pair is secure
   */
  private isSecureKey(key: string, value: string): boolean {
    // Check if it's an API key environment variable
    const isApiKey = key.includes('API_KEY') || 
                     key.includes('SECRET') || 
                     key.includes('TOKEN') ||
                     key.includes('PASSWORD');

    if (!isApiKey) {
      return false;
    }

    // Check if value looks like a real API key
    return value.length > 10 && 
           !value.includes('your_') && 
           !value.includes('example') && 
           !value.includes('demo');
  }

  /**
   * Validate all API keys in environment
   */
  public validateEnvironment(): EnvValidationResult {
    this.loadEnvironmentFile(); // Refresh cache

    const result: EnvValidationResult = {
      totalKeys: 0,
      validKeys: 0,
      invalidKeys: 0,
      missingKeys: [],
      invalidEntries: [],
      recommendations: []
    };

    // Check for expected API keys
    Object.values(PROVIDER_CONFIGS).forEach(config => {
      const entry = this.envCache.get(config.envVarName);
      
      if (!entry || !entry.value) {
        result.missingKeys.push(config.envVarName);
        result.recommendations.push(
          `Add ${config.envVarName} for ${config.provider} integration`
        );
        return;
      }

      result.totalKeys++;

      // Validate the key
      const validation = validateApiKey(entry.value, config.provider);
      
      if (validation.isValid) {
        result.validKeys++;
      } else {
        result.invalidKeys++;
        result.invalidEntries.push({
          key: config.envVarName,
          issues: validation.issues
        });
      }
    });

    // Add general recommendations
    if (result.invalidKeys > 0) {
      result.recommendations.push(
        `Fix ${result.invalidKeys} invalid API keys`
      );
    }

    if (result.missingKeys.length > 0) {
      result.recommendations.push(
        `Add ${result.missingKeys.length} missing API keys`
      );
    }

    if (!this.envCache.has('API_KEY_ENCRYPTION_KEY')) {
      result.recommendations.push(
        'Add API_KEY_ENCRYPTION_KEY for enhanced security'
      );
    }

    return result;
  }

  /**
   * Set an environment variable securely
   */
  public setEnvironmentVariable(
    key: string, 
    value: string, 
    comment?: string
  ): ApiKeyOperationResult<boolean> {
    try {
      // Backup current file if enabled
      if (this.config.backupOnChange) {
        this.createBackup();
      }

      // Update cache
      const provider = this.detectProviderFromKey(key);
      this.envCache.set(key, {
        key,
        value,
        comment,
        provider,
        isSecure: this.isSecureKey(key, value)
      });

      // Write to file
      this.writeEnvironmentFile();

      return {
        success: true,
        data: true,
        metadata: {
          key,
          provider,
          sanitizedValue: sanitizeKeyForLogging(value)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to set environment variable: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Remove an environment variable
   */
  public removeEnvironmentVariable(key: string): ApiKeyOperationResult<boolean> {
    try {
      if (!this.envCache.has(key)) {
        return {
          success: false,
          error: 'Environment variable not found'
        };
      }

      // Backup current file if enabled
      if (this.config.backupOnChange) {
        this.createBackup();
      }

      // Remove from cache
      this.envCache.delete(key);

      // Write to file
      this.writeEnvironmentFile();

      return {
        success: true,
        data: true,
        metadata: { key }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to remove environment variable: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Write current cache to environment file
   */
  private writeEnvironmentFile(): void {
    const lines: string[] = [];

    // Group entries by category
    const apiKeys = new Map<ApiProvider, EnvEntry[]>();
    const otherVars: EnvEntry[] = [];

    for (const entry of this.envCache.values()) {
      if (entry.provider) {
        if (!apiKeys.has(entry.provider)) {
          apiKeys.set(entry.provider, []);
        }
        apiKeys.get(entry.provider)!.push(entry);
      } else {
        otherVars.push(entry);
      }
    }

    // Write general variables first
    if (otherVars.length > 0) {
      lines.push('# General Configuration');
      for (const entry of otherVars) {
        if (entry.comment) {
          lines.push(`# ${entry.comment}`);
        }
        lines.push(`${entry.key}=${entry.value}`);
      }
      lines.push('');
    }

    // Write API keys by provider
    for (const [provider, entries] of apiKeys) {
      lines.push(`# ${provider.toUpperCase()} Configuration`);
      for (const entry of entries) {
        if (entry.comment) {
          lines.push(`# ${entry.comment}`);
        }
        lines.push(`${entry.key}=${entry.value}`);
      }
      lines.push('');
    }

    // Write to file
    fs.writeFileSync(this.config.path, lines.join('\n'), this.config.encoding);
  }

  /**
   * Create backup of current environment file
   */
  private createBackup(): void {
    try {
      if (!fs.existsSync(this.config.path)) {
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${this.config.path}.backup.${timestamp}`;
      
      fs.copyFileSync(this.config.path, backupPath);
      
      // Keep only last 5 backups
      this.cleanupBackups();

    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  }

  /**
   * Clean up old backup files
   */
  private cleanupBackups(): void {
    try {
      const dir = path.dirname(this.config.path);
      const baseName = path.basename(this.config.path);
      const files = fs.readdirSync(dir);
      
      const backupFiles = files
        .filter(file => file.startsWith(`${baseName}.backup.`))
        .map(file => ({
          name: file,
          path: path.join(dir, file),
          mtime: fs.statSync(path.join(dir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the 5 most recent backups
      const filesToDelete = backupFiles.slice(5);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }

    } catch (error) {
      console.error('Failed to cleanup backups:', error);
    }
  }

  /**
   * Get environment report
   */
  public getEnvironmentReport(): {
    file: {
      path: string;
      exists: boolean;
      size: number;
      lastModified: Date;
      backupsCount: number;
    };
    validation: EnvValidationResult;
    security: {
      hasEncryptionKey: boolean;
      hasSecureKeys: number;
      hasInsecureKeys: number;
      recommendations: string[];
    };
  } {
    this.loadEnvironmentFile();
    
    const validation = this.validateEnvironment();
    
    // Get file stats
    let fileStats = {
      exists: false,
      size: 0,
      lastModified: new Date(0),
      backupsCount: 0
    };

    try {
      if (fs.existsSync(this.config.path)) {
        const stats = fs.statSync(this.config.path);
        fileStats = {
          exists: true,
          size: stats.size,
          lastModified: stats.mtime,
          backupsCount: this.countBackupFiles()
        };
      }
    } catch (error) {
      // Use defaults
    }

    // Security analysis
    const secureKeys = Array.from(this.envCache.values()).filter(e => e.isSecure);
    const insecureKeys = Array.from(this.envCache.values()).filter(e => !e.isSecure && e.key.includes('KEY'));

    const securityRecommendations: string[] = [];
    if (!this.envCache.has('API_KEY_ENCRYPTION_KEY')) {
      securityRecommendations.push('Add encryption key for enhanced security');
    }
    if (insecureKeys.length > 0) {
      securityRecommendations.push(`Review ${insecureKeys.length} potentially insecure keys`);
    }

    return {
      file: {
        path: this.config.path,
        ...fileStats
      },
      validation,
      security: {
        hasEncryptionKey: this.envCache.has('API_KEY_ENCRYPTION_KEY'),
        hasSecureKeys: secureKeys.length,
        hasInsecureKeys: insecureKeys.length,
        recommendations: securityRecommendations
      }
    };
  }

  /**
   * Count backup files
   */
  private countBackupFiles(): number {
    try {
      const dir = path.dirname(this.config.path);
      const baseName = path.basename(this.config.path);
      const files = fs.readdirSync(dir);
      
      return files.filter(file => file.startsWith(`${baseName}.backup.`)).length;
    } catch (error) {
      return 0;
    }
  }
}

// Export singleton instance
let environmentManager: EnvironmentManager | null = null;

export function getEnvironmentManager(config?: Partial<EnvFileConfig>): EnvironmentManager {
  if (!environmentManager) {
    environmentManager = new EnvironmentManager(config);
  }
  return environmentManager;
}

export default EnvironmentManager; 