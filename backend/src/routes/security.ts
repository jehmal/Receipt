import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { securityController } from '@/controllers/security';
import { requireAuth } from '@/middleware/auth';

interface TwoFactorSetupBody {
  method: 'totp' | 'sms' | 'email';
  phoneNumber?: string;
  email?: string;
}

interface TwoFactorVerifyBody {
  token: string;
  method: 'totp' | 'sms' | 'email';
  setupMode?: boolean;
}

interface BiometricSetupBody {
  publicKey: string;
  credentialId: string;
  deviceInfo: {
    platform: string;
    deviceName: string;
    biometricType: 'fingerprint' | 'faceId' | 'touchId';
  };
}

interface SecurityEventQuery {
  eventType?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

interface SessionQuery {
  active?: boolean;
  page?: number;
  limit?: number;
}

export default async function securityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Two-Factor Authentication
  fastify.get('/2fa/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.getTwoFactorStatus(request, reply);
  });

  fastify.post('/2fa/setup', {
    schema: {
      body: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['totp', 'sms', 'email'] },
          phoneNumber: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' },
          email: { type: 'string', format: 'email' }
        },
        required: ['method']
      }
    }
  }, async (request: FastifyRequest<{ Body: TwoFactorSetupBody }>, reply: FastifyReply) => {
    return securityController.setupTwoFactor(request, reply);
  });

  fastify.post('/2fa/verify', {
    schema: {
      body: {
        type: 'object',
        properties: {
          token: { type: 'string', minLength: 6, maxLength: 8 },
          method: { type: 'string', enum: ['totp', 'sms', 'email'] },
          setupMode: { type: 'boolean' }
        },
        required: ['token', 'method']
      }
    }
  }, async (request: FastifyRequest<{ Body: TwoFactorVerifyBody }>, reply: FastifyReply) => {
    return securityController.verifyTwoFactor(request, reply);
  });

  fastify.delete('/2fa/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.disableTwoFactor(request, reply);
  });

  fastify.post('/2fa/backup-codes', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.generateBackupCodes(request, reply);
  });

  fastify.get('/2fa/backup-codes', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.getBackupCodes(request, reply);
  });

  // Biometric Authentication
  fastify.get('/biometric/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.getBiometricStatus(request, reply);
  });

  fastify.post('/biometric/setup', {
    schema: {
      body: {
        type: 'object',
        properties: {
          publicKey: { type: 'string' },
          credentialId: { type: 'string' },
          deviceInfo: {
            type: 'object',
            properties: {
              platform: { type: 'string' },
              deviceName: { type: 'string' },
              biometricType: { type: 'string', enum: ['fingerprint', 'faceId', 'touchId'] }
            },
            required: ['platform', 'deviceName', 'biometricType']
          }
        },
        required: ['publicKey', 'credentialId', 'deviceInfo']
      }
    }
  }, async (request: FastifyRequest<{ Body: BiometricSetupBody }>, reply: FastifyReply) => {
    return securityController.setupBiometric(request, reply);
  });

  fastify.post('/biometric/verify', {
    schema: {
      body: {
        type: 'object',
        properties: {
          credentialId: { type: 'string' },
          signature: { type: 'string' },
          challenge: { type: 'string' }
        },
        required: ['credentialId', 'signature', 'challenge']
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { credentialId: string; signature: string; challenge: string }
  }>, reply: FastifyReply) => {
    return securityController.verifyBiometric(request, reply);
  });

  fastify.get('/biometric/devices', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.getBiometricDevices(request, reply);
  });

  fastify.delete('/biometric/devices/:deviceId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', format: 'uuid' }
        },
        required: ['deviceId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    return securityController.removeBiometricDevice(request, reply);
  });

  // Session Management
  fastify.get('/sessions', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          active: { type: 'boolean' },
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: SessionQuery }>, reply: FastifyReply) => {
    return securityController.getSessions(request, reply);
  });

  fastify.delete('/sessions/:sessionId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    return securityController.revokeSession(request, reply);
  });

  fastify.delete('/sessions/all', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.revokeAllSessions(request, reply);
  });

  // Security Events and Audit Log
  fastify.get('/events', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          eventType: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: SecurityEventQuery }>, reply: FastifyReply) => {
    return securityController.getSecurityEvents(request, reply);
  });

  fastify.get('/events/:eventId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          eventId: { type: 'string', format: 'uuid' }
        },
        required: ['eventId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { eventId: string } }>, reply: FastifyReply) => {
    return securityController.getSecurityEventDetails(request, reply);
  });

  // Password Security
  fastify.post('/password/change', {
    schema: {
      body: {
        type: 'object',
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
          twoFactorToken: { type: 'string' }
        },
        required: ['currentPassword', 'newPassword']
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { 
      currentPassword: string; 
      newPassword: string; 
      twoFactorToken?: string 
    }
  }>, reply: FastifyReply) => {
    return securityController.changePassword(request, reply);
  });

  fastify.get('/password/strength', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          password: { type: 'string' }
        },
        required: ['password']
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { password: string } }>, reply: FastifyReply) => {
    return securityController.checkPasswordStrength(request, reply);
  });

  // Account Security Settings
  fastify.get('/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.getSecuritySettings(request, reply);
  });

  fastify.put('/settings', {
    schema: {
      body: {
        type: 'object',
        properties: {
          requireTwoFactor: { type: 'boolean' },
          sessionTimeout: { type: 'number', minimum: 300, maximum: 86400 }, // 5 minutes to 24 hours
          allowBiometric: { type: 'boolean' },
          loginNotifications: { type: 'boolean' },
          suspiciousActivityAlerts: { type: 'boolean' },
          dataExportRequireConfirmation: { type: 'boolean' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: {
      requireTwoFactor?: boolean;
      sessionTimeout?: number;
      allowBiometric?: boolean;
      loginNotifications?: boolean;
      suspiciousActivityAlerts?: boolean;
      dataExportRequireConfirmation?: boolean;
    }
  }>, reply: FastifyReply) => {
    return securityController.updateSecuritySettings(request, reply);
  });

  // Account Recovery
  fastify.post('/recovery/setup', {
    schema: {
      body: {
        type: 'object',
        properties: {
          recoveryEmail: { type: 'string', format: 'email' },
          recoveryPhone: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' },
          securityQuestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                answer: { type: 'string' }
              },
              required: ['question', 'answer']
            },
            minItems: 3,
            maxItems: 5
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: {
      recoveryEmail?: string;
      recoveryPhone?: string;
      securityQuestions?: Array<{ question: string; answer: string }>;
    }
  }>, reply: FastifyReply) => {
    return securityController.setupAccountRecovery(request, reply);
  });

  fastify.get('/recovery/options', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.getRecoveryOptions(request, reply);
  });

  // Risk Assessment
  fastify.get('/risk-assessment', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.getRiskAssessment(request, reply);
  });

  fastify.post('/trusted-devices', {
    schema: {
      body: {
        type: 'object',
        properties: {
          deviceFingerprint: { type: 'string' },
          deviceName: { type: 'string' },
          trustLevel: { type: 'string', enum: ['partial', 'full'] }
        },
        required: ['deviceFingerprint', 'deviceName']
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { 
      deviceFingerprint: string; 
      deviceName: string; 
      trustLevel?: string 
    }
  }>, reply: FastifyReply) => {
    return securityController.addTrustedDevice(request, reply);
  });

  fastify.get('/trusted-devices', async (request: FastifyRequest, reply: FastifyReply) => {
    return securityController.getTrustedDevices(request, reply);
  });

  fastify.delete('/trusted-devices/:deviceId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', format: 'uuid' }
        },
        required: ['deviceId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    return securityController.removeTrustedDevice(request, reply);
  });
}