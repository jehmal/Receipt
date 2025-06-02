import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { approvalsController } from '@/controllers/approvals';
import { requireAuth, requireCompanyRole } from '@/middleware/auth';

interface ApprovalQueryParams {
  status?: string;
  submitterId?: string;
  approverId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
}

interface ApprovalActionBody {
  action: 'approve' | 'reject';
  comments?: string;
  tags?: string[];
}

interface BulkApprovalBody {
  receiptIds: string[];
  action: 'approve' | 'reject';
  comments?: string;
}

export default async function approvalsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', requireCompanyRole(['admin', 'approver']));

  // Get pending approvals
  fastify.get('/pending', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 },
          submitterId: { type: 'string', format: 'uuid' },
          category: { type: 'string' },
          minAmount: { type: 'number', minimum: 0 },
          maxAmount: { type: 'number', minimum: 0 },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: ApprovalQueryParams }>, reply: FastifyReply) => {
    return approvalsController.getPendingApprovals(request, reply);
  });

  // Get all approvals (with filters)
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          submitterId: { type: 'string', format: 'uuid' },
          approverId: { type: 'string', format: 'uuid' },
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 },
          category: { type: 'string' },
          minAmount: { type: 'number', minimum: 0 },
          maxAmount: { type: 'number', minimum: 0 },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: ApprovalQueryParams }>, reply: FastifyReply) => {
    return approvalsController.getApprovals(request, reply);
  });

  // Get approval details
  fastify.get('/:receiptId', {
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
    return approvalsController.getApprovalDetails(request, reply);
  });

  // Submit receipt for approval
  fastify.post('/:receiptId/submit', {
    schema: {
      params: {
        type: 'object',
        properties: {
          receiptId: { type: 'string', format: 'uuid' }
        },
        required: ['receiptId']
      },
      body: {
        type: 'object',
        properties: {
          comments: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'] },
          requestedApprover: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { receiptId: string };
    Body: { comments?: string; priority?: string; requestedApprover?: string }
  }>, reply: FastifyReply) => {
    return approvalsController.submitForApproval(request, reply);
  });

  // Approve or reject receipt
  fastify.post('/:receiptId/action', {
    schema: {
      params: {
        type: 'object',
        properties: {
          receiptId: { type: 'string', format: 'uuid' }
        },
        required: ['receiptId']
      },
      body: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['approve', 'reject'] },
          comments: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['action']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { receiptId: string };
    Body: ApprovalActionBody
  }>, reply: FastifyReply) => {
    return approvalsController.processApproval(request, reply);
  });

  // Bulk approval/rejection
  fastify.post('/bulk-action', {
    schema: {
      body: {
        type: 'object',
        properties: {
          receiptIds: { 
            type: 'array', 
            items: { type: 'string', format: 'uuid' },
            minItems: 1,
            maxItems: 50
          },
          action: { type: 'string', enum: ['approve', 'reject'] },
          comments: { type: 'string' }
        },
        required: ['receiptIds', 'action']
      }
    }
  }, async (request: FastifyRequest<{ Body: BulkApprovalBody }>, reply: FastifyReply) => {
    return approvalsController.bulkProcessApprovals(request, reply);
  });

  // Get approval workflow configuration
  fastify.get('/config/workflow', async (request: FastifyRequest, reply: FastifyReply) => {
    return approvalsController.getWorkflowConfig(request, reply);
  });

  // Update approval workflow configuration (admin only)
  fastify.put('/config/workflow', {
    preHandler: requireCompanyRole(['admin']),
    schema: {
      body: {
        type: 'object',
        properties: {
          autoApprovalThreshold: { type: 'number', minimum: 0 },
          requireApprovalAbove: { type: 'number', minimum: 0 },
          defaultApprovers: { 
            type: 'array', 
            items: { type: 'string', format: 'uuid' } 
          },
          approvalLevels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                threshold: { type: 'number', minimum: 0 },
                requiredApprovers: { type: 'number', minimum: 1 },
                approverRoles: { 
                  type: 'array', 
                  items: { type: 'string', enum: ['approver', 'admin', 'manager'] } 
                }
              }
            }
          },
          notifications: {
            type: 'object',
            properties: {
              emailEnabled: { type: 'boolean' },
              slackEnabled: { type: 'boolean' },
              reminderAfterHours: { type: 'number', minimum: 1 }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: {
      autoApprovalThreshold?: number;
      requireApprovalAbove?: number;
      defaultApprovers?: string[];
      approvalLevels?: Array<{
        threshold: number;
        requiredApprovers: number;
        approverRoles: string[];
      }>;
      notifications?: {
        emailEnabled?: boolean;
        slackEnabled?: boolean;
        reminderAfterHours?: number;
      };
    }
  }>, reply: FastifyReply) => {
    return approvalsController.updateWorkflowConfig(request, reply);
  });

  // Get approval statistics
  fastify.get('/stats', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          approverId: { type: 'string', format: 'uuid' },
          submitterId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: {
      startDate?: string;
      endDate?: string;
      approverId?: string;
      submitterId?: string;
    }
  }>, reply: FastifyReply) => {
    return approvalsController.getApprovalStats(request, reply);
  });

  // Get approval history for a receipt
  fastify.get('/:receiptId/history', {
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
    return approvalsController.getApprovalHistory(request, reply);
  });

  // Delegate approval authority
  fastify.post('/delegate', {
    schema: {
      body: {
        type: 'object',
        properties: {
          delegateeTo: { type: 'string', format: 'uuid' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          maxAmount: { type: 'number', minimum: 0 },
          categories: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' }
        },
        required: ['delegateeTo', 'startDate', 'endDate']
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: {
      delegateeTo: string;
      startDate: string;
      endDate: string;
      maxAmount?: number;
      categories?: string[];
      reason?: string;
    }
  }>, reply: FastifyReply) => {
    return approvalsController.delegateApproval(request, reply);
  });
}