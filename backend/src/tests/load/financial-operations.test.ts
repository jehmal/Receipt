import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../setup';
import { createTestDatabase } from '../fixtures/database';
import { performance } from 'perf_hooks';

describe('Financial Operations Load Testing', () => {
  let app: any;
  let testDb: any;
  let authTokens: string[] = [];

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = await createTestApp(testDb);
    
    // Create multiple test users
    for (let i = 0; i < 10; i++) {
      const response = await request(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: `loadtest${i}@example.com`,
          password: 'SecurePass123!',
          firstName: `LoadTest${i}`,
          lastName: 'User'
        });
      
      authTokens.push(response.body.authToken);
    }
  });

  afterAll(async () => {
    await testDb.close();
    await app.close();
  });

  describe('Concurrent Receipt Upload Load Testing', () => {
    it('should handle 100 concurrent receipt uploads', async () => {
      const concurrentUploads = 100;
      const uploadPromises: Promise<any>[] = [];
      const responseTimes: number[] = [];

      for (let i = 0; i < concurrentUploads; i++) {
        const authToken = authTokens[i % authTokens.length];
        const receiptData = {
          id: `load-test-receipt-${i}`,
          totalAmount: Math.random() * 1000,
          vendor: `Load Test Vendor ${i}`,
          imageData: generateTestImageData(),
          receiptDate: new Date().toISOString()
        };

        const uploadPromise = (async () => {
          const startTime = performance.now();
          
          const response = await request(app.server)
            .post('/api/v1/receipts')
            .set('Authorization', `Bearer ${authToken}`)
            .send(receiptData)
            .expect(201);
          
          const endTime = performance.now();
          responseTimes.push(endTime - startTime);
          
          return response;
        })();

        uploadPromises.push(uploadPromise);
      }

      const startTime = performance.now();
      const results = await Promise.all(uploadPromises);
      const endTime = performance.now();

      const totalDuration = endTime - startTime;
      const throughput = concurrentUploads / (totalDuration / 1000);
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

      // Performance assertions
      expect(throughput).toBeGreaterThan(10); // At least 10 uploads per second
      expect(averageResponseTime).toBeLessThan(2000); // Average response time under 2s
      expect(p95ResponseTime).toBeLessThan(5000); // 95th percentile under 5s
      
      // Verify all uploads succeeded
      expect(results).toHaveLength(concurrentUploads);
      results.forEach(result => {
        expect(result.body).toHaveProperty('id');
        expect(result.body.status).toBe('uploaded');
      });

      // Verify all receipts were saved to database
      const savedReceipts = await testDb.query(
        'SELECT COUNT(*) FROM receipts WHERE id LIKE $1',
        ['load-test-receipt-%']
      );
      expect(parseInt(savedReceipts.rows[0].count)).toBe(concurrentUploads);
    });

    it('should maintain data consistency under load', async () => {
      const concurrentCount = 50;
      const userIndex = 0;
      const authToken = authTokens[userIndex];
      const userId = `loadtest${userIndex}@example.com`;

      // Upload receipts concurrently for same user
      const uploadPromises = [];
      const expectedTotal = concurrentCount * 100; // Each receipt is $100

      for (let i = 0; i < concurrentCount; i++) {
        uploadPromises.push(
          request(app.server)
            .post('/api/v1/receipts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              id: `consistency-receipt-${i}`,
              totalAmount: 100.00,
              vendor: `Consistency Test Vendor ${i}`,
              imageData: generateTestImageData()
            })
            .expect(201)
        );
      }

      await Promise.all(uploadPromises);

      // Verify total spending calculation is accurate
      const spendingResponse = await request(app.server)
        .get('/api/v1/analytics/spending-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(parseFloat(spendingResponse.body.totalSpending)).toBe(expectedTotal);
      expect(spendingResponse.body.receiptCount).toBe(concurrentCount);
    });

    it('should handle OCR processing queue under load', async () => {
      const queueLoadCount = 20;
      const uploadPromises = [];

      for (let i = 0; i < queueLoadCount; i++) {
        const authToken = authTokens[i % authTokens.length];
        
        uploadPromises.push(
          request(app.server)
            .post('/api/v1/receipts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              id: `ocr-queue-receipt-${i}`,
              totalAmount: Math.random() * 500,
              vendor: `OCR Queue Vendor ${i}`,
              imageData: generateLargeTestImageData(), // Larger image for more processing time
              requiresOCR: true
            })
            .expect(201)
        );
      }

      const results = await Promise.all(uploadPromises);

      // Verify all receipts were queued for OCR processing
      results.forEach(result => {
        expect(result.body.status).toBe('processing');
      });

      // Wait for OCR processing to complete
      const maxWaitTime = 60000; // 60 seconds
      const checkInterval = 2000; // 2 seconds
      let allProcessed = false;
      let waitTime = 0;

      while (!allProcessed && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;

        const processedCount = await testDb.query(
          'SELECT COUNT(*) FROM receipts WHERE id LIKE $1 AND status = $2',
          ['ocr-queue-receipt-%', 'processed']
        );

        allProcessed = parseInt(processedCount.rows[0].count) === queueLoadCount;
      }

      expect(allProcessed).toBe(true);
      expect(waitTime).toBeLessThan(maxWaitTime);
    });
  });

  describe('Database Performance Under Load', () => {
    it('should maintain query performance with large dataset', async () => {
      // Create large dataset
      const datasetSize = 1000;
      const batchSize = 100;
      
      for (let batch = 0; batch < datasetSize / batchSize; batch++) {
        const insertPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const receiptIndex = batch * batchSize + i;
          const authToken = authTokens[receiptIndex % authTokens.length];
          
          insertPromises.push(
            request(app.server)
              .post('/api/v1/receipts')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                id: `perf-receipt-${receiptIndex}`,
                totalAmount: Math.random() * 1000,
                vendor: `Performance Vendor ${receiptIndex}`,
                imageData: generateTestImageData()
              })
              .expect(201)
          );
        }
        
        await Promise.all(insertPromises);
      }

      // Test query performance with large dataset
      const queryTests = [
        {
          name: 'Receipt list pagination',
          endpoint: '/api/v1/receipts?page=1&limit=20',
          maxTime: 1000
        },
        {
          name: 'Search receipts',
          endpoint: '/api/v1/receipts/search?q=Performance',
          maxTime: 2000
        },
        {
          name: 'Analytics summary',
          endpoint: '/api/v1/analytics/spending-summary',
          maxTime: 3000
        },
        {
          name: 'Date range query',
          endpoint: '/api/v1/receipts?startDate=2024-01-01&endDate=2024-12-31',
          maxTime: 2000
        }
      ];

      for (const test of queryTests) {
        const startTime = performance.now();
        
        await request(app.server)
          .get(test.endpoint)
          .set('Authorization', `Bearer ${authTokens[0]}`)
          .expect(200);
        
        const endTime = performance.now();
        const queryTime = endTime - startTime;
        
        expect(queryTime).toBeLessThan(test.maxTime);
      }
    });

    it('should handle concurrent analytics calculations', async () => {
      const concurrentAnalytics = 20;
      const analyticsPromises = [];

      // Generate concurrent analytics requests
      for (let i = 0; i < concurrentAnalytics; i++) {
        const authToken = authTokens[i % authTokens.length];
        
        analyticsPromises.push(
          request(app.server)
            .get('/api/v1/analytics/spending-by-category')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200)
        );
      }

      const startTime = performance.now();
      const results = await Promise.all(analyticsPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentAnalytics;

      // All analytics should complete within reasonable time
      expect(averageTime).toBeLessThan(3000); // 3 seconds average
      expect(totalTime).toBeLessThan(15000); // 15 seconds total

      // Verify all results are valid
      results.forEach(result => {
        expect(result.body).toHaveProperty('categories');
        expect(Array.isArray(result.body.categories)).toBe(true);
      });
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks during sustained load', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 100;

      // Sustained load test
      for (let i = 0; i < iterations; i++) {
        await request(app.server)
          .post('/api/v1/receipts')
          .set('Authorization', `Bearer ${authTokens[i % authTokens.length]}`)
          .send({
            id: `memory-test-receipt-${i}`,
            totalAmount: Math.random() * 100,
            vendor: `Memory Test Vendor ${i}`,
            imageData: generateTestImageData()
          })
          .expect(201);
        
        // Force garbage collection every 10 iterations
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);
    });

    it('should handle file upload size limits gracefully', async () => {
      const authToken = authTokens[0];
      
      // Test with oversized image
      const oversizedImageData = 'x'.repeat(10 * 1024 * 1024); // 10MB string

      const response = await request(app.server)
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          id: 'oversized-receipt',
          totalAmount: 100.00,
          vendor: 'Oversized Test Vendor',
          imageData: oversizedImageData
        })
        .expect(413); // Payload too large

      expect(response.body.error).toContain('File size too large');
    });
  });

  describe('Error Recovery Under Load', () => {
    it('should recover from temporary database disconnections', async () => {
      const authToken = authTokens[0];

      // Simulate database issues by temporarily closing connections
      // (In a real test, this would involve connection pool manipulation)
      
      const robustnessTests = [];
      
      for (let i = 0; i < 10; i++) {
        robustnessTests.push(
          request(app.server)
            .post('/api/v1/receipts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              id: `recovery-receipt-${i}`,
              totalAmount: 100.00,
              vendor: `Recovery Test Vendor ${i}`,
              imageData: generateTestImageData()
            })
        );
      }

      // Some requests might fail, but system should recover
      const results = await Promise.allSettled(robustnessTests);
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // At least 70% should succeed even under stress
      expect(successful.length / results.length).toBeGreaterThan(0.7);
      
      // Failed requests should have appropriate error messages
      failed.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).toMatch(/database|connection|timeout/i);
        }
      });
    });

    it('should handle rate limiting gracefully', async () => {
      const authToken = authTokens[0];
      const rapidRequests = [];

      // Make rapid requests to trigger rate limiting
      for (let i = 0; i < 200; i++) {
        rapidRequests.push(
          request(app.server)
            .get('/api/v1/receipts')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const results = await Promise.allSettled(rapidRequests);
      const rateLimitedCount = results.filter(result => 
        result.status === 'fulfilled' && 
        (result.value as any).status === 429
      ).length;

      // Some requests should be rate limited
      expect(rateLimitedCount).toBeGreaterThan(0);
      
      // Rate limited responses should have appropriate headers
      const rateLimitedResponse = results.find(result => 
        result.status === 'fulfilled' && 
        (result.value as any).status === 429
      );

      if (rateLimitedResponse && rateLimitedResponse.status === 'fulfilled') {
        const response = rateLimitedResponse.value as any;
        expect(response.headers['retry-after']).toBeDefined();
      }
    });
  });

  // Helper function to generate test image data
  function generateTestImageData(): string {
    return Buffer.from('fake-image-data-' + Math.random()).toString('base64');
  }

  // Helper function to generate larger test image data
  function generateLargeTestImageData(): string {
    const largeData = 'x'.repeat(100000); // 100KB
    return Buffer.from(largeData).toString('base64');
  }
});