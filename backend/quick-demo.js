const fastify = require('fastify')({ logger: true });

// Enable CORS
fastify.register(require('@fastify/cors'), {
  origin: true
});

// Mock data for demo
const mockReceipts = [
  {
    id: '1',
    vendorName: 'Starbucks',
    totalAmount: 12.50,
    currency: 'USD',
    receiptDate: '2024-01-15',
    category: 'Food & Dining',
    status: 'processed'
  },
  {
    id: '2', 
    vendorName: 'Shell Gas Station',
    totalAmount: 45.00,
    currency: 'USD',
    receiptDate: '2024-01-14',
    category: 'Transportation',
    status: 'processed'
  },
  {
    id: '3',
    vendorName: 'Amazon',
    totalAmount: 89.99,
    currency: 'USD', 
    receiptDate: '2024-01-13',
    category: 'Office Supplies',
    status: 'processing'
  }
];

const mockUser = {
  id: 'demo-user',
  email: 'demo@receiptsvault.com',
  firstName: 'Demo',
  lastName: 'User'
};

// Health check
fastify.get('/health', async () => {
  return { 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Receipt Vault Demo API is running!' 
  };
});

// Demo API endpoints
fastify.get('/api/demo', async () => {
  return { 
    message: 'Welcome to Receipt Vault Demo API!',
    features: [
      'Receipt Management',
      'OCR Processing',
      'Multi-tenant Support',
      'Search & Analytics'
    ],
    status: 'Demo Mode'
  };
});

// Get receipts
fastify.get('/api/receipts', async () => {
  return {
    receipts: mockReceipts,
    total: mockReceipts.length,
    message: 'Mock receipt data for demo'
  };
});

// Get single receipt
fastify.get('/api/receipts/:id', async (request) => {
  const receipt = mockReceipts.find(r => r.id === request.params.id);
  if (!receipt) {
    return fastify.httpErrors.notFound('Receipt not found');
  }
  return { receipt };
});

// Mock receipt upload
fastify.post('/api/receipts/upload', async (request) => {
  return {
    message: 'Receipt uploaded successfully (demo mode)',
    receiptId: 'demo-' + Date.now(),
    status: 'processing',
    note: 'In real app, this would process the file with OCR'
  };
});

// User info
fastify.get('/api/user', async () => {
  return { user: mockUser };
});

// Search receipts
fastify.get('/api/search', async (request) => {
  const query = request.query.q || '';
  const filtered = mockReceipts.filter(r => 
    r.vendorName.toLowerCase().includes(query.toLowerCase()) ||
    r.category.toLowerCase().includes(query.toLowerCase())
  );
  
  return {
    results: filtered,
    query,
    total: filtered.length
  };
});

// Analytics
fastify.get('/api/analytics', async () => {
  return {
    totalReceipts: mockReceipts.length,
    totalAmount: mockReceipts.reduce((sum, r) => sum + r.totalAmount, 0),
    categories: {
      'Food & Dining': 1,
      'Transportation': 1, 
      'Office Supplies': 1
    },
    recentActivity: 'Demo data shows 3 receipts processed'
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 Receipt Vault Demo API running on http://localhost:3000');
    console.log('📊 Try these endpoints:');
    console.log('   GET  /health - Health check');
    console.log('   GET  /api/demo - Demo info');
    console.log('   GET  /api/receipts - List receipts');
    console.log('   GET  /api/receipts/1 - Get receipt');
    console.log('   POST /api/receipts/upload - Upload receipt');
    console.log('   GET  /api/search?q=starbucks - Search');
    console.log('   GET  /api/analytics - Analytics');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start(); 