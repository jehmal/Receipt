/**
 * Custom Metrics Collector for Receipt Vault Pro
 * Business metrics, performance KPIs, and operational monitoring
 */

import { StatsD } from 'node-statsd';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger';

// Prometheus metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'user_type']
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]
});

const receiptsProcessedTotal = new Counter({
  name: 'receipts_processed_total',
  help: 'Total number of receipts processed',
  labelNames: ['status', 'user_type', 'company_id', 'processing_type']
});

const ocrProcessingDuration = new Histogram({
  name: 'ocr_processing_duration_seconds',
  help: 'OCR processing duration in seconds',
  labelNames: ['provider', 'status', 'file_type'],
  buckets: [0.5, 1, 2, 5, 10, 15, 30, 60]
});

const ocrConfidenceScore = new Histogram({
  name: 'ocr_confidence_score',
  help: 'OCR confidence score distribution',
  labelNames: ['provider', 'file_type'],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
});

const databaseConnectionsActive = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

const redisConnectionsActive = new Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections'
});

const fileUploadSize = new Histogram({
  name: 'file_upload_size_bytes',
  help: 'File upload size distribution in bytes',
  labelNames: ['file_type', 'user_type'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 52428800] // 1KB to 50MB
});

const authFailuresTotal = new Counter({
  name: 'auth_failures_total',
  help: 'Total authentication failures',
  labelNames: ['provider', 'reason', 'ip_address']
});

const businessMetricsGauge = new Gauge({
  name: 'business_metrics',
  help: 'Business KPI metrics',
  labelNames: ['metric_type', 'period', 'company_id']
});

const systemResourceUsage = new Gauge({
  name: 'system_resource_usage',
  help: 'System resource usage metrics',
  labelNames: ['resource_type', 'component']
});

// Initialize default Prometheus metrics
collectDefaultMetrics({ register });

export class MetricsCollector {
  private static instance: MetricsCollector;
  private statsd: StatsD;
  private startTime: number;
  private metricsCache: Map<string, any>;
  private collectionInterval: NodeJS.Timeout;
  
  private constructor() {
    this.startTime = Date.now();
    this.metricsCache = new Map();
    
    // Initialize StatsD client for real-time metrics
    this.statsd = new StatsD({
      host: process.env.DD_AGENT_HOST || 'localhost',
      port: parseInt(process.env.DD_DOGSTATSD_PORT || '8125'),
      prefix: 'receipt_vault.',
      telegraf: false,
      mock: process.env.NODE_ENV === 'development'
    });
    
    // Start collecting system metrics every 10 seconds
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);
    
    logger.info('Metrics collector initialized');
  }
  
  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }
  
  /**
   * Record HTTP request metrics
   */
  public recordHTTPRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    userType: 'individual' | 'company_admin' | 'company_employee' | 'system_admin' | 'anonymous' = 'anonymous'
  ) {
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: statusCode.toString(),
      user_type: userType
    };
    
    // Prometheus metrics
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(
      { method: method.toUpperCase(), route, status_code: statusCode.toString() },
      duration / 1000
    );
    
    // StatsD metrics
    this.statsd.increment('http.requests.total', 1, [`method:${method}`, `route:${route}`, `status:${statusCode}`, `user_type:${userType}`]);
    this.statsd.histogram('http.request.duration_ms', duration, [`method:${method}`, `route:${route}`]);
    
    // Track error rates
    if (statusCode >= 400) {
      this.statsd.increment('http.requests.errors', 1, [`method:${method}`, `route:${route}`, `status:${statusCode}`]);
    }
  }
  
  /**
   * Record receipt processing metrics
   */
  public recordReceiptProcessing(
    status: 'success' | 'failed' | 'processing',
    duration: number,
    userType: 'individual' | 'company_admin' | 'company_employee' = 'individual',
    companyId?: string,
    processingType: 'automatic' | 'manual' | 'email' = 'automatic',
    metadata?: {
      fileSize?: number;
      fileType?: string;
      ocrProvider?: string;
      confidence?: number;
    }
  ) {
    const labels = {
      status,
      user_type: userType,
      company_id: companyId || 'individual',
      processing_type: processingType
    };
    
    // Prometheus metrics
    receiptsProcessedTotal.inc(labels);
    
    // StatsD metrics
    this.statsd.increment('receipts.processed.total', 1, [
      `status:${status}`,
      `user_type:${userType}`,
      `company_id:${companyId || 'individual'}`,
      `type:${processingType}`
    ]);
    
    this.statsd.histogram('receipts.processing.duration_ms', duration, [
      `status:${status}`,
      `type:${processingType}`
    ]);
    
    // Record additional metadata
    if (metadata) {
      if (metadata.fileSize) {
        this.recordFileUpload(metadata.fileSize, metadata.fileType || 'unknown', userType);
      }
      
      if (metadata.ocrProvider && metadata.confidence !== undefined) {
        this.recordOCRProcessing(
          metadata.ocrProvider,
          status === 'success',
          duration,
          metadata.confidence,
          metadata.fileType
        );
      }
    }
    
    // Business metrics
    this.updateBusinessMetric('receipts_processed_today', 1, 'daily', companyId);
    
    if (status === 'success') {
      this.updateBusinessMetric('successful_processing_rate', 1, 'hourly', companyId);
    }
  }
  
  /**
   * Record OCR processing metrics
   */
  public recordOCRProcessing(
    provider: string,
    success: boolean,
    duration: number,
    confidence: number,
    fileType?: string
  ) {
    const status = success ? 'success' : 'failed';
    const labels = {
      provider,
      status,
      file_type: fileType || 'unknown'
    };
    
    // Prometheus metrics
    ocrProcessingDuration.observe(labels, duration / 1000);
    
    if (success) {
      ocrConfidenceScore.observe(
        { provider, file_type: fileType || 'unknown' },
        confidence
      );
    }
    
    // StatsD metrics
    this.statsd.histogram('ocr.processing.duration_ms', duration, [
      `provider:${provider}`,
      `status:${status}`,
      `file_type:${fileType || 'unknown'}`
    ]);
    
    this.statsd.histogram('ocr.confidence.score', confidence, [
      `provider:${provider}`,
      `file_type:${fileType || 'unknown'}`
    ]);
    
    this.statsd.increment('ocr.processing.total', 1, [
      `provider:${provider}`,
      `status:${status}`
    ]);
    
    // Track OCR accuracy by confidence bands
    const confidenceBand = this.getConfidenceBand(confidence);
    this.statsd.increment('ocr.confidence.band', 1, [
      `provider:${provider}`,
      `band:${confidenceBand}`
    ]);
  }
  
  /**
   * Record file upload metrics
   */
  public recordFileUpload(
    fileSize: number,
    fileType: string,
    userType: 'individual' | 'company_admin' | 'company_employee' = 'individual'
  ) {
    // Prometheus metrics
    fileUploadSize.observe({ file_type: fileType, user_type: userType }, fileSize);
    
    // StatsD metrics
    this.statsd.histogram('file.upload.size_bytes', fileSize, [
      `file_type:${fileType}`,
      `user_type:${userType}`
    ]);
    
    this.statsd.increment('file.uploads.total', 1, [
      `file_type:${fileType}`,
      `user_type:${userType}`
    ]);
    
    // Track file size distribution
    const sizeCategory = this.getFileSizeCategory(fileSize);
    this.statsd.increment('file.size.category', 1, [
      `category:${sizeCategory}`,
      `file_type:${fileType}`
    ]);
  }
  
  /**
   * Record authentication metrics
   */
  public recordAuthentication(
    provider: string,
    success: boolean,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (!success) {
      // Prometheus metrics
      authFailuresTotal.inc({
        provider,
        reason: reason || 'unknown',
        ip_address: this.hashIP(ipAddress)
      });
      
      // StatsD metrics
      this.statsd.increment('auth.failures.total', 1, [
        `provider:${provider}`,
        `reason:${reason || 'unknown'}`
      ]);
      
      // Track suspicious activity
      if (ipAddress) {
        const key = `auth_failures_${this.hashIP(ipAddress)}`;
        const failures = this.incrementCacheValue(key, 1, 300000); // 5-minute window
        
        if (failures > 10) {
          this.statsd.increment('auth.suspicious.activity', 1, [
            `type:brute_force`,
            `threshold:exceeded`
          ]);
        }
      }
    } else {
      this.statsd.increment('auth.success.total', 1, [
        `provider:${provider}`
      ]);
    }
  }
  
  /**
   * Record database metrics
   */
  public recordDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    affectedRows?: number
  ) {
    this.statsd.histogram('database.query.duration_ms', duration, [
      `operation:${operation}`,
      `table:${table}`,
      `status:${success ? 'success' : 'error'}`
    ]);
    
    this.statsd.increment('database.queries.total', 1, [
      `operation:${operation}`,
      `table:${table}`,
      `status:${success ? 'success' : 'error'}`
    ]);
    
    if (affectedRows !== undefined) {
      this.statsd.histogram('database.affected_rows', affectedRows, [
        `operation:${operation}`,
        `table:${table}`
      ]);
    }
  }
  
  /**
   * Update business metrics
   */
  public updateBusinessMetric(
    metricType: string,
    value: number,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    companyId?: string
  ) {
    // Prometheus metrics
    businessMetricsGauge.set(
      { metric_type: metricType, period, company_id: companyId || 'global' },
      value
    );
    
    // StatsD metrics
    this.statsd.gauge(`business.${metricType}`, value, [
      `period:${period}`,
      `company_id:${companyId || 'global'}`
    ]);
    
    // Cache for aggregation
    const cacheKey = `business_${metricType}_${period}_${companyId || 'global'}`;
    this.metricsCache.set(cacheKey, {
      value,
      timestamp: Date.now(),
      period
    });
  }
  
  /**
   * Collect system metrics
   */
  private collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Memory metrics
    systemResourceUsage.set({ resource_type: 'memory_heap_used', component: 'nodejs' }, memUsage.heapUsed);
    systemResourceUsage.set({ resource_type: 'memory_heap_total', component: 'nodejs' }, memUsage.heapTotal);
    systemResourceUsage.set({ resource_type: 'memory_external', component: 'nodejs' }, memUsage.external);
    
    // Uptime
    systemResourceUsage.set({ resource_type: 'uptime_seconds', component: 'application' }, uptime);
    
    // StatsD system metrics
    this.statsd.gauge('system.memory.heap_used_bytes', memUsage.heapUsed);
    this.statsd.gauge('system.memory.heap_total_bytes', memUsage.heapTotal);
    this.statsd.gauge('system.memory.external_bytes', memUsage.external);
    this.statsd.gauge('system.uptime_seconds', uptime);
    
    // Event loop lag
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      this.statsd.histogram('system.event_loop.lag_ms', lag);
      systemResourceUsage.set({ resource_type: 'event_loop_lag_ms', component: 'nodejs' }, lag);
    });
  }
  
  /**
   * Update connection pool metrics
   */
  public updateConnectionMetrics(type: 'database' | 'redis', active: number, idle: number, waiting: number) {
    if (type === 'database') {
      databaseConnectionsActive.set(active);
    } else {
      redisConnectionsActive.set(active);
    }
    
    this.statsd.gauge(`${type}.connections.active`, active);
    this.statsd.gauge(`${type}.connections.idle`, idle);
    this.statsd.gauge(`${type}.connections.waiting`, waiting);
  }
  
  /**
   * Get Prometheus metrics for scraping
   */
  public async getPrometheusMetrics(): Promise<string> {
    return register.metrics();
  }
  
  /**
   * Get business metrics summary
   */
  public getBusinessMetricsSummary(companyId?: string): Record<string, any> {
    const summary: Record<string, any> = {};
    
    for (const [key, value] of this.metricsCache.entries()) {
      if (key.includes('business_') && (companyId ? key.includes(companyId) : true)) {
        const metricName = key.split('_').slice(1, -2).join('_');
        if (!summary[metricName]) {
          summary[metricName] = {};
        }
        summary[metricName][value.period] = value.value;
      }
    }
    
    return summary;
  }
  
  /**
   * Helper methods
   */
  private getConfidenceBand(confidence: number): string {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    if (confidence >= 0.5) return 'low';
    return 'very_low';
  }
  
  private getFileSizeCategory(bytes: number): string {
    if (bytes < 1024) return 'tiny';
    if (bytes < 102400) return 'small'; // < 100KB
    if (bytes < 1048576) return 'medium'; // < 1MB
    if (bytes < 10485760) return 'large'; // < 10MB
    return 'very_large';
  }
  
  private hashIP(ip?: string): string {
    if (!ip) return 'unknown';
    // Simple hash for IP anonymization
    return require('crypto').createHash('sha256').update(ip).digest('hex').substring(0, 8);
  }
  
  private incrementCacheValue(key: string, increment: number, ttl: number): number {
    const now = Date.now();
    const cached = this.metricsCache.get(key);
    
    if (cached && (now - cached.timestamp) < ttl) {
      cached.value += increment;
      cached.timestamp = now;
      return cached.value;
    } else {
      this.metricsCache.set(key, { value: increment, timestamp: now });
      return increment;
    }
  }
  
  /**
   * Cleanup resources
   */
  public destroy() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    
    this.statsd.close();
    this.metricsCache.clear();
    
    logger.info('Metrics collector destroyed');
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();

// Express middleware for automatic HTTP metrics collection
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path || 'unknown';
    const userType = req.user?.role || 'anonymous';
    
    metricsCollector.recordHTTPRequest(
      req.method,
      route,
      res.statusCode,
      duration,
      userType
    );
  });
  
  next();
}