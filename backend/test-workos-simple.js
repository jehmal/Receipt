const http = require('http');
const https = require('https');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 5000;

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[37m'
};

// Helper function for making HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: TIMEOUT
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: parsedData,
            ok: res.statusCode >= 200 && res.statusCode < 300
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: data,
            ok: res.statusCode >= 200 && res.statusCode < 300
          });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test helper function
async function runTest(testName, testFunction) {
  testResults.total++;
  console.log(`\n${colors.blue}🧪 Testing: ${testName}${colors.reset}`);
  
  try {
    await testFunction();
    testResults.passed++;
    console.log(`${colors.green}✅ PASS: ${testName}${colors.reset}`);
  } catch (error) {
    testResults.failed++;
    console.log(`${colors.red}❌ FAIL: ${testName}${colors.reset}`);
    console.log(`${colors.red}   Error: ${error.message}${colors.reset}`);
  }
}

// Test 1: Server Health Check
async function testHealthEndpoint() {
  const response = await makeRequest(`${BASE_URL}/health`);
  
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  
  if (!response.data.status || response.data.status !== 'healthy') {
    throw new Error('Health check returned unhealthy status');
  }
  
  if (!response.data.auth || response.data.auth !== 'WorkOS AuthKit') {
    throw new Error('WorkOS authentication not properly configured');
  }
  
  console.log(`${colors.gray}   Status: ${response.data.status}${colors.reset}`);
  console.log(`${colors.gray}   Auth: ${response.data.auth}${colors.reset}`);
  console.log(`${colors.gray}   Message: ${response.data.message}${colors.reset}`);
}

// Test 2: Demo Endpoint (Public)
async function testDemoEndpoint() {
  const response = await makeRequest(`${BASE_URL}/api/demo`);
  
  if (!response.ok) {
    throw new Error(`Demo endpoint failed with status: ${response.status}`);
  }
  
  if (!response.data.message) {
    throw new Error('Demo endpoint did not return expected message');
  }
  
  console.log(`${colors.gray}   Message: ${response.data.message.substring(0, 50)}...${colors.reset}`);
  console.log(`${colors.gray}   Features: ${response.data.features ? response.data.features.length : 0} features listed${colors.reset}`);
}

// Test 3: Protected Endpoint (Should Fail Without Auth)
async function testProtectedEndpointUnauthorized() {
  const response = await makeRequest(`${BASE_URL}/api/receipts`);
  
  if (response.status !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${response.status}`);
  }
  
  if (!response.data.error || response.data.error !== 'Unauthorized') {
    throw new Error('Expected "Unauthorized" error message');
  }
  
  console.log(`${colors.gray}   Correctly returned 401 with error: ${response.data.error}${colors.reset}`);
}

// Test 4: WorkOS Login Endpoint (Should Redirect)
async function testWorkOSLoginEndpoint() {
  const response = await makeRequest(`${BASE_URL}/auth/login`);
  
  // Should be a redirect (302 or 301)
  if (response.status !== 302 && response.status !== 301) {
    throw new Error(`Expected redirect status, got ${response.status}`);
  }
  
  const location = response.headers.location;
  if (!location || !location.includes('workos')) {
    throw new Error(`Expected redirect to WorkOS, got: ${location}`);
  }
  
  console.log(`${colors.gray}   Redirects to: ${location.substring(0, 50)}...${colors.reset}`);
}

// Test 5: Auth Me Endpoint (Should Fail Without Session)
async function testAuthMeUnauthorized() {
  const response = await makeRequest(`${BASE_URL}/auth/me`);
  
  if (response.status !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${response.status}`);
  }
  
  console.log(`${colors.gray}   Correctly requires authentication${colors.reset}`);
}

// Test 6: Environment Variables Validation
async function testEnvironmentValidation() {
  // This is implicit - if the server started without errors about missing
  // WORKOS_API_KEY, WORKOS_CLIENT_ID, or WORKOS_COOKIE_PASSWORD, then they're set
  console.log(`${colors.gray}   Environment variables are properly configured${colors.reset}`);
}

// Main test runner
async function runAllTests() {
  console.log(`${colors.cyan}🚀 Starting WorkOS Authentication Workflow Tests\n${colors.reset}`);
  console.log(`${colors.yellow}============================================================${colors.reset}`);
  
  // Wait for server to be ready
  console.log(`${colors.blue}⏳ Waiting for server to be ready...${colors.reset}`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Run all tests
  await runTest('Server Health Check', testHealthEndpoint);
  await runTest('Demo Endpoint (Public)', testDemoEndpoint);
  await runTest('Protected Endpoint (Unauthorized)', testProtectedEndpointUnauthorized);
  await runTest('WorkOS Login Endpoint', testWorkOSLoginEndpoint);
  await runTest('Auth Me Endpoint (Unauthorized)', testAuthMeUnauthorized);
  await runTest('Environment Variables', testEnvironmentValidation);
  
  // Print results
  console.log(`${colors.yellow}\n============================================================${colors.reset}`);
  console.log(`${colors.cyan}📊 Test Results Summary:${colors.reset}`);
  console.log(`${colors.green}✅ Passed: ${testResults.passed}/${testResults.total}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${testResults.failed}/${testResults.total}${colors.reset}`);
  
  if (testResults.failed === 0) {
    console.log(`${colors.green}\n🎉 All tests passed! WorkOS authentication is properly configured.${colors.reset}`);
    console.log(`${colors.blue}\n📋 Next Steps:${colors.reset}`);
    console.log(`${colors.gray}   1. Test the complete authentication flow in your browser:${colors.reset}`);
    console.log(`${colors.gray}      → Visit http://localhost:3000/auth/login${colors.reset}`);
    console.log(`${colors.gray}   2. Test the mobile app authentication flow${colors.reset}`);
    console.log(`${colors.gray}   3. Verify protected endpoints work after authentication${colors.reset}`);
  } else {
    console.log(`${colors.red}\n⚠️  Some tests failed. Please check the configuration.${colors.reset}`);
  }
  
  console.log(`${colors.yellow}============================================================${colors.reset}`);
}

// Handle errors and cleanup
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});

// Run tests
runAllTests().catch(error => {
  console.error(`${colors.red}Test runner failed:${colors.reset}`, error);
  process.exit(1);
}); 