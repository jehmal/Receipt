import { FastifyPluginAsync } from 'fastify';
import { receiptService } from '@/services/receipts';

const receiptRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all receipts for user
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          category: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          search: { type: 'string' },
          status: { type: 'string', enum: ['uploaded', 'processing', 'processed', 'failed'] },
          sortBy: { type: 'string', enum: ['created_at', 'receipt_date', 'total_amount', 'vendor_name'], default: 'created_at' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          vendorName: { type: 'string' },
          minAmount: { type: 'number' },
          maxAmount: { type: 'number' },
          tags: { type: 'array', items: { type: 'string' } }
        },
      },
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const query = request.query as any;

      const filter = {
        userId: user.id,
        companyId: user.companyId,
        category: query.category,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        search: query.search,
        status: query.status,
        vendorName: query.vendorName,
        minAmount: query.minAmount,
        maxAmount: query.maxAmount,
        tags: query.tags
      };

      const pagination = {
        page: query.page || 1,
        limit: query.limit || 20,
        sortBy: query.sortBy || 'created_at',
        sortOrder: query.sortOrder || 'desc'
      };

      const result = await receiptService.getReceipts(filter, pagination);

      reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get receipts'
      });
    }
  });

  // Upload new receipt
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      
      // Handle multipart file upload
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Convert stream to buffer
      const buffer = await data.toBuffer();
      
      // Get additional fields from the multipart data
      const fields = data.fields;
      const category = fields?.category?.value as string;
      const description = fields?.description?.value as string;
      const tags = fields?.tags?.value ? JSON.parse(fields.tags.value as string) : undefined;

      const uploadData = {
        userId: user.id,
        companyId: user.companyId,
        originalFilename: data.filename,
        fileBuffer: buffer,
        category,
        description,
        tags
      };

      const receipt = await receiptService.uploadReceipt(uploadData);

      reply.code(201).send({
        success: true,
        message: 'Receipt uploaded successfully',
        data: receipt
      });
    } catch (error: any) {
      console.error('Receipt upload error:', error);
      reply.code(400).send({
        success: false,
        message: error.message || 'Failed to upload receipt'
      });
    }
  });

  // Get specific receipt
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;

      const receipt = await receiptService.getReceiptById(id, user.id);
      
      if (!receipt) {
        return reply.code(404).send({
          success: false,
          message: 'Receipt not found'
        });
      }

      reply.send({
        success: true,
        data: receipt
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get receipt'
      });
    }
  });

  // Update receipt
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          vendorName: { type: 'string' },
          totalAmount: { type: 'number' },
          currency: { type: 'string' },
          receiptDate: { type: 'string', format: 'date' },
          category: { type: 'string' },
          description: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;
      const updates = request.body as any;

      // Convert receiptDate string to Date if provided
      if (updates.receiptDate) {
        updates.receiptDate = new Date(updates.receiptDate);
      }

      const receipt = await receiptService.updateReceipt(id, user.id, updates);
      
      if (!receipt) {
        return reply.code(404).send({
          success: false,
          message: 'Receipt not found'
        });
      }

      reply.send({
        success: true,
        message: 'Receipt updated successfully',
        data: receipt
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        message: error.message || 'Failed to update receipt'
      });
    }
  });

  // Delete receipt
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;

      const deleted = await receiptService.deleteReceipt(id, user.id);
      
      if (!deleted) {
        return reply.code(404).send({
          success: false,
          message: 'Receipt not found'
        });
      }

      reply.send({
        success: true,
        message: 'Receipt deleted successfully'
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Failed to delete receipt'
      });
    }
  });

  // Export receipts
  fastify.post('/export', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['format'],
        properties: {
          format: { type: 'string', enum: ['pdf', 'csv', 'excel'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          category: { type: 'string' },
          receiptIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement receipt export
    reply.status(501).send({ message: 'Export receipts endpoint not implemented yet' });
  });

  // Get receipt analytics
  fastify.get('/analytics', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['week', 'month', 'quarter', 'year'], default: 'month' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement receipt analytics
    reply.status(501).send({ message: 'Receipt analytics endpoint not implemented yet' });
  });
};

export default receiptRoutes;