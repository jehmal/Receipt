import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrometheusMetrics, trackError, trackPerformance } from '../config/observability';
import * as Sentry from '@sentry/node';

export interface MonitoringMiddlewareOptions {
  metrics: PrometheusMetrics;
  enableDetailedLogging?: boolean;
  enablePerformanceTracking?: boolean;
  slowQueryThreshold?: number; // in milliseconds
}

export const monitoringMiddleware = (options: MonitoringMiddlewareOptions) => {
  const {
    metrics,
    enableDetailedLogging = true,
    enablePerformanceTracking = true,
    slowQueryThreshold = 1000
  } = options;

  return async (fastify: FastifyInstance) => {
    // Request tracking hook
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      // Set request start time for performance tracking
      (request as any).startTime = Date.now();
      
      // Add request ID for tracing
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      (request as any).requestId = requestId;
      reply.header('x-request-id', requestId);
      
      // Sentry transaction
      if (process.env.SENTRY_DSN) {
        const transaction = Sentry.startTransaction({
          op: 'http.server',
          name: `${request.method} ${request.url}`,
          tags: {
            method: request.method,
            url: request.url,
            requestId
          }
        });
        (request as any).sentryTransaction = transaction;
        Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));
      }
      
      if (enableDetailedLogging) {
        console.log(`[${requestId}] ${request.method} ${request.url} - Started`);
      }
    });

    // Response tracking hook
    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = (request as any).startTime;
      const requestId = (request as any).requestId;
      const duration = Date.now() - startTime;
      const durationSeconds = duration / 1000;
      
      // Update Prometheus metrics
      const route = request.routerPath || request.url;
      const method = request.method;
      const statusCode = reply.statusCode.toString();
      
      metrics.httpRequestDuration.observe(
        { method, route, status_code: statusCode },
        durationSeconds
      );
      metrics.httpRequestTotal.inc({ method, route, status_code: statusCode });
      
      // Track performance
      if (enablePerformanceTracking) {
        trackPerformance(`HTTP ${method} ${route}`, duration, {
          statusCode,
          requestId,
          userAgent: request.headers['user-agent'] || 'unknown'
        });
        
        // Log slow requests
        if (duration > slowQueryThreshold) {
          console.warn(`[${requestId}] SLOW REQUEST: ${method} ${route} took ${duration}ms`);
        }
      }
      
      // Complete Sentry transaction
      const transaction = (request as any).sentryTransaction;
      if (transaction) {
        transaction.setHttpStatus(reply.statusCode);
        transaction.setTag('requestId', requestId);
        transaction.finish();
      }
      
      if (enableDetailedLogging) {
        console.log(
          `[${requestId}] ${method} ${route} - ${statusCode} - ${duration}ms`
        );
      }
    });

    // Error tracking hook
    fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
      const requestId = (request as any).requestId;
      const route = request.routerPath || request.url;
      
      // Track error in metrics
      metrics.httpRequestTotal.inc({
        method: request.method,
        route,
        status_code: '500'
      });
      
      // Track error with context
      trackError(error, {
        requestId,
        method: request.method,
        route,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        userId: (request as any).user?.id,
        organizationId: (request as any).user?.organizationId
      });
      
      console.error(`[${requestId}] ERROR: ${error.message}`, {
        stack: error.stack,
        method: request.method,
        route,
        url: request.url
      });
    });

    // Receipt processing performance tracking
    fastify.decorateRequest('trackReceiptOperation', function(
      this: FastifyRequest,
      operation: string,
      startTime: number,
      success: boolean,
      metadata?: Record<string, any>
    ) {
      const duration = (Date.now() - startTime) / 1000;
      const requestId = (this as any).requestId;
      
      switch (operation) {
        case 'upload':
          metrics.trackReceiptUpload(duration, success);
          break;
        case 'ocr':
          const provider = metadata?.provider || 'unknown';
          metrics.trackReceiptOCR(duration, provider, success);
          break;
        case 'categorization':
          metrics.trackReceiptCategorization(duration, success);
          break;
      }
      
      trackPerformance(`Receipt ${operation}`, duration * 1000, {
        requestId,
        success: success.toString(),
        ...metadata
      });
      
      console.log(`[${requestId}] Receipt ${operation}: ${success ? 'SUCCESS' : 'FAILED'} - ${duration.toFixed(3)}s`);
    });
  };
};

// Database monitoring middleware
export const databaseMonitoringMiddleware = (metrics: PrometheusMetrics) => {
  return {
    // PostgreSQL connection monitoring
    trackQuery: (query: string, startTime: number, success: boolean, error?: Error) => {
      const duration = (Date.now() - startTime) / 1000;
      
      if (!success && error) {
        trackError(error, { query: query.substring(0, 100), duration });
      }
      
      // Log slow queries
      if (duration > 1) { // 1 second threshold
        console.warn(`SLOW QUERY: ${query.substring(0, 100)} took ${duration.toFixed(3)}s`);
      }
    },
    
    // Connection pool monitoring
    trackConnectionPool: (activeConnections: number, idleConnections: number) => {
      metrics.trackDatabaseConnections(activeConnections);
      
      if (activeConnections > 80) { // Alert if > 80% of pool
        console.warn(`HIGH DB CONNECTION USAGE: ${activeConnections} active connections`);
      }
    }
  };
};

// Alerting thresholds and rules
export class AlertingRules {
  private metrics: PrometheusMetrics;
  private alertingEnabled: boolean;
  
  constructor(metrics: PrometheusMetrics, enabled = true) {
    this.metrics = metrics;
    this.alertingEnabled = enabled;
    
    if (enabled) {
      this.startMonitoring();
    }
  }
  
  private startMonitoring() {
    // Check metrics every 30 seconds
    setInterval(() => {
      this.checkAlerts();
    }, 30000);
  }
  
  private async checkAlerts() {
    try {
      // Memory usage alert (> 500MB)
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > 500 * 1024 * 1024) {
        this.sendAlert('HIGH_MEMORY_USAGE', {
          current: Math.round(memUsage.heapUsed / 1024 / 1024),
          threshold: 500,
          unit: 'MB'
        });
      }
      
      // Event loop delay alert (simplified check)
      const startTime = Date.now();
      setImmediate(() => {
        const delay = Date.now() - startTime;
        if (delay > 100) { // > 100ms event loop delay
          this.sendAlert('HIGH_EVENT_LOOP_DELAY', {
            current: delay,
            threshold: 100,
            unit: 'ms'
          });
        }
      });
      
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }
  
  private sendAlert(alertName: string, data: Record<string, any>) {
    console.warn(`🚨 ALERT: ${alertName}`, data);
    
    // Send to Sentry
    if (process.env.SENTRY_DSN) {
      Sentry.addBreadcrumb({
        category: 'alert',
        message: `Alert triggered: ${alertName}`,
        level: 'warning',
        data
      });
    }
    
    // TODO: Add webhook/email notifications for production
  }
}

// Performance profiling utilities
export class PerformanceProfiler {
  private profiles: Map<string, { start: number; samples: number[] }> = new Map();
  
  public startProfile(name: string): () => void {
    const start = Date.now();
    this.profiles.set(name, { start, samples: [] });
    
    return () => {
      const profile = this.profiles.get(name);
      if (profile) {
        const duration = Date.now() - profile.start;
        profile.samples.push(duration);
        
        // Keep only last 100 samples
        if (profile.samples.length > 100) {
          profile.samples.shift();
        }
      }
    };
  }
  
  public getProfileStats(name: string) {
    const profile = this.profiles.get(name);
    if (!profile || profile.samples.length === 0) {
      return null;
    }
    
    const samples = profile.samples;
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    return {
      name,
      sampleCount: samples.length,
      average: Math.round(avg),
      p50: Math.round(p50),
      p95: Math.round(p95),
      p99: Math.round(p99),
      min: Math.min(...samples),
      max: Math.max(...samples)
    };
  }
  
  public getAllProfiles() {
    const profiles: Record<string, any> = {};
    for (const [name] of this.profiles) {
      profiles[name] = this.getProfileStats(name);
    }
    return profiles;
  }
}

// Export singleton instances for global use
export const performanceProfiler = new PerformanceProfiler(); 