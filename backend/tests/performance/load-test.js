// Enterprise Load Testing Suite for Receipt Vault Pro
// Comprehensive performance testing with realistic user scenarios

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const uploadSuccessRate = new Rate('upload_success_rate');
const ocrProcessingTime = new Trend('ocr_processing_time');
const authenticationTime = new Trend('authentication_time');
const receiptCreationCount = new Counter('receipt_creation_count');

// Test configuration
export const options = {
  // Performance thresholds
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
    error_rate: ['rate<0.01'],
    upload_success_rate: ['rate>0.99'],
    response_time: ['p(95)<1500'],
    authentication_time: ['p(95)<500'],
    ocrProcessingTime: ['p(95)<10000'], // OCR processing under 10s
  },

  // Load testing scenarios
  scenarios: {
    // Smoke test - basic functionality
    smoke_test: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { test_type: 'smoke' },
    },
    
    // Load test - normal expected load
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 10 },   // Ramp up
        { duration: '30m', target: 10 },  // Stay at 10 users
        { duration: '5m', target: 0 },    // Ramp down
      ],
      tags: { test_type: 'load' },
    },

    // Stress test - beyond normal capacity
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 50 },   // Ramp up to stress level
        { duration: '10m', target: 50 },  // Stay at stress level
        { duration: '5m', target: 100 },  // Peak stress
        { duration: '5m', target: 0 },    // Recovery
      ],
      tags: { test_type: 'stress' },
    },

    // Spike test - sudden load increase
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },   // Normal load
        { duration: '1m', target: 100 },  // Spike
        { duration: '2m', target: 10 },   // Back to normal
        { duration: '1m', target: 0 },    // Recovery
      ],
      tags: { test_type: 'spike' },
    },

    // Soak test - extended duration
    soak_test: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2h',
      tags: { test_type: 'soak' },
    },
  },
};

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'https://api.receiptvault.com';
const API_VERSION = 'v1';

// Test data
const testUsers = [
  { email: 'test1@receiptvault.com', password: 'TestPassword123!' },
  { email: 'test2@receiptvault.com', password: 'TestPassword123!' },
  { email: 'test3@receiptvault.com', password: 'TestPassword123!' },
];

// Sample receipt data for testing
const receiptImages = [
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
];

// Authentication helper
function authenticate() {
  const startTime = Date.now();
  
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  const loginResponse = http.post(`${BASE_URL}/auth/login`, {
    email: user.email,
    password: user.password,
  }, {
    headers: { 'Content-Type': 'application/json' },
    tags: { operation: 'authentication' },
  });

  const authTime = Date.now() - startTime;
  authenticationTime.add(authTime);

  check(loginResponse, {
    'login successful': (r) => r.status === 200,
    'login response has token': (r) => r.json('access_token') !== undefined,
  });

  if (loginResponse.status !== 200) {
    errorRate.add(1);
    return null;
  }

  return loginResponse.json('access_token');
}

// Main test function
export default function () {
  const token = authenticate();
  if (!token) return;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Test scenario: Complete receipt management workflow
  group('Receipt Management Workflow', function () {
    
    // 1. Health check
    group('Health Check', function () {
      const healthResponse = http.get(`${BASE_URL}/health`, {
        tags: { operation: 'health_check' },
      });
      
      check(healthResponse, {
        'health check successful': (r) => r.status === 200,
        'health check response time OK': (r) => r.timings.duration < 500,
      });
      
      responseTime.add(healthResponse.timings.duration);
    });

    // 2. Get user profile
    group('User Profile', function () {
      const profileResponse = http.get(`${BASE_URL}/api/${API_VERSION}/user/profile`, {
        headers,
        tags: { operation: 'get_profile' },
      });
      
      check(profileResponse, {
        'profile fetch successful': (r) => r.status === 200,
        'profile has user data': (r) => r.json('id') !== undefined,
      });
      
      responseTime.add(profileResponse.timings.duration);
    });

    // 3. List receipts
    group('List Receipts', function () {
      const receiptsResponse = http.get(`${BASE_URL}/api/${API_VERSION}/receipts?limit=20&offset=0`, {
        headers,
        tags: { operation: 'list_receipts' },
      });
      
      check(receiptsResponse, {
        'receipts list successful': (r) => r.status === 200,
        'receipts list has data': (r) => Array.isArray(r.json('receipts')),
      });
      
      responseTime.add(receiptsResponse.timings.duration);
    });

    // 4. Upload receipt (most critical operation)
    group('Upload Receipt', function () {
      const uploadStartTime = Date.now();
      
      const formData = {
        file: http.file(receiptImages[0], 'test-receipt.jpg', 'image/jpeg'),
        category: 'Business',
        description: 'Load test receipt',
        tags: JSON.stringify(['test', 'performance']),
        context: 'company',
      };

      const uploadResponse = http.post(`${BASE_URL}/api/${API_VERSION}/receipts/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        tags: { operation: 'upload_receipt' },
        timeout: '30s', // Longer timeout for file uploads
      });
      
      const uploadTime = Date.now() - uploadStartTime;
      
      const uploadSuccess = check(uploadResponse, {
        'upload successful': (r) => r.status === 201,
        'upload returns receipt ID': (r) => r.json('receipt.id') !== undefined,
        'upload response time acceptable': (r) => r.timings.duration < 15000,
      });
      
      uploadSuccessRate.add(uploadSuccess ? 1 : 0);
      responseTime.add(uploadResponse.timings.duration);
      
      if (uploadSuccess) {
        receiptCreationCount.add(1);
        
        // Wait for OCR processing
        const receiptId = uploadResponse.json('receipt.id');
        sleep(2); // Give OCR service time to process
        
        // Check OCR status
        const ocrStartTime = Date.now();
        const statusResponse = http.get(`${BASE_URL}/api/${API_VERSION}/receipts/${receiptId}`, {
          headers,
          tags: { operation: 'check_ocr_status' },
        });
        
        check(statusResponse, {
          'status check successful': (r) => r.status === 200,
          'OCR processing completed': (r) => r.json('receipt.status') === 'processed',
        });
        
        ocrProcessingTime.add(Date.now() - ocrStartTime);
      } else {
        errorRate.add(1);
      }
    });

    // 5. Search receipts
    group('Search Receipts', function () {
      const searchResponse = http.get(`${BASE_URL}/search?q=test&limit=10`, {
        headers,
        tags: { operation: 'search_receipts' },
      });
      
      check(searchResponse, {
        'search successful': (r) => r.status === 200,
        'search returns results': (r) => r.json('results') !== undefined,
      });
      
      responseTime.add(searchResponse.timings.duration);
    });

    // 6. Get analytics
    group('Analytics', function () {
      const analyticsResponse = http.get(`${BASE_URL}/api/${API_VERSION}/analytics/summary`, {
        headers,
        tags: { operation: 'get_analytics' },
      });
      
      check(analyticsResponse, {
        'analytics successful': (r) => r.status === 200,
        'analytics has data': (r) => r.json('totalReceipts') !== undefined,
      });
      
      responseTime.add(analyticsResponse.timings.duration);
    });
  });

  // Random think time between 1-3 seconds
  sleep(Math.random() * 2 + 1);
}

// Setup function - runs once before the test
export function setup() {
  console.log(`Starting performance test against ${BASE_URL}`);
  
  // Verify test environment is accessible
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API not accessible. Health check failed with status ${healthCheck.status}`);
  }
  
  console.log('Environment health check passed');
  return { baseUrl: BASE_URL };
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log('Performance test completed');
  console.log(`Test ran against: ${data.baseUrl}`);
}

// Custom report generation
export function handleSummary(data) {
  return {
    'performance-report.html': htmlReport(data),
    'performance-summary.txt': textSummary(data, { indent: ' ', enableColors: true }),
    'performance-results.json': JSON.stringify(data),
  };
}

// Error handling for failed checks
export function errorHandler(error) {
  console.error(`Test error: ${error.message}`);
  errorRate.add(1);
}