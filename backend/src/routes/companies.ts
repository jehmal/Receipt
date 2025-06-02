import { FastifyPluginAsync } from 'fastify';

const companyRoutes: FastifyPluginAsync = async (fastify) => {
  // Get company details
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    // TODO: Implement get company details
    reply.status(501).send({ message: 'Get company endpoint not implemented yet' });
  });

  // Update company settings
  fastify.put('/', {
    preHandler: [fastify.companyAdmin],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          domain: { type: 'string' },
          billingEmail: { type: 'string', format: 'email' },
          settings: { type: 'object' },
          retentionPolicyDays: { type: 'integer', minimum: 365 },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement update company
    reply.status(501).send({ message: 'Update company endpoint not implemented yet' });
  });

  // Get company users
  fastify.get('/users', {
    preHandler: [fastify.companyAdmin],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          role: { type: 'string', enum: ['company_admin', 'company_employee'] },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement get company users
    reply.status(501).send({ message: 'Get company users endpoint not implemented yet' });
  });

  // Invite user to company
  fastify.post('/users/invite', {
    preHandler: [fastify.companyAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['company_admin', 'company_employee'] },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement invite user
    reply.status(501).send({ message: 'Invite user endpoint not implemented yet' });
  });

  // Update user role
  fastify.put('/users/:userId/role', {
    preHandler: [fastify.companyAdmin],
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['company_admin', 'company_employee'] },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement update user role
    reply.status(501).send({ message: 'Update user role endpoint not implemented yet' });
  });

  // Remove user from company
  fastify.delete('/users/:userId', {
    preHandler: [fastify.companyAdmin],
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
    },
  }, async (request, reply) => {
    // TODO: Implement remove user
    reply.status(501).send({ message: 'Remove user endpoint not implemented yet' });
  });

  // Get company receipts
  fastify.get('/receipts', {
    preHandler: [fastify.companyAdmin],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          userId: { type: 'string', format: 'uuid' },
          category: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement get company receipts
    reply.status(501).send({ message: 'Get company receipts endpoint not implemented yet' });
  });

  // Approve/reject receipt
  fastify.post('/receipts/:receiptId/approve', {
    preHandler: [fastify.companyAdmin],
    schema: {
      params: {
        type: 'object',
        properties: {
          receiptId: { type: 'string', format: 'uuid' },
        },
        required: ['receiptId'],
      },
      body: {
        type: 'object',
        required: ['approved'],
        properties: {
          approved: { type: 'boolean' },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement approve/reject receipt
    reply.status(501).send({ message: 'Approve receipt endpoint not implemented yet' });
  });

  // Get company analytics
  fastify.get('/analytics', {
    preHandler: [fastify.companyAdmin],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['week', 'month', 'quarter', 'year'], default: 'month' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          groupBy: { type: 'string', enum: ['user', 'category', 'department'] },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement company analytics
    reply.status(501).send({ message: 'Company analytics endpoint not implemented yet' });
  });

  // Export company receipts
  fastify.post('/export', {
    preHandler: [fastify.companyAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['format'],
        properties: {
          format: { type: 'string', enum: ['pdf', 'csv', 'excel'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          category: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
          includeUnapproved: { type: 'boolean', default: false },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement company export
    reply.status(501).send({ message: 'Company export endpoint not implemented yet' });
  });
};

export default companyRoutes;