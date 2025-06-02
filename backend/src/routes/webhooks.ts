import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { webhooksController } from '@/controllers/webhooks';
import { requireAuth, requireCompanyRole } from '@/middleware/auth';

interface CreateWebhookBody {
  url: string;
  events: string[];
  description?: string;
  secret?: string;
  active?: boolean;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  filterRules?: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
  }[];
}

interface UpdateWebhookBody {
  url?: string;
  events?: string[];
  description?: string;
  secret?: string;
  active?: boolean;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  filterRules?: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
  }[];
}

interface WebhookQueryParams {
  active?: boolean;
  event?: string;
  page?: number;
  limit?: number;
}

interface DeliveryQueryParams {
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export default async function webhooksRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', requireCompanyRole(['admin', 'developer']));

  // Create webhook
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'receipt.created',
                'receipt.updated',
                'receipt.deleted',
                'receipt.approved',
                'receipt.rejected',
                'user.created',
                'user.updated',
                'user.deleted',
                'company.updated',
                'api_key.created',
                'api_key.revoked'
              ]
            },
            minItems: 1
          },
          description: { type: 'string', maxLength: 500 },
          secret: { type: 'string', minLength: 8, maxLength: 100 },
          active: { type: 'boolean' },
          retryPolicy: {
            type: 'object',
            properties: {
              maxRetries: { type: 'number', minimum: 0, maximum: 10 },
              retryDelay: { type: 'number', minimum: 1, maximum: 3600 },
              backoffMultiplier: { type: 'number', minimum: 1, maximum: 5 }
            }
          },
          filterRules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                operator: { type: 'string', enum: ['equals', 'contains', 'greater_than', 'less_than'] },
                value: { type: 'string' }
              },
              required: ['field', 'operator', 'value']
            }
          }
        },
        required: ['url', 'events']
      }
    }
  }, async (request: FastifyRequest<{ Body: CreateWebhookBody }>, reply: FastifyReply) => {
    return webhooksController.createWebhook(request, reply);
  });

  // Get webhooks
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          active: { type: 'boolean' },
          event: { type: 'string' },
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: WebhookQueryParams }>, reply: FastifyReply) => {
    return webhooksController.listWebhooks(request, reply);
  });

  // Get webhook details
  fastify.get('/:webhookId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          webhookId: { type: 'string', format: 'uuid' }
        },
        required: ['webhookId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { webhookId: string } }>, reply: FastifyReply) => {
    return webhooksController.getWebhookDetails(request, reply);
  });

  // Update webhook
  fastify.put('/:webhookId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          webhookId: { type: 'string', format: 'uuid' }
        },
        required: ['webhookId']
      },
      body: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'receipt.created',
                'receipt.updated',
                'receipt.deleted',
                'receipt.approved',
                'receipt.rejected',
                'user.created',
                'user.updated',
                'user.deleted',
                'company.updated',
                'api_key.created',
                'api_key.revoked'
              ]
            }
          },
          description: { type: 'string', maxLength: 500 },
          secret: { type: 'string', minLength: 8, maxLength: 100 },
          active: { type: 'boolean' },
          retryPolicy: {
            type: 'object',
            properties: {
              maxRetries: { type: 'number', minimum: 0, maximum: 10 },
              retryDelay: { type: 'number', minimum: 1, maximum: 3600 },
              backoffMultiplier: { type: 'number', minimum: 1, maximum: 5 }
            }
          },
          filterRules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                operator: { type: 'string', enum: ['equals', 'contains', 'greater_than', 'less_than'] },
                value: { type: 'string' }
              },
              required: ['field', 'operator', 'value']
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { webhookId: string };
    Body: UpdateWebhookBody 
  }>, reply: FastifyReply) => {
    return webhooksController.updateWebhook(request, reply);
  });

  // Delete webhook
  fastify.delete('/:webhookId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          webhookId: { type: 'string', format: 'uuid' }
        },
        required: ['webhookId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { webhookId: string } }>, reply: FastifyReply) => {
    return webhooksController.deleteWebhook(request, reply);
  });

  // Test webhook
  fastify.post('/:webhookId/test', {
    schema: {
      params: {
        type: 'object',
        properties: {
          webhookId: { type: 'string', format: 'uuid' }
        },
        required: ['webhookId']
      },
      body: {
        type: 'object',
        properties: {
          event: { type: 'string' },
          payload: { type: 'object' }
        },
        required: ['event']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { webhookId: string };
    Body: { event: string; payload?: object }
  }>, reply: FastifyReply) => {
    return webhooksController.testWebhook(request, reply);
  });

  // Get webhook deliveries
  fastify.get('/:webhookId/deliveries', {
    schema: {
      params: {
        type: 'object',
        properties: {
          webhookId: { type: 'string', format: 'uuid' }
        },
        required: ['webhookId']
      },
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'success', 'failed', 'retrying'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { webhookId: string };
    Querystring: DeliveryQueryParams 
  }>, reply: FastifyReply) => {
    return webhooksController.getWebhookDeliveries(request, reply);
  });

  // Get delivery details
  fastify.get('/:webhookId/deliveries/:deliveryId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          webhookId: { type: 'string', format: 'uuid' },
          deliveryId: { type: 'string', format: 'uuid' }
        },
        required: ['webhookId', 'deliveryId']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { webhookId: string; deliveryId: string }
  }>, reply: FastifyReply) => {
    return webhooksController.getDeliveryDetails(request, reply);
  });

  // Retry delivery
  fastify.post('/:webhookId/deliveries/:deliveryId/retry', {
    schema: {
      params: {
        type: 'object',
        properties: {
          webhookId: { type: 'string', format: 'uuid' },
          deliveryId: { type: 'string', format: 'uuid' }
        },
        required: ['webhookId', 'deliveryId']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { webhookId: string; deliveryId: string }
  }>, reply: FastifyReply) => {
    return webhooksController.retryDelivery(request, reply);
  });

  // Get webhook statistics
  fastify.get('/:webhookId/stats', {
    schema: {
      params: {
        type: 'object',
        properties: {
          webhookId: { type: 'string', format: 'uuid' }
        },
        required: ['webhookId']
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { webhookId: string };
    Querystring: { startDate?: string; endDate?: string }
  }>, reply: FastifyReply) => {
    return webhooksController.getWebhookStats(request, reply);
  });

  // Get available events
  fastify.get('/events/available', async (request: FastifyRequest, reply: FastifyReply) => {
    return webhooksController.getAvailableEvents(request, reply);
  });

  // Verify webhook signature (for testing)
  fastify.post('/verify-signature', {
    schema: {
      body: {
        type: 'object',
        properties: {
          payload: { type: 'string' },
          signature: { type: 'string' },
          secret: { type: 'string' }
        },
        required: ['payload', 'signature', 'secret']
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: { payload: string; signature: string; secret: string }
  }>, reply: FastifyReply) => {
    return webhooksController.verifySignature(request, reply);
  });
}