import * as Sentry from '@sentry/node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { FastifyInstance } from 'fastify';

// DataDog APM Configuration
export const initializeDataDog = () => {
  if (process.env.NODE_ENV === 'production' || process.env.DD_TRACE_ENABLED === 'true') {
    const tracer = require('dd-trace').init({
      service: 'receipt-vault-pro',
      env: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      debug: process.env.DD_TRACE_DEBUG === 'true',
      profiling: true,
      runtimeMetrics: true,
      logInjection: true,
      analytics: {
        enabled: true,
        sampleRate: 1.0
      },
      plugins: {
        fastify: {
          enabled: true,
          service: 'receipt-vault-api'
        },
        pg: {
          enabled: true,
          service: 'receipt-vault-db'
        },
        http: {
          enabled: true,
          service: 'receipt-vault-http'
        }
      }
    });
    
    console.log('DataDog APM initialized');
    return tracer;
  }
  return null;
};

// Sentry Configuration
export const initializeSentry = () => {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: 0.1,
      debug: process.env.NODE_ENV !== 'production',
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.OnUncaughtException(),
        new Sentry.Integrations.OnUnhandledRejection()
      ],
      beforeSend(event) {
        // Filter out sensitive data
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      },
      beforeSendTransaction(event) {
        // Add custom tags for better filtering
        event.tags = {
          ...event.tags,
          service: 'receipt-vault-pro',
          version: process.env.APP_VERSION || '1.0.0'
        };
        return event;
      }
    });
    
    console.log('Sentry error tracking initialized');
  }
};

// OpenTelemetry Configuration
export const initializeOpenTelemetry = () => {
  if (process.env.OTEL_ENABLED === 'true') {
    const sdk = new NodeSDK({
      serviceName: 'receipt-vault-pro',
      // Remove serviceVersion as it's not a valid property
      instrumentations: [
        // Auto-instrumentation will be registered here
      ]
    });
    
    sdk.start();
    console.log('OpenTelemetry initialized');
    return sdk;
  }
  return null;
};

// Prometheus Metrics
export class PrometheusMetrics {
  public httpRequestDuration: Histogram<string>;
  public httpRequestTotal: Counter<string>;
  public receiptProcessingDuration: Histogram<string>;
  public receiptProcessingTotal: Counter<string>;
  public ocrProcessingDuration: Histogram<string>;
  public databaseConnectionsActive: Gauge<string>;
  public memoryUsage: Gauge<string>;
  public cpuUsage: Gauge<string>;
  
  constructor() {
    // HTTP Request Metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });
    
    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });
    
    // Receipt Processing Metrics
    this.receiptProcessingDuration = new Histogram({
      name: 'receipt_processing_duration_seconds',
      help: 'Duration of receipt processing operations',
      labelNames: ['operation', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 30]
    });
    
    this.receiptProcessingTotal = new Counter({
      name: 'receipt_processing_total',
      help: 'Total number of receipt processing operations',
      labelNames: ['operation', 'status']
    });
    
    // OCR Processing Metrics
    this.ocrProcessingDuration = new Histogram({
      name: 'ocr_processing_duration_seconds',
      help: 'Duration of OCR processing operations',
      labelNames: ['provider', 'status'],
      buckets: [1, 3, 5, 10, 30, 60]
    });
    
    // System Metrics
    this.databaseConnectionsActive = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections'
    });
    
    this.memoryUsage = new Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type']
    });
    
    this.cpuUsage = new Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage'
    });
    
    // Start collecting default metrics
    collectDefaultMetrics({
      prefix: 'receipt_vault_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      eventLoopMonitoringPrecision: 5
    });
    
    // Start system metrics collection
    this.startSystemMetricsCollection();
  }
  
  private startSystemMetricsCollection() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);
      
      // CPU usage (simplified calculation)
      const cpuUsage = process.cpuUsage();
      const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      this.cpuUsage.set(totalUsage);
    }, 10000); // Collect every 10 seconds
  }
  
  // Helper methods for tracking receipt operations
  public trackReceiptUpload(duration: number, success: boolean) {
    const status = success ? 'success' : 'error';
    this.receiptProcessingDuration.observe({ operation: 'upload', status }, duration);
    this.receiptProcessingTotal.inc({ operation: 'upload', status });
  }
  
  public trackReceiptOCR(duration: number, provider: string, success: boolean) {
    const status = success ? 'success' : 'error';
    this.ocrProcessingDuration.observe({ provider, status }, duration);
    this.receiptProcessingTotal.inc({ operation: 'ocr', status });
  }
  
  public trackReceiptCategorization(duration: number, success: boolean) {
    const status = success ? 'success' : 'error';
    this.receiptProcessingDuration.observe({ operation: 'categorization', status }, duration);
    this.receiptProcessingTotal.inc({ operation: 'categorization', status });
  }
  
  public trackDatabaseConnections(count: number) {
    this.databaseConnectionsActive.set(count);
  }
}

// Fastify Plugin for Metrics Endpoint
export const metricsPlugin = async (fastify: FastifyInstance) => {
  fastify.get('/metrics', async (request, reply) => {
    try {
      const metrics = await register.metrics();
      reply.type('text/plain; version=0.0.4; charset=utf-8');
      return metrics;
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to collect metrics' });
    }
  });
};

// Health Check Plugin
export const healthCheckPlugin = async (fastify: FastifyInstance) => {
  fastify.get('/health', async (request, reply) => {
    try {
      // Basic health checks
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks: {
          database: 'unknown',
          redis: 'unknown',
          storage: 'unknown'
        }
      };
      
      // TODO: Add actual health checks for external dependencies
      
      reply.send(health);
    } catch (error) {
      reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  fastify.get('/health/ready', async (request, reply) => {
    // Readiness probe - check if app is ready to receive traffic
    reply.send({ status: 'ready', timestamp: new Date().toISOString() });
  });
  
  fastify.get('/health/live', async (request, reply) => {
    // Liveness probe - check if app is alive
    reply.send({ status: 'alive', timestamp: new Date().toISOString() });
  });
};

// Error Tracking Utilities
export const trackError = (error: Error, context?: Record<string, any>) => {
  console.error('Error tracked:', error);
  
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }
      Sentry.captureException(error);
    });
  }
};

export const trackPerformance = (name: string, duration: number, tags?: Record<string, string>) => {
  console.log(`Performance: ${name} took ${duration}ms`, tags);
  
  if (process.env.SENTRY_DSN) {
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${name} completed`,
      level: 'info',
      data: { duration, ...tags }
    });
  }
};

// Initialize all monitoring
export const initializeObservability = () => {
  console.log('Initializing observability stack...');
  
  const datadog = initializeDataDog();
  initializeSentry();
  const otel = initializeOpenTelemetry();
  const metrics = new PrometheusMetrics();
  
  console.log('Observability stack initialized successfully');
  
  return {
    datadog,
    otel,
    metrics,
    trackError,
    trackPerformance
  };
}; 