import { db } from '@/database/connection';
import { logger } from '@/utils/logger';
import { redis as redisClient } from '@/config/redis';
import { randomUUID, createHash } from 'crypto';

export interface BiometricTemplate {
  id: string;
  userId: string;
  templateType: 'fingerprint' | 'face' | 'voice' | 'retina';
  templateData: string; // Encrypted biometric template
  deviceId: string;
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
}

export interface BiometricChallenge {
  id: string;
  userId: string;
  challengeData: string;
  templateType: 'fingerprint' | 'face' | 'voice' | 'retina';
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

export interface BiometricVerification {
  isValid: boolean;
  templateId?: string;
  confidence?: number;
  challengeId?: string;
}

export interface BiometricSettings {
  userId: string;
  isEnabled: boolean;
  enabledMethods: string[];
  requireLiveness: boolean;
  confidenceThreshold: number;
  maxAttempts: number;
  lockoutDuration: number;
  lastUpdated: Date;
}

class BiometricService {
  async registerBiometric(
    userId: string,
    templateType: 'fingerprint' | 'face' | 'voice' | 'retina',
    templateData: string,
    deviceId: string
  ): Promise<BiometricTemplate> {
    try {
      // Hash and encrypt the template data for security
      const hashedTemplate = this.hashTemplate(templateData);
      const templateId = randomUUID();

      const query = `
        INSERT INTO biometric_templates (
          id, user_id, template_type, template_data, device_id,
          is_active, created_at
        )
        VALUES ($1, $2, $3, $4, $5, true, NOW())
        RETURNING *
      `;

      const result = await db.query(query, [
        templateId,
        userId,
        templateType,
        hashedTemplate,
        deviceId
      ]);

      // Clear cache
      await redisClient.del(`biometric:templates:${userId}`);

      return this.mapDbRowToTemplate(result.rows[0]);
    } catch (error) {
      logger.error('Error registering biometric:', error);
      throw error;
    }
  }

  async verifyBiometric(
    userId: string,
    templateType: 'fingerprint' | 'face' | 'voice' | 'retina',
    biometricData: string,
    deviceId?: string
  ): Promise<BiometricVerification> {
    try {
      // Check rate limiting
      const rateLimitCheck = await this.checkRateLimit(userId);
      if (!rateLimitCheck.isAllowed) {
        await this.recordFailedAttempt(userId);
        return { isValid: false };
      }

      // Get user's biometric templates
      const templates = await this.getActiveTemplates(userId, templateType);
      
      if (templates.length === 0) {
        return { isValid: false };
      }

      // Hash the incoming biometric data
      const hashedData = this.hashTemplate(biometricData);

      // Compare against stored templates
      for (const template of templates) {
        const confidence = this.compareTemplates(hashedData, template.templateData);
        
        if (confidence >= await this.getConfidenceThreshold(userId)) {
          // Update last used timestamp
          await db.query(
            'UPDATE biometric_templates SET last_used = NOW() WHERE id = $1',
            [template.id]
          );

          // Clear failed attempts on successful verification
          await this.clearFailedAttempts(userId);

          return {
            isValid: true,
            templateId: template.id,
            confidence
          };
        }
      }

      // Record failed attempt
      await this.recordFailedAttempt(userId);

      return { isValid: false };
    } catch (error) {
      logger.error('Error verifying biometric:', error);
      return { isValid: false };
    }
  }

  async createChallenge(
    userId: string,
    templateType: 'fingerprint' | 'face' | 'voice' | 'retina'
  ): Promise<BiometricChallenge> {
    try {
      const challengeId = randomUUID();
      const challengeData = this.generateChallengeData();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const query = `
        INSERT INTO biometric_challenges (
          id, user_id, challenge_data, template_type, expires_at,
          is_used, created_at
        )
        VALUES ($1, $2, $3, $4, $5, false, NOW())
        RETURNING *
      `;

      const result = await db.query(query, [
        challengeId,
        userId,
        challengeData,
        templateType,
        expiresAt
      ]);

      return this.mapDbRowToChallenge(result.rows[0]);
    } catch (error) {
      logger.error('Error creating biometric challenge:', error);
      throw error;
    }
  }

  async verifyChallenge(
    challengeId: string,
    biometricResponse: string
  ): Promise<BiometricVerification> {
    try {
      // Get challenge
      const challengeQuery = `
        SELECT * FROM biometric_challenges 
        WHERE id = $1 AND is_used = false AND expires_at > NOW()
      `;
      
      const challengeResult = await db.query(challengeQuery, [challengeId]);
      
      if (challengeResult.rows.length === 0) {
        return { isValid: false };
      }

      const challenge = challengeResult.rows[0];

      // Verify the response against the challenge
      const isValid = this.verifyChallengeResponse(
        challenge.challenge_data,
        biometricResponse
      );

      if (isValid) {
        // Mark challenge as used
        await db.query(
          'UPDATE biometric_challenges SET is_used = true WHERE id = $1',
          [challengeId]
        );

        return {
          isValid: true,
          challengeId
        };
      }

      return { isValid: false };
    } catch (error) {
      logger.error('Error verifying challenge:', error);
      return { isValid: false };
    }
  }

  async getTemplates(userId: string): Promise<BiometricTemplate[]> {
    try {
      // Check cache first
      const cacheKey = `biometric:templates:${userId}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const query = `
        SELECT id, user_id, template_type, device_id, is_active, last_used, created_at
        FROM biometric_templates 
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [userId]);
      const templates = result.rows.map(row => ({
        ...this.mapDbRowToTemplate(row),
        templateData: '[REDACTED]' // Don't expose actual template data
      }));

      // Cache for 5 minutes
      await redisClient.setex(cacheKey, 300, JSON.stringify(templates));

      return templates;
    } catch (error) {
      logger.error('Error getting biometric templates:', error);
      throw error;
    }
  }

  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    try {
      const result = await db.query(
        'UPDATE biometric_templates SET is_active = false WHERE id = $1 AND user_id = $2',
        [templateId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Biometric template not found');
      }

      // Clear cache
      await redisClient.del(`biometric:templates:${userId}`);
    } catch (error) {
      logger.error('Error deleting biometric template:', error);
      throw error;
    }
  }

  async getSettings(userId: string): Promise<BiometricSettings> {
    try {
      const query = `
        SELECT * FROM biometric_settings WHERE user_id = $1
      `;

      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        // Return default settings
        return {
          userId,
          isEnabled: false,
          enabledMethods: [],
          requireLiveness: true,
          confidenceThreshold: 0.8,
          maxAttempts: 3,
          lockoutDuration: 300, // 5 minutes
          lastUpdated: new Date()
        };
      }

      const row = result.rows[0];
      return {
        userId: row.user_id,
        isEnabled: row.is_enabled,
        enabledMethods: JSON.parse(row.enabled_methods || '[]'),
        requireLiveness: row.require_liveness,
        confidenceThreshold: row.confidence_threshold,
        maxAttempts: row.max_attempts,
        lockoutDuration: row.lockout_duration,
        lastUpdated: row.last_updated
      };
    } catch (error) {
      logger.error('Error getting biometric settings:', error);
      throw error;
    }
  }

  async updateSettings(userId: string, settings: Partial<BiometricSettings>): Promise<void> {
    try {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(settings).forEach(([key, value]) => {
        if (value !== undefined && key !== 'userId' && key !== 'lastUpdated') {
          if (key === 'enabledMethods') {
            updateFields.push(`enabled_methods = $${paramIndex++}`);
            values.push(JSON.stringify(value));
          } else {
            const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            updateFields.push(`${dbKey} = $${paramIndex++}`);
            values.push(value);
          }
        }
      });

      updateFields.push(`last_updated = NOW()`);
      values.push(userId);

      const query = `
        INSERT INTO biometric_settings (
          user_id, is_enabled, enabled_methods, require_liveness,
          confidence_threshold, max_attempts, lockout_duration, last_updated
        )
        VALUES ($${values.length}, $1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET ${updateFields.join(', ')}
      `;

      // Add default values for insert
      const insertValues = [
        userId,
        settings.isEnabled ?? false,
        JSON.stringify(settings.enabledMethods ?? []),
        settings.requireLiveness ?? true,
        settings.confidenceThreshold ?? 0.8,
        settings.maxAttempts ?? 3,
        settings.lockoutDuration ?? 300
      ];

      await db.query(query, [...insertValues, ...values]);
    } catch (error) {
      logger.error('Error updating biometric settings:', error);
      throw error;
    }
  }

  private async getActiveTemplates(
    userId: string,
    templateType: 'fingerprint' | 'face' | 'voice' | 'retina'
  ): Promise<BiometricTemplate[]> {
    try {
      const query = `
        SELECT * FROM biometric_templates 
        WHERE user_id = $1 AND template_type = $2 AND is_active = true
      `;

      const result = await db.query(query, [userId, templateType]);
      return result.rows.map(row => this.mapDbRowToTemplate(row));
    } catch (error) {
      logger.error('Error getting active templates:', error);
      return [];
    }
  }

  private async getConfidenceThreshold(userId: string): Promise<number> {
    try {
      const settings = await this.getSettings(userId);
      return settings.confidenceThreshold;
    } catch (error) {
      return 0.8; // Default threshold
    }
  }

  private async checkRateLimit(userId: string): Promise<{ isAllowed: boolean; remainingAttempts: number }> {
    try {
      const settings = await this.getSettings(userId);
      const key = `biometric:attempts:${userId}`;
      
      const currentAttempts = await redisClient.get(key);
      const attempts = currentAttempts ? parseInt(currentAttempts) : 0;

      if (attempts >= settings.maxAttempts) {
        return { isAllowed: false, remainingAttempts: 0 };
      }

      return { isAllowed: true, remainingAttempts: settings.maxAttempts - attempts };
    } catch (error) {
      logger.error('Error checking biometric rate limit:', error);
      return { isAllowed: true, remainingAttempts: 3 };
    }
  }

  private async recordFailedAttempt(userId: string): Promise<void> {
    try {
      const settings = await this.getSettings(userId);
      const key = `biometric:attempts:${userId}`;

      const multi = redisClient.multi();
      multi.incr(key);
      multi.expire(key, settings.lockoutDuration);
      await multi.exec();
    } catch (error) {
      logger.error('Error recording failed biometric attempt:', error);
    }
  }

  private async clearFailedAttempts(userId: string): Promise<void> {
    try {
      const key = `biometric:attempts:${userId}`;
      await redisClient.del(key);
    } catch (error) {
      logger.error('Error clearing failed biometric attempts:', error);
    }
  }

  private hashTemplate(templateData: string): string {
    // In a real implementation, you would use more sophisticated
    // biometric template hashing and encryption
    return createHash('sha256').update(templateData).digest('hex');
  }

  private compareTemplates(template1: string, template2: string): number {
    // Simplified comparison - in reality, you'd use biometric matching algorithms
    // that return a confidence score between 0 and 1
    
    if (template1 === template2) {
      return 1.0; // Perfect match
    }

    // Simple similarity calculation based on string comparison
    let matches = 0;
    const minLength = Math.min(template1.length, template2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (template1[i] === template2[i]) {
        matches++;
      }
    }

    return matches / Math.max(template1.length, template2.length);
  }

  private generateChallengeData(): string {
    // Generate a random challenge string
    return randomUUID();
  }

  private verifyChallengeResponse(challengeData: string, response: string): boolean {
    // Simplified challenge verification
    // In reality, this would involve complex biometric liveness detection
    return createHash('sha256').update(challengeData + response).digest('hex').length > 0;
  }

  private mapDbRowToTemplate(row: any): BiometricTemplate {
    return {
      id: row.id,
      userId: row.user_id,
      templateType: row.template_type,
      templateData: row.template_data,
      deviceId: row.device_id,
      isActive: row.is_active,
      lastUsed: row.last_used,
      createdAt: row.created_at
    };
  }

  private mapDbRowToChallenge(row: any): BiometricChallenge {
    return {
      id: row.id,
      userId: row.user_id,
      challengeData: row.challenge_data,
      templateType: row.template_type,
      expiresAt: row.expires_at,
      isUsed: row.is_used,
      createdAt: row.created_at
    };
  }
}

export const biometricService = new BiometricService();

// Export individual functions for controllers
export const registerBiometric = biometricService.registerBiometric.bind(biometricService);
export const verifyBiometric = biometricService.verifyBiometric.bind(biometricService);
export const createChallenge = biometricService.createChallenge.bind(biometricService);
export const verifyChallenge = biometricService.verifyChallenge.bind(biometricService);
export const getTemplates = biometricService.getTemplates.bind(biometricService);
export const deleteTemplate = biometricService.deleteTemplate.bind(biometricService);
export const getSettings = biometricService.getSettings.bind(biometricService);
export const updateSettings = biometricService.updateSettings.bind(biometricService);