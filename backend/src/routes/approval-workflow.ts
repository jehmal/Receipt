import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { approvalWorkflowController } from '@/controllers/approval-workflow';
import { requireAuth } from '@/middleware/auth';

interface CreateRuleBody {
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  conditions: {
    amountThreshold?: number;
    categories?: string[];
    vendors?: string[];
    timeWindow?: number;
    userRoles?: string[];
  };
  actions: {
    requiresApproval: boolean;
    autoApprove: boolean;
    approvers: string[];
    escalationChain?: string[];
    notifications: {
      onSubmission: boolean;
      onApproval: boolean;
      onRejection: boolean;
      reminderInterval?: number;
    };
  };
}

interface CreateRequestBody {
  receiptId: string;
  amount: number;
  category: string;
  vendor?: string;
  reason?: string;
}

interface ProcessActionBody {
  action: 'approve' | 'reject' | 'request_info';
  comments?: string;
}

interface CheckRequirementQuery {
  amount: number;
  category: string;
  vendor?: string;
}

interface HistoryQuery {
  status?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  approverId?: string;
  page?: number;
  limit?: number;
}

export default async function approvalWorkflowRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth);

  // Approval Rules Management
  fastify.post('/rules', {
    schema: {
      description: 'Create a new approval rule',
      tags: ['Approval Workflow'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          isActive: { type: 'boolean' },
          priority: { type: 'number', minimum: 1, maximum: 100 },
          conditions: {
            type: 'object',
            properties: {
              amountThreshold: { type: 'number', minimum: 0 },
              categories: { 
                type: 'array', 
                items: { type: 'string' },
                maxItems: 20 
              },
              vendors: { 
                type: 'array', 
                items: { type: 'string' },
                maxItems: 50 
              },
              timeWindow: { type: 'number', minimum: 1, maximum: 8760 }, // max 1 year in hours
              userRoles: { 
                type: 'array', 
                items: { type: 'string' },
                maxItems: 10 
              }
            }
          },
          actions: {
            type: 'object',
            properties: {
              requiresApproval: { type: 'boolean' },
              autoApprove: { type: 'boolean' },
              approvers: { 
                type: 'array', 
                items: { type: 'string', format: 'uuid' },
                minItems: 1,
                maxItems: 10 
              },
              escalationChain: { 
                type: 'array', 
                items: { type: 'string', format: 'uuid' },
                maxItems: 5 
              },
              notifications: {
                type: 'object',
                properties: {
                  onSubmission: { type: 'boolean' },
                  onApproval: { type: 'boolean' },
                  onRejection: { type: 'boolean' },
                  reminderInterval: { type: 'number', minimum: 1, maximum: 168 } // max 1 week in hours
                },
                required: ['onSubmission', 'onApproval', 'onRejection']
              }
            },
            required: ['requiresApproval', 'autoApprove', 'approvers', 'notifications']
          }
        },
        required: ['name', 'isActive', 'priority', 'conditions', 'actions']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: CreateRuleBody }>, reply: FastifyReply) => {
    return approvalWorkflowController.createRule(request, reply);
  });

  fastify.get('/rules', {
    schema: {
      description: 'Get approval rules for company',
      tags: ['Approval Workflow'],
      querystring: {
        type: 'object',
        properties: {
          active: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: { type: 'object' }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { active?: boolean } }>, reply: FastifyReply) => {
    return approvalWorkflowController.getRules(request, reply);
  });

  // Approval Requirements
  fastify.get('/check/:receiptId', {
    schema: {
      description: 'Check if a receipt requires approval',
      tags: ['Approval Workflow'],
      params: {
        type: 'object',
        properties: {
          receiptId: { type: 'string', format: 'uuid' }
        },
        required: ['receiptId']
      },
      querystring: {
        type: 'object',
        properties: {
          amount: { type: 'number', minimum: 0 },
          category: { type: 'string', minLength: 1 },
          vendor: { type: 'string' }
        },
        required: ['amount', 'category']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                requiresApproval: { type: 'boolean' },
                rule: { type: 'object' },
                autoApprove: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { receiptId: string };
    Querystring: CheckRequirementQuery;
  }>, reply: FastifyReply) => {
    return approvalWorkflowController.checkRequirement(request, reply);
  });

  // Approval Requests
  fastify.post('/requests', {
    schema: {
      description: 'Create an approval request',
      tags: ['Approval Workflow'],
      body: {
        type: 'object',
        properties: {
          receiptId: { type: 'string', format: 'uuid' },
          amount: { type: 'number', minimum: 0 },
          category: { type: 'string', minLength: 1 },
          vendor: { type: 'string' },
          reason: { type: 'string', maxLength: 1000 }
        },
        required: ['receiptId', 'amount', 'category']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: CreateRequestBody }>, reply: FastifyReply) => {
    return approvalWorkflowController.createRequest(request, reply);
  });

  fastify.post('/requests/:requestId/action', {
    schema: {
      description: 'Process an approval action (approve/reject)',
      tags: ['Approval Workflow'],
      params: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' }
        },
        required: ['requestId']
      },
      body: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['approve', 'reject', 'request_info'] },
          comments: { type: 'string', maxLength: 1000 }
        },
        required: ['action']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { requestId: string };
    Body: ProcessActionBody;
  }>, reply: FastifyReply) => {
    return approvalWorkflowController.processAction(request, reply);
  });

  fastify.post('/requests/:requestId/escalate', {
    schema: {
      description: 'Escalate an approval request',
      tags: ['Approval Workflow'],
      params: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' }
        },
        required: ['requestId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { requestId: string } }>, reply: FastifyReply) => {
    return approvalWorkflowController.escalateRequest(request, reply);
  });

  fastify.get('/requests/:requestId', {
    schema: {
      description: 'Get approval request details',
      tags: ['Approval Workflow'],
      params: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' }
        },
        required: ['requestId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { requestId: string } }>, reply: FastifyReply) => {
    return approvalWorkflowController.getRequestDetails(request, reply);
  });

  // User-specific endpoints
  fastify.get('/pending', {
    schema: {
      description: 'Get pending approvals for current user',
      tags: ['Approval Workflow'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: { type: 'object' }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return approvalWorkflowController.getPendingApprovals(request, reply);
  });

  fastify.get('/history', {
    schema: {
      description: 'Get approval history with filters',
      tags: ['Approval Workflow'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'escalated', 'auto_approved'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          userId: { type: 'string', format: 'uuid' },
          approverId: { type: 'string', format: 'uuid' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: { type: 'object' }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: HistoryQuery }>, reply: FastifyReply) => {
    return approvalWorkflowController.getHistory(request, reply);
  });

  // Dashboard/Statistics
  fastify.get('/statistics', {
    schema: {
      description: 'Get approval workflow statistics',
      tags: ['Approval Workflow'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                pending: { type: 'number' },
                approvedThisMonth: { type: 'number' },
                rejectedThisMonth: { type: 'number' },
                averageApprovalTimeHours: { type: 'number' },
                totalActiveRules: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return approvalWorkflowController.getStatistics(request, reply);
  });
}