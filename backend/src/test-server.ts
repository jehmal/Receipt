import Fastify from 'fastify';

async function start() {
  const server = Fastify({ logger: true });
  
  server.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }));

  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server started on http://0.0.0.0:3000');
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();