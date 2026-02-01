import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { marketRoutes } from './routes/markets.js';

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
});

await fastify.register(healthRoutes);
await fastify.register(marketRoutes, { prefix: '/api/markets' });

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
