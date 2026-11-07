import cors from '@fastify/cors';
import type { MyVote, VoteAccepted } from '@scmp/shared';
import type { FastifyReply } from 'fastify';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  assessVote,
  getActivePoll,
  getMyVote,
  getResults,
  insertVote,
  type SqliteDatabase,
  type VoteRejectReason,
} from './db.js';
import {
  applyVoteInstability,
  DISABLED_VOTE_INSTABILITY,
  type VoteInstabilityConfig,
} from './vote-instability.js';

interface VoteBody {
  optionId?: unknown;
}

interface BuildAppOptions {
  logger?: boolean;
  voteInstability?: VoteInstabilityConfig;
}

function normalizeUserId(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    return null;
  }
  return trimmed;
}

function normalizeOptionId(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    return null;
  }
  return trimmed;
}

function sendVoteRejection(reply: FastifyReply, reason: VoteRejectReason): FastifyReply {
  switch (reason) {
    case 'already_voted':
      return reply.code(409).send({ error: 'already_voted' });
    case 'invalid_option':
      return reply.code(400).send({ error: 'invalid_option' });
    case 'no_active_poll':
      return reply.code(404).send({ error: 'no_active_poll' });
    default: {
      const unreachable: never = reason;
      return unreachable;
    }
  }
}

export async function buildApp(
  db: SqliteDatabase,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const voteInstability = options.voteInstability ?? DISABLED_VOTE_INSTABILITY;
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

  app.get('/results', async (_request, reply) => {
    const results = getResults(db);
    if (!results) {
      return reply.code(404).send({ error: 'no_active_poll' });
    }
    return results;
  });

  app.get('/vote', async (request, reply) => {
    const userId = normalizeUserId(request.headers['x-user-id']);
    if (!userId) {
      return reply.code(400).send({ error: 'invalid_user_id' });
    }

    const mine = getMyVote(db, userId);
    if (!mine) {
      return reply.code(404).send({ error: 'no_active_poll' });
    }

    const body: MyVote = mine;
    return body;
  });

  app.post<{ Body: VoteBody }>('/vote', async (request, reply) => {
    const userId = normalizeUserId(request.headers['x-user-id']);
    if (!userId) {
      return reply.code(400).send({ error: 'invalid_user_id' });
    }

    const optionId = normalizeOptionId(request.body?.optionId);
    if (!optionId) {
      return reply.code(400).send({ error: 'invalid_option_id' });
    }

    const eligibility = assessVote(db, { userId, optionId });
    if (!eligibility.ok) {
      return sendVoteRejection(reply, eligibility.reason);
    }

    const outcome = await applyVoteInstability(voteInstability);
    if (outcome === 'fail') {
      return reply.code(500).send({ error: 'simulated_failure' });
    }

    const result = insertVote(db, { userId, optionId });
    if (!result.ok) {
      return sendVoteRejection(reply, result.reason);
    }

    const body: VoteAccepted = { pollId: result.pollId, optionId: result.optionId };
    return body;
  });

  return app;
}
