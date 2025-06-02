/**
 * Error Tracking and Monitoring for Receipt Vault Pro
 * Comprehensive error tracking with Sentry integration and context
 */

import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { logger } from '../utils/logger';
import { datadogAPM } from './datadog-apm';
import { metricsCollector } from './metrics-collector';

export interface ErrorContext {
  userId?: string;
  companyId?: string;
  receiptId?: string;
  operationId?: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  route?: string;
  method?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
}

export interface PerformanceContext {
  operation: string;
  startTime: number;
  metadata?: Record<string, any>;
}

export class ErrorTracker {
  private static instance: ErrorTracker;
  private performanceTransactions: Map<string, PerformanceContext> = new Map();
  
  private constructor() {
    this.initializeSentry();
    logger.info('Error tracker initialized');
  }
  
  public static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }
  
  private initializeSentry() {
    const environment = process.env.NODE_ENV || 'production';
    const release = process.env.APP_VERSION || '1.0.0';
    
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment,
      release: `receipt-vault-backend@${release}`,
      
      // Performance monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      
      // Integrations
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Tracing.Integrations.Express({ app: undefined }),
        new Tracing.Integrations.Postgres(),
        new Tracing.Integrations.Mysql(),
        new Tracing.Integrations.Mongo(),
      ],
      
      // Configure session tracking
      autoSessionTracking: true,
      
      // Configure scope
      beforeSend(event, hint) {
        // Add custom context to all events
        if (event.user) {
          // Remove sensitive user data
          delete event.user.email;
          delete event.user.ip_address;
        }
        
        // Add correlation IDs for distributed tracing
        const traceId = datadogAPM.getCurrentTraceId();
        const spanId = datadogAPM.getCurrentSpanId();
        
        if (traceId) {
          event.tags = {
            ...event.tags,
            'trace.id': traceId,
            'span.id': spanId
          };
        }
        
        return event;
      },
      
      // Filter out noisy errors
      beforeBreadcrumb(breadcrumb, hint) {
        // Filter out debug/info level breadcrumbs in production
        if (environment === 'production' && breadcrumb.level === 'debug') {
          return null;
        }
        
        // Filter out sensitive URLs
        if (breadcrumb.data?.url?.includes('/auth/') || breadcrumb.data?.url?.includes('/api-keys/')) {
          breadcrumb.data.url = '[FILTERED]';
        }
        
        return breadcrumb;
      }
    });
    
    // Set global tags
    Sentry.setTags({
      component: 'backend',
      service: 'receipt-vault',
      team: 'platform'
    });
  }
  
  /**
   * Track application errors with rich context
   */
  public trackError(
    error: Error,
    context: ErrorContext = {},
    severity: 'fatal' | 'error' | 'warning' | 'info' = 'error'
  ): string {
    // Generate unique error ID
    const errorId = this.generateErrorId();
    
    // Set user context
    if (context.userId || context.companyId) {
      Sentry.setUser({
        id: context.userId,
        company_id: context.companyId,
        ip_address: this.hashIP(context.ipAddress)
      });
    }
    
    // Set additional context
    Sentry.setContext('request', {
      id: context.requestId,
      route: context.route,
      method: context.method,
      user_agent: context.userAgent,
      timestamp: context.timestamp?.toISOString() || new Date().toISOString()
    });
    
    if (context.receiptId) {
      Sentry.setContext('receipt', {
        id: context.receiptId,
        operation_id: context.operationId
      });
    }
    
    if (context.additionalData) {
      Sentry.setContext('additional', context.additionalData);
    }
    
    // Set tags for filtering
    Sentry.setTags({
      error_id: errorId,
      user_type: this.getUserType(context),
      has_user_context: !!context.userId,
      has_receipt_context: !!context.receiptId
    });
    
    // Add breadcrumb
    Sentry.addBreadcrumb({
      message: `Error tracked: ${error.message}`,
      category: 'error',
      level: severity,
      data: {
        error_id: errorId,
        operation_id: context.operationId,
        receipt_id: context.receiptId
      }
    });
    
    // Capture the error
    const sentryEventId = Sentry.captureException(error);
    
    // Log structured error data
    logger.error('Error tracked', {
      error_id: errorId,
      sentry_event_id: sentryEventId,
      error_message: error.message,
      error_stack: error.stack,
      user_id: context.userId,
      company_id: context.companyId,
      receipt_id: context.receiptId,
      operation_id: context.operationId,
      request_id: context.requestId,
      route: context.route,
      method: context.method,
      trace_id: datadogAPM.getCurrentTraceId(),
      span_id: datadogAPM.getCurrentSpanId()
    });
    
    // Record metrics
    metricsCollector.recordHTTPRequest(
      context.method || 'UNKNOWN',
      context.route || 'unknown',
      this.getStatusCodeFromError(error),
      0,
      this.getUserType(context) as any
    );
    
    // Track error in Datadog
    datadogAPM.recordBusinessMetric('errors.total', 1, {
      error_type: error.constructor.name,
      severity,
      component: 'error_tracking'
    });
    
    return errorId;
  }
  
  /**
   * Track business logic errors with specific context
   */
  public trackBusinessError(
    operation: string,
    error: Error,
    context: ErrorContext & {
      businessContext?: {
        receiptProcessingStage?: 'upload' | 'ocr' | 'categorization' | 'storage' | 'validation';
        ocrProvider?: string;
        fileType?: string;
        fileSize?: number;
        processingDuration?: number;
      };
    }
  ): string {
    const errorId = this.generateErrorId();
    
    // Add business-specific context
    Sentry.setContext('business_operation', {
      operation,
      stage: context.businessContext?.receiptProcessingStage,
      ocr_provider: context.businessContext?.ocrProvider,
      file_type: context.businessContext?.fileType,
      file_size: context.businessContext?.fileSize,
      processing_duration: context.businessContext?.processingDuration
    });
    
    Sentry.setTags({
      business_operation: operation,
      processing_stage: context.businessContext?.receiptProcessingStage || 'unknown',
      error_category: 'business_logic'
    });
    
    // Track with specific business metrics
    if (context.businessContext?.receiptProcessingStage) {
      metricsCollector.recordReceiptProcessing(
        'failed',
        context.businessContext.processingDuration || 0,
        this.getUserType(context) as any,
        context.companyId,
        'automatic',
        {
          fileSize: context.businessContext.fileSize,
          fileType: context.businessContext.fileType,
          ocrProvider: context.businessContext.ocrProvider
        }
      );
    }
    
    return this.trackError(error, context, 'error');
  }
  
  /**
   * Track security-related errors
   */
  public trackSecurityError(
    securityEvent: string,
    error: Error,
    context: ErrorContext & {
      securityContext?: {
        attackType?: 'brute_force' | 'injection' | 'xss' | 'csrf' | 'unauthorized_access';
        riskLevel?: 'low' | 'medium' | 'high' | 'critical';
        blockedByPolicy?: boolean;
        suspiciousPatterns?: string[];
      };
    }
  ): string {
    const errorId = this.generateErrorId();
    
    // Add security-specific context
    Sentry.setContext('security_event', {
      event: securityEvent,
      attack_type: context.securityContext?.attackType,
      risk_level: context.securityContext?.riskLevel,
      blocked_by_policy: context.securityContext?.blockedByPolicy,
      suspicious_patterns: context.securityContext?.suspiciousPatterns
    });
    
    Sentry.setTags({
      security_event: securityEvent,
      attack_type: context.securityContext?.attackType || 'unknown',
      risk_level: context.securityContext?.riskLevel || 'medium',
      error_category: 'security'
    });
    
    // Record authentication failure if applicable
    if (securityEvent.includes('auth')) {
      metricsCollector.recordAuthentication(
        'local',
        false,
        error.message,
        context.ipAddress,
        context.userAgent
      );
    }
    
    // Escalate high-risk security events
    const severity = context.securityContext?.riskLevel === 'critical' ? 'fatal' : 'error';
    
    return this.trackError(error, context, severity);
  }
  
  /**
   * Start performance tracking for an operation
   */
  public startPerformanceTracking(
    operationId: string,
    operation: string,
    metadata?: Record<string, any>
  ): string {
    const transactionId = `${operationId}_${Date.now()}`;
    
    this.performanceTransactions.set(transactionId, {
      operation,
      startTime: Date.now(),
      metadata
    });
    
    // Start Sentry transaction
    const transaction = Sentry.startTransaction({
      name: operation,
      op: 'receipt_processing'
    });
    
    transaction.setTag('operation_id', operationId);
    transaction.setTag('transaction_id', transactionId);
    
    if (metadata) {
      transaction.setContext('operation_metadata', metadata);
    }
    
    return transactionId;
  }
  
  /**
   * End performance tracking and record metrics
   */
  public endPerformanceTracking(
    transactionId: string,
    success: boolean,
    errorMessage?: string,
    additionalMetrics?: Record<string, number>
  ): void {
    const transaction = this.performanceTransactions.get(transactionId);
    
    if (!transaction) {
      logger.warn('Performance transaction not found', { transaction_id: transactionId });
      return;
    }
    
    const duration = Date.now() - transaction.startTime;
    
    // Record performance metrics
    const status = success ? 'success' : 'failed';
    
    Sentry.addBreadcrumb({
      message: `Operation ${transaction.operation} ${status}`,
      category: 'performance',
      level: success ? 'info' : 'error',
      data: {
        transaction_id: transactionId,
        duration_ms: duration,
        operation: transaction.operation,
        ...additionalMetrics
      }
    });
    
    // Track in Datadog
    datadogAPM.recordBusinessMetric(`performance.${transaction.operation}.duration_ms`, duration, {
      status,
      component: 'performance_tracking'
    });
    
    if (additionalMetrics) {
      Object.entries(additionalMetrics).forEach(([key, value]) => {
        datadogAPM.recordBusinessMetric(`performance.${transaction.operation}.${key}`, value, {
          status,
          component: 'performance_tracking'
        });
      });
    }
    
    // End Sentry transaction
    const sentryTransaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    if (sentryTransaction) {
      sentryTransaction.setTag('status', status);
      sentryTransaction.setTag('duration_ms', duration);
      
      if (errorMessage) {
        sentryTransaction.setTag('error_message', errorMessage);
      }
      
      sentryTransaction.finish();
    }
    
    // Clean up
    this.performanceTransactions.delete(transactionId);
    
    logger.info('Performance tracking completed', {
      transaction_id: transactionId,
      operation: transaction.operation,
      duration_ms: duration,
      status,
      error_message: errorMessage,
      additional_metrics: additionalMetrics
    });
  }
  
  /**
   * Add breadcrumb for debugging
   */
  public addBreadcrumb(
    message: string,
    category: string,
    level: 'debug' | 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, any>
  ): void {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        trace_id: datadogAPM.getCurrentTraceId(),
        span_id: datadogAPM.getCurrentSpanId()
      }
    });
  }
  
  /**
   * Set user context for error tracking
   */
  public setUserContext(userId: string, companyId?: string, role?: string): void {
    Sentry.setUser({
      id: userId,
      company_id: companyId,
      role: role
    });
    
    // Also set in Datadog
    datadogAPM.recordUserActivity(userId, 'session_start', companyId, { role });
  }
  
  /**
   * Clear user context
   */
  public clearUserContext(): void {
    Sentry.setUser(null);
  }
  
  /**
   * Get error statistics
   */
  public getErrorStatistics(): Record<string, any> {
    // This would typically query your metrics backend
    return {
      active_performance_transactions: this.performanceTransactions.size,
      // Add more statistics as needed
    };
  }
  
  /**
   * Helper methods
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  private getUserType(context: ErrorContext): string {
    if (!context.userId) return 'anonymous';
    if (context.companyId) return 'company_user';
    return 'individual';
  }
  
  private getStatusCodeFromError(error: Error): number {
    // Map common errors to HTTP status codes
    if (error.name === 'ValidationError') return 400;
    if (error.name === 'UnauthorizedError') return 401;
    if (error.name === 'ForbiddenError') return 403;
    if (error.name === 'NotFoundError') return 404;
    if (error.name === 'ConflictError') return 409;
    if (error.name === 'RateLimitError') return 429;
    return 500;
  }
  
  private hashIP(ip?: string): string {
    if (!ip) return 'unknown';
    // Simple hash for IP anonymization
    return require('crypto').createHash('sha256').update(ip).digest('hex').substring(0, 8);
  }
}

// Export singleton instance
export const errorTracker = ErrorTracker.getInstance();

// Express middleware for automatic error tracking
export function errorTrackingMiddleware(err: Error, req: any, res: any, next: any) {
  const context: ErrorContext = {
    userId: req.user?.id,
    companyId: req.user?.company_id,
    requestId: req.correlationId,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    route: req.route?.path || req.path,
    method: req.method,
    timestamp: new Date(),
    additionalData: {
      query: req.query,
      params: req.params,
      body: req.body ? '[FILTERED]' : undefined // Don't log actual body for security
    }
  };
  
  const errorId = errorTracker.trackError(err, context);
  
  // Add error ID to response for debugging
  res.setHeader('x-error-id', errorId);
  
  next(err);
}

// Unhandled rejection and exception handlers
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const error = new Error(`Unhandled Rejection: ${reason}`);
  errorTracker.trackError(error, {}, 'fatal');
  logger.error('Unhandled rejection', { reason, promise });
});

process.on('uncaughtException', (error: Error) => {
  errorTracker.trackError(error, {}, 'fatal');
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  
  // Graceful shutdown
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});