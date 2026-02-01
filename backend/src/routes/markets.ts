import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { markets } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';

export async function marketRoutes(fastify: FastifyInstance) {
  // List all markets
  fastify.get('/', async () => {
    const result = await db.select().from(markets).orderBy(desc(markets.createdAt));
    return result;
  });

  // Get market by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const result = await db
      .select()
      .from(markets)
      .where(eq(markets.id, parseInt(id, 10)));

    if (result.length === 0) {
      return reply.status(404).send({ error: 'Market not found' });
    }

    return result[0];
  });
}
