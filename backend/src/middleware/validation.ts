import { FastifyRequest, FastifyReply } from 'fastify';
import Joi from 'joi';

export interface ValidationSchema {
  body?: Joi.Schema;
  querystring?: Joi.Schema;
  params?: Joi.Schema;
  headers?: Joi.Schema;
}

export function createValidationMiddleware(schema: ValidationSchema) {
  return async function validate(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const errors: string[] = [];

    // Validate body
    if (schema.body && request.body) {
      const { error } = schema.body.validate(request.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => `body.${detail.path.join('.')}: ${detail.message}`));
      }
    }

    // Validate query string
    if (schema.querystring && request.query) {
      const { error } = schema.querystring.validate(request.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => `query.${detail.path.join('.')}: ${detail.message}`));
      }
    }

    // Validate params
    if (schema.params && request.params) {
      const { error } = schema.params.validate(request.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => `params.${detail.path.join('.')}: ${detail.message}`));
      }
    }

    // Validate headers
    if (schema.headers && request.headers) {
      const { error } = schema.headers.validate(request.headers, { 
        abortEarly: false,
        allowUnknown: true // Allow additional headers
      });
      if (error) {
        errors.push(...error.details.map(detail => `headers.${detail.path.join('.')}: ${detail.message}`));
      }
    }

    if (errors.length > 0) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: errors
      });
    }
  };
}

// Common validation schemas
export const commonSchemas = {
  id: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  },
  dateRange: {
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate'))
  }
};

// Receipt-specific validation schemas
export const receiptSchemas = {
  createReceipt: Joi.object({
    merchant: Joi.string().required(),
    amount: Joi.number().positive().required(),
    date: Joi.date().iso().required(),
    category: Joi.string().required(),
    description: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional()
  }),
  
  updateReceipt: Joi.object({
    merchant: Joi.string().optional(),
    amount: Joi.number().positive().optional(),
    date: Joi.date().iso().optional(),
    category: Joi.string().optional(),
    description: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional()
  }).min(1), // At least one field must be provided
  
  searchReceipts: Joi.object({
    query: Joi.string().optional(),
    category: Joi.string().optional(),
    minAmount: Joi.number().positive().optional(),
    maxAmount: Joi.number().positive().min(Joi.ref('minAmount')).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};
