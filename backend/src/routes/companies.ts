import { FastifyPluginAsync } from 'fastify';
import { companyService } from '@/services/company';

const companyRoutes: FastifyPluginAsync = async (fastify) => {
  // Create new company
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          domain: { type: 'string', maxLength: 255 },
          subscriptionTier: { 
            type: 'string', 
            enum: ['free', 'personal', 'business', 'enterprise'],
            default: 'business'
          },
          maxUsers: { type: 'integer', minimum: 1, maximum: 1000 },
          maxStorageGb: { type: 'integer', minimum: 1, maximum: 10000 },
          billingEmail: { type: 'string', format: 'email' },
          taxId: { type: 'string', maxLength: 50 },
          address: {
            type: 'object',
            properties: {
              line1: { type: 'string', maxLength: 255 },
              line2: { type: 'string', maxLength: 255 },
              city: { type: 'string', maxLength: 100 },
              state: { type: 'string', maxLength: 100 },
              postalCode: { type: 'string', maxLength: 20 },
              country: { type: 'string', maxLength: 2, default: 'US' }
            }
          },
          settings: { type: 'object' },
          retentionPolicyDays: { type: 'integer', minimum: 1, maximum: 10000 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const companyData = request.body as any;

      const company = await companyService.createCompany({
        ...companyData,
        adminUserId: user.id
      });

      reply.code(201).send({
        success: true,
        message: 'Company created successfully',
        data: company
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        message: error.message || 'Failed to create company'
      });
    }
  });

  // Get user's companies
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const companies = await companyService.getUserCompanies(user.id);

      reply.send({
        success: true,
        data: companies
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get companies'
      });
    }
  });

  // Get specific company details
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;

      const company = await companyService.getCompanyById(id, user.id);

      reply.send({
        success: true,
        data: company
      });
    } catch (error: any) {
      const statusCode = error.message.includes('Access denied') ? 403 : 
                        error.message.includes('not found') ? 404 : 500;
      
      reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to get company'
      });
    }
  });

  // Update company
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          domain: { type: 'string', maxLength: 255 },
          maxUsers: { type: 'integer', minimum: 1, maximum: 1000 },
          maxStorageGb: { type: 'integer', minimum: 1, maximum: 10000 },
          billingEmail: { type: 'string', format: 'email' },
          taxId: { type: 'string', maxLength: 50 },
          address: {
            type: 'object',
            properties: {
              line1: { type: 'string', maxLength: 255 },
              line2: { type: 'string', maxLength: 255 },
              city: { type: 'string', maxLength: 100 },
              state: { type: 'string', maxLength: 100 },
              postalCode: { type: 'string', maxLength: 20 },
              country: { type: 'string', maxLength: 2 }
            }
          },
          settings: { type: 'object' },
          retentionPolicyDays: { type: 'integer', minimum: 1, maximum: 10000 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;
      const updates = request.body as any;

      const company = await companyService.updateCompany(id, user.id, updates);

      reply.send({
        success: true,
        message: 'Company updated successfully',
        data: company
      });
    } catch (error: any) {
      const statusCode = error.message.includes('Insufficient permissions') ? 403 :
                        error.message.includes('not found') ? 404 :
                        error.message.includes('already taken') ? 409 : 400;

      reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to update company'
      });
    }
  });

  // Delete company
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;

      await companyService.deleteCompany(id, user.id);

      reply.send({
        success: true,
        message: 'Company deleted successfully'
      });
    } catch (error: any) {
      const statusCode = error.message.includes('Insufficient permissions') ? 403 : 500;

      reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to delete company'
      });
    }
  });

  // Get company members
  fastify.get('/:id/members', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;

      const members = await companyService.getCompanyMembers(id, user.id);

      reply.send({
        success: true,
        data: members
      });
    } catch (error: any) {
      const statusCode = error.message.includes('Access denied') ? 403 : 500;

      reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to get company members'
      });
    }
  });

  // Invite user to company
  fastify.post('/:id/members/invite', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['email', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          role: { 
            type: 'string', 
            enum: ['company_admin', 'company_employee'] 
          },
          firstName: { type: 'string', maxLength: 100 },
          lastName: { type: 'string', maxLength: 100 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;
      const inviteData = request.body as any;

      const invitation = await companyService.inviteUser(id, user.id, inviteData);

      reply.code(201).send({
        success: true,
        message: 'Invitation sent successfully',
        data: {
          invitationId: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error: any) {
      const statusCode = error.message.includes('Insufficient permissions') ? 403 :
                        error.message.includes('already a member') ? 409 :
                        error.message.includes('maximum user limit') ? 429 : 400;

      reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to send invitation'
      });
    }
  });

  // Accept company invitation
  fastify.post('/invitations/:token/accept', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          token: { type: 'string' }
        },
        required: ['token']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { token } = request.params as any;

      await companyService.acceptInvitation(token, user.id);

      reply.send({
        success: true,
        message: 'Invitation accepted successfully'
      });
    } catch (error: any) {
      const statusCode = error.message.includes('Invalid or expired') ? 404 :
                        error.message.includes('does not match') ? 403 : 400;

      reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to accept invitation'
      });
    }
  });

  // Remove company member
  fastify.delete('/:id/members/:memberId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          memberId: { type: 'string', format: 'uuid' }
        },
        required: ['id', 'memberId']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id, memberId } = request.params as any;

      await companyService.removeMember(id, user.id, memberId);

      reply.send({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error: any) {
      const statusCode = error.message.includes('Insufficient permissions') ? 403 :
                        error.message.includes('not found') ? 404 :
                        error.message.includes('Cannot remove') ? 409 : 500;

      reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to remove member'
      });
    }
  });

  // Update member role
  fastify.put('/:id/members/:memberId/role', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          memberId: { type: 'string', format: 'uuid' }
        },
        required: ['id', 'memberId']
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { 
            type: 'string', 
            enum: ['company_admin', 'company_employee'] 
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id, memberId } = request.params as any;
      const { role } = request.body as any;

      await companyService.updateMemberRole(id, user.id, memberId, role);

      reply.send({
        success: true,
        message: 'Member role updated successfully'
      });
    } catch (error: any) {
      const statusCode = error.message.includes('Insufficient permissions') ? 403 :
                        error.message.includes('not found') ? 404 :
                        error.message.includes('Invalid role') ? 400 : 500;

      reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to update member role'
      });
    }
  });

  // Get company analytics
  fastify.get('/:id/analytics', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;

      const analytics = await companyService.getCompanyAnalytics(id, user.id);

      reply.send({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      const statusCode = error.message.includes('Access denied') ? 403 : 500;

      reply.code(statusCode).send({
        success: false,
        message: error.message || 'Failed to get company analytics'
      });
    }
  });
};

export default companyRoutes;