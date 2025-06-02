import { FastifyRequest, FastifyReply } from 'fastify';
import * as userService from '@/services/user';
import * as auditService from '@/services/audit';
import { logger } from '@/utils/logger';

interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
  status?: string;
}

interface UserStatusUpdate {
  status: string;
  reason?: string;
}

export const adminUsersController = {
  async getUsers(
    request: FastifyRequest<{ Querystring: UserQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { page = 1, limit = 20, search, companyId, status } = request.query;

      const users = await userService.getUsersWithFilters({
        page,
        limit,
        search: search || '',
        companyId: companyId || '',
        status: status || '',
        includeInactive: true
      });

      return reply.send({
        success: true,
        data: users.users,
        pagination: {
          page,
          limit,
          total: users.total,
          totalPages: Math.ceil(users.total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting users:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get users'
      });
    }
  },

  async getUserById(
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params;

      const user = await userService.getUserById(userId);

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found'
        });
      }

      return reply.send({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user'
      });
    }
  },

  async updateUserStatus(
    request: FastifyRequest<{ 
      Params: { userId: string }; 
      Body: UserStatusUpdate 
    }>,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params;
      const { status, reason } = request.body;
      const adminUser = request.user;

      const user = await userService.getUserById(userId);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found'
        });
      }

      const updatedUser = await userService.updateUserStatus(userId, status);

      // Log the action for audit trail
      await auditService.logAction({
        userId: (adminUser as any).id,
        action: 'user_status_update',
        resourceType: 'user',
        resourceId: userId,
        details: {
          previousStatus: (user as any).status,
          newStatus: status,
          reason
        },
        request: {
          ip: request.ip,
          headers: { 'user-agent': request.headers['user-agent'] }
        }
      });

      return reply.send({
        success: true,
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error updating user status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update user status'
      });
    }
  }
};