import { FastifyPluginAsync } from 'fastify';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // System health check
  fastify.get('/health', {
    preHandler: [fastify.adminOnly],
  }, async (request, reply) => {
    reply.status(501).send({ message: 'Admin health endpoint not implemented yet' });
  });

  // System metrics
  fastify.get('/metrics', {
    preHandler: [fastify.adminOnly],
  }, async (request, reply) => {
    reply.status(501).send({ message: 'Admin metrics endpoint not implemented yet' });
  });
};

export default adminRoutes;