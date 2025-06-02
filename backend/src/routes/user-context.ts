import { FastifyPluginAsync } from 'fastify';

const userContextRoutes: FastifyPluginAsync = async (fastify) => {
  // Get current user context
  fastify.get('/context', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      
      return reply.send({
        success: true,
        data: {
          current_context: user.companyId ? 'company' : 'personal',
          user: {
            id: user.id,
            email: user.email,
            company_id: user.companyId,
            role: user.role || 'owner'
          }
        }
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get user context'
      });
    }
  });

  // Set user context (for switching between personal/company)
  fastify.put('/context', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['context'],
        properties: {
          context: { 
            type: 'string', 
            enum: ['personal', 'company'] 
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { context } = request.body as any;

      // Validate context switch
      if (context === 'company' && !user.companyId) {
        return reply.code(400).send({
          success: false,
          message: 'User is not associated with a company'
        });
      }

      // Update user's current context preference
      const { db } = await import('@/database/connection');
      await db.query(
        'UPDATE users SET preferred_context = $1, updated_at = NOW() WHERE id = $2',
        [context, user.id]
      );

      return reply.send({
        success: true,
        data: {
          current_context: context,
          user: {
            id: user.id,
            email: user.email,
            company_id: user.companyId,
            role: user.role || 'owner'
          }
        }
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to update user context'
      });
    }
  });

  // Get user settings for mobile app
  fastify.get('/settings', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      
      const { db } = await import('@/database/connection');
      const result = await db.query(
        `SELECT 
          preferred_context,
          settings,
          created_at,
          updated_at
         FROM users 
         WHERE id = $1`,
        [user.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      const userData = result.rows[0];
      
      return reply.send({
        success: true,
        data: {
          user_id: user.id,
          email: user.email,
          preferred_context: userData.preferred_context || 'personal',
          settings: userData.settings || {},
          company_id: user.companyId,
          role: user.role,
          created_at: userData.created_at,
          updated_at: userData.updated_at
        }
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get user settings'
      });
    }
  });

  // Update user settings
  fastify.put('/settings', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          preferred_context: { 
            type: 'string', 
            enum: ['personal', 'company'] 
          },
          settings: {
            type: 'object',
            properties: {
              notifications_enabled: { type: 'boolean' },
              auto_categorization: { type: 'boolean' },
              voice_memos_enabled: { type: 'boolean' },
              dark_mode: { type: 'boolean' },
              auto_sync: { type: 'boolean' },
              biometric_auth: { type: 'boolean' },
              default_currency: { type: 'string' },
              receipt_reminder_days: { type: 'integer' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { preferred_context, settings } = request.body as any;

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (preferred_context !== undefined) {
        updateFields.push(`preferred_context = $${++paramCount}`);
        params.push(preferred_context);
      }

      if (settings !== undefined) {
        updateFields.push(`settings = $${++paramCount}`);
        params.push(JSON.stringify(settings));
      }

      if (updateFields.length === 0) {
        return reply.code(400).send({
          success: false,
          message: 'No fields to update'
        });
      }

      updateFields.push('updated_at = NOW()');
      params.push(user.id);

      const { db } = await import('@/database/connection');
      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${++paramCount}
        RETURNING preferred_context, settings, updated_at
      `;

      const result = await db.query(query, params);
      
      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      const updatedUser = result.rows[0];

      return reply.send({
        success: true,
        message: 'Settings updated successfully',
        data: {
          user_id: user.id,
          preferred_context: updatedUser.preferred_context,
          settings: updatedUser.settings,
          updated_at: updatedUser.updated_at
        }
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to update user settings'
      });
    }
  });

  // Get recent job numbers for the current user (for mobile job number field)
  fastify.get('/recent-job-numbers', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { limit } = request.query as any;

      const { db } = await import('@/database/connection');
      const result = await db.query(
        `SELECT DISTINCT job_number, MAX(created_at) as last_used
         FROM receipts 
         WHERE user_id = $1 
           AND job_number IS NOT NULL 
           AND job_number != ''
           AND deleted_at IS NULL
         GROUP BY job_number
         ORDER BY last_used DESC
         LIMIT $2`,
        [user.id, limit || 10]
      );

      const jobNumbers = result.rows.map(row => ({
        job_number: row.job_number,
        last_used: row.last_used
      }));

      return reply.send({
        success: true,
        data: {
          job_numbers: jobNumbers
        }
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get recent job numbers'
      });
    }
  });
};

export default userContextRoutes;