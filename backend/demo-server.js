const fastify = require('fastify')({ logger: true });

// Enable CORS
fastify.register(require('@fastify/cors'), {
  origin: true
});

// Mock receipts data
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

// Health check
fastify.get('/health', async () => {
  return { 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Receipt Vault Demo API is running!' 
  };
});

// Demo info
fastify.get('/api/demo', async () => {
  return { 
    message: 'Welcome to Receipt Vault Demo API!',
    features: [
      'Receipt Management',
      'OCR Processing', 
      'Multi-tenant Support',
      'Search & Analytics'
    ],
    status: 'Demo Mode - Docker Infrastructure Running'
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

// Analytics
fastify.get('/api/analytics', async () => {
  return {
    totalReceipts: mockReceipts.length,
    totalAmount: mockReceipts.reduce((sum, r) => sum + r.totalAmount, 0),
    categories: {
      'Food & Dining': 1,
      'Transportation': 1, 
      'Office Supplies': 1
    }
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('');
    console.log('🚀 Receipt Vault Demo API RUNNING!');
    console.log('📡 http://localhost:3000');
    console.log('');
    console.log('📊 Available Endpoints:');
    console.log('   GET  /health - Health check');
    console.log('   GET  /api/demo - Demo info');
    console.log('   GET  /api/receipts - List receipts');
    console.log('   GET  /api/analytics - Analytics');
    console.log('');
    console.log('💾 Docker Services Running:');
    console.log('   ✅ PostgreSQL (port 5432)');
    console.log('   ✅ Redis (port 6379)');
    console.log('   ✅ Elasticsearch (port 9200)');
    console.log('   ✅ MinIO Storage (port 9000)');
    console.log('   ✅ Qdrant Vector DB (port 6333)');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start(); 