import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import NodeVault from 'node-vault';

export interface SecretValue {
  value: string;
  version?: string;
  lastRotated?: Date;
}

export interface SecretsManagerConfig {
  provider: 'aws' | 'vault';
  awsRegion?: string;
  vaultEndpoint?: string;
  vaultToken?: string;
}

export class SecretsManager {
  private awsClient?: SecretsManagerClient;
  private vaultClient?: any;
  private config: SecretsManagerConfig;

  constructor(config: SecretsManagerConfig) {
    this.config = config;
    
    if (config.provider === 'aws') {
      this.awsClient = new SecretsManagerClient({
        region: config.awsRegion || 'us-east-1'
      });
    } else if (config.provider === 'vault') {
      this.vaultClient = NodeVault({
        endpoint: config.vaultEndpoint || 'http://localhost:8200',
        token: config.vaultToken
      });
    }
  }

  async getSecret(secretName: string): Promise<SecretValue> {
    try {
      if (this.config.provider === 'aws' && this.awsClient) {
        const command = new GetSecretValueCommand({
          SecretId: secretName,
          VersionStage: 'AWSCURRENT'
        });
        
        const response = await this.awsClient.send(command);
        return {
          value: response.SecretString || '',
          version: response.VersionId,
          lastRotated: response.CreatedDate
        };
      } 
      
      if (this.config.provider === 'vault' && this.vaultClient) {
        const result = await this.vaultClient.read(`secret/data/${secretName}`);
        return {
          value: result.data.data.value,
          version: result.data.metadata.version?.toString(),
          lastRotated: new Date(result.data.metadata.created_time)
        };
      }
      
      throw new Error('No secrets provider configured');
    } catch (error) {
      console.error(`Failed to retrieve secret ${secretName}:`, error);
      throw new Error(`Secret retrieval failed: ${secretName}`);
    }
  }

  async setSecret(secretName: string, secretValue: string): Promise<void> {
    try {
      if (this.config.provider === 'vault' && this.vaultClient) {
        await this.vaultClient.write(`secret/data/${secretName}`, {
          data: { value: secretValue }
        });
      } else {
        throw new Error('Setting secrets only supported with Vault');
      }
    } catch (error) {
      console.error(`Failed to set secret ${secretName}:`, error);
      throw new Error(`Secret storage failed: ${secretName}`);
    }
  }

  async rotateSecret(secretName: string): Promise<void> {
    // Implementation depends on the secret type and rotation strategy
    console.log(`Secret rotation triggered for: ${secretName}`);
    // This would integrate with your secret rotation logic
  }

  // Cache secrets in memory with TTL for performance
  private secretCache = new Map<string, { value: SecretValue; expiry: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getCachedSecret(secretName: string): Promise<SecretValue> {
    const cached = this.secretCache.get(secretName);
    const now = Date.now();
    
    if (cached && cached.expiry > now) {
      return cached.value;
    }
    
    const secret = await this.getSecret(secretName);
    this.secretCache.set(secretName, {
      value: secret,
      expiry: now + this.CACHE_TTL
    });
    
    return secret;
  }
}

// Singleton instance
let secretsManager: SecretsManager;

export function initializeSecretsManager(config: SecretsManagerConfig): SecretsManager {
  secretsManager = new SecretsManager(config);
  return secretsManager;
}

export function getSecretsManager(): SecretsManager {
  if (!secretsManager) {
    throw new Error('SecretsManager not initialized. Call initializeSecretsManager first.');
  }
  return secretsManager;
}

// Helper function to migrate from env vars to secrets manager
export async function migrateSecret(envVarName: string, secretName: string): Promise<string> {
  try {
    // First try to get from secrets manager
    const secret = await secretsManager.getCachedSecret(secretName);
    return secret.value;
  } catch {
    // Fallback to environment variable (development mode)
    const envValue = process.env[envVarName];
    if (!envValue) {
      throw new Error(`Neither secret ${secretName} nor env var ${envVarName} found`);
    }
    console.warn(`Using fallback env var ${envVarName}. Consider migrating to secrets manager.`);
    return envValue;
  }
} 