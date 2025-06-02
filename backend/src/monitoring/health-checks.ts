/**
 * Comprehensive Health Checks for Receipt Vault Pro
 * Deep health validation endpoints for production monitoring
 */

import { logger } from '../utils/logger';
import { metricsCollector } from './metrics-collector';
import { errorTracker } from './error-tracking';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  component: string;
  responseTime: number;
  message?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface OverallHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  responseTime: number;
  version: string;
  environment: string;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  
  private constructor() {
    this.registerDefaultChecks();
    logger.info('Health check service initialized');
  }
  
  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }
  
  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    this.registerCheck('database', this.checkDatabase.bind(this));
    this.registerCheck('redis', this.checkRedis.bind(this));
    this.registerCheck('external_apis', this.checkExternalAPIs.bind(this));
    this.registerCheck('storage', this.checkStorage.bind(this));
    this.registerCheck('memory', this.checkMemoryUsage.bind(this));
    this.registerCheck('disk_space', this.checkDiskSpace.bind(this));
    this.registerCheck('ocr_service', this.checkOCRService.bind(this));
    this.registerCheck('job_queue', this.checkJobQueue.bind(this));
    this.registerCheck('security_services', this.checkSecurityServices.bind(this));
  }
  
  /**
   * Register a custom health check
   */
  public registerCheck(name: string, checkFunction: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFunction);
    logger.debug('Health check registered', { check: name });
  }
  
  /**
   * Run all health checks and return comprehensive status
   */
  public async performHealthCheck(includeDetails: boolean = true): Promise<OverallHealthStatus> {
    const startTime = Date.now();
    const results: HealthCheckResult[] = [];
    
    logger.debug('Starting health check', { 
      checks_count: this.checks.size,
      include_details: includeDetails 
    });
    
    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        return await checkFn();
      } catch (error) {
        logger.error('Health check failed', { check: name, error: error.message });
        return {
          status: 'unhealthy' as const,
          component: name,
          responseTime: Date.now() - startTime,
          message: `Health check failed: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }
    });
    
    try {
      results.push(...await Promise.all(checkPromises));
    } catch (error) {
      logger.error('Health check promise resolution failed', { error: error.message });
    }
    
    const responseTime = Date.now() - startTime;
    
    // Calculate summary
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      degraded: results.filter(r => r.status === 'degraded').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length
    };
    
    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }
    
    // Record metrics
    metricsCollector.updateBusinessMetric('health_check_status', overallStatus === 'healthy' ? 1 : 0, 'hourly');
    metricsCollector.updateBusinessMetric('health_check_response_time_ms', responseTime, 'hourly');
    
    const healthStatus: OverallHealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      checks: includeDetails ? results : [],
      summary
    };
    
    logger.info('Health check completed', {
      status: overallStatus,
      response_time_ms: responseTime,
      summary
    });
    
    return healthStatus;
  }
  
  /**
   * Perform a quick liveness check
   */
  public async livenessCheck(): Promise<{ status: 'ok' | 'error'; timestamp: string }> {
    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Basic checks - process is running and responsive
      if (uptime > 0 && memUsage.heapUsed > 0) {
        return {
          status: 'ok',
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'error',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error('Liveness check failed', { error: error.message });
      return {
        status: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Perform readiness check - can the service handle requests?
   */
  public async readinessCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check critical dependencies
      const dbCheck = await this.checkDatabase();
      const redisCheck = await this.checkRedis();
      
      const isCriticalHealthy = dbCheck.status !== 'unhealthy' && redisCheck.status !== 'unhealthy';
      
      return {
        status: isCriticalHealthy ? 'healthy' : 'unhealthy',
        component: 'readiness',
        responseTime: Date.now() - startTime,
        message: isCriticalHealthy ? 'Service ready to accept requests' : 'Service not ready - critical dependencies unhealthy',
        metadata: {
          database_status: dbCheck.status,
          redis_status: redisCheck.status
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Readiness check failed', { error: error.message });
      return {
        status: 'unhealthy',
        component: 'readiness',
        responseTime: Date.now() - startTime,
        message: `Readiness check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Database health check
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Dynamic import to avoid circular dependencies
      const { db } = await import('../database/connection');
      
      // Test basic connectivity
      const result = await db.query('SELECT 1 as health_check');
      const basicResponseTime = Date.now() - startTime;
      
      // Check connection pool status
      const pool = db.getPool();
      const poolStatus = {
        totalCount: pool.totalCount || 0,
        idleCount: pool.idleCount || 0,
        waitingCount: pool.waitingCount || 0
      };
      
      // Update connection metrics
      metricsCollector.updateConnectionMetrics(
        'database',
        poolStatus.totalCount - poolStatus.idleCount,
        poolStatus.idleCount,
        poolStatus.waitingCount
      );
      
      // Test query performance
      const perfTestStart = Date.now();
      await db.query('SELECT COUNT(*) FROM users');
      const queryResponseTime = Date.now() - perfTestStart;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;
      
      if (basicResponseTime > 5000) {
        status = 'unhealthy';
        message = 'Database response time too slow';
      } else if (basicResponseTime > 1000 || queryResponseTime > 2000) {
        status = 'degraded';
        message = 'Database performance degraded';
      } else {
        status = 'healthy';
        message = 'Database operating normally';
      }
      
      return {
        status,
        component: 'database',
        responseTime: Date.now() - startTime,
        message,
        metadata: {
          basic_response_time_ms: basicResponseTime,
          query_response_time_ms: queryResponseTime,
          pool_status: poolStatus,
          connection_string: this.sanitizeConnectionString(process.env.DATABASE_URL)
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        component: 'database',
        responseTime: Date.now() - startTime,
        message: `Database connection failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Redis health check
   */
  private async checkRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Dynamic import to avoid circular dependencies
      const Redis = require('redis');
      const client = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      
      await client.connect();
      
      // Test basic operations
      const testKey = `health_check_${Date.now()}`;
      await client.set(testKey, 'test_value', { EX: 30 });
      const value = await client.get(testKey);
      await client.del(testKey);
      
      // Get Redis info
      const info = await client.info();
      const memoryInfo = this.parseRedisInfo(info, 'memory');
      const statsInfo = this.parseRedisInfo(info, 'stats');
      
      await client.disconnect();
      
      const responseTime = Date.now() - startTime;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;
      
      if (value !== 'test_value') {
        status = 'unhealthy';
        message = 'Redis data integrity check failed';
      } else if (responseTime > 3000) {
        status = 'degraded';
        message = 'Redis response time degraded';
      } else {
        status = 'healthy';
        message = 'Redis operating normally';
      }
      
      // Update connection metrics
      const connectedClients = parseInt(statsInfo.connected_clients || '0');
      metricsCollector.updateConnectionMetrics('redis', connectedClients, 0, 0);
      
      return {
        status,
        component: 'redis',
        responseTime,
        message,
        metadata: {
          memory_usage_bytes: parseInt(memoryInfo.used_memory || '0'),
          connected_clients: connectedClients,
          total_commands_processed: parseInt(statsInfo.total_commands_processed || '0')
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Redis health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        component: 'redis',
        responseTime: Date.now() - startTime,
        message: `Redis connection failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * External APIs health check
   */
  private async checkExternalAPIs(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const apiChecks: Array<{ name: string; url: string; timeout: number }> = [
      { name: 'Google Vision API', url: 'https://vision.googleapis.com/v1/images:annotate', timeout: 5000 },
      { name: 'WorkOS API', url: 'https://api.workos.com/user_management/users', timeout: 3000 }
    ];
    
    const results: Array<{ name: string; status: string; responseTime: number }> = [];
    
    for (const api of apiChecks) {
      try {
        const apiStartTime = Date.now();
        const response = await fetch(api.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(api.timeout)
        });
        
        const apiResponseTime = Date.now() - apiStartTime;
        results.push({
          name: api.name,
          status: response.ok ? 'healthy' : 'degraded',
          responseTime: apiResponseTime
        });
        
      } catch (error) {
        results.push({
          name: api.name,
          status: 'unhealthy',
          responseTime: Date.now() - startTime
        });
      }
    }
    
    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      status = 'unhealthy';
    } else if (degradedCount > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }
    
    return {
      status,
      component: 'external_apis',
      responseTime: Date.now() - startTime,
      message: `External APIs status: ${results.length - unhealthyCount - degradedCount} healthy, ${degradedCount} degraded, ${unhealthyCount} unhealthy`,
      metadata: { api_checks: results },
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Storage health check
   */
  private async checkStorage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Check uploads directory
      const uploadsPath = path.join(process.cwd(), 'uploads');
      await fs.access(uploadsPath, fs.constants.R_OK | fs.constants.W_OK);
      
      // Test write operation
      const testFile = path.join(uploadsPath, `health_check_${Date.now()}.tmp`);
      await fs.writeFile(testFile, 'health check test');
      await fs.readFile(testFile);
      await fs.unlink(testFile);
      
      // Check disk space
      const stats = await fs.stat(uploadsPath);
      
      return {
        status: 'healthy',
        component: 'storage',
        responseTime: Date.now() - startTime,
        message: 'Storage operating normally',
        metadata: {
          uploads_directory: uploadsPath,
          accessible: true,
          test_write_successful: true
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        component: 'storage',
        responseTime: Date.now() - startTime,
        message: `Storage check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Memory usage health check
   */
  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const memUsage = process.memoryUsage();
    const memoryLimitMB = parseInt(process.env.MEMORY_LIMIT_MB || '1024');
    const memoryLimitBytes = memoryLimitMB * 1024 * 1024;
    
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usagePercentage = (memUsage.heapUsed / memoryLimitBytes) * 100;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;
    
    if (usagePercentage > 90) {
      status = 'unhealthy';
      message = `Memory usage critical: ${usagePercentage.toFixed(1)}%`;
    } else if (usagePercentage > 70) {
      status = 'degraded';
      message = `Memory usage high: ${usagePercentage.toFixed(1)}%`;
    } else {
      status = 'healthy';
      message = `Memory usage normal: ${usagePercentage.toFixed(1)}%`;
    }
    
    return {
      status,
      component: 'memory',
      responseTime: Date.now() - startTime,
      message,
      metadata: {
        heap_used_mb: heapUsedMB,
        heap_total_mb: heapTotalMB,
        usage_percentage: parseFloat(usagePercentage.toFixed(2)),
        memory_limit_mb: memoryLimitMB,
        external_mb: Math.round(memUsage.external / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Disk space health check
   */
  private async checkDiskSpace(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const { execSync } = require('child_process');
      const output = execSync('df -h /', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const dataLine = lines[1].split(/\s+/);
      
      const usagePercentage = parseInt(dataLine[4].replace('%', ''));
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;
      
      if (usagePercentage > 90) {
        status = 'unhealthy';
        message = `Disk space critical: ${usagePercentage}% used`;
      } else if (usagePercentage > 80) {
        status = 'degraded';
        message = `Disk space high: ${usagePercentage}% used`;
      } else {
        status = 'healthy';
        message = `Disk space normal: ${usagePercentage}% used`;
      }
      
      return {
        status,
        component: 'disk_space',
        responseTime: Date.now() - startTime,
        message,
        metadata: {
          total: dataLine[1],
          used: dataLine[2],
          available: dataLine[3],
          usage_percentage: usagePercentage
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'degraded',
        component: 'disk_space',
        responseTime: Date.now() - startTime,
        message: 'Unable to check disk space',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * OCR service health check
   */
  private async checkOCRService(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check if Google Cloud Vision API key is configured
      const hasApiKey = !!process.env.GOOGLE_CLOUD_API_KEY;
      
      if (!hasApiKey) {
        return {
          status: 'degraded',
          component: 'ocr_service',
          responseTime: Date.now() - startTime,
          message: 'OCR service not configured - Google Cloud API key missing',
          timestamp: new Date().toISOString()
        };
      }
      
      // Additional OCR-specific checks would go here
      return {
        status: 'healthy',
        component: 'ocr_service',
        responseTime: Date.now() - startTime,
        message: 'OCR service configured and ready',
        metadata: {
          google_vision_configured: hasApiKey
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        component: 'ocr_service',
        responseTime: Date.now() - startTime,
        message: `OCR service check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Job queue health check
   */
  private async checkJobQueue(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check Redis connection for job queue
      const redisResult = await this.checkRedis();
      
      if (redisResult.status === 'unhealthy') {
        return {
          status: 'unhealthy',
          component: 'job_queue',
          responseTime: Date.now() - startTime,
          message: 'Job queue unavailable - Redis connection failed',
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        status: 'healthy',
        component: 'job_queue',
        responseTime: Date.now() - startTime,
        message: 'Job queue operating normally',
        metadata: {
          redis_status: redisResult.status
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        component: 'job_queue',
        responseTime: Date.now() - startTime,
        message: `Job queue check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Security services health check
   */
  private async checkSecurityServices(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const securityChecks = {
        jwt_secret: !!process.env.JWT_SECRET,
        encryption_key: !!process.env.ENCRYPTION_KEY,
        session_secret: !!process.env.SESSION_SECRET,
        workos_configured: !!(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID)
      };
      
      const missingConfigs = Object.entries(securityChecks)
        .filter(([key, value]) => !value)
        .map(([key]) => key);
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;
      
      if (missingConfigs.length > 2) {
        status = 'unhealthy';
        message = `Critical security configurations missing: ${missingConfigs.join(', ')}`;
      } else if (missingConfigs.length > 0) {
        status = 'degraded';
        message = `Some security configurations missing: ${missingConfigs.join(', ')}`;
      } else {
        status = 'healthy';
        message = 'All security services properly configured';
      }
      
      return {
        status,
        component: 'security_services',
        responseTime: Date.now() - startTime,
        message,
        metadata: {
          configurations: securityChecks,
          missing_configs: missingConfigs
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        component: 'security_services',
        responseTime: Date.now() - startTime,
        message: `Security services check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Helper methods
   */
  private sanitizeConnectionString(connectionString?: string): string {
    if (!connectionString) return 'not_configured';
    return connectionString.replace(/\/\/.*:.*@/, '//***:***@');
  }
  
  private parseRedisInfo(info: string, section: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\n');
    let inSection = false;
    
    for (const line of lines) {
      if (line.startsWith(`# ${section.charAt(0).toUpperCase() + section.slice(1)}`)) {
        inSection = true;
        continue;
      }
      
      if (line.startsWith('#')) {
        inSection = false;
        continue;
      }
      
      if (inSection && line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }
}

// Export singleton instance
export const healthCheckService = HealthCheckService.getInstance();