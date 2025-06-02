import { FastifyRequest, FastifyReply } from 'fastify';
import { securityService } from '@/services/security';
import { twoFactorService } from '@/services/two-factor';
import { biometricService } from '@/services/biometric';
import { sessionService } from '@/services/session';
import { auditService } from '@/services/audit';
import { notificationService } from '@/services/notifications';
import { logger } from '@/utils/logger';

export const securityController = {
  // Two-Factor Authentication
  async getTwoFactorStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;
      const status = await twoFactorService.getStatus((user as any).id);

      return reply.send({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting 2FA status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get 2FA status'
      });
    }
  },

  async setupTwoFactor(
    request: FastifyRequest<{ 
      Body: { method: string; phoneNumber?: string; email?: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { method, phoneNumber, email } = request.body;

      const setup = await twoFactorService.setup({
        userId: (user as any).id,
        method,
        phoneNumber,
        email
      });

      // Log the 2FA setup attempt
      await auditService.logAction({
        userId: (user as any).id,
        action: '2fa_setup_initiated',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: { method },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: setup
      });
    } catch (error) {
      logger.error('Error setting up 2FA:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to setup 2FA'
      });
    }
  },

  async verifyTwoFactor(
    request: FastifyRequest<{ 
      Body: { token: string; method: string; setupMode?: boolean }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { token, method, setupMode } = request.body;

      const verification = await twoFactorService.verify({
        userId: (user as any).id,
        token,
        method,
        setupMode
      });

      if (verification.success) {
        // Log successful verification
        await auditService.logAction({
          userId: (user as any).id,
          action: setupMode ? '2fa_setup_completed' : '2fa_verified',
          resourceType: 'user',
          resourceId: (user as any).id,
          details: { method },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent']
        });

        if (setupMode) {
          // Send confirmation notification
          await notificationService.send2FASetupConfirmation((user as any).id, method);
        }
      } else {
        // Log failed verification
        await auditService.logAction({
          userId: (user as any).id,
          action: '2fa_verification_failed',
          resourceType: 'user',
          resourceId: (user as any).id,
          details: { method, reason: verification.error },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent']
        });
      }

      return reply.send({
        success: verification.success,
        data: verification.data,
        error: verification.error
      });
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to verify 2FA'
      });
    }
  },

  async disableTwoFactor(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      await twoFactorService.disable((user as any).id);

      // Log 2FA disable
      await auditService.logAction({
        userId: (user as any).id,
        action: '2fa_disabled',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: {},
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      // Send security alert
      await notificationService.sendSecurityAlert({
        userId: (user as any).id,
        alertType: '2fa_disabled',
        severity: 'medium',
        details: {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent']
        }
      });

      return reply.send({
        success: true,
        message: '2FA has been disabled'
      });
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to disable 2FA'
      });
    }
  },

  async generateBackupCodes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const backupCodes = await twoFactorService.generateBackupCodes((user as any).id);

      // Log backup code generation
      await auditService.logAction({
        userId: (user as any).id,
        action: '2fa_backup_codes_generated',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: { codeCount: backupCodes.length },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: { backupCodes }
      });
    } catch (error) {
      logger.error('Error generating backup codes:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate backup codes'
      });
    }
  },

  async getBackupCodes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const backupCodes = await twoFactorService.getBackupCodes((user as any).id);

      return reply.send({
        success: true,
        data: { backupCodes }
      });
    } catch (error) {
      logger.error('Error getting backup codes:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get backup codes'
      });
    }
  },

  // Biometric Authentication
  async getBiometricStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;
      const status = await biometricService.getStatus((user as any).id);

      return reply.send({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting biometric status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get biometric status'
      });
    }
  },

  async setupBiometric(
    request: FastifyRequest<{ 
      Body: {
        publicKey: string;
        credentialId: string;
        deviceInfo: {
          platform: string;
          deviceName: string;
          biometricType: string;
        };
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { publicKey, credentialId, deviceInfo } = request.body;

      const setup = await biometricService.setup({
        userId: (user as any).id,
        publicKey,
        credentialId,
        deviceInfo
      });

      // Log biometric setup
      await auditService.logAction({
        userId: (user as any).id,
        action: 'biometric_setup',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: { 
          deviceInfo,
          credentialId: credentialId.substring(0, 8) + '...' // Log partial ID for security
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: setup
      });
    } catch (error) {
      logger.error('Error setting up biometric:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to setup biometric authentication'
      });
    }
  },

  async verifyBiometric(
    request: FastifyRequest<{ 
      Body: { credentialId: string; signature: string; challenge: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { credentialId, signature, challenge } = request.body;

      const verification = await biometricService.verify({
        userId: (user as any).id,
        credentialId,
        signature,
        challenge
      });

      // Log verification attempt
      await auditService.logAction({
        userId: (user as any).id,
        action: verification.success ? 'biometric_verified' : 'biometric_verification_failed',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: {
          credentialId: credentialId.substring(0, 8) + '...',
          success: verification.success
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: verification.success,
        data: verification.data,
        error: verification.error
      });
    } catch (error) {
      logger.error('Error verifying biometric:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to verify biometric authentication'
      });
    }
  },

  async getBiometricDevices(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;
      const devices = await biometricService.getDevices((user as any).id);

      return reply.send({
        success: true,
        data: devices
      });
    } catch (error) {
      logger.error('Error getting biometric devices:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get biometric devices'
      });
    }
  },

  async removeBiometricDevice(
    request: FastifyRequest<{ Params: { deviceId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { deviceId } = request.params;

      await biometricService.removeDevice((user as any).id, deviceId);

      // Log device removal
      await auditService.logAction({
        userId: (user as any).id,
        action: 'biometric_device_removed',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: { deviceId },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        message: 'Biometric device removed successfully'
      });
    } catch (error) {
      logger.error('Error removing biometric device:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to remove biometric device'
      });
    }
  },

  // Session Management
  async getSessions(
    request: FastifyRequest<{ 
      Querystring: { active?: boolean; page?: number; limit?: number }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { active, page = 1, limit = 20 } = request.query;

      const sessions = await sessionService.getUserSessions({
        userId: (user as any).id,
        active,
        page,
        limit
      });

      return reply.send({
        success: true,
        data: sessions.data,
        pagination: {
          page,
          limit,
          total: sessions.total,
          totalPages: Math.ceil(sessions.total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting sessions:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get sessions'
      });
    }
  },

  async revokeSession(
    request: FastifyRequest<{ Params: { sessionId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { sessionId } = request.params;

      await sessionService.revokeSession((user as any).id, sessionId);

      // Log session revocation
      await auditService.logAction({
        userId: (user as any).id,
        action: 'session_revoked',
        resourceType: 'session',
        resourceId: sessionId,
        details: {},
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        message: 'Session revoked successfully'
      });
    } catch (error) {
      logger.error('Error revoking session:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to revoke session'
      });
    }
  },

  async revokeAllSessions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const revokedCount = await sessionService.revokeAllSessions((user as any).id);

      // Log session revocation
      await auditService.logAction({
        userId: (user as any).id,
        action: 'all_sessions_revoked',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: { revokedCount },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        message: `${revokedCount} sessions revoked successfully`
      });
    } catch (error) {
      logger.error('Error revoking all sessions:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to revoke sessions'
      });
    }
  },

  // Security Events
  async getSecurityEvents(
    request: FastifyRequest<{ 
      Querystring: {
        eventType?: string;
        severity?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { page = 1, limit = 20, ...filters } = request.query;

      const events = await securityService.getSecurityEvents({
        userId: (user as any).id,
        page,
        limit,
        ...filters
      });

      return reply.send({
        success: true,
        data: events.data,
        pagination: {
          page,
          limit,
          total: events.total,
          totalPages: Math.ceil(events.total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting security events:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get security events'
      });
    }
  },

  async getSecurityEventDetails(
    request: FastifyRequest<{ Params: { eventId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { eventId } = request.params;

      const event = await securityService.getSecurityEventDetails((user as any).id, eventId);

      if (!event) {
        return reply.status(404).send({
          success: false,
          error: 'Security event not found'
        });
      }

      return reply.send({
        success: true,
        data: event
      });
    } catch (error) {
      logger.error('Error getting security event details:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get security event details'
      });
    }
  },

  // Password Security
  async changePassword(
    request: FastifyRequest<{ 
      Body: { 
        currentPassword: string; 
        newPassword: string; 
        twoFactorToken?: string 
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { currentPassword, newPassword, twoFactorToken } = request.body;

      const result = await securityService.changePassword({
        userId: (user as any).id,
        currentPassword,
        newPassword,
        twoFactorToken
      });

      if (result.success) {
        // Log password change
        await auditService.logAction({
          userId: (user as any).id,
          action: 'password_changed',
          resourceType: 'user',
          resourceId: (user as any).id,
          details: {},
          ipAddress: request.ip,
          userAgent: request.headers['user-agent']
        });

        // Send security notification
        await notificationService.sendSecurityAlert({
          userId: (user as any).id,
          alertType: 'password_changed',
          severity: 'medium',
          details: {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent']
          }
        });
      }

      return reply.send({
        success: result.success,
        error: result.error
      });
    } catch (error) {
      logger.error('Error changing password:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to change password'
      });
    }
  },

  async checkPasswordStrength(
    request: FastifyRequest<{ Querystring: { password: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { password } = request.query;

      const strength = securityService.checkPasswordStrength(password);

      return reply.send({
        success: true,
        data: strength
      });
    } catch (error) {
      logger.error('Error checking password strength:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check password strength'
      });
    }
  },

  // Security Settings
  async getSecuritySettings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const settings = await securityService.getSecuritySettings((user as any).id);

      return reply.send({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('Error getting security settings:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get security settings'
      });
    }
  },

  async updateSecuritySettings(
    request: FastifyRequest<{ 
      Body: {
        requireTwoFactor?: boolean;
        sessionTimeout?: number;
        allowBiometric?: boolean;
        loginNotifications?: boolean;
        suspiciousActivityAlerts?: boolean;
        dataExportRequireConfirmation?: boolean;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const settings = request.body;

      const updatedSettings = await securityService.updateSecuritySettings(
        (user as any).id,
        settings
      );

      // Log settings change
      await auditService.logAction({
        userId: (user as any).id,
        action: 'security_settings_updated',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: settings,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: updatedSettings
      });
    } catch (error) {
      logger.error('Error updating security settings:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update security settings'
      });
    }
  },

  // Account Recovery
  async setupAccountRecovery(
    request: FastifyRequest<{ 
      Body: {
        recoveryEmail?: string;
        recoveryPhone?: string;
        securityQuestions?: Array<{ question: string; answer: string }>;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { recoveryEmail, recoveryPhone, securityQuestions } = request.body;

      const recovery = await securityService.setupAccountRecovery({
        userId: (user as any).id,
        recoveryEmail,
        recoveryPhone,
        securityQuestions
      });

      // Log recovery setup
      await auditService.logAction({
        userId: (user as any).id,
        action: 'account_recovery_setup',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: {
          recoveryEmail: !!recoveryEmail,
          recoveryPhone: !!recoveryPhone,
          securityQuestionsCount: securityQuestions?.length || 0
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: recovery
      });
    } catch (error) {
      logger.error('Error setting up account recovery:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to setup account recovery'
      });
    }
  },

  async getRecoveryOptions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const options = await securityService.getRecoveryOptions((user as any).id);

      return reply.send({
        success: true,
        data: options
      });
    } catch (error) {
      logger.error('Error getting recovery options:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get recovery options'
      });
    }
  },

  // Risk Assessment
  async getRiskAssessment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const assessment = await securityService.getRiskAssessment({
        userId: (user as any).id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: assessment
      });
    } catch (error) {
      logger.error('Error getting risk assessment:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get risk assessment'
      });
    }
  },

  // Trusted Devices
  async addTrustedDevice(
    request: FastifyRequest<{ 
      Body: { 
        deviceFingerprint: string; 
        deviceName: string; 
        trustLevel?: string 
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { deviceFingerprint, deviceName, trustLevel = 'partial' } = request.body;

      const device = await securityService.addTrustedDevice({
        userId: (user as any).id,
        deviceFingerprint,
        deviceName,
        trustLevel,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      // Log trusted device addition
      await auditService.logAction({
        userId: (user as any).id,
        action: 'trusted_device_added',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: { deviceName, trustLevel },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: device
      });
    } catch (error) {
      logger.error('Error adding trusted device:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to add trusted device'
      });
    }
  },

  async getTrustedDevices(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const devices = await securityService.getTrustedDevices((user as any).id);

      return reply.send({
        success: true,
        data: devices
      });
    } catch (error) {
      logger.error('Error getting trusted devices:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get trusted devices'
      });
    }
  },

  async removeTrustedDevice(
    request: FastifyRequest<{ Params: { deviceId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { deviceId } = request.params;

      await securityService.removeTrustedDevice((user as any).id, deviceId);

      // Log trusted device removal
      await auditService.logAction({
        userId: (user as any).id,
        action: 'trusted_device_removed',
        resourceType: 'user',
        resourceId: (user as any).id,
        details: { deviceId },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        message: 'Trusted device removed successfully'
      });
    } catch (error) {
      logger.error('Error removing trusted device:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to remove trusted device'
      });
    }
  }
};