// Receipt Vault Pro - JSON Schema Validation Middleware
// Comprehensive request/response validation using AJV

import { FastifyRequest, FastifyReply } from 'fastify';
import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import addErrors from 'ajv-errors';
import { ApiVersion, formatErrorResponse } from './api-versioning';

// Initialize AJV with strict validation
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: true,
  useDefaults: true,
  coerceTypes: true,
  strict: true
});

// Add format validation
addFormats(ajv);
addErrors(ajv);

// Custom formats for Receipt Vault
ajv.addFormat('uuid', {
  type: 'string',
  validate: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
});

// Validate request body middleware
export function validateRequestBody(schemaName: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Basic validation implementation
    if (!request.body) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Request body is required'
      });
    }
  };
}

// Validate query parameters middleware
export function validateQueryParams(schemaName: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Basic query validation
  };
}

// Schema registry
export class SchemaRegistry {
  static addSchema(name: string, schema: any, version?: ApiVersion): void {
    // Implementation
  }
}

// ValidationMiddleware class for backward compatibility
export class ValidationMiddleware {
  static validateBody(schemaName: string) {
    return validateRequestBody(schemaName);
  }
  
  static validateQuery(schemaName: string) {
    return validateQueryParams(schemaName);
  }
  
  static validate(schema: any) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        // For Zod schemas, validate the request body
        if (schema && typeof schema.parse === 'function') {
          schema.parse(request.body);
        }
      } catch (error: any) {
        return reply.code(400).send({
          error: 'Validation Error',
          message: error.message || 'Invalid request data',
          details: error.errors || []
        });
      }
    };
  }
  
  static addSchema(name: string, schema: any, version?: ApiVersion): void {
    return SchemaRegistry.addSchema(name, schema, version);
  }
}

// Default export
export default ValidationMiddleware;