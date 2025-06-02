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
          receiptIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          merchantName: { type: 'string' },
          amountMin: { type: 'number', minimum: 0 },
          amountMax: { type: 'number', minimum: 0 },
          status: { type: 'string', enum: ['uploaded', 'processing', 'processed', 'failed'] },
          requiresApproval: { type: 'boolean' },
          approvedBy: { type: 'string', format: 'uuid' },
          includeImages: { type: 'boolean', default: false },
          includeOcrText: { type: 'boolean', default: false },
          groupByCategory: { type: 'boolean', default: false },
          groupByMerchant: { type: 'boolean', default: false },
          sortBy: { type: 'string', enum: ['date', 'amount', 'merchant', 'category'], default: 'date' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          template: { type: 'string', enum: ['summary', 'detailed', 'financial'], default: 'detailed' },
          customFields: { type: 'array', items: { type: 'string' } }
        },
      },
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const exportParams = request.body as any;

      // Import export service
      const { exportService } = await import('@/services/export');

      // Prepare filters
      const filters = {
        userId: user.id,
        companyId: user.companyId,
        receiptIds: exportParams.receiptIds,
        dateFrom: exportParams.dateFrom ? new Date(exportParams.dateFrom) : undefined,
        dateTo: exportParams.dateTo ? new Date(exportParams.dateTo) : undefined,
        category: exportParams.category,
        tags: exportParams.tags,
        merchantName: exportParams.merchantName,
        amountMin: exportParams.amountMin,
        amountMax: exportParams.amountMax,
        status: exportParams.status,
        requiresApproval: exportParams.requiresApproval,
        approvedBy: exportParams.approvedBy
      };

      // Prepare options
      const options = {
        format: exportParams.format,
        includeImages: exportParams.includeImages,
        includeOcrText: exportParams.includeOcrText,
        groupByCategory: exportParams.groupByCategory,
        groupByMerchant: exportParams.groupByMerchant,
        sortBy: exportParams.sortBy,
        sortOrder: exportParams.sortOrder,
        template: exportParams.template,
        customFields: exportParams.customFields
      };

      // Create export job
      const job = await exportService.createExportJob(user.id, filters, options);

      reply.code(202).send({
        success: true,
        message: 'Export job created successfully',
        data: {
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          format: job.format,
          createdAt: job.createdAt,
          expiresAt: job.expiresAt
        }
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        message: error.message || 'Failed to create export job'
      });
    }
  });

  // Get export job status
  fastify.get('/export/:jobId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string', format: 'uuid' }
        },
        required: ['jobId']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { jobId } = request.params as any;

      const { exportService } = await import('@/services/export');
      const job = await exportService.getExportJob(jobId, user.id);

      if (!job) {
        return reply.code(404).send({
          success: false,
          message: 'Export job not found'
        });
      }

      reply.send({
        success: true,
        data: job
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get export job status'
      });
    }
  });

  // Get user's export jobs
  fastify.get('/export', {
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

      const { exportService } = await import('@/services/export');
      const jobs = await exportService.getUserExportJobs(user.id, limit);

      reply.send({
        success: true,
        data: jobs
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get export jobs'
      });
    }
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