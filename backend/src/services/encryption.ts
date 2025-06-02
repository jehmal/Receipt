import crypto from 'crypto';
import { logger } from '../utils/logger';

interface EncryptionConfig {
  encryptionKey: string;
  algorithm: string;
  keyVersion?: string;
}

interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
  algorithm: string;
  keyVersion?: string;
}

export class EncryptionService {
  private encryptionKey: Buffer;
  private algorithm: string;
  private keyVersion?: string;
  public readonly keyLength: number;

  constructor(config: EncryptionConfig) {
    this.algorithm = config.algorithm;
    this.keyVersion = config.keyVersion;

    // Validate encryption key
    if (!config.encryptionKey || config.encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }

    // Derive key from provided key (ensure 32 bytes for AES-256)
    this.encryptionKey = crypto.scryptSync(config.encryptionKey, 'salt', 32);
    this.keyLength = this.encryptionKey.length * 8; // Convert to bits

    logger.info('EncryptionService initialized', {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      keyVersion: this.keyVersion
    });
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  encrypt(data: string): EncryptedData {
    try {
      // Generate random IV (12 bytes for GCM)
      const iv = crypto.randomBytes(12);
      
      // Create cipher
      const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
      cipher.setAutoPadding(true);

      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      const result: EncryptedData = {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm,
      };

      if (this.keyVersion) {
        result.keyVersion = this.keyVersion;
      }

      return result;
    } catch (error) {
      logger.error('Encryption failed', { error: error.message });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt encrypted data
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      // Validate algorithm
      if (encryptedData.algorithm !== this.algorithm) {
        throw new Error('Algorithm mismatch');
      }

      // Create decipher
      const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
      
      // Set auth tag
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      // Decrypt data
      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { 
        error: error.message,
        algorithm: encryptedData.algorithm,
        keyVersion: encryptedData.keyVersion
      });
      throw new Error('Authentication failed');
    }
  }

  /**
   * Encrypt multiple fields in an object
   */
  encryptFields(data: Record<string, any>, fieldsToEncrypt: string[]): {
    encryptedData: Record<string, any>;
    encryptionMetadata: Record<string, EncryptedData>;
  } {
    const encryptedData = { ...data };
    const encryptionMetadata: Record<string, EncryptedData> = {};

    for (const field of fieldsToEncrypt) {
      if (data[field] !== undefined && data[field] !== null) {
        const fieldValue = typeof data[field] === 'string' 
          ? data[field] 
          : JSON.stringify(data[field]);
        
        const encrypted = this.encrypt(fieldValue);
        encryptionMetadata[field] = encrypted;
        
        // Replace original field with placeholder
        encryptedData[field] = '[ENCRYPTED]';
      }
    }

    return { encryptedData, encryptionMetadata };
  }

  /**
   * Decrypt multiple fields in an object
   */
  decryptFields(
    encryptedData: Record<string, any>, 
    encryptionMetadata: Record<string, EncryptedData>
  ): Record<string, any> {
    const decryptedData = { ...encryptedData };

    for (const [field, metadata] of Object.entries(encryptionMetadata)) {
      try {
        const decryptedValue = this.decrypt(metadata);
        
        // Try to parse as JSON, fallback to string
        try {
          decryptedData[field] = JSON.parse(decryptedValue);
        } catch {
          decryptedData[field] = decryptedValue;
        }
      } catch (error) {
        logger.warn('Failed to decrypt field', { field, error: error.message });
        decryptedData[field] = null;
      }
    }

    return decryptedData;
  }

  /**
   * Generate secure hash for data integrity
   */
  generateHash(data: string): string {
    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify hash integrity
   */
  verifyHash(data: string, hash: string): boolean {
    const computedHash = this.generateHash(data);
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(computedHash, 'hex')
    );
  }

  /**
   * Rotate encryption key while maintaining backwards compatibility
   */
  static async rotateKey(
    oldService: EncryptionService,
    newConfig: EncryptionConfig,
    encryptedData: EncryptedData
  ): Promise<EncryptedData> {
    // Decrypt with old service
    const decryptedData = oldService.decrypt(encryptedData);
    
    // Create new service and encrypt with new key
    const newService = new EncryptionService(newConfig);
    return newService.encrypt(decryptedData);
  }

  /**
   * Secure memory cleanup (limited in JavaScript, but attempt to clear)
   */
  destroy(): void {
    // Fill encryption key buffer with zeros
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
    }
    
    logger.info('EncryptionService destroyed');
  }
}