import os from 'os';
import { db } from '@/database/connection';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    storage: ServiceStatus;
    ocr: ServiceStatus;
  };
  system: {
    uptime: number;
    memory: MemoryUsage;
    cpu: number;
    diskSpace: DiskUsage;
  };
  timestamp: string;
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

interface MemoryUsage {
  total: number;
  used: number;
  free: number;
  percentage: number;
}

interface DiskUsage {
  total: number;
  used: number;
  free: number;
  percentage: number;
}

interface SystemMetrics {
  cpu: Array<{ timestamp: string; value: number }>;
  memory: Array<{ timestamp: string; total: number; used: number; free: number }>;
  disk: Array<{ timestamp: string; total: number; used: number; free: number }>;
  network: Array<{ timestamp: string; bytesIn: number; bytesOut: number }>;
}

export const systemMetricsService = {
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const [
        databaseStatus,
        redisStatus,
        storageStatus,
        ocrStatus
      ] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.checkStorageHealth(),
        this.checkOCRHealth()
      ]);

      const systemInfo = this.getSystemInfo();
      
      const overallStatus = this.determineOverallStatus([
        databaseStatus,
        redisStatus,
        storageStatus,
        ocrStatus
      ]);

      return {
        status: overallStatus,
        services: {
          database: databaseStatus,
          redis: redisStatus,
          storage: storageStatus,
          ocr: ocrStatus
        },
        system: systemInfo,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting system health:', error);
      throw error;
    }
  },

  async getMetrics(options: { metric?: string; timeRange?: string }): Promise<SystemMetrics> {
    try {
      const { metric, timeRange = '24h' } = options;
      const cacheKey = `metrics:${metric || 'all'}:${timeRange}`;
      
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const timeRangeMs = this.parseTimeRange(timeRange);
      const startTime = new Date(Date.now() - timeRangeMs);

      let metrics: SystemMetrics = {
        cpu: [],
        memory: [],
        disk: [],
        network: []
      };

      if (!metric || metric === 'cpu') {
        metrics.cpu = await this.getCPUMetrics(startTime);
      }

      if (!metric || metric === 'memory') {
        metrics.memory = await this.getMemoryMetrics(startTime);
      }

      if (!metric || metric === 'disk') {
        metrics.disk = await this.getDiskMetrics(startTime);
      }

      if (!metric || metric === 'network') {
        metrics.network = await this.getNetworkMetrics(startTime);
      }

      await redis.setex(cacheKey, 60, JSON.stringify(metrics)); // Cache for 1 minute
      return metrics;
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      throw error;
    }
  },

  async checkDatabaseHealth(): Promise<ServiceStatus> {
    try {
      const startTime = Date.now();
      await db.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 1000 ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async checkRedisHealth(): Promise<ServiceStatus> {
    try {
      const startTime = Date.now();
      await redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 500 ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async checkStorageHealth(): Promise<ServiceStatus> {
    try {
      // Check S3 or storage service health
      // This is a placeholder implementation
      const startTime = Date.now();
      // Simulate storage check
      await new Promise(resolve => setTimeout(resolve, 50));
      const responseTime = Date.now() - startTime;

      return {
        status: 'up',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async checkOCRHealth(): Promise<ServiceStatus> {
    try {
      // Check Google Cloud Vision API health
      // This is a placeholder implementation
      const startTime = Date.now();
      // Simulate OCR service check
      await new Promise(resolve => setTimeout(resolve, 100));
      const responseTime = Date.now() - startTime;

      return {
        status: 'up',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  getSystemInfo(): {
    uptime: number;
    memory: MemoryUsage;
    cpu: number;
    diskSpace: DiskUsage;
  } {
    const memInfo = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Get CPU usage (simplified)
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;

    // Get disk usage (simplified - would need platform-specific implementation)
    const diskTotal = 100 * 1024 * 1024 * 1024; // 100GB placeholder
    const diskUsed = 45 * 1024 * 1024 * 1024;   // 45GB placeholder
    const diskFree = diskTotal - diskUsed;

    return {
      uptime: process.uptime(),
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentage: (usedMem / totalMem) * 100
      },
      cpu: Math.min(cpuUsage, 100),
      diskSpace: {
        total: diskTotal,
        used: diskUsed,
        free: diskFree,
        percentage: (diskUsed / diskTotal) * 100
      }
    };
  },

  determineOverallStatus(serviceStatuses: ServiceStatus[]): 'healthy' | 'degraded' | 'unhealthy' {
    const downServices = serviceStatuses.filter(s => s.status === 'down').length;
    const degradedServices = serviceStatuses.filter(s => s.status === 'degraded').length;

    if (downServices > 0) {
      return 'unhealthy';
    } else if (degradedServices > 1) {
      return 'degraded';
    } else if (degradedServices === 1) {
      return 'degraded';
    }

    return 'healthy';
  },

  parseTimeRange(timeRange: string): number {
    const ranges: { [key: string]: number } = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    return ranges[timeRange] || ranges['24h'];
  },

  async getCPUMetrics(startTime: Date): Promise<Array<{ timestamp: string; value: number }>> {
    try {
      // In a real implementation, you would query from a metrics database
      // This is a placeholder that generates sample data
      const metrics = [];
      const now = Date.now();
      const interval = 5 * 60 * 1000; // 5 minutes

      for (let time = startTime.getTime(); time <= now; time += interval) {
        metrics.push({
          timestamp: new Date(time).toISOString(),
          value: Math.random() * 80 + 10 // Random CPU usage between 10-90%
        });
      }

      return metrics;
    } catch (error) {
      logger.error('Error getting CPU metrics:', error);
      return [];
    }
  },

  async getMemoryMetrics(startTime: Date): Promise<Array<{ 
    timestamp: string; 
    total: number; 
    used: number; 
    free: number 
  }>> {
    try {
      const metrics = [];
      const now = Date.now();
      const interval = 5 * 60 * 1000; // 5 minutes
      const totalMem = os.totalmem();

      for (let time = startTime.getTime(); time <= now; time += interval) {
        const usedPercent = Math.random() * 0.6 + 0.2; // 20-80% usage
        const used = totalMem * usedPercent;
        const free = totalMem - used;

        metrics.push({
          timestamp: new Date(time).toISOString(),
          total: totalMem,
          used,
          free
        });
      }

      return metrics;
    } catch (error) {
      logger.error('Error getting memory metrics:', error);
      return [];
    }
  },

  async getDiskMetrics(startTime: Date): Promise<Array<{ 
    timestamp: string; 
    total: number; 
    used: number; 
    free: number 
  }>> {
    try {
      const metrics = [];
      const now = Date.now();
      const interval = 15 * 60 * 1000; // 15 minutes
      const diskTotal = 100 * 1024 * 1024 * 1024; // 100GB

      for (let time = startTime.getTime(); time <= now; time += interval) {
        const usedPercent = Math.random() * 0.3 + 0.4; // 40-70% usage
        const used = diskTotal * usedPercent;
        const free = diskTotal - used;

        metrics.push({
          timestamp: new Date(time).toISOString(),
          total: diskTotal,
          used,
          free
        });
      }

      return metrics;
    } catch (error) {
      logger.error('Error getting disk metrics:', error);
      return [];
    }
  },

  async getNetworkMetrics(startTime: Date): Promise<Array<{ 
    timestamp: string; 
    bytesIn: number; 
    bytesOut: number 
  }>> {
    try {
      const metrics = [];
      const now = Date.now();
      const interval = 5 * 60 * 1000; // 5 minutes

      for (let time = startTime.getTime(); time <= now; time += interval) {
        metrics.push({
          timestamp: new Date(time).toISOString(),
          bytesIn: Math.random() * 1000000 + 100000, // Random bytes in
          bytesOut: Math.random() * 500000 + 50000   // Random bytes out
        });
      }

      return metrics;
    } catch (error) {
      logger.error('Error getting network metrics:', error);
      return [];
    }
  },

  async recordMetric(metric: string, value: number, timestamp?: Date): Promise<void> {
    try {
      // Store metric in database for historical analysis
      const query = `
        INSERT INTO system_metrics (metric_name, value, timestamp)
        VALUES ($1, $2, $3)
      `;
      
      await db.query(query, [
        metric,
        value,
        timestamp || new Date()
      ]);
    } catch (error) {
      logger.error('Error recording metric:', error);
    }
  },

  startMetricsCollection(): void {
    // Start collecting system metrics every minute
    setInterval(async () => {
      try {
        const systemInfo = this.getSystemInfo();
        
        await Promise.all([
          this.recordMetric('cpu_usage', systemInfo.cpu),
          this.recordMetric('memory_usage_percentage', systemInfo.memory.percentage),
          this.recordMetric('disk_usage_percentage', systemInfo.diskSpace.percentage),
          this.recordMetric('uptime', systemInfo.uptime)
        ]);
      } catch (error) {
        logger.error('Error collecting metrics:', error);
      }
    }, 60000); // Every minute
  }
};