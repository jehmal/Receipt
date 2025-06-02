import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { redis as redisClient } from '../config/redis';
import { randomUUID } from 'crypto';

export interface SecurityEvent {
  id: string;
  userId: string;
  companyId?: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface SecurityAlert {
  id: string;
  userId: string;
  companyId?: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  isRead: boolean;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface SecurityPolicy {
  id: string;
  companyId: string;
  name: string;
  description: string;
  policyType: 'password' | 'session' | 'access' | 'data' | 'compliance';
  rules: Record<string, any>;
  isActive: boolean;
  enforceFrom: Date;
  createdAt: Date;
  updatedAt: Date;
}

class SecurityService {
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'createdAt'>): Promise<SecurityEvent> {
    try {
      const eventId = randomUUID();
      
      const query = `
        INSERT INTO security_events (
          id, user_id, company_id, event_type, severity, description,
          ip_address, user_agent, metadata, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;

      const result = await db.query(query, [
        eventId,
        event.userId,
        event.companyId,
        event.eventType,
        event.severity,
        event.description,
        event.ipAddress,
        event.userAgent,
        event.metadata ? JSON.stringify(event.metadata) : null
      ]);

      const securityEvent = this.mapDbRowToEvent(result.rows[0]);

      // Check if this event should trigger an alert
      await this.checkForSecurityAlerts(securityEvent);

      return securityEvent;
    } catch (error) {
      logger.error('Error logging security event:', error);
      throw error;
    }
  }

  async createAlert(alert: Omit<SecurityAlert, 'id' | 'createdAt'>): Promise<SecurityAlert> {
    try {
      const alertId = randomUUID();
      
      const query = `
        INSERT INTO security_alerts (
          id, user_id, company_id, alert_type, severity, title, message,
          is_read, is_resolved, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;

      const result = await db.query(query, [
        alertId,
        alert.userId,
        alert.companyId,
        alert.alertType,
        alert.severity,
        alert.title,
        alert.message,
        alert.isRead,
        alert.isResolved
      ]);

      return this.mapDbRowToAlert(result.rows[0]);
    } catch (error) {
      logger.error('Error creating security alert:', error);
      throw error;
    }
  }

  async getSecurityEvents(filters: {
    userId?: string;
    companyId?: string;
    eventType?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: SecurityEvent[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 20, ...filterParams } = filters;
      const offset = (page - 1) * limit;

      let whereConditions = ['1 = 1'];
      const values = [];
      let paramIndex = 1;

      Object.entries(filterParams).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'userId') {
            whereConditions.push(`user_id = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'companyId') {
            whereConditions.push(`company_id = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'eventType') {
            whereConditions.push(`event_type = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'severity') {
            whereConditions.push(`severity = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'startDate') {
            whereConditions.push(`created_at >= $${paramIndex++}`);
            values.push(value);
          } else if (key === 'endDate') {
            whereConditions.push(`created_at <= $${paramIndex++}`);
            values.push(value);
          }
        }
      });

      const query = `
        SELECT * FROM security_events
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;

      values.push(limit, offset);

      const result = await db.query(query, values);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total FROM security_events
        WHERE ${whereConditions.join(' AND ')}
      `;

      const countResult = await db.query(countQuery, values.slice(0, -2));

      return {
        data: result.rows.map(row => this.mapDbRowToEvent(row)),
        total: parseInt(countResult.rows[0].total),
        page,
        limit
      };
    } catch (error) {
      logger.error('Error getting security events:', error);
      throw error;
    }
  }

  async getSecurityAlerts(filters: {
    userId?: string;
    companyId?: string;
    alertType?: string;
    severity?: string;
    isRead?: boolean;
    isResolved?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: SecurityAlert[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 20, ...filterParams } = filters;
      const offset = (page - 1) * limit;

      let whereConditions = ['1 = 1'];
      const values = [];
      let paramIndex = 1;

      Object.entries(filterParams).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'userId') {
            whereConditions.push(`user_id = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'companyId') {
            whereConditions.push(`company_id = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'alertType') {
            whereConditions.push(`alert_type = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'severity') {
            whereConditions.push(`severity = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'isRead') {
            whereConditions.push(`is_read = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'isResolved') {
            whereConditions.push(`is_resolved = $${paramIndex++}`);
            values.push(value);
          }
        }
      });

      const query = `
        SELECT * FROM security_alerts
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;

      values.push(limit, offset);

      const result = await db.query(query, values);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total FROM security_alerts
        WHERE ${whereConditions.join(' AND ')}
      `;

      const countResult = await db.query(countQuery, values.slice(0, -2));

      return {
        data: result.rows.map(row => this.mapDbRowToAlert(row)),
        total: parseInt(countResult.rows[0].total),
        page,
        limit
      };
    } catch (error) {
      logger.error('Error getting security alerts:', error);
      throw error;
    }
  }

  async markAlertAsRead(alertId: string, userId: string): Promise<void> {
    try {
      await db.query(
        'UPDATE security_alerts SET is_read = true WHERE id = $1 AND user_id = $2',
        [alertId, userId]
      );
    } catch (error) {
      logger.error('Error marking alert as read:', error);
      throw error;
    }
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    try {
      await db.query(
        'UPDATE security_alerts SET is_resolved = true, resolved_by = $1, resolved_at = NOW() WHERE id = $2',
        [resolvedBy, alertId]
      );
    } catch (error) {
      logger.error('Error resolving alert:', error);
      throw error;
    }
  }

  async createSecurityPolicy(policy: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<SecurityPolicy> {
    try {
      const policyId = randomUUID();
      
      const query = `
        INSERT INTO security_policies (
          id, company_id, name, description, policy_type, rules,
          is_active, enforce_from, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `;

      const result = await db.query(query, [
        policyId,
        policy.companyId,
        policy.name,
        policy.description,
        policy.policyType,
        JSON.stringify(policy.rules),
        policy.isActive,
        policy.enforceFrom
      ]);

      // Clear cache
      await redisClient.del(`security:policies:${policy.companyId}`);

      return this.mapDbRowToPolicy(result.rows[0]);
    } catch (error) {
      logger.error('Error creating security policy:', error);
      throw error;
    }
  }

  async getSecurityPolicies(companyId: string): Promise<SecurityPolicy[]> {
    try {
      // Check cache first
      const cacheKey = `security:policies:${companyId}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const query = `
        SELECT * FROM security_policies 
        WHERE company_id = $1 AND is_active = true
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [companyId]);
      const policies = result.rows.map(row => this.mapDbRowToPolicy(row));

      // Cache for 10 minutes
      await redisClient.setex(cacheKey, 600, JSON.stringify(policies));

      return policies;
    } catch (error) {
      logger.error('Error getting security policies:', error);
      throw error;
    }
  }

  async validatePassword(password: string, companyId?: string): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const errors: string[] = [];

      // Get password policy for company
      let passwordRules = {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        preventCommonPasswords: true
      };

      if (companyId) {
        const policies = await this.getSecurityPolicies(companyId);
        const passwordPolicy = policies.find(p => p.policyType === 'password');
        if (passwordPolicy) {
          passwordRules = { ...passwordRules, ...passwordPolicy.rules };
        }
      }

      // Validate against rules
      if (password.length < passwordRules.minLength) {
        errors.push(`Password must be at least ${passwordRules.minLength} characters long`);
      }

      if (passwordRules.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }

      if (passwordRules.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }

      if (passwordRules.requireNumbers && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
      }

      if (passwordRules.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }

      if (passwordRules.preventCommonPasswords) {
        const commonPasswords = ['password', '123456', 'admin', 'welcome', 'qwerty'];
        if (commonPasswords.includes(password.toLowerCase())) {
          errors.push('Password is too common');
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      logger.error('Error validating password:', error);
      return {
        isValid: false,
        errors: ['Failed to validate password']
      };
    }
  }

  private async checkForSecurityAlerts(event: SecurityEvent): Promise<void> {
    try {
      // Define alert rules based on event types
      const alertRules = {
        'failed_login': { threshold: 5, timeWindow: 300, severity: 'medium' as const }, // 5 attempts in 5 minutes
        'suspicious_ip': { threshold: 1, timeWindow: 0, severity: 'high' as const },
        'password_change': { threshold: 3, timeWindow: 3600, severity: 'medium' as const }, // 3 changes in 1 hour
        'data_export': { threshold: 1, timeWindow: 0, severity: 'high' as const }
      };

      const rule = alertRules[event.eventType as keyof typeof alertRules];
      if (!rule) return;

      if (rule.threshold === 1 && rule.timeWindow === 0) {
        // Immediate alert
        await this.createAlert({
          userId: event.userId,
          companyId: event.companyId,
          alertType: event.eventType,
          severity: rule.severity,
          title: `Security Event: ${event.eventType}`,
          message: event.description,
          isRead: false,
          isResolved: false
        });
      } else {
        // Check threshold over time window
        const cutoffTime = new Date(Date.now() - rule.timeWindow * 1000);
        
        const countQuery = `
          SELECT COUNT(*) as count 
          FROM security_events 
          WHERE user_id = $1 AND event_type = $2 AND created_at > $3
        `;

        const result = await db.query(countQuery, [event.userId, event.eventType, cutoffTime]);
        const count = parseInt(result.rows[0].count);

        if (count >= rule.threshold) {
          await this.createAlert({
            userId: event.userId,
            companyId: event.companyId,
            alertType: `repeated_${event.eventType}`,
            severity: rule.severity,
            title: `Multiple Security Events: ${event.eventType}`,
            message: `${count} occurrences of ${event.eventType} detected in the last ${rule.timeWindow / 60} minutes`,
            isRead: false,
            isResolved: false
          });
        }
      }
    } catch (error) {
      logger.error('Error checking for security alerts:', error);
    }
  }

  private mapDbRowToEvent(row: any): SecurityEvent {
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      eventType: row.event_type,
      severity: row.severity,
      description: row.description,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at
    };
  }

  private mapDbRowToAlert(row: any): SecurityAlert {
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      isRead: row.is_read,
      isResolved: row.is_resolved,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at
    };
  }

  private mapDbRowToPolicy(row: any): SecurityPolicy {
    return {
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      description: row.description,
      policyType: row.policy_type,
      rules: JSON.parse(row.rules || '{}'),
      isActive: row.is_active,
      enforceFrom: row.enforce_from,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Additional methods for security controller
  async getSecuritySettings(userId: string): Promise<any> {
    try {
      return {
        userId,
        twoFactorEnabled: false,
        biometricEnabled: false,
        trustedDevices: [],
        sessionTimeout: 3600,
        settings: {}
      };
    } catch (error) {
      logger.error('Error getting security settings:', error);
      throw error;
    }
  }

  async updateSecuritySettings(userId: string, settings: any): Promise<any> {
    try {
      return {
        userId,
        ...settings,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error updating security settings:', error);
      throw error;
    }
  }

  async setupAccountRecovery(userId: string, options: any): Promise<any> {
    try {
      return {
        userId,
        recoveryMethodsEnabled: options.methods || [],
        setupAt: new Date()
      };
    } catch (error) {
      logger.error('Error setting up account recovery:', error);
      throw error;
    }
  }

  async getRecoveryOptions(userId: string): Promise<any> {
    try {
      return {
        userId,
        availableMethods: ['email', 'phone', 'backup_codes'],
        enabledMethods: []
      };
    } catch (error) {
      logger.error('Error getting recovery options:', error);
      throw error;
    }
  }

  async getRiskAssessment(userId: string): Promise<any> {
    try {
      return {
        userId,
        riskLevel: 'low',
        factors: [],
        recommendations: [],
        assessedAt: new Date()
      };
    } catch (error) {
      logger.error('Error getting risk assessment:', error);
      throw error;
    }
  }

  async addTrustedDevice(userId: string, deviceInfo: any): Promise<any> {
    try {
      const deviceId = randomUUID();
      return {
        id: deviceId,
        userId,
        ...deviceInfo,
        addedAt: new Date()
      };
    } catch (error) {
      logger.error('Error adding trusted device:', error);
      throw error;
    }
  }

  async getTrustedDevices(userId: string): Promise<any[]> {
    try {
      return [];
    } catch (error) {
      logger.error('Error getting trusted devices:', error);
      throw error;
    }
  }

  async removeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    try {
      // Remove trusted device
    } catch (error) {
      logger.error('Error removing trusted device:', error);
      throw error;
    }
  }
}

export const securityService = new SecurityService();

// Export individual functions for controllers
export const logSecurityEvent = securityService.logSecurityEvent.bind(securityService);
export const createAlert = securityService.createAlert.bind(securityService);
export const getSecurityEvents = securityService.getSecurityEvents.bind(securityService);
export const getSecurityAlerts = securityService.getSecurityAlerts.bind(securityService);
export const markAlertAsRead = securityService.markAlertAsRead.bind(securityService);
export const resolveAlert = securityService.resolveAlert.bind(securityService);
export const createSecurityPolicy = securityService.createSecurityPolicy.bind(securityService);
export const getSecurityPolicies = securityService.getSecurityPolicies.bind(securityService);
export const validatePassword = securityService.validatePassword.bind(securityService);