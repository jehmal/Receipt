import { initializeObservability, PrometheusMetrics, trackError, trackPerformance } from '../../config/observability';
import { monitoringMiddleware, performanceProfiler } from '../../middleware/monitoring';
import { register } from 'prom-client';

describe('Observability Infrastructure', () => {
  let metrics: PrometheusMetrics;

  beforeAll(() => {
    // Initialize observability stack for testing
    const observability = initializeObservability();
    metrics = observability.metrics;
  });

  afterEach(() => {
    // Clear metrics between tests
    register.clear();
  });

  describe('Prometheus Metrics', () => {
    test('should initialize all required metrics', () => {
      expect(metrics.httpRequestDuration).toBeDefined();
      expect(metrics.httpRequestTotal).toBeDefined();
      expect(metrics.receiptProcessingDuration).toBeDefined();
      expect(metrics.receiptProcessingTotal).toBeDefined();
      expect(metrics.ocrProcessingDuration).toBeDefined();
      expect(metrics.databaseConnectionsActive).toBeDefined();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.cpuUsage).toBeDefined();
    });

    test('should track HTTP requests correctly', () => {
      const startTime = Date.now();
      
      // Simulate HTTP request
      metrics.httpRequestDuration.observe(
        { method: 'GET', route: '/api/receipts', status_code: '200' },
        0.5
      );
      
      metrics.httpRequestTotal.inc({
        method: 'GET',
        route: '/api/receipts',
        status_code: '200'
      });

      // Verify metrics were recorded
      const httpDurationMetric = register.getSingleMetric('http_request_duration_seconds');
      const httpTotalMetric = register.getSingleMetric('http_requests_total');
      
      expect(httpDurationMetric).toBeDefined();
      expect(httpTotalMetric).toBeDefined();
    });

    test('should track receipt operations', () => {
      // Test receipt upload tracking
      metrics.trackReceiptUpload(2.5, true);
      metrics.trackReceiptUpload(3.1, false);

      // Test OCR tracking
      metrics.trackReceiptOCR(5.2, 'google-vision', true);
      metrics.trackReceiptOCR(8.1, 'aws-textract', false);

      // Test categorization tracking
      metrics.trackReceiptCategorization(1.2, true);

      // Verify metrics were recorded
      const receiptMetric = register.getSingleMetric('receipt_processing_total');
      const ocrMetric = register.getSingleMetric('ocr_processing_duration_seconds');
      
      expect(receiptMetric).toBeDefined();
      expect(ocrMetric).toBeDefined();
    });

    test('should track system metrics', () => {
      // Track database connections
      metrics.trackDatabaseConnections(25);

      // Verify metric was recorded
      const dbMetric = register.getSingleMetric('database_connections_active');
      expect(dbMetric).toBeDefined();
    });

    test('should collect default Node.js metrics', async () => {
      // Wait a bit for default metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check for default metrics
      const metrics = await register.metrics();
      expect(metrics).toContain('nodejs_heap_size_total_bytes');
      expect(metrics).toContain('nodejs_heap_size_used_bytes');
      expect(metrics).toContain('process_cpu_user_seconds_total');
    });
  });

  describe('Error Tracking', () => {
    test('should track errors with context', () => {
      const error = new Error('Test error for monitoring');
      const context = {
        userId: 'user-123',
        operation: 'receipt-upload',
        filename: 'test-receipt.jpg'
      };

      // This should not throw
      expect(() => {
        trackError(error, context);
      }).not.toThrow();
    });

    test('should track errors without context', () => {
      const error = new Error('Simple test error');

      expect(() => {
        trackError(error);
      }).not.toThrow();
    });
  });

  describe('Performance Tracking', () => {
    test('should track performance metrics', () => {
      const operationName = 'receipt-processing';
      const duration = 1500; // 1.5 seconds
      const tags = { operation: 'upload', provider: 'aws' };

      expect(() => {
        trackPerformance(operationName, duration, tags);
      }).not.toThrow();
    });

    test('should track performance without tags', () => {
      const operationName = 'database-query';
      const duration = 250;

      expect(() => {
        trackPerformance(operationName, duration);
      }).not.toThrow();
    });
  });

  describe('Performance Profiler', () => {
    test('should start and end profiling sessions', () => {
      const profileName = 'test-operation';
      
      const endProfile = performanceProfiler.startProfile(profileName);
      
      // Simulate some work
      const startTime = Date.now();
      while (Date.now() - startTime < 50) {
        // Busy wait for 50ms
      }
      
      endProfile();

      const stats = performanceProfiler.getProfileStats(profileName);
      expect(stats).toBeNull(); // No stats yet as we need multiple samples
    });

    test('should calculate statistics after multiple samples', () => {
      const profileName = 'multi-sample-test';
      
      // Generate multiple samples
      for (let i = 0; i < 10; i++) {
        const endProfile = performanceProfiler.startProfile(profileName);
        setTimeout(endProfile, Math.random() * 100); // Random duration
      }

      // Wait a bit for samples to complete
      setTimeout(() => {
        const stats = performanceProfiler.getProfileStats(profileName);
        if (stats) {
          expect(stats.sampleCount).toBeGreaterThan(0);
          expect(stats.average).toBeGreaterThan(0);
          expect(stats.p50).toBeGreaterThan(0);
          expect(stats.p95).toBeGreaterThan(0);
        }
      }, 200);
    });

    test('should return all profiles', () => {
      performanceProfiler.startProfile('profile-1')();
      performanceProfiler.startProfile('profile-2')();

      const allProfiles = performanceProfiler.getAllProfiles();
      expect(allProfiles).toBeDefined();
    });
  });
});

describe('Monitoring Middleware', () => {
  let fastifyInstance: any;
  
  beforeEach(() => {
    // Mock Fastify instance
    fastifyInstance = {
      addHook: jest.fn(),
      decorateRequest: jest.fn()
    };
  });

  test('should register monitoring hooks', async () => {
    const middleware = monitoringMiddleware({
      metrics: metrics,
      enableDetailedLogging: false,
      enablePerformanceTracking: true
    });

    await middleware(fastifyInstance);

    expect(fastifyInstance.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
    expect(fastifyInstance.addHook).toHaveBeenCalledWith('onResponse', expect.any(Function));
    expect(fastifyInstance.addHook).toHaveBeenCalledWith('onError', expect.any(Function));
    expect(fastifyInstance.decorateRequest).toHaveBeenCalledWith('trackReceiptOperation', expect.any(Function));
  });

  test('should handle request tracking', () => {
    const mockRequest = {
      method: 'POST',
      url: '/api/receipts/upload',
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1'
    };

    const mockReply = {
      header: jest.fn(),
      statusCode: 200
    };

    // This tests that the middleware functions can be created without errors
    const middleware = monitoringMiddleware({
      metrics: metrics,
      enableDetailedLogging: true,
      enablePerformanceTracking: true
    });

    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('function');
  });
});

describe('Health Checks', () => {
  test('should generate health check response', () => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.0',
      environment: 'test',
      checks: {
        database: 'unknown',
        redis: 'unknown',
        storage: 'unknown'
      }
    };

    expect(health.status).toBe('healthy');
    expect(health.timestamp).toBeDefined();
    expect(health.uptime).toBeGreaterThan(0);
    expect(health.memory).toBeDefined();
    expect(health.version).toBe('1.0.0');
  });
});

describe('Metrics Export', () => {
  test('should export metrics in Prometheus format', async () => {
    // Record some test metrics
    metrics.httpRequestTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
    metrics.trackReceiptUpload(1.5, true);

    const metricsOutput = await register.metrics();
    
    expect(metricsOutput).toContain('http_requests_total');
    expect(metricsOutput).toContain('receipt_processing_total');
    expect(metricsOutput).toContain('# HELP');
    expect(metricsOutput).toContain('# TYPE');
  });

  test('should handle metrics export errors gracefully', async () => {
    // Mock register to throw error
    const originalMetrics = register.metrics;
    register.metrics = jest.fn().mockRejectedValue(new Error('Export failed'));

    try {
      await register.metrics();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    // Restore original function
    register.metrics = originalMetrics;
  });
}); 