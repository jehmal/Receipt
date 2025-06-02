import axios from 'axios';
import { IS_PRODUCTION } from './index';

interface VaultConfig {
  address: string;
  token: string;
  namespace?: string;
}

interface SecretData {
  [key: string]: any;
}

class VaultClient {
  private config: VaultConfig;
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private cacheTTL = 300000; // 5 minutes

  constructor(config: VaultConfig) {
    this.config = config;
  }

  private getCacheKey(path: string): string {
    return `${this.config.namespace || 'default'}:${path}`;
  }

  private isExpired(expires: number): boolean {
    return Date.now() > expires;
  }

  async readSecret(path: string): Promise<SecretData> {
    const cacheKey = this.getCacheKey(path);
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isExpired(cached.expires)) {
      return cached.data;
    }

    try {
      const response = await axios.get(
        `${this.config.address}/v1/${path}`,
        {
          headers: {
            'X-Vault-Token': this.config.token,
            ...(this.config.namespace && { 'X-Vault-Namespace': this.config.namespace })
          }
        }
      );

      const data = response.data.data.data || response.data.data;
      
      this.cache.set(cacheKey, {
        data,
        expires: Date.now() + this.cacheTTL
      });

      return data;
    } catch (error) {
      console.error(`Failed to read secret from Vault: ${path}`, error);
      throw new Error('Failed to retrieve secret from Vault');
    }
  }

  async writeSecret(path: string, data: SecretData): Promise<void> {
    try {
      await axios.post(
        `${this.config.address}/v1/${path}`,
        { data },
        {
          headers: {
            'X-Vault-Token': this.config.token,
            ...(this.config.namespace && { 'X-Vault-Namespace': this.config.namespace })
          }
        }
      );

      // Invalidate cache
      const cacheKey = this.getCacheKey(path);
      this.cache.delete(cacheKey);
    } catch (error) {
      console.error(`Failed to write secret to Vault: ${path}`, error);
      throw new Error('Failed to write secret to Vault');
    }
  }

  async rotateSecret(path: string, generator: () => Promise<SecretData>): Promise<SecretData> {
    const newSecret = await generator();
    await this.writeSecret(path, newSecret);
    return newSecret;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Initialize Vault client
export const vault = IS_PRODUCTION && process.env.VAULT_ADDR
  ? new VaultClient({
      address: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN || '',
      namespace: process.env.VAULT_NAMESPACE
    })
  : null;

// Secret management wrapper
export class SecretManager {
  private static instance: SecretManager;
  private secrets: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): SecretManager {
    if (!SecretManager.instance) {
      SecretManager.instance = new SecretManager();
    }
    return SecretManager.instance;
  }

  async getSecret(key: string, vaultPath?: string): Promise<string> {
    // Check in-memory cache first
    if (this.secrets.has(key)) {
      return this.secrets.get(key);
    }

    // Try Vault if available
    if (vault && vaultPath) {
      try {
        const vaultSecrets = await vault.readSecret(vaultPath);
        if (vaultSecrets[key]) {
          this.secrets.set(key, vaultSecrets[key]);
          return vaultSecrets[key];
        }
      } catch (error) {
        console.error(`Failed to get secret ${key} from Vault`, error);
      }
    }

    // Fall back to environment variable
    const envValue = process.env[key];
    if (envValue) {
      this.secrets.set(key, envValue);
      return envValue;
    }

    throw new Error(`Secret ${key} not found`);
  }

  async setSecret(key: string, value: string, vaultPath?: string): Promise<void> {
    this.secrets.set(key, value);

    if (vault && vaultPath) {
      const currentSecrets = await vault.readSecret(vaultPath).catch(() => ({}));
      await vault.writeSecret(vaultPath, {
        ...currentSecrets,
        [key]: value
      });
    }
  }

  clearCache(): void {
    this.secrets.clear();
    if (vault) {
      vault.clearCache();
    }
  }
}

export const secretManager = SecretManager.getInstance();

// Key rotation scheduler
export class KeyRotationScheduler {
  private rotationJobs: Map<string, NodeJS.Timeout> = new Map();

  scheduleRotation(
    name: string,
    vaultPath: string,
    interval: number,
    generator: () => Promise<SecretData>
  ): void {
    // Clear existing job if any
    this.cancelRotation(name);

    // Schedule rotation
    const job = setInterval(async () => {
      try {
        if (vault) {
          await vault.rotateSecret(vaultPath, generator);
          console.log(`Successfully rotated secret: ${name}`);
        }
      } catch (error) {
        console.error(`Failed to rotate secret: ${name}`, error);
      }
    }, interval);

    this.rotationJobs.set(name, job);
  }

  cancelRotation(name: string): void {
    const job = this.rotationJobs.get(name);
    if (job) {
      clearInterval(job);
      this.rotationJobs.delete(name);
    }
  }

  cancelAllRotations(): void {
    for (const job of this.rotationJobs.values()) {
      clearInterval(job);
    }
    this.rotationJobs.clear();
  }
}

export const keyRotationScheduler = new KeyRotationScheduler();

// Common secret generators
export const secretGenerators = {
  async generateApiKey(): Promise<string> {
    const { randomBytes } = await import('crypto');
    return randomBytes(32).toString('hex');
  },

  async generateJwtSecret(): Promise<string> {
    const { randomBytes } = await import('crypto');
    return randomBytes(64).toString('base64');
  },

  async generateDatabasePassword(): Promise<string> {
    const { randomBytes } = await import('crypto');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const bytes = randomBytes(32);
    let password = '';
    
    for (let i = 0; i < bytes.length; i++) {
      password += chars[bytes[i] % chars.length];
    }
    
    return password;
  }
};
