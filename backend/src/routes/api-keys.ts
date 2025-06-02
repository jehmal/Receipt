import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { apiKeysController } from '@/controllers/api-keys';
import { requireAuth, requireCompanyRole } from '@/middleware/auth';

interface CreateApiKeyBody {
  name: string;
  description?: string;
  scopes: string[];
  expiresAt?: string;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  allowedIps?: string[];
  webhookUrl?: string;
}

interface UpdateApiKeyBody {
  name?: string;
  description?: string;
  scopes?: string[];
  status?: 'active' | 'suspended';
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  allowedIps?: string[];
  webhookUrl?: string;
}

interface ApiKeyQueryParams {
  status?: string;
  scope?: string;
  page?: number;
  limit?: number;
}

export default async function apiKeysRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', requireCompanyRole(['admin', 'developer']));

  // Create API key
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          scopes: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'receipts:read',
                'receipts:write',
                'receipts:delete',
                'users:read',
                'companies:read',
                'analytics:read',
                'search:read',
                'webhooks:manage'
              ]
            },
            minItems: 1
          },
          expiresAt: { type: 'string', format: 'date-time' },
          rateLimit: {
            type: 'object',
            properties: {
              requestsPerMinute: { type: 'number', minimum: 1, maximum: 1000 },
              requestsPerHour: { type: 'number', minimum: 1, maximum: 10000 },
              requestsPerDay: { type: 'number', minimum: 1, maximum: 100000 }
            }
          },
          allowedIps: {
            type: 'array',
            items: { type: 'string', format: 'ipv4' }
          },
          webhookUrl: { type: 'string', format: 'uri' }
        },
        required: ['name', 'scopes']
      }
    }
  }, async (request: FastifyRequest<{ Body: CreateApiKeyBody }>, reply: FastifyReply) => {
    return apiKeysController.createApiKey(request, reply);
  });

  // Get API keys
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'suspended', 'expired'] },
          scope: { type: 'string' },
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: ApiKeyQueryParams }>, reply: FastifyReply) => {
    return apiKeysController.getApiKeys(request, reply);
  });

  // Get API key details
  fastify.get('/:keyId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          keyId: { type: 'string', format: 'uuid' }
        },
        required: ['keyId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { keyId: string } }>, reply: FastifyReply) => {
    return apiKeysController.getApiKeyDetails(request, reply);
  });

  // Update API key
  fastify.put('/:keyId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          keyId: { type: 'string', format: 'uuid' }
        },
        required: ['keyId']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          scopes: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'receipts:read',
                'receipts:write',
                'receipts:delete',
                'users:read',
                'companies:read',
                'analytics:read',
                'search:read',
                'webhooks:manage'
              ]
            }
          },
          status: { type: 'string', enum: ['active', 'suspended'] },
          rateLimit: {
            type: 'object',
            properties: {
              requestsPerMinute: { type: 'number', minimum: 1, maximum: 1000 },
              requestsPerHour: { type: 'number', minimum: 1, maximum: 10000 },
              requestsPerDay: { type: 'number', minimum: 1, maximum: 100000 }
            }
          },
          allowedIps: {
            type: 'array',
            items: { type: 'string', format: 'ipv4' }
          },
          webhookUrl: { type: 'string', format: 'uri' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { keyId: string };
    Body: UpdateApiKeyBody 
  }>, reply: FastifyReply) => {
    return apiKeysController.updateApiKey(request, reply);
  });

  // Delete API key
  fastify.delete('/:keyId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          keyId: { type: 'string', format: 'uuid' }
        },
        required: ['keyId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { keyId: string } }>, reply: FastifyReply) => {
    return apiKeysController.deleteApiKey(request, reply);
  });

  // Regenerate API key
  fastify.post('/:keyId/regenerate', {
    schema: {
      params: {
        type: 'object',
        properties: {
          keyId: { type: 'string', format: 'uuid' }
        },
        required: ['keyId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { keyId: string } }>, reply: FastifyReply) => {
    return apiKeysController.regenerateApiKey(request, reply);
  });

  // Get API key usage statistics
  fastify.get('/:keyId/usage', {
    schema: {
      params: {
        type: 'object',
        properties: {
          keyId: { type: 'string', format: 'uuid' }
        },
        required: ['keyId']
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          granularity: { type: 'string', enum: ['hour', 'day', 'week'] }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { keyId: string };
    Querystring: { startDate?: string; endDate?: string; granularity?: string }
  }>, reply: FastifyReply) => {
    return apiKeysController.getApiKeyUsage(request, reply);
  });

  // Test API key
  fastify.post('/:keyId/test', {
    schema: {
      params: {
        type: 'object',
        properties: {
          keyId: { type: 'string', format: 'uuid' }
        },
        required: ['keyId']
      },
      body: {
        type: 'object',
        properties: {
          endpoint: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
          payload: { type: 'object' }
        },
        required: ['endpoint', 'method']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { keyId: string };
    Body: { endpoint: string; method: string; payload?: object }
  }>, reply: FastifyReply) => {
    return apiKeysController.testApiKey(request, reply);
  });

  // Get available scopes
  fastify.get('/scopes/available', async (request: FastifyRequest, reply: FastifyReply) => {
    return apiKeysController.getAvailableScopes(request, reply);
  });

  // Get API documentation
  fastify.get('/docs/openapi', async (request: FastifyRequest, reply: FastifyReply) => {
    return apiKeysController.getOpenApiSpec(request, reply);
  });

  // Get API rate limits
  fastify.get('/limits', async (request: FastifyRequest, reply: FastifyReply) => {
    return apiKeysController.getApiLimits(request, reply);
  });
}