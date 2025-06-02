import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { jobQueueService } from '@/services/job-queue';
import { ocrService } from '@/services/ocr';
import { receiptService } from '@/services/receipts';

interface JobStatusRequest {
  Params: {
    jobId: string;
    queueName: string;
  };
}

interface RetryJobRequest {
  Params: {
    jobId: string;
    queueName: string;
  };
}

interface RetryReceiptOCRRequest {
  Params: {
    receiptId: string;
  };
}

const jobsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get job status
  fastify.get<JobStatusRequest>(
    '/status/:queueName/:jobId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Jobs'],
        summary: 'Get job status',
        params: {
          type: 'object',
          properties: {
            queueName: { type: 'string', enum: ['ocr', 'email', 'export'] },
            jobId: { type: 'string' }
          },
          required: ['queueName', 'jobId']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              data: { type: 'object' },
              progress: { type: 'number' },
              status: { type: 'string' },
              processedOn: { type: ['number', 'null'] },
              finishedOn: { type: ['number', 'null'] },
              failedReason: { type: ['string', 'null'] },
              returnvalue: { type: ['object', 'null'] }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<JobStatusRequest>, reply: FastifyReply) => {
      try {
        const { jobId, queueName } = request.params;
        
        const jobStatus = await jobQueueService.getJobStatus(jobId, queueName);
        
        return reply.send(jobStatus);
      } catch (error: any) {
        return reply.status(500).send({
          error: 'Failed to get job status',
          message: error.message
        });
      }
    }
  );

  // Get queue statistics
  fastify.get(
    '/stats',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Jobs'],
        summary: 'Get queue statistics',
        response: {
          200: {
            type: 'object',
            properties: {
              ocr: {
                type: 'object',
                properties: {
                  waiting: { type: 'number' },
                  active: { type: 'number' },
                  completed: { type: 'number' },
                  failed: { type: 'number' }
                }
              },
              email: {
                type: 'object',
                properties: {
                  waiting: { type: 'number' },
                  active: { type: 'number' },
                  completed: { type: 'number' },
                  failed: { type: 'number' }
                }
              },
              export: {
                type: 'object',
                properties: {
                  waiting: { type: 'number' },
                  active: { type: 'number' },
                  completed: { type: 'number' },
                  failed: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await jobQueueService.getQueueStats();
        return reply.send(stats);
      } catch (error: any) {
        return reply.status(500).send({
          error: 'Failed to get queue stats',
          message: error.message
        });
      }
    }
  );

  // Retry failed job
  fastify.post<RetryJobRequest>(
    '/retry/:queueName/:jobId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Jobs'],
        summary: 'Retry failed job',
        params: {
          type: 'object',
          properties: {
            queueName: { type: 'string', enum: ['ocr', 'email', 'export'] },
            jobId: { type: 'string' }
          },
          required: ['queueName', 'jobId']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<RetryJobRequest>, reply: FastifyReply) => {
      try {
        const { jobId, queueName } = request.params;
        
        const retried = await jobQueueService.retryFailedJob(jobId, queueName);
        
        if (retried) {
          return reply.send({
            success: true,
            message: 'Job retried successfully'
          });
        } else {
          return reply.status(404).send({
            success: false,
            message: 'Job not found or not in failed state'
          });
        }
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          message: error.message
        });
      }
    }
  );

  // Get OCR processing statistics
  fastify.get(
    '/ocr/stats',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['OCR'],
        summary: 'Get OCR processing statistics',
        response: {
          200: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              processed: { type: 'number' },
              processing: { type: 'number' },
              failed: { type: 'number' },
              pending: { type: 'number' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await ocrService.getProcessingStats();
        return reply.send(stats);
      } catch (error: any) {
        return reply.status(500).send({
          error: 'Failed to get OCR stats',
          message: error.message
        });
      }
    }
  );

  // Retry OCR processing for a specific receipt
  fastify.post<RetryReceiptOCRRequest>(
    '/ocr/retry/:receiptId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['OCR'],
        summary: 'Retry OCR processing for receipt',
        params: {
          type: 'object',
          properties: {
            receiptId: { type: 'string' }
          },
          required: ['receiptId']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              jobId: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<RetryReceiptOCRRequest>, reply: FastifyReply) => {
      try {
        const { receiptId } = request.params;
        const userId = (request.user as any).id;

        // Verify user owns the receipt
        const receipt = await receiptService.getReceiptById(receiptId, userId);
        if (!receipt) {
          return reply.status(404).send({
            success: false,
            message: 'Receipt not found'
          });
        }

        // Add OCR job to queue
        const job = await jobQueueService.addOCRJob({
          receiptId,
          filePath: receipt.filePath,
          userId,
          priority: 1 // High priority for manual retries
        });

        return reply.send({
          success: true,
          message: 'OCR processing queued successfully',
          jobId: job.id as string
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          message: error.message
        });
      }
    }
  );

  // Queue OCR processing for all pending receipts
  fastify.post(
    '/ocr/queue-pending',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['OCR'],
        summary: 'Queue OCR processing for all pending receipts',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              queuedCount: { type: 'number' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request.user as any).id;

        // Get all receipts with status 'uploaded' for this user
        const pendingReceipts = await receiptService.getReceipts(
          {
            userId,
            status: 'uploaded'
          },
          {
            page: 1,
            limit: 1000 // Process up to 1000 receipts at once
          }
        );

        let queuedCount = 0;
        
        // Queue OCR jobs for each pending receipt
        for (const receipt of pendingReceipts.receipts) {
          try {
            await jobQueueService.addOCRJob({
              receiptId: receipt.id,
              filePath: receipt.filePath,
              userId,
              priority: 0
            });
            queuedCount++;
          } catch (error) {
            console.warn(`Failed to queue OCR for receipt ${receipt.id}:`, error);
          }
        }

        return reply.send({
          success: true,
          message: `Queued OCR processing for ${queuedCount} receipts`,
          queuedCount
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          message: error.message
        });
      }
    }
  );

  // Clean old jobs
  fastify.post(
    '/cleanup',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Jobs'],
        summary: 'Clean old completed and failed jobs',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await jobQueueService.cleanOldJobs();
        
        return reply.send({
          success: true,
          message: 'Old jobs cleaned successfully'
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          message: error.message
        });
      }
    }
  );
};

export default jobsRoutes;