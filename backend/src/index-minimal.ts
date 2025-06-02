import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

const server: FastifyInstance = Fastify({
  logger: true
});

// Register CORS
server.register(cors, {
  origin: true
});

// Health check route
server.get('/health', async (request, reply) => {
  return { 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };
});

// Basic API route
server.get('/api/test', async (request, reply) => {
  return { message: 'Backend is working!' };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    console.log(`🚀 Server running on http://${host}:${port}`);
    console.log(`🔧 Health check: http://${host}:${port}/health`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();