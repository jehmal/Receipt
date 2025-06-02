import { db } from '@/database/connection';
import { logger } from '@/utils/logger';
import { redis as redisClient } from '@/config/redis';
import { randomUUID, randomBytes } from 'crypto';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

export interface TwoFactorSecret {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorSetup {
  userId: string;
  secret: string;
  backupCodes: string[];
  isEnabled: boolean;
  verifiedAt?: Date;
  createdAt: Date;
}

export interface TwoFactorVerification {
  isValid: boolean;
  isBackupCode?: boolean;
  remainingBackupCodes?: number;
}

class TwoFactorService {
  async generateSecret(userId: string, email: string): Promise<TwoFactorSecret> {
    try {
      const secret = speakeasy.generateSecret({
        name: `Receipt Vault (${email})`,
        issuer: 'Receipt Vault',
        length: 20
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Store temporary secret in Redis (expires in 10 minutes)
      const tempKey = `2fa:temp:${userId}`;
      await redisClient.setex(tempKey, 600, JSON.stringify({
        secret: secret.base32,
        backupCodes
      }));

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

      return {
        secret: secret.base32!,
        qrCodeUrl,
        backupCodes
      };
    } catch (error) {
      logger.error('Error generating 2FA secret:', error);
      throw error;
    }
  }

  async enableTwoFactor(userId: string, token: string): Promise<{ success: boolean; backupCodes?: string[] }> {
    try {
      // Get temporary secret from Redis
      const tempKey = `2fa:temp:${userId}`;
      const tempData = await redisClient.get(tempKey);
      
      if (!tempData) {
        throw new Error('2FA setup session expired. Please start over.');
      }

      const { secret, backupCodes } = JSON.parse(tempData);

      // Verify the token
      const isValid = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (!isValid) {
        throw new Error('Invalid verification code');
      }

      // Save to database
      await db.query(
        `INSERT INTO user_two_factor (
          user_id, secret, backup_codes, is_enabled, verified_at, created_at
        ) VALUES ($1, $2, $3, true, NOW(), NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          secret = $2, 
          backup_codes = $3, 
          is_enabled = true, 
          verified_at = NOW(), 
          updated_at = NOW()`,
        [userId, secret, JSON.stringify(backupCodes)]
      );

      // Remove temporary data
      await redisClient.del(tempKey);

      // Clear user cache
      await redisClient.del(`user:2fa:${userId}`);

      return {
        success: true,
        backupCodes
      };
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      throw error;
    }
  }

  async disableTwoFactor(userId: string, token?: string, backupCode?: string): Promise<void> {
    try {
      // Verify user can disable 2FA
      if (token) {
        const isValid = await this.verifyToken(userId, token);
        if (!isValid.isValid) {
          throw new Error('Invalid verification code');
        }
      } else if (backupCode) {
        const isValid = await this.verifyBackupCode(userId, backupCode);
        if (!isValid.isValid) {
          throw new Error('Invalid backup code');
        }
      } else {
        throw new Error('Either token or backup code is required to disable 2FA');
      }

      // Disable in database
      await db.query(
        'UPDATE user_two_factor SET is_enabled = false, updated_at = NOW() WHERE user_id = $1',
        [userId]
      );

      // Clear cache
      await redisClient.del(`user:2fa:${userId}`);
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw error;
    }
  }

  async verifyToken(userId: string, token: string): Promise<TwoFactorVerification> {
    try {
      const twoFactorData = await this.getTwoFactorData(userId);
      
      if (!twoFactorData || !twoFactorData.isEnabled) {
        return { isValid: false };
      }

      const isValid = speakeasy.totp.verify({
        secret: twoFactorData.secret,
        encoding: 'base32',
        token,
        window: 2
      });

      return { isValid };
    } catch (error) {
      logger.error('Error verifying 2FA token:', error);
      return { isValid: false };
    }
  }

  async verifyBackupCode(userId: string, backupCode: string): Promise<TwoFactorVerification> {
    try {
      const twoFactorData = await this.getTwoFactorData(userId);
      
      if (!twoFactorData || !twoFactorData.isEnabled) {
        return { isValid: false };
      }

      const backupCodes = twoFactorData.backupCodes;
      const codeIndex = backupCodes.indexOf(backupCode);
      
      if (codeIndex === -1) {
        return { isValid: false };
      }

      // Remove used backup code
      backupCodes.splice(codeIndex, 1);
      
      await db.query(
        'UPDATE user_two_factor SET backup_codes = $1, updated_at = NOW() WHERE user_id = $2',
        [JSON.stringify(backupCodes), userId]
      );

      // Clear cache
      await redisClient.del(`user:2fa:${userId}`);

      return {
        isValid: true,
        isBackupCode: true,
        remainingBackupCodes: backupCodes.length
      };
    } catch (error) {
      logger.error('Error verifying backup code:', error);
      return { isValid: false };
    }
  }

  async getTwoFactorStatus(userId: string): Promise<{ 
    isEnabled: boolean; 
    hasBackupCodes: boolean; 
    backupCodesCount: number;
    verifiedAt?: Date;
  }> {
    try {
      const twoFactorData = await this.getTwoFactorData(userId);
      
      if (!twoFactorData) {
        return {
          isEnabled: false,
          hasBackupCodes: false,
          backupCodesCount: 0
        };
      }

      return {
        isEnabled: twoFactorData.isEnabled,
        hasBackupCodes: twoFactorData.backupCodes.length > 0,
        backupCodesCount: twoFactorData.backupCodes.length,
        verifiedAt: twoFactorData.verifiedAt
      };
    } catch (error) {
      logger.error('Error getting 2FA status:', error);
      return {
        isEnabled: false,
        hasBackupCodes: false,
        backupCodesCount: 0
      };
    }
  }

  async regenerateBackupCodes(userId: string, token?: string, backupCode?: string): Promise<string[]> {
    try {
      // Verify user can regenerate backup codes
      if (token) {
        const isValid = await this.verifyToken(userId, token);
        if (!isValid.isValid) {
          throw new Error('Invalid verification code');
        }
      } else if (backupCode) {
        const isValid = await this.verifyBackupCode(userId, backupCode);
        if (!isValid.isValid) {
          throw new Error('Invalid backup code');
        }
      } else {
        throw new Error('Either token or backup code is required to regenerate backup codes');
      }

      // Generate new backup codes
      const newBackupCodes = this.generateBackupCodes();

      // Update in database
      await db.query(
        'UPDATE user_two_factor SET backup_codes = $1, updated_at = NOW() WHERE user_id = $2',
        [JSON.stringify(newBackupCodes), userId]
      );

      // Clear cache
      await redisClient.del(`user:2fa:${userId}`);

      return newBackupCodes;
    } catch (error) {
      logger.error('Error regenerating backup codes:', error);
      throw error;
    }
  }

  async checkRateLimit(userId: string): Promise<{ isAllowed: boolean; remainingAttempts: number }> {
    try {
      const key = `2fa:attempts:${userId}`;
      const maxAttempts = 5;
      const windowSeconds = 300; // 5 minutes

      const currentAttempts = await redisClient.get(key);
      const attempts = currentAttempts ? parseInt(currentAttempts) : 0;

      if (attempts >= maxAttempts) {
        return { isAllowed: false, remainingAttempts: 0 };
      }

      return { isAllowed: true, remainingAttempts: maxAttempts - attempts };
    } catch (error) {
      logger.error('Error checking 2FA rate limit:', error);
      return { isAllowed: true, remainingAttempts: 5 };
    }
  }

  async recordFailedAttempt(userId: string): Promise<void> {
    try {
      const key = `2fa:attempts:${userId}`;
      const windowSeconds = 300; // 5 minutes

      const multi = redisClient.multi();
      multi.incr(key);
      multi.expire(key, windowSeconds);
      await multi.exec();
    } catch (error) {
      logger.error('Error recording failed 2FA attempt:', error);
    }
  }

  async clearFailedAttempts(userId: string): Promise<void> {
    try {
      const key = `2fa:attempts:${userId}`;
      await redisClient.del(key);
    } catch (error) {
      logger.error('Error clearing failed 2FA attempts:', error);
    }
  }

  private async getTwoFactorData(userId: string): Promise<TwoFactorSetup | null> {
    try {
      // Check cache first
      const cacheKey = `user:2fa:${userId}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const result = await db.query(
        'SELECT * FROM user_two_factor WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const twoFactorData: TwoFactorSetup = {
        userId: row.user_id,
        secret: row.secret,
        backupCodes: JSON.parse(row.backup_codes || '[]'),
        isEnabled: row.is_enabled,
        verifiedAt: row.verified_at,
        createdAt: row.created_at
      };

      // Cache for 5 minutes
      await redisClient.setex(cacheKey, 300, JSON.stringify(twoFactorData));

      return twoFactorData;
    } catch (error) {
      logger.error('Error getting 2FA data:', error);
      return null;
    }
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      // Generate 8-character alphanumeric codes
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  // Additional methods for security controller
  async getStatus(userId: string): Promise<any> {
    try {
      const twoFactorData = await this.getTwoFactorData(userId);
      return {
        isEnabled: !!twoFactorData?.isEnabled,
        isVerified: !!twoFactorData?.verifiedAt,
        hasBackupCodes: twoFactorData?.backupCodes?.length > 0
      };
    } catch (error) {
      logger.error('Error getting 2FA status:', error);
      return {
        isEnabled: false,
        isVerified: false,
        hasBackupCodes: false
      };
    }
  }

  async setup(userId: string): Promise<any> {
    try {
      const secret = await this.generateSecret(userId);
      return secret;
    } catch (error) {
      logger.error('Error setting up 2FA:', error);
      throw error;
    }
  }

  async verify(userId: string, token: string): Promise<any> {
    try {
      const result = await this.verifyToken(userId, token);
      return { 
        isValid: result.isValid,
        message: result.isValid ? 'Token verified' : 'Invalid token'
      };
    } catch (error) {
      logger.error('Error verifying 2FA token:', error);
      throw error;
    }
  }

  async disable(userId: string): Promise<void> {
    try {
      await this.disableTwoFactor(userId);
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw error;
    }
  }

  async getBackupCodes(userId: string): Promise<string[]> {
    try {
      const twoFactorData = await this.getTwoFactorData(userId);
      return twoFactorData?.backupCodes || [];
    } catch (error) {
      logger.error('Error getting backup codes:', error);
      return [];
    }
  }
}

export const twoFactorService = new TwoFactorService();

// Export individual functions for controllers
export const generateSecret = twoFactorService.generateSecret.bind(twoFactorService);
export const enableTwoFactor = twoFactorService.enableTwoFactor.bind(twoFactorService);
export const disableTwoFactor = twoFactorService.disableTwoFactor.bind(twoFactorService);
export const verifyToken = twoFactorService.verifyToken.bind(twoFactorService);
export const verifyBackupCode = twoFactorService.verifyBackupCode.bind(twoFactorService);
export const getTwoFactorStatus = twoFactorService.getTwoFactorStatus.bind(twoFactorService);
export const regenerateBackupCodes = twoFactorService.regenerateBackupCodes.bind(twoFactorService);
export const checkRateLimit = twoFactorService.checkRateLimit.bind(twoFactorService);
export const recordFailedAttempt = twoFactorService.recordFailedAttempt.bind(twoFactorService);
export const clearFailedAttempts = twoFactorService.clearFailedAttempts.bind(twoFactorService);