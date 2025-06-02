import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../helpers/test-server';

describe('Performance and Load Testing', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      logger: false,
      trustProxy: true
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Response Time Performance', () => {
    it('should respond to health checks within 50ms', async () => {
      const startTime = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(50);
    });

    it('should respond to authentication within 100ms', async () => {
      const startTime = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle receipt creation within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: {
          merchant: 'Performance Test Merchant',
          amount: 99.99,
          category: 'Performance'
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(response.statusCode).toBe(201);
      expect(responseTime).toBeLessThan(200);
    });

    it('should handle search queries within 150ms', async () => {
      const startTime = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?q=Starbucks',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(150);
    });
  });

  describe('Concurrent Load Testing', () => {
    it('should handle 10 concurrent users', async () => {
      const concurrentUsers = 10;
      const startTime = Date.now();
      
      const requests = Array(concurrentUsers).fill(null).map((_, index) =>
        app.inject({
          method: 'GET',
          url: '/health',
          headers: {
            'X-User-ID': `user-${index}`
          }
        })
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(1000); // 1 second
      
      // Average response time should be acceptable
      const avgResponseTime = totalTime / concurrentUsers;
      expect(avgResponseTime).toBeLessThan(100);
    });

    it('should handle 50 concurrent API requests', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill(null).map((_, index) =>
        app.inject({
          method: 'GET',
          url: '/api/v1/receipts',
          headers: {
            'Authorization': 'Bearer valid-token',
            'X-Request-ID': `req-${index}`
          }
        })
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      // Count successful responses (excluding rate limited ones)
      const successfulResponses = responses.filter(r => r.statusCode === 200);
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      
      // Most requests should succeed, some may be rate limited
      expect(successfulResponses.length).toBeGreaterThan(30);
      expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(0);
      
      // Total requests should equal concurrent requests
      expect(successfulResponses.length + rateLimitedResponses.length).toBe(concurrentRequests);
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds
    });

    it('should handle mixed operation load', async () => {
      const operations = [
        // Health checks (fastest)
        ...Array(20).fill(null).map(() => ({
          method: 'GET' as const,
          url: '/health'
        })),
        // Receipt listings
        ...Array(15).fill(null).map((_, i) => ({
          method: 'GET' as const,
          url: '/api/v1/receipts',
          headers: { 'Authorization': 'Bearer valid-token' }
        })),
        // Receipt creations
        ...Array(10).fill(null).map((_, i) => ({
          method: 'POST' as const,
          url: '/api/v1/receipts',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json'
          },
          payload: {
            merchant: `Load Test Merchant ${i}`,
            amount: Math.random() * 100,
            category: 'Load Test'
          }
        })),
        // Search operations
        ...Array(5).fill(null).map(() => ({
          method: 'GET' as const,
          url: '/api/v1/receipts/search?q=test',
          headers: { 'Authorization': 'Bearer valid-token' }
        }))
      ];

      const startTime = Date.now();
      const requests = operations.map(op => app.inject(op));
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // Categorize responses
      const healthChecks = responses.slice(0, 20);
      const receiptsListings = responses.slice(20, 35);
      const receiptCreations = responses.slice(35, 45);
      const searchOperations = responses.slice(45, 50);

      // Health checks should all succeed
      healthChecks.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Most API operations should succeed
      const successfulApiOps = [
        ...receiptsListings.filter(r => r.statusCode === 200),
        ...receiptCreations.filter(r => r.statusCode === 201),
        ...searchOperations.filter(r => r.statusCode === 200)
      ];
      
      expect(successfulApiOps.length).toBeGreaterThan(20);
      expect(totalTime).toBeLessThan(10000); // 10 seconds
    });
  });

  describe('Memory and Resource Testing', () => {
    it('should handle large JSON payloads efficiently', async () => {
      const largePayload = {
        merchant: 'Large Payload Test',
        amount: 99.99,
        category: 'Testing',
        description: 'A'.repeat(10000), // 10KB description
        metadata: {
          items: Array(1000).fill(null).map((_, i) => ({
            id: i,
            name: `Item ${i}`,
            price: Math.random() * 50,
            category: `Category ${i % 10}`
          }))
        }
      };

      const startTime = Date.now();
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: largePayload
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(response.statusCode).toBe(201);
      expect(responseTime).toBeLessThan(1000); // Should handle within 1 second
    });

    it('should maintain performance under memory pressure', async () => {
      // Create multiple large requests to simulate memory pressure
      const requests = Array(10).fill(null).map((_, index) => {
        const payload = {
          merchant: `Memory Test ${index}`,
          amount: 50.00,
          category: 'Memory Test',
          metadata: {
            largeData: Array(5000).fill(null).map(i => `data-item-${i}`)
          }
        };

        return app.inject({
          method: 'POST',
          url: '/api/v1/receipts',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json'
          },
          payload
        });
      });

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All or most should succeed
      const successfulResponses = responses.filter(r => r.statusCode === 201);
      expect(successfulResponses.length).toBeGreaterThan(7);
      
      // Should complete within reasonable time despite large payloads
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe('Stress Testing', () => {
    it('should handle burst traffic patterns', async () => {
      // Simulate burst: many requests in quick succession, then normal load
      const burstRequests = Array(25).fill(null).map(() =>
        app.inject({
          method: 'GET',
          url: '/health'
        })
      );

      const burstStartTime = Date.now();
      const burstResponses = await Promise.all(burstRequests);
      const burstTime = Date.now() - burstStartTime;

      // Allow some time for rate limiting to reset
      await new Promise(resolve => setTimeout(resolve, 100));

      // Normal load after burst
      const normalRequests = Array(10).fill(null).map(() =>
        app.inject({
          method: 'GET',
          url: '/health'
        })
      );

      const normalStartTime = Date.now();
      const normalResponses = await Promise.all(normalRequests);
      const normalTime = Date.now() - normalStartTime;

      // Burst should handle most requests
      const successfulBurst = burstResponses.filter(r => r.statusCode === 200);
      expect(successfulBurst.length).toBeGreaterThan(15);

      // Normal requests should all succeed
      normalResponses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Normal load should be faster than burst
      expect(normalTime / normalRequests.length).toBeLessThan(burstTime / burstRequests.length);
    });

    it('should recover from high error rates', async () => {
      // Generate requests that will cause errors
      const errorRequests = Array(10).fill(null).map(() =>
        app.inject({
          method: 'GET',
          url: '/api/v1/test/error',
          headers: { 'Authorization': 'Bearer valid-token' }
        })
      );

      const errorResponses = await Promise.all(errorRequests);

      // All should return 500 errors
      errorResponses.forEach(response => {
        expect(response.statusCode).toBe(500);
      });

      // Server should still respond to normal requests
      const healthResponse = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(healthResponse.statusCode).toBe(200);

      // API should still work for valid requests
      const validResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      expect(validResponse.statusCode).toBe(200);
    });
  });

  describe('Latency Testing', () => {
    it('should measure consistent response times', async () => {
      const measurements = [];
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        const response = await app.inject({
          method: 'GET',
          url: '/health'
        });
        
        const responseTime = Date.now() - startTime;
        measurements.push(responseTime);
        
        expect(response.statusCode).toBe(200);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Calculate statistics
      const avgResponseTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxResponseTime = Math.max(...measurements);
      const minResponseTime = Math.min(...measurements);

      // Performance assertions
      expect(avgResponseTime).toBeLessThan(50);
      expect(maxResponseTime).toBeLessThan(100);
      expect(minResponseTime).toBeGreaterThan(0);

      // Consistency check - standard deviation should be reasonable
      const variance = measurements.reduce((acc, time) => 
        acc + Math.pow(time - avgResponseTime, 2), 0) / measurements.length;
      const stdDev = Math.sqrt(variance);
      
      expect(stdDev).toBeLessThan(20); // Low variance indicates consistency
    });

    it('should maintain performance under varying loads', async () => {
      const loadLevels = [5, 10, 20, 15, 8];
      const results = [];

      for (const load of loadLevels) {
        const startTime = Date.now();
        
        const requests = Array(load).fill(null).map(() =>
          app.inject({
            method: 'GET',
            url: '/api/v1/receipts',
            headers: { 'Authorization': 'Bearer valid-token' }
          })
        );

        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;
        const avgResponseTime = totalTime / load;

        const successCount = responses.filter(r => r.statusCode === 200).length;
        
        results.push({
          load,
          avgResponseTime,
          successRate: successCount / load
        });

        // Brief pause between load tests
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Performance should remain reasonable across load levels
      results.forEach(result => {
        expect(result.avgResponseTime).toBeLessThan(200);
        expect(result.successRate).toBeGreaterThan(0.5); // At least 50% success
      });
    });
  });

  describe('Throughput Testing', () => {
    it('should achieve target requests per second', async () => {
      const testDuration = 2000; // 2 seconds
      const startTime = Date.now();
      let requestCount = 0;
      const responses: any[] = [];

      // Send requests continuously for the test duration
      while (Date.now() - startTime < testDuration) {
        const request = app.inject({
          method: 'GET',
          url: '/health'
        });
        responses.push(request);
        requestCount++;
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Wait for all requests to complete
      const completedResponses = await Promise.all(responses);
      const actualDuration = Date.now() - startTime;

      // Calculate throughput
      const requestsPerSecond = (requestCount / actualDuration) * 1000;

      // Verify responses
      const successfulRequests = completedResponses.filter(r => r.statusCode === 200);
      const successRate = successfulRequests.length / completedResponses.length;

      expect(requestsPerSecond).toBeGreaterThan(10); // At least 10 RPS
      expect(successRate).toBeGreaterThan(0.9); // 90% success rate
    });
  });
});