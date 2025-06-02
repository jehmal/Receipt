/**
 * Datadog APM Integration for Receipt Vault Pro
 * Comprehensive distributed tracing with custom spans and metrics
 */

import tracer from 'dd-trace';
import { StatsD } from 'node-statsd';
import { logger } from '../utils/logger';

// Initialize Datadog tracer
const isDevelopment = process.env.NODE_ENV === 'development';
const serviceName = process.env.DD_SERVICE || 'receipt-vault-backend';
const serviceVersion = process.env.DD_VERSION || '1.0.0';
const environment = process.env.DD_ENV || process.env.NODE_ENV || 'production';

// Initialize tracer with custom configuration
tracer.init({
  service: serviceName,
  version: serviceVersion,
  env: environment,
  debug: isDevelopment,
  
  // Sampling configuration
  sampleRate: isDevelopment ? 1.0 : 0.1,
  runtimeMetrics: true,
  
  // Custom tags
  tags: {
    'component': 'backend',
    'team': 'platform',
    'service.type': 'web'
  },
  
  // Plugin configuration
  plugins: {
    // Express.js instrumentation
    express: {
      enabled: true,
      service: `${serviceName}-express`,
      analyticsEnabled: true,
      headers: ['user-agent', 'x-request-id', 'x-user-id']
    },
    
    // HTTP client instrumentation
    http: {
      enabled: true,
      service: `${serviceName}-http-client`,
      splitByDomain: true
    },
    
    // PostgreSQL instrumentation
    pg: {
      enabled: true,
      service: `${serviceName}-postgres`,
      analyticsEnabled: true
    },
    
    // Redis instrumentation
    redis: {
      enabled: true,
      service: `${serviceName}-redis`,
      analyticsEnabled: true
    },
    
    // DNS instrumentation
    dns: {
      enabled: true,
      service: `${serviceName}-dns`
    },
    
    // File system instrumentation
    fs: {
      enabled: true,
      service: `${serviceName}-fs`
    }
  }
});

// Initialize StatsD client for custom metrics
const statsd = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: parseInt(process.env.DD_DOGSTATSD_PORT || '8125'),
  prefix: 'receipt_vault.',
  telegraf: false,
  mock: isDevelopment
});

export class DatadogAPM {
  private static instance: DatadogAPM;
  
  private constructor() {
    logger.info('Datadog APM initialized', {
      service: serviceName,
      version: serviceVersion,
      environment: environment
    });
  }
  
  public static getInstance(): DatadogAPM {
    if (!DatadogAPM.instance) {
      DatadogAPM.instance = new DatadogAPM();
    }
    return DatadogAPM.instance;
  }
  
  /**
   * Create a custom span for receipt processing
   */
  public traceReceiptProcessing<T>(
    operation: string,
    receiptId: string,
    userId: string,
    companyId?: string,
    fn: (span: any) => Promise<T>
  ): Promise<T> {
    return tracer.trace('receipt.processing', {
      resource: operation,
      service: `${serviceName}-receipt-processing`,
      type: 'custom',
      tags: {
        'receipt.id': receiptId,
        'user.id': userId,
        'company.id': companyId || 'individual',
        'operation': operation,
        'component': 'receipt-processor'
      }
    }, fn);
  }
  
  /**
   * Create a custom span for OCR processing
   */
  public traceOCRProcessing<T>(
    provider: string,
    fileSize: number,
    receiptId: string,
    fn: (span: any) => Promise<T>
  ): Promise<T> {
    return tracer.trace('ocr.processing', {
      resource: `ocr-${provider}`,
      service: `${serviceName}-ocr`,
      type: 'custom',
      tags: {
        'ocr.provider': provider,
        'file.size_bytes': fileSize,
        'receipt.id': receiptId,
        'component': 'ocr-processor'
      }
    }, async (span) => {
      this.incrementCounter('ocr.processing.started', {
        provider,
        receipt_id: receiptId
      });
      
      const startTime = Date.now();
      
      try {
        const result = await fn(span);
        
        const processingTime = Date.now() - startTime;
        
        // Record processing time
        this.histogram('ocr.processing.duration_ms', processingTime, {
          provider,
          status: 'success'
        });
        
        // Record file size distribution
        this.histogram('ocr.file.size_bytes', fileSize, {
          provider
        });
        
        this.incrementCounter('ocr.processing.completed', {
          provider,
          status: 'success'
        });
        
        span.setTag('processing.time_ms', processingTime);
        span.setTag('status', 'success');
        
        return result;
      } catch (error) {
        const processingTime = Date.now() - startTime;
        
        this.histogram('ocr.processing.duration_ms', processingTime, {
          provider,
          status: 'error'
        });
        
        this.incrementCounter('ocr.processing.failed', {
          provider,
          error_type: error.constructor.name
        });
        
        span.setTag('processing.time_ms', processingTime);
        span.setTag('status', 'error');
        span.setTag('error.type', error.constructor.name);
        span.setTag('error.message', error.message);
        
        throw error;
      }
    });
  }
  
  /**
   * Create a custom span for database operations
   */
  public traceDatabaseOperation<T>(
    operation: string,
    table: string,
    queryType: 'select' | 'insert' | 'update' | 'delete',
    fn: (span: any) => Promise<T>
  ): Promise<T> {
    return tracer.trace('database.operation', {
      resource: `${queryType.toUpperCase()} ${table}`,
      service: `${serviceName}-database`,
      type: 'db',
      tags: {
        'db.operation': operation,
        'db.table': table,
        'db.query_type': queryType,
        'component': 'database'
      }
    }, async (span) => {
      const startTime = Date.now();
      
      try {
        const result = await fn(span);
        const duration = Date.now() - startTime;
        
        this.histogram('database.query.duration_ms', duration, {
          operation,
          table,
          query_type: queryType,
          status: 'success'
        });
        
        span.setTag('query.duration_ms', duration);
        span.setTag('status', 'success');
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        this.histogram('database.query.duration_ms', duration, {
          operation,
          table,
          query_type: queryType,
          status: 'error'
        });
        
        this.incrementCounter('database.query.errors', {
          operation,
          table,
          query_type: queryType,
          error_type: error.constructor.name
        });
        
        span.setTag('query.duration_ms', duration);
        span.setTag('status', 'error');
        span.setTag('error.type', error.constructor.name);
        
        throw error;
      }
    });
  }
  
  /**
   * Create a custom span for authentication operations
   */
  public traceAuthentication<T>(
    operation: string,
    userId?: string,
    provider?: string,
    fn: (span: any) => Promise<T>
  ): Promise<T> {
    return tracer.trace('auth.operation', {
      resource: operation,
      service: `${serviceName}-auth`,
      type: 'custom',
      tags: {
        'auth.operation': operation,
        'auth.provider': provider || 'local',
        'user.id': userId || 'anonymous',
        'component': 'authentication'
      }
    }, async (span) => {
      try {
        const result = await fn(span);
        
        this.incrementCounter('auth.success', {
          operation,
          provider: provider || 'local'
        });
        
        span.setTag('status', 'success');
        return result;
      } catch (error) {
        this.incrementCounter('auth.failed', {
          operation,
          provider: provider || 'local',
          error_type: error.constructor.name
        });
        
        span.setTag('status', 'error');
        span.setTag('error.type', error.constructor.name);
        
        throw error;
      }
    });
  }
  
  /**
   * Create a custom span for external API calls
   */
  public traceExternalAPI<T>(
    service: string,
    endpoint: string,
    method: string,
    fn: (span: any) => Promise<T>
  ): Promise<T> {
    return tracer.trace('external.api', {
      resource: `${method.toUpperCase()} ${endpoint}`,
      service: `${serviceName}-external-${service}`,
      type: 'http',
      tags: {
        'external.service': service,
        'http.method': method,
        'http.endpoint': endpoint,
        'component': 'external-api'
      }
    }, async (span) => {
      const startTime = Date.now();
      
      try {
        const result = await fn(span);
        const duration = Date.now() - startTime;
        
        this.histogram('external.api.duration_ms', duration, {
          service,
          method,
          status: 'success'
        });
        
        span.setTag('http.duration_ms', duration);
        span.setTag('status', 'success');
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        this.histogram('external.api.duration_ms', duration, {
          service,
          method,
          status: 'error'
        });
        
        this.incrementCounter('external.api.errors', {
          service,
          method,
          error_type: error.constructor.name
        });
        
        span.setTag('http.duration_ms', duration);
        span.setTag('status', 'error');
        span.setTag('error.type', error.constructor.name);
        
        throw error;
      }
    });
  }
  
  /**
   * Record business metrics
   */
  public recordBusinessMetric(metric: string, value: number, tags?: Record<string, string>) {
    this.gauge(metric, value, tags);
    
    logger.debug('Business metric recorded', {
      metric,
      value,
      tags
    });
  }
  
  /**
   * Record user activity
   */
  public recordUserActivity(
    userId: string,
    action: string,
    companyId?: string,
    metadata?: Record<string, any>
  ) {
    this.incrementCounter('user.activity', {
      user_id: userId,
      action,
      company_id: companyId || 'individual',
      ...metadata
    });
    
    // Set user context for future spans
    tracer.setUser({
      id: userId,
      company_id: companyId
    });
  }
  
  /**
   * Record receipt processing metrics
   */
  public recordReceiptMetrics(
    operation: string,
    status: 'success' | 'failed',
    processingTime: number,
    fileSize?: number,
    confidence?: number
  ) {
    this.incrementCounter('receipts.processed', {
      operation,
      status
    });
    
    this.histogram('receipts.processing.duration_ms', processingTime, {
      operation,
      status
    });
    
    if (fileSize) {
      this.histogram('receipts.file.size_bytes', fileSize, {
        operation
      });
    }
    
    if (confidence) {
      this.histogram('receipts.ocr.confidence_score', confidence, {
        operation
      });
    }
  }
  
  /**
   * Increment a counter metric
   */
  private incrementCounter(metric: string, tags?: Record<string, string>, value: number = 1) {
    const tagArray = tags ? Object.entries(tags).map(([k, v]) => `${k}:${v}`) : [];
    statsd.increment(metric, value, tagArray);
  }
  
  /**
   * Record a gauge metric
   */
  private gauge(metric: string, value: number, tags?: Record<string, string>) {
    const tagArray = tags ? Object.entries(tags).map(([k, v]) => `${k}:${v}`) : [];
    statsd.gauge(metric, value, tagArray);
  }
  
  /**
   * Record a histogram metric
   */
  private histogram(metric: string, value: number, tags?: Record<string, string>) {
    const tagArray = tags ? Object.entries(tags).map(([k, v]) => `${k}:${v}`) : [];
    statsd.histogram(metric, value, tagArray);
  }
  
  /**
   * Create correlation ID for request tracing
   */
  public createCorrelationId(): string {
    const span = tracer.scope().active();
    return span ? span.context().toTraceId() : this.generateUUID();
  }
  
  /**
   * Add span tags for request context
   */
  public addRequestContext(
    userId?: string,
    companyId?: string,
    requestId?: string,
    userAgent?: string,
    ipAddress?: string
  ) {
    const span = tracer.scope().active();
    if (span) {
      if (userId) span.setTag('user.id', userId);
      if (companyId) span.setTag('company.id', companyId);
      if (requestId) span.setTag('request.id', requestId);
      if (userAgent) span.setTag('http.user_agent', userAgent);
      if (ipAddress) span.setTag('http.client_ip', ipAddress);
    }
  }
  
  /**
   * Get current trace ID for logging correlation
   */
  public getCurrentTraceId(): string | null {
    const span = tracer.scope().active();
    return span ? span.context().toTraceId() : null;
  }
  
  /**
   * Get current span ID for logging correlation
   */
  public getCurrentSpanId(): string | null {
    const span = tracer.scope().active();
    return span ? span.context().toSpanId() : null;
  }
  
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Export singleton instance
export const datadogAPM = DatadogAPM.getInstance();

// Export tracer for direct access if needed
export { tracer };

// Middleware for Express.js to add request context
export function addAPMContext(req: any, res: any, next: any) {
  const correlationId = req.headers['x-correlation-id'] || datadogAPM.createCorrelationId();
  
  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', correlationId);
  
  // Add request context to span
  datadogAPM.addRequestContext(
    req.user?.id,
    req.user?.company_id,
    correlationId,
    req.headers['user-agent'],
    req.ip
  );
  
  // Add to request object for downstream use
  req.correlationId = correlationId;
  req.traceId = datadogAPM.getCurrentTraceId();
  req.spanId = datadogAPM.getCurrentSpanId();
  
  next();
}