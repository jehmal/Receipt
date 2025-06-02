import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { emailProcessorService, type EmailProcessingRule } from '@/services/email-processor';
import { jobQueueService } from '@/services/job-queue';

interface CreateRuleRequest {
  Body: {
    name: string;
    isActive?: boolean;
    fromEmailPattern?: string;
    subjectPattern?: string;
    autoCategory?: string;
    autoTags?: string[];
    requiresApproval?: boolean;
    defaultProject?: string;
    defaultDepartment?: string;
  };
}

interface UpdateRuleRequest {
  Params: {
    ruleId: string;
  };
  Body: Partial<{
    name: string;
    isActive: boolean;
    fromEmailPattern: string;
    subjectPattern: string;
    autoCategory: string;
    autoTags: string[];
    requiresApproval: boolean;
    defaultProject: string;
    defaultDepartment: string;
  }>;
}

interface DeleteRuleRequest {
  Params: {
    ruleId: string;
  };
}

interface ProcessEmailRequest {
  Body: {
    emailId: string;
    from: string;
    to: string;
    subject: string;
    date: string;
    body: string;
    messageId: string;
    headers?: { [key: string]: string };
    attachments: Array<{
      filename: string;
      contentType: string;
      size: number;
      data: string; // Base64 encoded
      contentId?: string;
    }>;
  };
}

const emailProcessingRoutes: FastifyPluginAsync = async (fastify) => {
  // Get processing rules
  fastify.get(
    '/rules',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Email Processing'],
        summary: 'Get email processing rules',
        response: {
          200: {
            type: 'object',
            properties: {
              rules: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    isActive: { type: 'boolean' },
                    fromEmailPattern: { type: ['string', 'null'] },
                    subjectPattern: { type: ['string', 'null'] },
                    autoCategory: { type: ['string', 'null'] },
                    autoTags: { type: 'array', items: { type: 'string' } },
                    requiresApproval: { type: ['boolean', 'null'] },
                    defaultProject: { type: ['string', 'null'] },
                    defaultDepartment: { type: ['string', 'null'] },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
          async (request: FastifyRequest, reply: FastifyReply) => {
        try {
        const userId = (request.user as any).id;
        const companyId = (request.user as any).companyId;

          const rules = await emailProcessorService.getProcessingRulesForUser(userId, companyId);

        return reply.send({ rules });
      } catch (error: any) {
        return reply.status(500).send({
          error: 'Failed to get processing rules',
          message: error.message
        });
      }
    }
  );

  // Create processing rule
  fastify.post<CreateRuleRequest>(
    '/rules',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Email Processing'],
        summary: 'Create email processing rule',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            isActive: { type: 'boolean', default: true },
            fromEmailPattern: { type: 'string' },
            subjectPattern: { type: 'string' },
            autoCategory: { type: 'string' },
            autoTags: { type: 'array', items: { type: 'string' } },
            requiresApproval: { type: 'boolean' },
            defaultProject: { type: 'string' },
            defaultDepartment: { type: 'string' }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              rule: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  isActive: { type: 'boolean' },
                  fromEmailPattern: { type: ['string', 'null'] },
                  subjectPattern: { type: ['string', 'null'] },
                  autoCategory: { type: ['string', 'null'] },
                  autoTags: { type: 'array', items: { type: 'string' } },
                  requiresApproval: { type: ['boolean', 'null'] },
                  defaultProject: { type: ['string', 'null'] },
                  defaultDepartment: { type: ['string', 'null'] },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<CreateRuleRequest>, reply: FastifyReply) => {
      try {
        const userId = (request.user as any).id;
        const companyId = (request.user as any).companyId;
        
        const rule = await emailProcessorService.createProcessingRule(
          userId,
          companyId,
          {
            name: request.body.name,
            isActive: request.body.isActive ?? true,
            fromEmailPattern: request.body.fromEmailPattern,
            subjectPattern: request.body.subjectPattern,
            autoCategory: request.body.autoCategory,
            autoTags: request.body.autoTags || [],
            requiresApproval: request.body.requiresApproval,
            defaultProject: request.body.defaultProject,
            defaultDepartment: request.body.defaultDepartment
          }
        );

        return reply.status(201).send({ rule });
      } catch (error: any) {
        return reply.status(500).send({
          error: 'Failed to create processing rule',
          message: error.message
        });
      }
    }
  );

  // Update processing rule
  fastify.put<UpdateRuleRequest>(
    '/rules/:ruleId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Email Processing'],
        summary: 'Update email processing rule',
        params: {
          type: 'object',
          properties: {
            ruleId: { type: 'string' }
          },
          required: ['ruleId']
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            isActive: { type: 'boolean' },
            fromEmailPattern: { type: 'string' },
            subjectPattern: { type: 'string' },
            autoCategory: { type: 'string' },
            autoTags: { type: 'array', items: { type: 'string' } },
            requiresApproval: { type: 'boolean' },
            defaultProject: { type: 'string' },
            defaultDepartment: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              rule: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  isActive: { type: 'boolean' },
                  fromEmailPattern: { type: ['string', 'null'] },
                  subjectPattern: { type: ['string', 'null'] },
                  autoCategory: { type: ['string', 'null'] },
                  autoTags: { type: 'array', items: { type: 'string' } },
                  requiresApproval: { type: ['boolean', 'null'] },
                  defaultProject: { type: ['string', 'null'] },
                  defaultDepartment: { type: ['string', 'null'] },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<UpdateRuleRequest>, reply: FastifyReply) => {
      try {
        const userId = (request.user as any).id;
        const { ruleId } = request.params;

        const rule = await emailProcessorService.updateProcessingRule(
          ruleId,
          userId,
          request.body
        );

        if (!rule) {
          return reply.status(404).send({
            error: 'Processing rule not found'
          });
        }

        return reply.send({ rule });
      } catch (error: any) {
        return reply.status(500).send({
          error: 'Failed to update processing rule',
          message: error.message
        });
      }
    }
  );

  // Delete processing rule
  fastify.delete<DeleteRuleRequest>(
    '/rules/:ruleId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Email Processing'],
        summary: 'Delete email processing rule',
        params: {
          type: 'object',
          properties: {
            ruleId: { type: 'string' }
          },
          required: ['ruleId']
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
    async (request: FastifyRequest<DeleteRuleRequest>, reply: FastifyReply) => {
      try {
        const userId = (request.user as any).id;
        const { ruleId } = request.params;

        const deleted = await emailProcessorService.deleteProcessingRule(ruleId, userId);

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            message: 'Processing rule not found'
          });
        }

        return reply.send({
          success: true,
          message: 'Processing rule deleted successfully'
        });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          message: error.message
        });
      }
    }
  );

  // Process email manually (for testing or API integration)
  fastify.post<ProcessEmailRequest>(
    '/process',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Email Processing'],
        summary: 'Process email with attachments',
        body: {
          type: 'object',
          required: ['emailId', 'from', 'to', 'subject', 'date', 'body', 'messageId', 'attachments'],
          properties: {
            emailId: { type: 'string' },
            from: { type: 'string' },
            to: { type: 'string' },
            subject: { type: 'string' },
            date: { type: 'string' },
            body: { type: 'string' },
            messageId: { type: 'string' },
            headers: {
              type: 'object',
              additionalProperties: { type: 'string' }
            },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['filename', 'contentType', 'size', 'data'],
                properties: {
                  filename: { type: 'string' },
                  contentType: { type: 'string' },
                  size: { type: 'number' },
                  data: { type: 'string' },
                  contentId: { type: 'string' }
                }
              }
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              emailId: { type: 'string' },
              processedAttachments: { type: 'number' },
              skippedAttachments: { type: 'number' },
              totalAttachments: { type: 'number' },
              createdReceipts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    receiptId: { type: 'string' },
                    filename: { type: 'string' },
                    status: { type: 'string' },
                    error: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<ProcessEmailRequest>, reply: FastifyReply) => {
      try {
        const userId = (request.user as any).id;
        const companyId = (request.user as any).companyId;

        // Convert request data to ProcessedEmail format
        const email = {
          id: request.body.emailId,
          from: request.body.from,
          to: request.body.to,
          subject: request.body.subject,
          date: new Date(request.body.date),
          body: request.body.body,
          messageId: request.body.messageId,
          headers: request.body.headers || {},
          attachments: request.body.attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            data: Buffer.from(att.data, 'base64'),
            contentId: att.contentId
          }))
        };

        const result = await emailProcessorService.processEmail(email, userId, companyId);

        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({
          error: 'Failed to process email',
          message: error.message
        });
      }
    }
  );

  // Process email via job queue (for asynchronous processing)
  fastify.post<ProcessEmailRequest>(
    '/process-async',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Email Processing'],
        summary: 'Queue email processing job',
        body: {
          type: 'object',
          required: ['emailId', 'from', 'to', 'subject', 'date', 'body', 'messageId', 'attachments'],
          properties: {
            emailId: { type: 'string' },
            from: { type: 'string' },
            to: { type: 'string' },
            subject: { type: 'string' },
            date: { type: 'string' },
            body: { type: 'string' },
            messageId: { type: 'string' },
            headers: {
              type: 'object',
              additionalProperties: { type: 'string' }
            },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['filename', 'contentType', 'size', 'data'],
                properties: {
                  filename: { type: 'string' },
                  contentType: { type: 'string' },
                  size: { type: 'number' },
                  data: { type: 'string' },
                  contentId: { type: 'string' }
                }
              }
            }
          }
        },
        response: {
          202: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<ProcessEmailRequest>, reply: FastifyReply) => {
      try {
        const userId = (request.user as any).id;

        // Convert attachments from base64 to Buffer
        const attachments = request.body.attachments.map(att => ({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          data: Buffer.from(att.data, 'base64'),
          contentId: att.contentId
        }));

        // Queue email processing job
        const job = await jobQueueService.addEmailJob({
          emailId: request.body.emailId,
          userId,
          attachments
        });

        return reply.status(202).send({
          jobId: job.id as string,
          message: 'Email processing job queued successfully'
        });
      } catch (error: any) {
        return reply.status(500).send({
          error: 'Failed to queue email processing job',
          message: error.message
        });
      }
    }
  );

  // Get processing statistics
  fastify.get(
    '/stats',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Email Processing'],
        summary: 'Get email processing statistics',
        response: {
          200: {
            type: 'object',
            properties: {
              totalEmails: { type: 'number' },
              processedEmails: { type: 'number' },
              failedEmails: { type: 'number' },
              totalReceiptsCreated: { type: 'number' },
              totalAttachmentsSkipped: { type: 'number' },
              avgReceiptsPerEmail: { type: 'number' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request.user as any).id;
        const companyId = (request.user as any).companyId;

        const stats = await emailProcessorService.getProcessingStats(userId, companyId);

        return reply.send({
          totalEmails: parseInt(stats.total_emails) || 0,
          processedEmails: parseInt(stats.processed_emails) || 0,
          failedEmails: parseInt(stats.failed_emails) || 0,
          totalReceiptsCreated: parseInt(stats.total_receipts_created) || 0,
          totalAttachmentsSkipped: parseInt(stats.total_attachments_skipped) || 0,
          avgReceiptsPerEmail: parseFloat(stats.avg_receipts_per_email) || 0
        });
      } catch (error: any) {
        return reply.status(500).send({
          error: 'Failed to get processing statistics',
          message: error.message
        });
      }
    }
  );

  // Test rule pattern matching
  fastify.post(
    '/test-rule',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Email Processing'],
        summary: 'Test rule pattern matching',
        body: {
          type: 'object',
          required: ['fromEmailPattern', 'subjectPattern', 'testEmail'],
          properties: {
            fromEmailPattern: { type: 'string' },
            subjectPattern: { type: 'string' },
            testEmail: {
              type: 'object',
              required: ['from', 'subject'],
              properties: {
                from: { type: 'string' },
                subject: { type: 'string' }
              }
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              fromMatch: { type: 'boolean' },
              subjectMatch: { type: 'boolean' },
              overallMatch: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{
      Body: {
        fromEmailPattern: string;
        subjectPattern: string;
        testEmail: {
          from: string;
          subject: string;
        };
      };
    }>, reply: FastifyReply) => {
      try {
        const { fromEmailPattern, subjectPattern, testEmail } = request.body;

        let fromMatch = true;
        let subjectMatch = true;

        // Test from email pattern
        if (fromEmailPattern) {
          try {
            const fromRegex = new RegExp(fromEmailPattern, 'i');
            fromMatch = fromRegex.test(testEmail.from);
          } catch (error) {
            fromMatch = false;
          }
        }

        // Test subject pattern
        if (subjectPattern) {
          try {
            const subjectRegex = new RegExp(subjectPattern, 'i');
            subjectMatch = subjectRegex.test(testEmail.subject);
          } catch (error) {
            subjectMatch = false;
          }
        }

        return reply.send({
          fromMatch,
          subjectMatch,
          overallMatch: fromMatch && subjectMatch
        });
      } catch (error: any) {
        return reply.status(500).send({
          error: 'Failed to test rule patterns',
          message: error.message
        });
      }
    }
  );
};

export default emailProcessingRoutes;