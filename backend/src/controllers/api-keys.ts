import { FastifyRequest, FastifyReply } from 'fastify';
import * as apiKeyService from '@/services/api-key';
import * as auditService from '@/services/audit';
import { logger } from '@/utils/logger';

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

export const apiKeysController = {
  async createApiKey(
    request: FastifyRequest<{ Body: CreateApiKeyBody }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const apiKeyData = request.body;

      const apiKey = await apiKeyService.createApiKey({
        ...apiKeyData,
        companyId: (user as any).companyId,
        createdBy: (user as any).id
      });

      // Log API key creation
      await auditService.logAction({
        userId: (user as any).id,
        action: 'api_key_created',
        resourceType: 'api_key',
        resourceId: apiKey.id,
        details: {
          name: apiKeyData.name,
          scopes: apiKeyData.scopes,
          expiresAt: apiKeyData.expiresAt
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.status(201).send({
        success: true,
        data: apiKey
      });
    } catch (error) {
      logger.error('Error creating API key:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create API key'
      });
    }
  },

  async getApiKeys(
    request: FastifyRequest<{ Querystring: ApiKeyQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { page = 1, limit = 20, status, scope } = request.query;

      const apiKeys = await apiKeyService.getApiKeys({
        companyId: (user as any).companyId,
        page,
        limit,
        status,
        scope
      });

      return reply.send({
        success: true,
        data: apiKeys.data,
        pagination: {
          page,
          limit,
          total: apiKeys.total,
          totalPages: Math.ceil(apiKeys.total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting API keys:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get API keys'
      });
    }
  },

  async getApiKeyDetails(
    request: FastifyRequest<{ Params: { keyId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { keyId } = request.params;

      const apiKey = await apiKeyService.getApiKeyDetails({
        keyId,
        companyId: (user as any).companyId
      });

      if (!apiKey) {
        return reply.status(404).send({
          success: false,
          error: 'API key not found'
        });
      }

      return reply.send({
        success: true,
        data: apiKey
      });
    } catch (error) {
      logger.error('Error getting API key details:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get API key details'
      });
    }
  },

  async updateApiKey(
    request: FastifyRequest<{ 
      Params: { keyId: string };
      Body: UpdateApiKeyBody 
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { keyId } = request.params;
      const updates = request.body;

      const updatedApiKey = await apiKeyService.updateApiKey({
        keyId,
        companyId: (user as any).companyId,
        updates
      });

      if (!updatedApiKey) {
        return reply.status(404).send({
          success: false,
          error: 'API key not found'
        });
      }

      // Log API key update
      await auditService.logAction({
        userId: (user as any).id,
        action: 'api_key_updated',
        resourceType: 'api_key',
        resourceId: keyId,
        details: updates,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: updatedApiKey
      });
    } catch (error) {
      logger.error('Error updating API key:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update API key'
      });
    }
  },

  async deleteApiKey(
    request: FastifyRequest<{ Params: { keyId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { keyId } = request.params;

      const success = await apiKeyService.deleteApiKey({
        keyId,
        companyId: (user as any).companyId
      });

      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'API key not found'
        });
      }

      // Log API key deletion
      await auditService.logAction({
        userId: (user as any).id,
        action: 'api_key_deleted',
        resourceType: 'api_key',
        resourceId: keyId,
        details: {},
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        message: 'API key deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting API key:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete API key'
      });
    }
  },

  async regenerateApiKey(
    request: FastifyRequest<{ Params: { keyId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { keyId } = request.params;

      const newApiKey = await apiKeyService.regenerateApiKey({
        keyId,
        companyId: (user as any).companyId
      });

      if (!newApiKey) {
        return reply.status(404).send({
          success: false,
          error: 'API key not found'
        });
      }

      // Log API key regeneration
      await auditService.logAction({
        userId: (user as any).id,
        action: 'api_key_regenerated',
        resourceType: 'api_key',
        resourceId: keyId,
        details: {},
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: newApiKey,
        message: 'API key regenerated successfully. Please update your applications with the new key.'
      });
    } catch (error) {
      logger.error('Error regenerating API key:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to regenerate API key'
      });
    }
  },

  async getApiKeyUsage(
    request: FastifyRequest<{ 
      Params: { keyId: string };
      Querystring: { startDate?: string; endDate?: string; granularity?: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { keyId } = request.params;
      const { startDate, endDate, granularity = 'day' } = request.query;

      const usage = await apiKeyService.getApiKeyUsage({
        keyId,
        companyId: (user as any).companyId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        granularity
      });

      if (!usage) {
        return reply.status(404).send({
          success: false,
          error: 'API key not found'
        });
      }

      return reply.send({
        success: true,
        data: usage
      });
    } catch (error) {
      logger.error('Error getting API key usage:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get API key usage'
      });
    }
  },

  async testApiKey(
    request: FastifyRequest<{ 
      Params: { keyId: string };
      Body: { endpoint: string; method: string; payload?: object }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { keyId } = request.params;
      const { endpoint, method, payload } = request.body;

      const testResult = await apiKeyService.testApiKey({
        keyId,
        companyId: (user as any).companyId,
        endpoint,
        method,
        payload
      });

      if (!testResult) {
        return reply.status(404).send({
          success: false,
          error: 'API key not found'
        });
      }

      return reply.send({
        success: true,
        data: testResult
      });
    } catch (error) {
      logger.error('Error testing API key:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to test API key'
      });
    }
  },

  async getAvailableScopes(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const scopes = await apiKeyService.getAvailableScopes();

      return reply.send({
        success: true,
        data: scopes
      });
    } catch (error) {
      logger.error('Error getting available scopes:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get available scopes'
      });
    }
  },

  async getOpenApiSpec(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      
      const openApiSpec = await apiKeyService.getOpenApiSpec((user as any).companyId);

      return reply.send({
        success: true,
        data: openApiSpec
      });
    } catch (error) {
      logger.error('Error getting OpenAPI spec:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get API documentation'
      });
    }
  },

  async getApiLimits(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      
      const limits = await apiKeyService.getApiLimits((user as any).companyId);

      return reply.send({
        success: true,
        data: limits
      });
    } catch (error) {
      logger.error('Error getting API limits:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get API limits'
      });
    }
  }
};