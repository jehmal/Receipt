import { db } from '../database/connection';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

interface CreateApiKeyParams {
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
  companyId: string;
  createdBy: string;
}

interface GetApiKeysParams {
  companyId: string;
  page: number;
  limit: number;
  status?: string;
  scope?: string;
}

interface ApiKeyUsageParams {
  keyId: string;
  companyId: string;
  startDate?: Date;
  endDate?: Date;
  granularity: string;
}

interface TestApiKeyParams {
  keyId: string;
  companyId: string;
  endpoint: string;
  method: string;
  payload?: object;
}

export const createApiKey = async (params: CreateApiKeyParams) => {
  return apiKeyService.createApiKey(params);
};

export const getApiKeys = async (params: GetApiKeysParams) => {
  return apiKeyService.getApiKeys(params);
};

export const getApiKeyDetails = async (params: { keyId: string; companyId: string }) => {
  return apiKeyService.getApiKeyDetails(params);
};

export const updateApiKey = async (params: {
  keyId: string;
  companyId: string;
  updates: {
    name?: string;
    description?: string;
    scopes?: string[];
    status?: string;
    rateLimit?: {
      requestsPerMinute: number;
      requestsPerHour: number;
      requestsPerDay: number;
    };
    allowedIps?: string[];
    webhookUrl?: string;
  };
}) => {
  return apiKeyService.updateApiKey(params);
};

export const deleteApiKey = async (params: { keyId: string; companyId: string }): Promise<boolean> => {
  return apiKeyService.deleteApiKey(params);
};

export const regenerateApiKey = async (params: { keyId: string; companyId: string }) => {
  return apiKeyService.regenerateApiKey(params);
};

export const getApiKeyUsage = async (params: {
  keyId: string;
  companyId: string;
  startDate?: Date;
  endDate?: Date;
  granularity: string;
}) => {
  return apiKeyService.getApiKeyUsage(params);
};

export const testApiKey = async (params: {
  keyId: string;
  companyId: string;
  endpoint: string;
  method: string;
  payload?: object;
}) => {
  return apiKeyService.testApiKey(params);
};

export const getAvailableScopes = async () => {
  return apiKeyService.getAvailableScopes();
};

export const getOpenApiSpec = async (companyId: string) => {
  return apiKeyService.getOpenApiSpec(companyId);
};

export const getApiLimits = async (companyId: string) => {
  return apiKeyService.getApiLimits(companyId);
};

export const apiKeyService = {
  async createApiKey(params: CreateApiKeyParams) {
    try {
      const {
        name,
        description,
        scopes,
        expiresAt,
        rateLimit,
        allowedIps,
        webhookUrl,
        companyId,
        createdBy
      } = params;

      // Generate API key and secret
      const keyId = uuidv4();
      const apiKey = this.generateApiKey();
      const hashedKey = this.hashApiKey(apiKey);

      // Set default rate limits if not provided
      const defaultRateLimit = {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      };

      const finalRateLimit = rateLimit || defaultRateLimit;

      const query = `
        INSERT INTO api_keys (
          id, company_id, created_by, name, description, 
          key_hash, scopes, expires_at, rate_limit, 
          allowed_ips, webhook_url, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', NOW())
        RETURNING id, name, description, scopes, expires_at, 
                 rate_limit, allowed_ips, webhook_url, status, created_at
      `;

      const result = await db.query(query, [
        keyId,
        companyId,
        createdBy,
        name,
        description,
        hashedKey,
        JSON.stringify(scopes),
        expiresAt ? new Date(expiresAt) : null,
        JSON.stringify(finalRateLimit),
        allowedIps ? JSON.stringify(allowedIps) : null,
        webhookUrl
      ]);

      const apiKeyRecord = result.rows[0];

      // Store API key mapping in Redis for fast lookup
      await redis.setex(`api_key:${apiKey}`, 86400, JSON.stringify({
        id: keyId,
        companyId,
        scopes,
        rateLimit: finalRateLimit,
        allowedIps,
        status: 'active'
      }));

      return {
        ...apiKeyRecord,
        apiKey, // Only return the actual key on creation
        scopes: JSON.parse(apiKeyRecord.scopes),
        rate_limit: JSON.parse(apiKeyRecord.rate_limit),
        allowed_ips: apiKeyRecord.allowed_ips ? JSON.parse(apiKeyRecord.allowed_ips) : null
      };
    } catch (error) {
      logger.error('Error creating API key:', error);
      throw error;
    }
  },

  async getApiKeys(params: GetApiKeysParams) {
    try {
      const { companyId, page, limit, status, scope } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE company_id = $1';
      const queryParams = [companyId];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      if (scope) {
        whereClause += ` AND scopes::text LIKE $${paramIndex}`;
        queryParams.push(`%${scope}%`);
        paramIndex++;
      }

      const query = `
        SELECT 
          id, name, description, scopes, expires_at,
          rate_limit, allowed_ips, webhook_url, status,
          created_at, last_used_at, usage_count,
          u.name as created_by_name
        FROM api_keys ak
        LEFT JOIN users u ON ak.created_by = u.id
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit.toString(), offset.toString());

      const countQuery = `
        SELECT COUNT(*) as total
        FROM api_keys
        ${whereClause}
      `;

      const [dataResult, countResult] = await Promise.all([
        db.query(query, queryParams),
        db.query(countQuery, queryParams.slice(0, -2))
      ]);

      const apiKeys = dataResult.rows.map(row => ({
        ...row,
        scopes: JSON.parse(row.scopes),
        rate_limit: JSON.parse(row.rate_limit),
        allowed_ips: row.allowed_ips ? JSON.parse(row.allowed_ips) : null
      }));

      return {
        data: apiKeys,
        total: parseInt(countResult.rows[0].total)
      };
    } catch (error) {
      logger.error('Error getting API keys:', error);
      throw error;
    }
  },

  async getApiKeyDetails(params: { keyId: string; companyId: string }) {
    try {
      const { keyId, companyId } = params;

      const query = `
        SELECT 
          ak.id, ak.name, ak.description, ak.scopes, ak.expires_at,
          ak.rate_limit, ak.allowed_ips, ak.webhook_url, ak.status,
          ak.created_at, ak.last_used_at, ak.usage_count,
          u.name as created_by_name,
          u.email as created_by_email
        FROM api_keys ak
        LEFT JOIN users u ON ak.created_by = u.id
        WHERE ak.id = $1 AND ak.company_id = $2
      `;

      const result = await db.query(query, [keyId, companyId]);

      if (result.rows.length === 0) {
        return null;
      }

      const apiKey = result.rows[0];

      return {
        ...apiKey,
        scopes: JSON.parse(apiKey.scopes),
        rate_limit: JSON.parse(apiKey.rate_limit),
        allowed_ips: apiKey.allowed_ips ? JSON.parse(apiKey.allowed_ips) : null
      };
    } catch (error) {
      logger.error('Error getting API key details:', error);
      throw error;
    }
  },

  async updateApiKey(params: {
    keyId: string;
    companyId: string;
    updates: {
      name?: string;
      description?: string;
      scopes?: string[];
      status?: string;
      rateLimit?: {
        requestsPerMinute: number;
        requestsPerHour: number;
        requestsPerDay: number;
      };
      allowedIps?: string[];
      webhookUrl?: string;
    };
  }) {
    try {
      const { keyId, companyId, updates } = params;

      const setClauses: string[] = [];
      const queryParams = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex}`);
        queryParams.push(updates.name);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex}`);
        queryParams.push(updates.description);
        paramIndex++;
      }

      if (updates.scopes !== undefined) {
        setClauses.push(`scopes = $${paramIndex}`);
        queryParams.push(JSON.stringify(updates.scopes));
        paramIndex++;
      }

      if (updates.status !== undefined) {
        setClauses.push(`status = $${paramIndex}`);
        queryParams.push(updates.status);
        paramIndex++;
      }

      if (updates.rateLimit !== undefined) {
        setClauses.push(`rate_limit = $${paramIndex}`);
        queryParams.push(JSON.stringify(updates.rateLimit));
        paramIndex++;
      }

      if (updates.allowedIps !== undefined) {
        setClauses.push(`allowed_ips = $${paramIndex}`);
        queryParams.push(updates.allowedIps ? JSON.stringify(updates.allowedIps) : null);
        paramIndex++;
      }

      if (updates.webhookUrl !== undefined) {
        setClauses.push(`webhook_url = $${paramIndex}`);
        queryParams.push(updates.webhookUrl);
        paramIndex++;
      }

      if (setClauses.length === 0) {
        throw new Error('No updates provided');
      }

      setClauses.push(`updated_at = NOW()`);

      const query = `
        UPDATE api_keys
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}
        RETURNING id, name, description, scopes, expires_at,
                 rate_limit, allowed_ips, webhook_url, status,
                 created_at, updated_at
      `;

      queryParams.push(keyId, companyId);

      const result = await db.query(query, queryParams);

      if (result.rows.length === 0) {
        return null;
      }

      const apiKey = result.rows[0];

      // Update Redis cache if key exists
      const cachedKeys = await redis.keys('api_key:*');
      for (const cacheKey of cachedKeys) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const keyData = JSON.parse(cached);
          if (keyData.id === keyId) {
            await redis.setex(cacheKey, 86400, JSON.stringify({
              ...keyData,
              scopes: updates.scopes || keyData.scopes,
              rateLimit: updates.rateLimit || keyData.rateLimit,
              allowedIps: updates.allowedIps || keyData.allowedIps,
              status: updates.status || keyData.status
            }));
            break;
          }
        }
      }

      return {
        ...apiKey,
        scopes: JSON.parse(apiKey.scopes),
        rate_limit: JSON.parse(apiKey.rate_limit),
        allowed_ips: apiKey.allowed_ips ? JSON.parse(apiKey.allowed_ips) : null
      };
    } catch (error) {
      logger.error('Error updating API key:', error);
      throw error;
    }
  },

  async deleteApiKey(params: { keyId: string; companyId: string }): Promise<boolean> {
    try {
      const { keyId, companyId } = params;

      const query = `
        DELETE FROM api_keys
        WHERE id = $1 AND company_id = $2
        RETURNING id
      `;

      const result = await db.query(query, [keyId, companyId]);

      if (result.rows.length === 0) {
        return false;
      }

      // Remove from Redis cache
      const cachedKeys = await redis.keys('api_key:*');
      for (const cacheKey of cachedKeys) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const keyData = JSON.parse(cached);
          if (keyData.id === keyId) {
            await redis.del(cacheKey);
            break;
          }
        }
      }

      return true;
    } catch (error) {
      logger.error('Error deleting API key:', error);
      throw error;
    }
  },

  async regenerateApiKey(params: { keyId: string; companyId: string }) {
    try {
      const { keyId, companyId } = params;

      // Generate new API key
      const newApiKey = this.generateApiKey();
      const hashedKey = this.hashApiKey(newApiKey);

      const query = `
        UPDATE api_keys
        SET key_hash = $1, updated_at = NOW()
        WHERE id = $2 AND company_id = $3
        RETURNING id, name, description, scopes, expires_at,
                 rate_limit, allowed_ips, webhook_url, status,
                 created_at, updated_at
      `;

      const result = await db.query(query, [hashedKey, keyId, companyId]);

      if (result.rows.length === 0) {
        return null;
      }

      const apiKeyRecord = result.rows[0];

      // Update Redis cache
      const cachedKeys = await redis.keys('api_key:*');
      for (const cacheKey of cachedKeys) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const keyData = JSON.parse(cached);
          if (keyData.id === keyId) {
            await redis.del(cacheKey);
            // Create new cache entry with new key
            await redis.setex(`api_key:${newApiKey}`, 86400, JSON.stringify(keyData));
            break;
          }
        }
      }

      return {
        ...apiKeyRecord,
        apiKey: newApiKey, // Return the new key
        scopes: JSON.parse(apiKeyRecord.scopes),
        rate_limit: JSON.parse(apiKeyRecord.rate_limit),
        allowed_ips: apiKeyRecord.allowed_ips ? JSON.parse(apiKeyRecord.allowed_ips) : null
      };
    } catch (error) {
      logger.error('Error regenerating API key:', error);
      throw error;
    }
  },

  async getApiKeyUsage(params: ApiKeyUsageParams) {
    try {
      const { keyId, companyId, startDate, endDate, granularity } = params;

      // Check if API key exists
      const keyQuery = `
        SELECT id FROM api_keys
        WHERE id = $1 AND company_id = $2
      `;
      const keyResult = await db.query(keyQuery, [keyId, companyId]);

      if (keyResult.rows.length === 0) {
        return null;
      }

      const dateFormat = granularity === 'hour' ? 'YYYY-MM-DD HH24:00:00' :
                        granularity === 'day' ? 'YYYY-MM-DD' :
                        'YYYY-MM-DD'; // Default to day

      let whereClause = 'WHERE api_key_id = $1';
      const queryParams = [keyId];
      let paramIndex = 2;

      if (startDate) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        queryParams.push(startDate.toISOString());
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        queryParams.push(endDate.toISOString());
        paramIndex++;
      }

      const usageQuery = `
        SELECT 
          TO_CHAR(created_at, '${dateFormat}') as period,
          COUNT(*) as request_count,
          COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as success_count,
          COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
          AVG(response_time) as avg_response_time
        FROM api_usage_logs
        ${whereClause}
        GROUP BY TO_CHAR(created_at, '${dateFormat}')
        ORDER BY period
      `;

      const result = await db.query(usageQuery, queryParams);

      const totalQuery = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as total_success,
          COUNT(CASE WHEN status_code >= 400 THEN 1 END) as total_errors,
          AVG(response_time) as avg_response_time
        FROM api_usage_logs
        ${whereClause}
      `;

      const totalResult = await db.query(totalQuery, queryParams);

      return {
        summary: totalResult.rows[0],
        timeline: result.rows.map(row => ({
          period: row.period,
          requestCount: parseInt(row.request_count),
          successCount: parseInt(row.success_count),
          errorCount: parseInt(row.error_count),
          avgResponseTime: parseFloat(row.avg_response_time) || 0
        }))
      };
    } catch (error) {
      logger.error('Error getting API key usage:', error);
      throw error;
    }
  },

  async testApiKey(params: TestApiKeyParams) {
    try {
      const { keyId, companyId, endpoint, method, payload } = params;

      // Check if API key exists and get its details
      const keyQuery = `
        SELECT scopes, status FROM api_keys
        WHERE id = $1 AND company_id = $2
      `;
      const keyResult = await db.query(keyQuery, [keyId, companyId]);

      if (keyResult.rows.length === 0) {
        return null;
      }

      const apiKey = keyResult.rows[0];
      const scopes = JSON.parse(apiKey.scopes);

      // Validate endpoint access based on scopes
      const requiredScope = this.getRequiredScope(endpoint, method);
      if (!scopes.includes(requiredScope)) {
        return {
          success: false,
          error: `Insufficient scope. Required: ${requiredScope}`,
          statusCode: 403
        };
      }

      // Simulate API call
      const testResult = {
        success: true,
        endpoint,
        method,
        requiredScope,
        hasAccess: true,
        statusCode: 200,
        responseTime: Math.random() * 100 + 50, // Simulated response time
        payload: payload || null
      };

      return testResult;
    } catch (error) {
      logger.error('Error testing API key:', error);
      throw error;
    }
  },

  async getAvailableScopes() {
    return [
      {
        scope: 'receipts:read',
        description: 'Read access to receipts',
        endpoints: ['GET /api/receipts', 'GET /api/receipts/:id']
      },
      {
        scope: 'receipts:write',
        description: 'Create and update receipts',
        endpoints: ['POST /api/receipts', 'PUT /api/receipts/:id']
      },
      {
        scope: 'receipts:delete',
        description: 'Delete receipts',
        endpoints: ['DELETE /api/receipts/:id']
      },
      {
        scope: 'users:read',
        description: 'Read access to user information',
        endpoints: ['GET /api/users', 'GET /api/users/:id']
      },
      {
        scope: 'companies:read',
        description: 'Read access to company information',
        endpoints: ['GET /api/companies/:id']
      },
      {
        scope: 'analytics:read',
        description: 'Access to analytics and reporting',
        endpoints: ['GET /api/analytics/*']
      },
      {
        scope: 'search:read',
        description: 'Search functionality',
        endpoints: ['GET /api/search']
      },
      {
        scope: 'webhooks:manage',
        description: 'Manage webhooks',
        endpoints: ['POST /api/webhooks', 'PUT /api/webhooks/:id', 'DELETE /api/webhooks/:id']
      }
    ];
  },

  async getOpenApiSpec(companyId: string) {
    // Return OpenAPI 3.0 specification for the API
    return {
      openapi: '3.0.0',
      info: {
        title: 'Receipt Vault API',
        version: '1.0.0',
        description: 'API for managing receipts and expenses'
      },
      servers: [
        {
          url: 'https://api.receiptvault.com/v1',
          description: 'Production server'
        }
      ],
      security: [
        {
          ApiKeyAuth: []
        }
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        }
      },
      paths: {
        '/receipts': {
          get: {
            summary: 'List receipts',
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                name: 'page',
                in: 'query',
                schema: { type: 'integer', minimum: 1 }
              },
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer', minimum: 1, maximum: 100 }
              }
            ],
            responses: {
              '200': {
                description: 'List of receipts',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Receipt' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  },

  async getApiLimits(companyId: string) {
    // Get company-specific API limits
    const query = `
      SELECT 
        subscription_tier,
        api_limits
      FROM companies
      WHERE id = $1
    `;

    const result = await db.query(query, [companyId]);
    
    if (result.rows.length === 0) {
      return this.getDefaultApiLimits();
    }

    const company = result.rows[0];
    return company.api_limits || this.getDefaultApiLimits();
  },

  getDefaultApiLimits() {
    return {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      requestsPerMonth: 100000,
      maxApiKeys: 5,
      maxWebhooks: 3
    };
  },

  generateApiKey(): string {
    const prefix = 'rv_';
    const randomBytes = crypto.randomBytes(32);
    return prefix + randomBytes.toString('hex');
  },

  hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  },

  getRequiredScope(endpoint: string, method: string): string {
    // Map endpoints to required scopes
    const scopeMap: { [key: string]: string } = {
      'GET /receipts': 'receipts:read',
      'POST /receipts': 'receipts:write',
      'PUT /receipts': 'receipts:write',
      'DELETE /receipts': 'receipts:delete',
      'GET /users': 'users:read',
      'GET /companies': 'companies:read',
      'GET /analytics': 'analytics:read',
      'GET /search': 'search:read',
      'POST /webhooks': 'webhooks:manage',
      'PUT /webhooks': 'webhooks:manage',
      'DELETE /webhooks': 'webhooks:manage'
    };

    const key = `${method} ${endpoint.split('?')[0].replace(/\/:\w+/g, '')}`;
    return scopeMap[key] || 'unknown';
  },

  async validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    keyData?: any;
    error?: string;
  }> {
    try {
      // Check Redis cache first
      const cached = await redis.get(`api_key:${apiKey}`);
      if (cached) {
        const keyData = JSON.parse(cached);
        
        if (keyData.status !== 'active') {
          return { valid: false, error: 'API key is suspended' };
        }

        return { valid: true, keyData };
      }

      // Check database
      const hashedKey = this.hashApiKey(apiKey);
      const query = `
        SELECT 
          id, company_id, scopes, expires_at,
          rate_limit, allowed_ips, status
        FROM api_keys
        WHERE key_hash = $1
      `;

      const result = await db.query(query, [hashedKey]);

      if (result.rows.length === 0) {
        return { valid: false, error: 'Invalid API key' };
      }

      const keyRecord = result.rows[0];

      if (keyRecord.status !== 'active') {
        return { valid: false, error: 'API key is suspended' };
      }

      if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
        return { valid: false, error: 'API key has expired' };
      }

      const keyData = {
        id: keyRecord.id,
        companyId: keyRecord.company_id,
        scopes: JSON.parse(keyRecord.scopes),
        rateLimit: JSON.parse(keyRecord.rate_limit),
        allowedIps: keyRecord.allowed_ips ? JSON.parse(keyRecord.allowed_ips) : null,
        status: keyRecord.status
      };

      // Cache the result
      await redis.setex(`api_key:${apiKey}`, 86400, JSON.stringify(keyData));

      return { valid: true, keyData };
    } catch (error) {
      logger.error('Error validating API key:', error);
      return { valid: false, error: 'Validation error' };
    }
  }
};