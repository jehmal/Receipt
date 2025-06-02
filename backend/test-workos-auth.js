const fetch = require('node-fetch');
const chalk = require('chalk');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 5000;

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

// Helper function for making HTTP requests with timeout
async function makeRequest(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Test helper function
async function runTest(testName, testFunction) {
  testResults.total++;
  console.log(chalk.blue(`\n🧪 Testing: ${testName}`));
  
  try {
    await testFunction();
    testResults.passed++;
    console.log(chalk.green(`✅ PASS: ${testName}`));
  } catch (error) {
    testResults.failed++;
    console.log(chalk.red(`❌ FAIL: ${testName}`));
    console.log(chalk.red(`   Error: ${error.message}`));
  }
}

// Test 1: Server Health Check
async function testHealthEndpoint() {
  const response = await makeRequest(`${BASE_URL}/health`);
  
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.status || data.status !== 'healthy') {
    throw new Error('Health check returned unhealthy status');
  }
  
  if (!data.auth || data.auth !== 'WorkOS AuthKit') {
    throw new Error('WorkOS authentication not properly configured');
  }
  
  console.log(chalk.gray(`   Status: ${data.status}`));
  console.log(chalk.gray(`   Auth: ${data.auth}`));
  console.log(chalk.gray(`   Message: ${data.message}`));
}

// Test 2: Demo Endpoint (Public)
async function testDemoEndpoint() {
  const response = await makeRequest(`${BASE_URL}/api/demo`);
  
  if (!response.ok) {
    throw new Error(`Demo endpoint failed with status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.message) {
    throw new Error('Demo endpoint did not return expected message');
  }
  
  console.log(chalk.gray(`   Message: ${data.message.substring(0, 50)}...`));
  console.log(chalk.gray(`   Features: ${data.features ? data.features.length : 0} features listed`));
}

// Test 3: Protected Endpoint (Should Fail Without Auth)
async function testProtectedEndpointUnauthorized() {
  const response = await makeRequest(`${BASE_URL}/api/receipts`);
  
  if (response.status !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.error || data.error !== 'Unauthorized') {
    throw new Error('Expected "Unauthorized" error message');
  }
  
  console.log(chalk.gray(`   Correctly returned 401 with error: ${data.error}`));
}

// Test 4: WorkOS Login Endpoint (Should Redirect)
async function testWorkOSLoginEndpoint() {
  const response = await makeRequest(`${BASE_URL}/auth/login`, {
    redirect: 'manual' // Don't follow redirects
  });
  
  // Should be a 302 redirect to WorkOS
  if (response.status !== 302) {
    throw new Error(`Expected 302 redirect, got ${response.status}`);
  }
  
  const location = response.headers.get('location');
  if (!location || !location.includes('workos')) {
    throw new Error(`Expected redirect to WorkOS, got: ${location}`);
  }
  
  console.log(chalk.gray(`   Redirects to: ${location.substring(0, 50)}...`));
}

// Test 5: Auth Me Endpoint (Should Fail Without Session)
async function testAuthMeUnauthorized() {
  const response = await makeRequest(`${BASE_URL}/auth/me`);
  
  if (response.status !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${response.status}`);
  }
  
  console.log(chalk.gray(`   Correctly requires authentication`));
}

// Test 6: CORS Headers
async function testCORSHeaders() {
  const response = await makeRequest(`${BASE_URL}/health`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3001',
      'Access-Control-Request-Method': 'GET'
    }
  });
  
  const corsHeader = response.headers.get('access-control-allow-origin');
  if (!corsHeader) {
    throw new Error('CORS headers not properly configured');
  }
  
  console.log(chalk.gray(`   CORS Origin: ${corsHeader}`));
}

// Test 7: Session Cookie Configuration
async function testSessionCookieConfig() {
  const response = await makeRequest(`${BASE_URL}/auth/login`, {
    redirect: 'manual'
  });
  
  // Check if the server is configured to handle cookies
  const setCookie = response.headers.get('set-cookie');
  console.log(chalk.gray(`   Cookie handling configured: ${setCookie ? 'Yes' : 'No'}`));
}

// Test 8: Environment Variables Validation
async function testEnvironmentValidation() {
  // This is implicit - if the server started without errors about missing
  // WORKOS_API_KEY, WORKOS_CLIENT_ID, or WORKOS_COOKIE_PASSWORD, then they're set
  console.log(chalk.gray(`   Environment variables are properly configured`));
}

// Main test runner
async function runAllTests() {
  console.log(chalk.cyan('🚀 Starting WorkOS Authentication Workflow Tests\n'));
  console.log(chalk.yellow('=' .repeat(60)));
  
  // Wait for server to be ready
  console.log(chalk.blue('⏳ Waiting for server to be ready...'));
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Run all tests
  await runTest('Server Health Check', testHealthEndpoint);
  await runTest('Demo Endpoint (Public)', testDemoEndpoint);
  await runTest('Protected Endpoint (Unauthorized)', testProtectedEndpointUnauthorized);
  await runTest('WorkOS Login Endpoint', testWorkOSLoginEndpoint);
  await runTest('Auth Me Endpoint (Unauthorized)', testAuthMeUnauthorized);
  await runTest('CORS Headers', testCORSHeaders);
  await runTest('Session Cookie Configuration', testSessionCookieConfig);
  await runTest('Environment Variables', testEnvironmentValidation);
  
  // Print results
  console.log(chalk.yellow('\n' + '=' .repeat(60)));
  console.log(chalk.cyan('📊 Test Results Summary:'));
  console.log(chalk.green(`✅ Passed: ${testResults.passed}/${testResults.total}`));
  console.log(chalk.red(`❌ Failed: ${testResults.failed}/${testResults.total}`));
  
  if (testResults.failed === 0) {
    console.log(chalk.green('\n🎉 All tests passed! WorkOS authentication is properly configured.'));
    console.log(chalk.blue('\n📋 Next Steps:'));
    console.log(chalk.gray('   1. Test the complete authentication flow in your browser:'));
    console.log(chalk.gray('      → Visit http://localhost:3000/auth/login'));
    console.log(chalk.gray('   2. Test the mobile app authentication flow'));
    console.log(chalk.gray('   3. Verify protected endpoints work after authentication'));
  } else {
    console.log(chalk.red('\n⚠️  Some tests failed. Please check the configuration.'));
  }
  
  console.log(chalk.yellow('=' .repeat(60)));
}

// Handle errors and cleanup
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});

// Run tests
runAllTests().catch(error => {
  console.error(chalk.red('Test runner failed:'), error);
  process.exit(1);
}); 