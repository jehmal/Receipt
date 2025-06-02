import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@/utils/logger';

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

export const handleWebhook = async (
  request: FastifyRequest<{ Params: { id: string }; Body: any }>,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params;
    const payload = request.body;
    
    logger.info(`Webhook received for ID: ${id}`, { payload });
    
    // Process webhook payload here
    // This would typically trigger some business logic
    
    return reply.status(200).send({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const listWebhooks = async (
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; status?: string } }>,
  reply: FastifyReply
) => {
  try {
    const { page = 1, limit = 20, status } = request.query;
    const user = request.user;
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Mock response for now - would fetch from database
    const webhooks = [];
    const total = 0;
    
    return reply.send({
      success: true,
      data: {
        webhooks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error listing webhooks:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const createWebhook = async (
  request: FastifyRequest<{ Body: CreateWebhookBody }>,
  reply: FastifyReply
) => {
  try {
    const user = request.user;
    const webhookData = request.body;
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Validate webhook URL
    try {
      new URL(webhookData.url);
    } catch {
      return reply.status(400).send({
        success: false,
        error: 'Invalid webhook URL'
      });
    }
    
    // Mock webhook creation - would save to database
    const webhook = {
      id: 'webhook_' + Date.now(),
      ...webhookData,
      companyId: (user as any).companyId,
      createdBy: (user as any).id,
      createdAt: new Date().toISOString()
    };
    
    logger.info('Webhook created:', { webhook });
    
    return reply.status(201).send({
      success: true,
      data: webhook
    });
  } catch (error) {
    logger.error('Error creating webhook:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getWebhook = async (
  request: FastifyRequest<{ Params: { id: string } | { webhookId: string } }>,
  reply: FastifyReply
) => {
  try {
    const params = request.params;
    const id = 'id' in params ? params.id : params.webhookId;
    const user = request.user;
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Mock response - would fetch from database
    const webhook = null;
    
    if (!webhook) {
      return reply.status(404).send({
        success: false,
        error: 'Webhook not found'
      });
    }
    
    return reply.send({
      success: true,
      data: webhook
    });
  } catch (error) {
    logger.error('Error getting webhook:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const updateWebhook = async (
  request: FastifyRequest<{ Params: { id: string } | { webhookId: string }; Body: UpdateWebhookBody }>,
  reply: FastifyReply
) => {
  try {
    const params = request.params;
    const id = 'id' in params ? params.id : params.webhookId;
    const updates = request.body;
    const user = request.user;
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Validate URL if provided
    if (updates.url) {
      try {
        new URL(updates.url);
      } catch {
        return reply.status(400).send({
          success: false,
          error: 'Invalid webhook URL'
        });
      }
    }
    
    // Mock update - would update in database
    const updatedWebhook = {
      id,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    logger.info('Webhook updated:', { id, updates });
    
    return reply.send({
      success: true,
      data: updatedWebhook
    });
  } catch (error) {
    logger.error('Error updating webhook:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const deleteWebhook = async (
  request: FastifyRequest<{ Params: { id: string } | { webhookId: string } }>,
  reply: FastifyReply
) => {
  try {
    const params = request.params;
    const id = 'id' in params ? params.id : params.webhookId;
    const user = request.user;
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Mock deletion - would delete from database
    logger.info('Webhook deleted:', { id, userId: (user as any).id });
    
    return reply.status(204).send();
  } catch (error) {
    logger.error('Error deleting webhook:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const testWebhook = async (
  request: FastifyRequest<{ Params: { id: string } | { webhookId: string }; Body: { payload?: any } }>,
  reply: FastifyReply
) => {
  try {
    const params = request.params;
    const id = 'id' in params ? params.id : params.webhookId;
    const { payload = {} } = request.body;
    const user = request.user;
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Mock webhook test - would send test payload to webhook URL
    logger.info('Testing webhook:', { id, payload });
    
    return reply.send({
      success: true,
      data: {
        status: 'delivered',
        responseCode: 200,
        responseTime: 150,
        deliveredAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error testing webhook:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getWebhookDeliveries = async (
  request: FastifyRequest<{ 
    Params: { id: string } | { webhookId: string }; 
    Querystring: { page?: number; limit?: number; status?: string } 
  }>,
  reply: FastifyReply
) => {
  try {
    const params = request.params;
    const id = 'id' in params ? params.id : params.webhookId;
    const { page = 1, limit = 20, status } = request.query;
    const user = request.user;
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Mock response - would fetch delivery history from database
    const deliveries = [];
    const total = 0;
    
    return reply.send({
      success: true,
      data: {
        deliveries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error getting webhook deliveries:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getWebhookDetails = async (
  request: FastifyRequest<{ Params: { webhookId: string } }>,
  reply: FastifyReply
) => {
  return getWebhook(request, reply);
};

export const getDeliveryDetails = async (
  request: FastifyRequest<{ Params: { webhookId: string; deliveryId: string } }>,
  reply: FastifyReply
) => {
  try {
    const { webhookId, deliveryId } = request.params;
    const user = request.user;
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Mock response - would fetch from database
    const delivery = {
      id: deliveryId,
      webhookId,
      status: 'delivered',
      attempts: 1,
      responseCode: 200,
      responseTime: 150,
      createdAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString()
    };
    
    return reply.send({
      success: true,
      data: delivery
    });
  } catch (error) {
    logger.error('Error getting delivery details:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const retryDelivery = async (
  request: FastifyRequest<{ Params: { webhookId: string; deliveryId: string } }>,
  reply: FastifyReply
) => {
  try {
    const { webhookId, deliveryId } = request.params;
    const user = request.user;
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    logger.info('Retrying webhook delivery:', { webhookId, deliveryId });
    
    return reply.send({
      success: true,
      message: 'Delivery retry initiated'
    });
  } catch (error) {
    logger.error('Error retrying delivery:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getWebhookStats = async (
  request: FastifyRequest<{ 
    Params: { webhookId: string };
    Querystring: { startDate?: string; endDate?: string }
  }>,
  reply: FastifyReply
) => {
  try {
    const { webhookId } = request.params;
    const { startDate, endDate } = request.query;
    const user = request.user;
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    // Mock stats
    const stats = {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageResponseTime: 0,
      successRate: 0
    };
    
    return reply.send({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting webhook stats:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getAvailableEvents = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const events = [
      {
        name: 'receipt.created',
        description: 'Triggered when a new receipt is created',
        payload: {
          receiptId: 'string',
          companyId: 'string',
          userId: 'string'
        }
      },
      {
        name: 'receipt.updated',
        description: 'Triggered when a receipt is updated',
        payload: {
          receiptId: 'string',
          companyId: 'string',
          userId: 'string'
        }
      },
      {
        name: 'receipt.deleted',
        description: 'Triggered when a receipt is deleted',
        payload: {
          receiptId: 'string',
          companyId: 'string',
          userId: 'string'
        }
      }
    ];
    
    return reply.send({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Error getting available events:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const verifySignature = async (
  request: FastifyRequest<{ 
    Body: { payload: string; signature: string; secret: string }
  }>,
  reply: FastifyReply
) => {
  try {
    const { payload, signature, secret } = request.body;
    
    // Mock signature verification
    const isValid = signature.length > 0;
    
    return reply.send({
      success: true,
      data: {
        valid: isValid,
        message: isValid ? 'Signature is valid' : 'Invalid signature'
      }
    });
  } catch (error) {
    logger.error('Error verifying signature:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const webhooksController = {
  handleWebhook,
  listWebhooks,
  createWebhook,
  getWebhook,
  getWebhookDetails,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
  getDeliveryDetails,
  retryDelivery,
  getWebhookStats,
  getAvailableEvents,
  verifySignature
};