import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { getActivePoll, type SqliteDatabase } from './db.js';

interface BuildAppOptions {
  logger?: boolean;
}

export async function buildApp(
  db: SqliteDatabase,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  // Local dev only: reflect any Origin (fine for 127.0.0.1). Tighten to an allowlist before Docker / exposed ports — see issue #5.
  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ ok: true }));

  app.get('/poll', async (_request, reply) => {
    const poll = getActivePoll(db);
    if (!poll) {
      return reply.code(404).send({ error: 'no_active_poll' });
    }
    return poll;
  });

  return app;
}
