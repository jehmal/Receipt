import { SecretsManager, SecretsManagerConfig, SecretValue, initializeSecretsManager, getSecretsManager, migrateSecret } from '../../security/secrets-manager';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import NodeVault from 'node-vault';

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager');
jest.mock('node-vault');

describe('SecretsManager', () => {
  let mockAwsClient: jest.Mocked<SecretsManagerClient>;
  let mockVaultClient: any;
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;

  beforeEach(() => {
    // Mock console methods to suppress output during tests
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    console.error = jest.fn();
    console.warn = jest.fn();

    // Reset AWS mock
    mockAwsClient = {
      send: jest.fn()
    } as any;
    (SecretsManagerClient as jest.Mock).mockImplementation(() => mockAwsClient);

    // Reset Vault mock
    mockVaultClient = {
      read: jest.fn(),
      write: jest.fn()
    };
    (NodeVault as jest.Mock).mockImplementation(() => mockVaultClient);

    jest.clearAllMocks();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with AWS provider', () => {
      const config: SecretsManagerConfig = {
        provider: 'aws',
        awsRegion: 'us-west-2'
      };

      const secretsManager = new SecretsManager(config);
      expect(secretsManager).toBeInstanceOf(SecretsManager);
      expect(SecretsManagerClient).toHaveBeenCalledWith({
        region: 'us-west-2'
      });
    });

    it('should initialize with Vault provider', () => {
      const config: SecretsManagerConfig = {
        provider: 'vault',
        vaultEndpoint: 'https://vault.example.com',
        vaultToken: 'vault-token-123'
      };

      const secretsManager = new SecretsManager(config);
      expect(secretsManager).toBeInstanceOf(SecretsManager);
      expect(NodeVault).toHaveBeenCalledWith({
        endpoint: 'https://vault.example.com',
        token: 'vault-token-123'
      });
    });

    it('should use default AWS region when not specified', () => {
      const config: SecretsManagerConfig = {
        provider: 'aws'
      };

      new SecretsManager(config);
      expect(SecretsManagerClient).toHaveBeenCalledWith({
        region: 'us-east-1'
      });
    });

    it('should use default Vault endpoint when not specified', () => {
      const config: SecretsManagerConfig = {
        provider: 'vault',
        vaultToken: 'token'
      };

      new SecretsManager(config);
      expect(NodeVault).toHaveBeenCalledWith({
        endpoint: 'http://localhost:8200',
        token: 'token'
      });
    });
  });

  describe('AWS Secrets Manager Integration', () => {
    let secretsManager: SecretsManager;

    beforeEach(() => {
      const config: SecretsManagerConfig = {
        provider: 'aws',
        awsRegion: 'us-east-1'
      };
      secretsManager = new SecretsManager(config);
    });

    it('should retrieve secret from AWS', async () => {
      const mockResponse = {
        SecretString: JSON.stringify({ username: 'testuser', password: 'testpass' }),
        VersionId: 'version-123',
        CreatedDate: new Date('2024-01-01')
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      const result = await secretsManager.getSecret('test-secret');

      expect(mockAwsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            SecretId: 'test-secret',
            VersionStage: 'AWSCURRENT'
          }
        })
      );

      expect(result).toEqual({
        value: JSON.stringify({ username: 'testuser', password: 'testpass' }),
        version: 'version-123',
        lastRotated: new Date('2024-01-01')
      });
    });

    it('should handle AWS secret without version info', async () => {
      const mockResponse = {
        SecretString: 'simple-secret-value'
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      const result = await secretsManager.getSecret('test-secret');

      expect(result).toEqual({
        value: 'simple-secret-value',
        version: undefined,
        lastRotated: undefined
      });
    });

    it('should handle AWS errors gracefully', async () => {
      const awsError = new Error('ResourceNotFoundException');
      mockAwsClient.send.mockRejectedValue(awsError);

      await expect(secretsManager.getSecret('nonexistent-secret'))
        .rejects.toThrow('Secret retrieval failed: nonexistent-secret');

      expect(console.error).toHaveBeenCalledWith(
        'Failed to retrieve secret nonexistent-secret:',
        awsError
      );
    });

    it('should reject setting secrets with AWS provider', async () => {
      await expect(secretsManager.setSecret('test-secret', 'value'))
        .rejects.toThrow('Setting secrets only supported with Vault');
    });
  });

  describe('HashiCorp Vault Integration', () => {
    let secretsManager: SecretsManager;

    beforeEach(() => {
      const config: SecretsManagerConfig = {
        provider: 'vault',
        vaultEndpoint: 'https://vault.example.com',
        vaultToken: 'vault-token'
      };
      secretsManager = new SecretsManager(config);
    });

    it('should retrieve secret from Vault', async () => {
      const mockVaultResponse = {
        data: {
          data: {
            value: 'vault-secret-value'
          },
          metadata: {
            version: 5,
            created_time: '2024-01-01T10:00:00Z'
          }
        }
      };

      mockVaultClient.read.mockResolvedValue(mockVaultResponse);

      const result = await secretsManager.getSecret('test-secret');

      expect(mockVaultClient.read).toHaveBeenCalledWith('secret/data/test-secret');
      expect(result).toEqual({
        value: 'vault-secret-value',
        version: '5',
        lastRotated: new Date('2024-01-01T10:00:00Z')
      });
    });

    it('should set secret in Vault', async () => {
      mockVaultClient.write.mockResolvedValue({});

      await secretsManager.setSecret('test-secret', 'new-secret-value');

      expect(mockVaultClient.write).toHaveBeenCalledWith('secret/data/test-secret', {
        data: { value: 'new-secret-value' }
      });
    });

    it('should handle Vault read errors', async () => {
      const vaultError = new Error('403 Forbidden');
      mockVaultClient.read.mockRejectedValue(vaultError);

      await expect(secretsManager.getSecret('forbidden-secret'))
        .rejects.toThrow('Secret retrieval failed: forbidden-secret');
    });

    it('should handle Vault write errors', async () => {
      const vaultError = new Error('403 Forbidden');
      mockVaultClient.write.mockRejectedValue(vaultError);

      await expect(secretsManager.setSecret('forbidden-secret', 'value'))
        .rejects.toThrow('Secret storage failed: forbidden-secret');
    });

    it('should handle missing metadata gracefully', async () => {
      const mockVaultResponse = {
        data: {
          data: {
            value: 'vault-secret-value'
          },
          metadata: {} // Empty metadata
        }
      };

      mockVaultClient.read.mockResolvedValue(mockVaultResponse);

      const result = await secretsManager.getSecret('test-secret');

      expect(result).toEqual({
        value: 'vault-secret-value',
        version: undefined,
        lastRotated: new Date('Invalid Date')
      });
    });
  });

  describe('Secret Caching', () => {
    let secretsManager: SecretsManager;

    beforeEach(() => {
      const config: SecretsManagerConfig = {
        provider: 'aws'
      };
      secretsManager = new SecretsManager(config);
    });

    it('should cache secrets and return cached values', async () => {
      const mockResponse = {
        SecretString: 'cached-secret-value',
        VersionId: 'version-1'
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      // First call should hit the provider
      const result1 = await secretsManager.getCachedSecret('cached-secret');
      expect(mockAwsClient.send).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await secretsManager.getCachedSecret('cached-secret');
      expect(mockAwsClient.send).toHaveBeenCalledTimes(1); // No additional calls

      expect(result1).toEqual(result2);
      expect(result1.value).toBe('cached-secret-value');
    });

    it('should refresh cache after TTL expires', async () => {
      const mockResponse1 = {
        SecretString: 'original-value'
      };
      const mockResponse2 = {
        SecretString: 'updated-value'
      };

      mockAwsClient.send
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // First call
      const result1 = await secretsManager.getCachedSecret('ttl-secret');
      expect(result1.value).toBe('original-value');

      // Mock time passing beyond TTL (5 minutes = 300,000ms)
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 300001);

      // Second call should refresh cache
      const result2 = await secretsManager.getCachedSecret('ttl-secret');
      expect(result2.value).toBe('updated-value');
      expect(mockAwsClient.send).toHaveBeenCalledTimes(2);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should handle concurrent cache requests', async () => {
      const mockResponse = {
        SecretString: 'concurrent-secret'
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      // Make multiple concurrent requests
      const promises = Array(10).fill(0).map(() => 
        secretsManager.getCachedSecret('concurrent-secret')
      );

      const results = await Promise.all(promises);

      // Should only call the provider once due to caching
      expect(mockAwsClient.send).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(10);
      expect(results.every(r => r.value === 'concurrent-secret')).toBe(true);
    });

    it('should maintain separate cache entries for different secrets', async () => {
      const mockResponse1 = { SecretString: 'secret-1-value' };
      const mockResponse2 = { SecretString: 'secret-2-value' };

      mockAwsClient.send
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result1 = await secretsManager.getCachedSecret('secret-1');
      const result2 = await secretsManager.getCachedSecret('secret-2');

      expect(mockAwsClient.send).toHaveBeenCalledTimes(2);
      expect(result1.value).toBe('secret-1-value');
      expect(result2.value).toBe('secret-2-value');

      // Subsequent calls should use cache
      const result1Cached = await secretsManager.getCachedSecret('secret-1');
      const result2Cached = await secretsManager.getCachedSecret('secret-2');

      expect(mockAwsClient.send).toHaveBeenCalledTimes(2); // No additional calls
      expect(result1Cached.value).toBe('secret-1-value');
      expect(result2Cached.value).toBe('secret-2-value');
    });
  });

  describe('Secret Rotation', () => {
    let secretsManager: SecretsManager;

    beforeEach(() => {
      const config: SecretsManagerConfig = {
        provider: 'vault'
      };
      secretsManager = new SecretsManager(config);
    });

    it('should log rotation trigger', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      await secretsManager.rotateSecret('rotate-secret');

      expect(consoleSpy).toHaveBeenCalledWith('Secret rotation triggered for: rotate-secret');
    });
  });

  describe('Provider Validation', () => {
    it('should throw error when no provider is configured', async () => {
      const config: SecretsManagerConfig = {
        provider: 'aws'
      };
      const secretsManager = new SecretsManager(config);
      
      // Manually clear the client to simulate misconfiguration
      (secretsManager as any).awsClient = undefined;
      (secretsManager as any).config.provider = 'invalid' as any;

      await expect(secretsManager.getSecret('test-secret'))
        .rejects.toThrow('No secrets provider configured');
    });
  });

  describe('Singleton Pattern', () => {
    afterEach(() => {
      // Reset singleton for clean tests
      (global as any).secretsManager = undefined;
    });

    it('should initialize singleton', () => {
      const config: SecretsManagerConfig = {
        provider: 'aws'
      };

      const instance = initializeSecretsManager(config);
      expect(instance).toBeInstanceOf(SecretsManager);
    });

    it('should return singleton instance', () => {
      const config: SecretsManagerConfig = {
        provider: 'vault',
        vaultToken: 'token'
      };

      const instance1 = initializeSecretsManager(config);
      const instance2 = getSecretsManager();

      expect(instance1).toBe(instance2);
    });

    it('should throw error when getting uninitialized singleton', () => {
      expect(() => getSecretsManager())
        .toThrow('SecretsManager not initialized. Call initializeSecretsManager first.');
    });
  });

  describe('Secret Migration Helper', () => {
    beforeEach(() => {
      const config: SecretsManagerConfig = {
        provider: 'aws'
      };
      initializeSecretsManager(config);
    });

    afterEach(() => {
      delete process.env.TEST_ENV_VAR;
      (global as any).secretsManager = undefined;
    });

    it('should prefer secrets manager over environment variables', async () => {
      const mockResponse = {
        SecretString: 'secret-from-manager'
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);
      process.env.TEST_ENV_VAR = 'value-from-env';

      const result = await migrateSecret('TEST_ENV_VAR', 'test-secret-name');

      expect(result).toBe('secret-from-manager');
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should fallback to environment variable when secret not found', async () => {
      const awsError = new Error('ResourceNotFoundException');
      mockAwsClient.send.mockRejectedValue(awsError);
      process.env.TEST_ENV_VAR = 'fallback-env-value';

      const result = await migrateSecret('TEST_ENV_VAR', 'nonexistent-secret');

      expect(result).toBe('fallback-env-value');
      expect(console.warn).toHaveBeenCalledWith(
        'Using fallback env var TEST_ENV_VAR. Consider migrating to secrets manager.'
      );
    });

    it('should throw error when neither secret nor env var exists', async () => {
      const awsError = new Error('ResourceNotFoundException');
      mockAwsClient.send.mockRejectedValue(awsError);
      
      await expect(migrateSecret('NONEXISTENT_ENV_VAR', 'nonexistent-secret'))
        .rejects.toThrow('Neither secret nonexistent-secret nor env var NONEXISTENT_ENV_VAR found');
    });

    it('should handle cached secrets in migration', async () => {
      const mockResponse = {
        SecretString: 'cached-migration-value'
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      // First call should cache
      const result1 = await migrateSecret('TEST_ENV_VAR', 'migration-secret');
      // Second call should use cache
      const result2 = await migrateSecret('TEST_ENV_VAR', 'migration-secret');

      expect(result1).toBe('cached-migration-value');
      expect(result2).toBe('cached-migration-value');
      expect(mockAwsClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let secretsManager: SecretsManager;

    beforeEach(() => {
      const config: SecretsManagerConfig = {
        provider: 'aws'
      };
      secretsManager = new SecretsManager(config);
    });

    it('should handle empty secret values', async () => {
      const mockResponse = {
        SecretString: ''
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      const result = await secretsManager.getSecret('empty-secret');
      expect(result.value).toBe('');
    });

    it('should handle null secret string', async () => {
      const mockResponse = {
        SecretString: null
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      const result = await secretsManager.getSecret('null-secret');
      expect(result.value).toBe('');
    });

    it('should handle binary secrets', async () => {
      const mockResponse = {
        SecretBinary: Buffer.from('binary-secret-data')
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      // Should still work even though we expect SecretString
      const result = await secretsManager.getSecret('binary-secret');
      expect(result.value).toBe('');
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockAwsClient.send.mockRejectedValue(timeoutError);

      await expect(secretsManager.getSecret('timeout-secret'))
        .rejects.toThrow('Secret retrieval failed: timeout-secret');
    });

    it('should handle large secret values', async () => {
      const largeSecret = 'x'.repeat(65536); // 64KB secret
      const mockResponse = {
        SecretString: largeSecret
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      const result = await secretsManager.getSecret('large-secret');
      expect(result.value).toBe(largeSecret);
      expect(result.value.length).toBe(65536);
    });

    it('should handle special characters in secret names', async () => {
      const mockResponse = {
        SecretString: 'special-secret-value'
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      const specialSecretName = 'secret/with/slashes-and_underscores.and.dots';
      await secretsManager.getSecret(specialSecretName);

      expect(mockAwsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            SecretId: specialSecretName,
            VersionStage: 'AWSCURRENT'
          }
        })
      );
    });
  });

  describe('Performance and Memory', () => {
    let secretsManager: SecretsManager;

    beforeEach(() => {
      const config: SecretsManagerConfig = {
        provider: 'aws'
      };
      secretsManager = new SecretsManager(config);
    });

    it('should handle high-frequency cache access', async () => {
      const mockResponse = {
        SecretString: 'high-frequency-secret'
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      const start = Date.now();
      
      // Make many concurrent cache requests
      const promises = Array(1000).fill(0).map(() =>
        secretsManager.getCachedSecret('high-frequency-secret')
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete quickly
      expect(results).toHaveLength(1000);
      expect(results.every(r => r.value === 'high-frequency-secret')).toBe(true);
      expect(mockAwsClient.send).toHaveBeenCalledTimes(1); // Only one provider call
    });

    it('should not leak memory with cache growth', async () => {
      const mockResponse = {
        SecretString: 'memory-test-secret'
      };

      mockAwsClient.send.mockResolvedValue(mockResponse);

      // Access many different secrets
      for (let i = 0; i < 1000; i++) {
        await secretsManager.getCachedSecret(`secret-${i}`);
      }

      // Should not throw out-of-memory errors
      expect(mockAwsClient.send).toHaveBeenCalledTimes(1000);
    });
  });
});