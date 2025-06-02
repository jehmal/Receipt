import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { complianceController } from '@/controllers/compliance';
import { requireAuth, requireCompanyRole } from '@/middleware/auth';

interface ComplianceReportQuery {
  jurisdiction?: string;
  startDate?: string;
  endDate?: string;
  format?: 'pdf' | 'csv' | 'json';
  includeAttachments?: boolean;
}

interface AuditExportQuery {
  startDate?: string;
  endDate?: string;
  eventTypes?: string;
  userIds?: string;
  format?: 'csv' | 'json';
}

interface RetentionPolicyBody {
  defaultRetentionYears: number;
  taxDocumentRetentionYears: number;
  auditLogRetentionYears: number;
  autoDeleteExpired: boolean;
  complianceMode: 'strict' | 'standard';
  exceptions: Array<{
    category: string;
    retentionYears: number;
    reason: string;
  }>;
}

interface CertificationRequestBody {
  certificationType: 'soc2' | 'iso27001' | 'gdpr' | 'hipaa';
  requestedBy: string;
  businessJustification: string;
  targetCompletionDate: string;
  additionalRequirements?: string[];
}

export default async function complianceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // Compliance Reports
  fastify.get('/reports/tax', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer']),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          jurisdiction: { type: 'string', enum: ['US', 'AU', 'EU', 'CA', 'UK'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          format: { type: 'string', enum: ['pdf', 'csv', 'json'] },
          includeAttachments: { type: 'boolean' }
        },
        required: ['jurisdiction', 'startDate', 'endDate']
      }
    }
  }, async (request: FastifyRequest<{ Querystring: ComplianceReportQuery }>, reply: FastifyReply) => {
    return complianceController.generateTaxComplianceReport(request, reply);
  });

  fastify.get('/reports/audit', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer']),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          eventTypes: { type: 'string' }, // Comma-separated list
          userIds: { type: 'string' }, // Comma-separated list
          format: { type: 'string', enum: ['csv', 'json'] }
        },
        required: ['startDate', 'endDate']
      }
    }
  }, async (request: FastifyRequest<{ Querystring: AuditExportQuery }>, reply: FastifyReply) => {
    return complianceController.exportAuditLog(request, reply);
  });

  fastify.get('/reports/data-integrity', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer']),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          includeHashVerification: { type: 'boolean' },
          includeBackupVerification: { type: 'boolean' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: {
      startDate?: string;
      endDate?: string;
      includeHashVerification?: boolean;
      includeBackupVerification?: boolean;
    }
  }>, reply: FastifyReply) => {
    return complianceController.generateDataIntegrityReport(request, reply);
  });

  // Data Retention Policies
  fastify.get('/retention-policy', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return complianceController.getRetentionPolicy(request, reply);
  });

  fastify.put('/retention-policy', {
    preHandler: requireCompanyRole(['admin']),
    schema: {
      body: {
        type: 'object',
        properties: {
          defaultRetentionYears: { type: 'number', minimum: 1, maximum: 50 },
          taxDocumentRetentionYears: { type: 'number', minimum: 3, maximum: 20 },
          auditLogRetentionYears: { type: 'number', minimum: 1, maximum: 10 },
          autoDeleteExpired: { type: 'boolean' },
          complianceMode: { type: 'string', enum: ['strict', 'standard'] },
          exceptions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                retentionYears: { type: 'number', minimum: 1, maximum: 50 },
                reason: { type: 'string' }
              },
              required: ['category', 'retentionYears', 'reason']
            }
          }
        },
        required: ['defaultRetentionYears', 'taxDocumentRetentionYears', 'auditLogRetentionYears']
      }
    }
  }, async (request: FastifyRequest<{ Body: RetentionPolicyBody }>, reply: FastifyReply) => {
    return complianceController.updateRetentionPolicy(request, reply);
  });

  fastify.post('/retention-policy/apply', {
    preHandler: requireCompanyRole(['admin']),
    schema: {
      body: {
        type: 'object',
        properties: {
          dryRun: { type: 'boolean' },
          categories: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { dryRun?: boolean; categories?: string[] }
  }>, reply: FastifyReply) => {
    return complianceController.applyRetentionPolicy(request, reply);
  });

  // Compliance Certifications
  fastify.get('/certifications', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return complianceController.getCertifications(request, reply);
  });

  fastify.post('/certifications/request', {
    preHandler: requireCompanyRole(['admin']),
    schema: {
      body: {
        type: 'object',
        properties: {
          certificationType: { type: 'string', enum: ['soc2', 'iso27001', 'gdpr', 'hipaa'] },
          requestedBy: { type: 'string' },
          businessJustification: { type: 'string', minLength: 10 },
          targetCompletionDate: { type: 'string', format: 'date' },
          additionalRequirements: { type: 'array', items: { type: 'string' } }
        },
        required: ['certificationType', 'requestedBy', 'businessJustification', 'targetCompletionDate']
      }
    }
  }, async (request: FastifyRequest<{ Body: CertificationRequestBody }>, reply: FastifyReply) => {
    return complianceController.requestCertification(request, reply);
  });

  fastify.get('/certifications/:certificationId', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer']),
    schema: {
      params: {
        type: 'object',
        properties: {
          certificationId: { type: 'string', format: 'uuid' }
        },
        required: ['certificationId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { certificationId: string } }>, reply: FastifyReply) => {
    return complianceController.getCertificationDetails(request, reply);
  });

  // Legal Hold
  fastify.get('/legal-holds', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer', 'legal'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return complianceController.getLegalHolds(request, reply);
  });

  fastify.post('/legal-holds', {
    preHandler: requireCompanyRole(['admin', 'legal']),
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 1000 },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          scope: {
            type: 'object',
            properties: {
              userIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
              categories: { type: 'array', items: { type: 'string' } },
              dateRange: {
                type: 'object',
                properties: {
                  start: { type: 'string', format: 'date' },
                  end: { type: 'string', format: 'date' }
                }
              }
            }
          },
          legalContact: { type: 'string', format: 'email' },
          caseReference: { type: 'string' }
        },
        required: ['name', 'description', 'startDate', 'scope', 'legalContact']
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: {
      name: string;
      description: string;
      startDate: string;
      endDate?: string;
      scope: {
        userIds?: string[];
        categories?: string[];
        dateRange?: { start: string; end: string };
      };
      legalContact: string;
      caseReference?: string;
    }
  }>, reply: FastifyReply) => {
    return complianceController.createLegalHold(request, reply);
  });

  fastify.put('/legal-holds/:holdId/release', {
    preHandler: requireCompanyRole(['admin', 'legal']),
    schema: {
      params: {
        type: 'object',
        properties: {
          holdId: { type: 'string', format: 'uuid' }
        },
        required: ['holdId']
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', minLength: 10 },
          authorizedBy: { type: 'string', format: 'email' }
        },
        required: ['reason', 'authorizedBy']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { holdId: string };
    Body: { reason: string; authorizedBy: string }
  }>, reply: FastifyReply) => {
    return complianceController.releaseLegalHold(request, reply);
  });

  // Privacy and GDPR
  fastify.get('/privacy/data-map', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer', 'dpo'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return complianceController.getDataMap(request, reply);
  });

  fastify.post('/privacy/subject-request', {
    schema: {
      body: {
        type: 'object',
        properties: {
          requestType: { type: 'string', enum: ['access', 'portability', 'rectification', 'erasure', 'restriction'] },
          subjectEmail: { type: 'string', format: 'email' },
          subjectName: { type: 'string' },
          requestDetails: { type: 'string', minLength: 10 },
          verificationMethod: { type: 'string', enum: ['email', 'phone', 'document'] },
          urgency: { type: 'string', enum: ['low', 'normal', 'high'] }
        },
        required: ['requestType', 'subjectEmail', 'requestDetails', 'verificationMethod']
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: {
      requestType: string;
      subjectEmail: string;
      subjectName?: string;
      requestDetails: string;
      verificationMethod: string;
      urgency?: string;
    }
  }>, reply: FastifyReply) => {
    return complianceController.createDataSubjectRequest(request, reply);
  });

  fastify.get('/privacy/subject-requests', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer', 'dpo']),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'rejected'] },
          requestType: { type: 'string' },
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: {
      status?: string;
      requestType?: string;
      page?: number;
      limit?: number;
    }
  }>, reply: FastifyReply) => {
    return complianceController.getDataSubjectRequests(request, reply);
  });

  // Compliance Dashboard
  fastify.get('/dashboard', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return complianceController.getComplianceDashboard(request, reply);
  });

  fastify.get('/compliance-score', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return complianceController.getComplianceScore(request, reply);
  });

  // Blockchain Verification
  fastify.get('/blockchain/verification/:receiptId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          receiptId: { type: 'string', format: 'uuid' }
        },
        required: ['receiptId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { receiptId: string } }>, reply: FastifyReply) => {
    return complianceController.getBlockchainVerification(request, reply);
  });

  fastify.post('/blockchain/anchor', {
    preHandler: requireCompanyRole(['admin']),
    schema: {
      body: {
        type: 'object',
        properties: {
          receiptIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          batchName: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { receiptIds?: string[]; batchName?: string }
  }>, reply: FastifyReply) => {
    return complianceController.anchorToBlockchain(request, reply);
  });

  // Compliance Templates
  fastify.get('/templates', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer'])
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return complianceController.getComplianceTemplates(request, reply);
  });

  fastify.get('/templates/:templateId', {
    preHandler: requireCompanyRole(['admin', 'compliance_officer']),
    schema: {
      params: {
        type: 'object',
        properties: {
          templateId: { type: 'string', format: 'uuid' }
        },
        required: ['templateId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { templateId: string } }>, reply: FastifyReply) => {
    return complianceController.getComplianceTemplate(request, reply);
  });
}