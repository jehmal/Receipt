import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const responseTimeUpload = new Trend('upload_response_time');
const responseTimeProcess = new Trend('process_response_time');
const receiptThroughput = new Rate('receipt_throughput');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Warm up to 10 users
    { duration: '3m', target: 10 },   // Stay at 10 users
    { duration: '1m', target: 25 },   // Ramp to 25 users
    { duration: '3m', target: 25 },   // Stay at 25 users
    { duration: '1m', target: 50 },   // Ramp to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Ramp to 100 users
    { duration: '5m', target: 100 },  // Peak load at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must be below 2s
    http_req_failed: ['rate<0.05'],    // Error rate must be below 5%
    errors: ['rate<0.05'],             // Custom error rate below 5%
    upload_response_time: ['p(95)<3000'], // Upload response time
    process_response_time: ['p(95)<30000'], // OCR processing time
  },
};

// Test users for load testing
const TEST_USERS = [
  { email: 'loadtest1@example.com', token: 'load-test-token-1' },
  { email: 'loadtest2@example.com', token: 'load-test-token-2' },
  { email: 'loadtest3@example.com', token: 'load-test-token-3' },
  { email: 'loadtest4@example.com', token: 'load-test-token-4' },
  { email: 'loadtest5@example.com', token: 'load-test-token-5' },
];

// Base configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Generate realistic receipt data
function generateReceiptData() {
  const vendors = [
    'Office Depot', 'Staples', 'Amazon Business', 'Home Depot', 'Walmart',
    'Target', 'Best Buy', 'Costco', 'FedEx Office', 'UPS Store',
    'Shell Gas Station', 'Exxon', 'Chevron', 'McDonald\'s', 'Starbucks',
    'Subway', 'Pizza Hut', 'Hotel Marriott', 'Hertz Car Rental', 'United Airlines'
  ];
  
  const categories = [
    'office_supplies', 'travel', 'meals', 'utilities', 'equipment',
    'software', 'marketing', 'training', 'maintenance', 'fuel'
  ];

  const vendor = vendors[Math.floor(Math.random() * vendors.length)];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const amount = Math.round((Math.random() * 500 + 10) * 100) / 100;
  const taxRate = 0.08 + Math.random() * 0.04; // 8-12% tax
  const taxAmount = Math.round(amount * taxRate * 100) / 100;

  return {
    id: uuidv4(),
    vendor: vendor,
    totalAmount: amount,
    taxAmount: taxAmount,
    category: category,
    receiptDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: `Business expense at ${vendor}`,
    imageData: generateTestImageData(),
  };
}

// Generate test image data (base64 encoded)
function generateTestImageData() {
  const imageSize = Math.floor(Math.random() * 50000) + 10000; // 10KB to 60KB
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  
  for (let i = 0; i < imageSize; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

// Get random test user
function getRandomUser() {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
}

// Main test function
export default function () {
  const user = getRandomUser();
  const receiptData = generateReceiptData();

  // Headers for authentication
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
  };

  // Test 1: Upload Receipt
  const uploadStartTime = new Date().getTime();
  
  const uploadResponse = http.post(
    `${BASE_URL}/api/v1/receipts`,
    JSON.stringify(receiptData),
    { headers: headers }
  );

  const uploadEndTime = new Date().getTime();
  const uploadDuration = uploadEndTime - uploadStartTime;
  
  responseTimeUpload.add(uploadDuration);

  const uploadSuccess = check(uploadResponse, {
    'receipt upload status is 201': (r) => r.status === 201,
    'receipt upload response time < 5000ms': (r) => r.timings.duration < 5000,
    'receipt upload has valid response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('id') && body.hasOwnProperty('status');
      } catch (e) {
        return false;
      }
    },
  });

  if (!uploadSuccess) {
    errorRate.add(1);
    console.error(`Upload failed for user ${user.email}: ${uploadResponse.status} - ${uploadResponse.body}`);
    return;
  }

  receiptThroughput.add(1);
  const receiptId = JSON.parse(uploadResponse.body).id;

  // Test 2: Check Receipt Status (OCR Processing)
  let processingComplete = false;
  let statusCheckAttempts = 0;
  const maxStatusChecks = 10;
  const statusCheckInterval = 2000; // 2 seconds

  const processStartTime = new Date().getTime();

  while (!processingComplete && statusCheckAttempts < maxStatusChecks) {
    sleep(statusCheckInterval / 1000); // K6 sleep is in seconds
    
    const statusResponse = http.get(
      `${BASE_URL}/api/v1/receipts/${receiptId}`,
      { headers: headers }
    );

    const statusSuccess = check(statusResponse, {
      'status check response is 200': (r) => r.status === 200,
      'status check response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    if (statusSuccess) {
      try {
        const statusBody = JSON.parse(statusResponse.body);
        if (statusBody.status === 'processed' || statusBody.status === 'failed') {
          processingComplete = true;
          
          const processEndTime = new Date().getTime();
          const processDuration = processEndTime - processStartTime;
          responseTimeProcess.add(processDuration);

          check(statusBody, {
            'receipt processing completed': (body) => body.status === 'processed',
            'OCR data present if processed': (body) => 
              body.status !== 'processed' || body.hasOwnProperty('ocrData'),
          });
        }
      } catch (e) {
        errorRate.add(1);
        console.error(`Status check parsing failed: ${e.message}`);
      }
    } else {
      errorRate.add(1);
    }

    statusCheckAttempts++;
  }

  // Test 3: Search Receipts
  const searchResponse = http.get(
    `${BASE_URL}/api/v1/receipts/search?q=${encodeURIComponent(receiptData.vendor)}`,
    { headers: headers }
  );

  check(searchResponse, {
    'search response status is 200': (r) => r.status === 200,
    'search response time < 2000ms': (r) => r.timings.duration < 2000,
    'search returns results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('results') && Array.isArray(body.results);
      } catch (e) {
        return false;
      }
    },
  });

  // Test 4: Get Analytics (every 10th iteration to reduce load)
  if (Math.random() < 0.1) {
    const analyticsResponse = http.get(
      `${BASE_URL}/api/v1/analytics/spending-summary`,
      { headers: headers }
    );

    check(analyticsResponse, {
      'analytics response status is 200': (r) => r.status === 200,
      'analytics response time < 3000ms': (r) => r.timings.duration < 3000,
      'analytics has valid data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.hasOwnProperty('totalSpending') && body.hasOwnProperty('receiptCount');
        } catch (e) {
          return false;
        }
      },
    });
  }

  // Random sleep between 1-3 seconds to simulate realistic user behavior
  sleep(Math.random() * 2 + 1);
}

// Setup function (runs once before the test)
export function setup() {
  console.log('Starting Receipt Vault Pro Load Test');
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Test Users: ${TEST_USERS.length}`);
  
  // Verify server is accessible
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server health check failed: ${healthCheck.status}`);
  }
  
  console.log('Server health check passed');
  return { startTime: new Date().getTime() };
}

// Teardown function (runs once after the test)
export function teardown(data) {
  const endTime = new Date().getTime();
  const totalDuration = (endTime - data.startTime) / 1000 / 60; // minutes
  
  console.log(`Load test completed in ${totalDuration.toFixed(2)} minutes`);
}

// Handle summary
export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data, null, 2),
    'summary.html': htmlReport(data),
  };
}

// Generate HTML report
function htmlReport(data) {
  const metrics = data.metrics;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Receipt Vault Pro Load Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 10px; border-left: 4px solid #007cba; }
        .pass { border-left-color: #28a745; }
        .fail { border-left-color: #dc3545; }
        .summary { background: #f8f9fa; padding: 20px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Receipt Vault Pro Load Test Report</h1>
    
    <div class="summary">
        <h2>Test Overview</h2>
        <p><strong>Duration:</strong> ${data.state.testRunDurationMs / 1000 / 60} minutes</p>
        <p><strong>Virtual Users:</strong> Peak of 100 concurrent users</p>
        <p><strong>Total Requests:</strong> ${metrics.http_reqs.values.count}</p>
        <p><strong>Success Rate:</strong> ${((1 - metrics.http_req_failed.values.rate) * 100).toFixed(2)}%</p>
    </div>
    
    <h2>Performance Metrics</h2>
    
    <div class="metric ${metrics.http_req_duration.values.p95 < 2000 ? 'pass' : 'fail'}">
        <strong>Response Time (95th percentile):</strong> ${metrics.http_req_duration.values.p95.toFixed(2)}ms
        <br><small>Threshold: &lt; 2000ms</small>
    </div>
    
    <div class="metric ${metrics.http_req_failed.values.rate < 0.05 ? 'pass' : 'fail'}">
        <strong>Error Rate:</strong> ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%
        <br><small>Threshold: &lt; 5%</small>
    </div>
    
    <div class="metric">
        <strong>Upload Response Time (95th percentile):</strong> ${metrics.upload_response_time?.values.p95?.toFixed(2) || 'N/A'}ms
    </div>
    
    <div class="metric">
        <strong>Processing Response Time (95th percentile):</strong> ${metrics.process_response_time?.values.p95?.toFixed(2) || 'N/A'}ms
    </div>
    
    <div class="metric">
        <strong>Receipt Throughput:</strong> ${metrics.receipt_throughput?.values.rate?.toFixed(2) || 'N/A'} receipts/second
    </div>
    
    <h2>Detailed Metrics</h2>
    <pre>${JSON.stringify(metrics, null, 2)}</pre>
</body>
</html>`;
}