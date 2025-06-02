import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { ocrService } from './ocr';
import { config } from '../config/index';

// Job types
export interface OCRJobData {
  receiptId: string;
  filePath: string;
  userId: string;
  priority?: number;
}

export interface EmailProcessingJobData {
  emailId: string;
  userId: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    data: Buffer;
  }>;
}

export interface ExportJobData {
  exportId: string;
  userId: string;
  type: 'pdf' | 'csv' | 'excel';
  filters: any;
  dateRange: {
    start: Date;
    end: Date;
  };
}

// Redis connection
const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxLoadingTimeout: 1000,
});

class JobQueueService {
  private ocrQueue: Queue<OCRJobData>;
  private emailQueue: Queue<EmailProcessingJobData>;
  private exportQueue: Queue<ExportJobData>;
  private ocrWorker: Worker<OCRJobData>;
  private emailWorker: Worker<EmailProcessingJobData>;
  private exportWorker: Worker<ExportJobData>;
  private queueEvents: QueueEvents;

  constructor() {
    // Initialize queues
    this.ocrQueue = new Queue<OCRJobData>('ocr-processing', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50,      // Keep last 50 failed jobs
        attempts: 3,           // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.emailQueue = new Queue<EmailProcessingJobData>('email-processing', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    this.exportQueue = new Queue<ExportJobData>('export-processing', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 25,
        removeOnFail: 10,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    });

    // Initialize workers
    this.initializeWorkers();

    // Initialize queue events for monitoring
    this.queueEvents = new QueueEvents('ocr-processing', {
      connection: redisConnection,
    });

    this.setupEventListeners();
  }

  private initializeWorkers(): void {
    // OCR Worker
    this.ocrWorker = new Worker<OCRJobData>(
      'ocr-processing',
      this.processOCRJob.bind(this),
      {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 OCR jobs concurrently
        limiter: {
          max: 10,     // Maximum 10 jobs
          duration: 60000, // per minute (to respect Google Vision API limits)
        },
      }
    );

    // Email Worker
    this.emailWorker = new Worker<EmailProcessingJobData>(
      'email-processing',
      this.processEmailJob.bind(this),
      {
        connection: redisConnection,
        concurrency: 3, // Process up to 3 email jobs concurrently
      }
    );

    // Export Worker
    this.exportWorker = new Worker<ExportJobData>(
      'export-processing',
      this.processExportJob.bind(this),
      {
        connection: redisConnection,
        concurrency: 2, // Process up to 2 export jobs concurrently
      }
    );

    logger.info('Background job workers initialized');
  }

  private setupEventListeners(): void {
    // OCR Queue Events
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info(`OCR job ${jobId} completed successfully`, { returnvalue });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`OCR job ${jobId} failed`, { failedReason });
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      logger.warn(`OCR job ${jobId} stalled`);
    });

    // Worker event handlers
    this.ocrWorker.on('completed', (job) => {
      logger.info(`OCR worker completed job ${job.id} for receipt ${job.data.receiptId}`);
    });

    this.ocrWorker.on('failed', (job, err) => {
      logger.error(`OCR worker failed job ${job?.id} for receipt ${job?.data?.receiptId}`, { error: err.message });
    });

    this.emailWorker.on('completed', (job) => {
      logger.info(`Email worker completed job ${job.id}`);
    });

    this.emailWorker.on('failed', (job, err) => {
      logger.error(`Email worker failed job ${job?.id}`, { error: err.message });
    });

    this.exportWorker.on('completed', (job) => {
      logger.info(`Export worker completed job ${job.id}`);
    });

    this.exportWorker.on('failed', (job, err) => {
      logger.error(`Export worker failed job ${job?.id}`, { error: err.message });
    });
  }

  /**
   * Add OCR processing job to queue
   */
  async addOCRJob(data: OCRJobData): Promise<Job<OCRJobData>> {
    const priority = data.priority || 0;
    
    const job = await this.ocrQueue.add('process-receipt-ocr', data, {
      priority: priority * -1, // BullMQ uses negative numbers for higher priority
      delay: 0, // Process immediately
      jobId: `ocr-${data.receiptId}`, // Prevent duplicate jobs for same receipt
    });

    logger.info(`Added OCR job for receipt ${data.receiptId}`, { jobId: job.id });
    return job;
  }

  /**
   * Add email processing job to queue
   */
  async addEmailJob(data: EmailProcessingJobData): Promise<Job<EmailProcessingJobData>> {
    const job = await this.emailQueue.add('process-email-receipts', data);
    logger.info(`Added email processing job ${job.id}`);
    return job;
  }

  /**
   * Add export job to queue
   */
  async addExportJob(data: ExportJobData): Promise<Job<ExportJobData>> {
    const job = await this.exportQueue.add('generate-export', data, {
      delay: 1000, // Small delay to allow user to see "processing" status
    });
    logger.info(`Added export job ${job.id} for user ${data.userId}`);
    return job;
  }

  /**
   * Process OCR job
   */
  private async processOCRJob(job: Job<OCRJobData>): Promise<any> {
    const { receiptId, filePath, userId } = job.data;
    
    try {
      logger.info(`Starting OCR processing for receipt ${receiptId}`);
      
      // Update job progress
      await job.updateProgress(10);
      
      // Get user and company info for enhanced ML categorization
      let companyId: string | undefined;
      try {
        const { db } = await import('../database/connection');
        const userResult = await db.query(
          'SELECT company_id FROM users WHERE id = $1',
          [userId]
        );
        if (userResult.rows.length > 0) {
          companyId = userResult.rows[0].company_id;
        }
      } catch (error) {
        logger.warn('Failed to get user company info for OCR processing:', error);
      }
      
      await job.updateProgress(20);
      
      // Process with OCR service including user context for ML categorization
      const result = await ocrService.processReceiptWithId(receiptId, filePath, userId, companyId);
      
      await job.updateProgress(90);
      
      if (!result.success) {
        throw new Error(result.error || 'OCR processing failed');
      }

      await job.updateProgress(100);
      
      logger.info(`OCR processing completed for receipt ${receiptId}`, {
        confidence: result.confidence,
        extractedVendor: result.vendorName,
        extractedAmount: result.totalAmount,
        category: result.structuredData?.category
      });

      return {
        success: true,
        receiptId,
        confidence: result.confidence,
        extractedData: {
          vendor: result.vendorName,
          amount: result.totalAmount,
          currency: result.currency,
          date: result.date,
          category: result.structuredData?.category
        }
      };

    } catch (error: any) {
      logger.error(`OCR processing failed for receipt ${receiptId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Process email job (placeholder for now)
   */
  private async processEmailJob(job: Job<EmailProcessingJobData>): Promise<any> {
    const { emailId, userId, attachments } = job.data;
    
    try {
      logger.info(`Processing email ${emailId} with ${attachments.length} attachments`);
      
      // TODO: Implement email processing logic
      // 1. Validate email source
      // 2. Process each attachment
      // 3. Create receipt records
      // 4. Queue OCR jobs for each attachment
      
      await job.updateProgress(50);
      
      // Placeholder processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await job.updateProgress(100);
      
      return {
        success: true,
        emailId,
        processedAttachments: attachments.length
      };

    } catch (error: any) {
      logger.error(`Email processing failed for ${emailId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Process export job (placeholder for now)
   */
  private async processExportJob(job: Job<ExportJobData>): Promise<any> {
    const { exportId, userId, type, filters, dateRange } = job.data;
    
    try {
      logger.info(`Processing export ${exportId} of type ${type} for user ${userId}`);
      
      await job.updateProgress(25);
      
      // TODO: Implement export processing logic
      // 1. Query receipts based on filters
      // 2. Generate export file (PDF/CSV/Excel)
      // 3. Store file in storage
      // 4. Update export record with file path
      
      await job.updateProgress(75);
      
      // Placeholder processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await job.updateProgress(100);
      
      return {
        success: true,
        exportId,
        filePath: `/exports/${exportId}.${type}`
      };

    } catch (error: any) {
      logger.error(`Export processing failed for ${exportId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string, queueName: string): Promise<any> {
    let queue: Queue;
    
    switch (queueName) {
      case 'ocr':
        queue = this.ocrQueue;
        break;
      case 'email':
        queue = this.emailQueue;
        break;
      case 'export':
        queue = this.exportQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    
    if (!job) {
      return { status: 'not_found' };
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
      status: await job.getState(),
    };
  }

  /**
   * Get queue stats
   */
  async getQueueStats(): Promise<{
    ocr: any;
    email: any;
    export: any;
  }> {
    const [ocrStats, emailStats, exportStats] = await Promise.all([
      this.ocrQueue.getJobs(['waiting', 'active', 'completed', 'failed']),
      this.emailQueue.getJobs(['waiting', 'active', 'completed', 'failed']),
      this.exportQueue.getJobs(['waiting', 'active', 'completed', 'failed']),
    ]);

    return {
      ocr: {
        waiting: ocrStats.filter(job => job.finishedOn === undefined && !job.processedOn).length,
        active: ocrStats.filter(job => job.processedOn && !job.finishedOn).length,
        completed: ocrStats.filter(job => job.finishedOn && !job.failedReason).length,
        failed: ocrStats.filter(job => job.failedReason).length,
      },
      email: {
        waiting: emailStats.filter(job => job.finishedOn === undefined && !job.processedOn).length,
        active: emailStats.filter(job => job.processedOn && !job.finishedOn).length,
        completed: emailStats.filter(job => job.finishedOn && !job.failedReason).length,
        failed: emailStats.filter(job => job.failedReason).length,
      },
      export: {
        waiting: exportStats.filter(job => job.finishedOn === undefined && !job.processedOn).length,
        active: exportStats.filter(job => job.processedOn && !job.finishedOn).length,
        completed: exportStats.filter(job => job.finishedOn && !job.failedReason).length,
        failed: exportStats.filter(job => job.failedReason).length,
      },
    };
  }

  /**
   * Retry failed job
   */
  async retryFailedJob(jobId: string, queueName: string): Promise<boolean> {
    let queue: Queue;
    
    switch (queueName) {
      case 'ocr':
        queue = this.ocrQueue;
        break;
      case 'email':
        queue = this.emailQueue;
        break;
      case 'export':
        queue = this.exportQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    
    if (!job || !job.failedReason) {
      return false;
    }

    await job.retry();
    return true;
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(): Promise<void> {
    const grace = 24 * 60 * 60 * 1000; // 24 hours
    
    await Promise.all([
      this.ocrQueue.clean(grace, 100, 'completed'),
      this.ocrQueue.clean(grace, 50, 'failed'),
      this.emailQueue.clean(grace, 50, 'completed'),
      this.emailQueue.clean(grace, 25, 'failed'),
      this.exportQueue.clean(grace, 25, 'completed'),
      this.exportQueue.clean(grace, 10, 'failed'),
    ]);

    logger.info('Cleaned old jobs from queues');
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await Promise.all([
      this.ocrWorker.close(),
      this.emailWorker.close(),
      this.exportWorker.close(),
      this.ocrQueue.close(),
      this.emailQueue.close(),
      this.exportQueue.close(),
      this.queueEvents.close(),
    ]);

    await redisConnection.quit();
    logger.info('Job queue service closed');
  }
}

export const jobQueueService = new JobQueueService();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing job queue service...');
  await jobQueueService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing job queue service...');
  await jobQueueService.close();
  process.exit(0);
});