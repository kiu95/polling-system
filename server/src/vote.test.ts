import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import { initDatabase, openDatabase, type SqliteDatabase } from './db.js';
import type { VoteInstabilityConfig } from './vote-instability.js';

function votePayload(optionId: string): string {
  return JSON.stringify({ optionId });
}

const jsonHeaders = (userId: string): Record<string, string> => ({
  'content-type': 'application/json',
  'x-user-id': userId,
});

describe('POST /vote and GET /results', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let db: SqliteDatabase;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    initDatabase(db);
    app = await buildApp(db, { logger: false });
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('accepts a vote and GET /results reflects count', async () => {
    const before = await app.inject({ method: 'GET', url: '/results' });
    expect(before.statusCode).toBe(200);
    const empty = before.json() as {
      total: number;
      options: Array<{ count: number; percentage: number }>;
    };
    expect(empty.total).toBe(0);
    expect(empty.options.every((option) => option.count === 0 && option.percentage === 0)).toBe(
      true,
    );

    const vote = await app.inject({
      headers: jsonHeaders('user-a'),
      method: 'POST',
      payload: votePayload('opt-web'),
      url: '/vote',
    });
    expect(vote.statusCode).toBe(200);
    expect(vote.json()).toEqual({ pollId: 'poll-1', optionId: 'opt-web' });

    const results = await app.inject({ method: 'GET', url: '/results' });
    expect(results.statusCode).toBe(200);
    const body = results.json() as {
      pollId: string;
      total: number;
      options: Array<{ id: string; count: number; percentage: number }>;
    };
    expect(body.pollId).toBe('poll-1');
    expect(body.total).toBe(1);
    const web = body.options.find((option) => option.id === 'opt-web');
    expect(web).toEqual({ id: 'opt-web', count: 1, label: 'Web', percentage: 100 });
    expect(
      body.options
        .filter((option) => option.id !== 'opt-web')
        .every((option) => option.count === 0 && option.percentage === 0),
    ).toBe(true);
  });

  it('returns 409 when the same user votes again', async () => {
    await app.inject({
      headers: jsonHeaders('user-b'),
      method: 'POST',
      payload: votePayload('opt-web'),
      url: '/vote',
    });

    const duplicate = await app.inject({
      headers: jsonHeaders('user-b'),
      method: 'POST',
      payload: votePayload('opt-app'),
      url: '/vote',
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: 'already_voted' });
  });

  it('does not drop counts when many users vote for the same option at once', async () => {
    const responses = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        app.inject({
          headers: jsonHeaders(`concurrent-${index}`),
          method: 'POST',
          payload: votePayload('opt-web'),
          url: '/vote',
        }),
      ),
    );

    expect(responses.every((response) => response.statusCode === 200)).toBe(true);

    const results = await app.inject({ method: 'GET', url: '/results' });
    const body = results.json() as { total: number; options: Array<{ id: string; count: number }> };
    expect(body.total).toBe(100);
    expect(body.options.find((o) => o.id === 'opt-web')?.count).toBe(100);

    const rows = db.prepare('SELECT COUNT(*) AS n FROM votes').get() as { n: number };
    expect(rows.n).toBe(100);
  });

  it('serializes duplicate submits from the same user', async () => {
    const [first, second] = await Promise.all([
      app.inject({
        headers: jsonHeaders('same-user'),
        method: 'POST',
        payload: votePayload('opt-web'),
        url: '/vote',
      }),
      app.inject({
        headers: jsonHeaders('same-user'),
        method: 'POST',
        payload: votePayload('opt-web'),
        url: '/vote',
      }),
    ]);

    const codes = [first.statusCode, second.statusCode].toSorted((a, b) => a - b);
    expect(codes).toEqual([200, 409]);

    const rows = db.prepare('SELECT COUNT(*) AS n FROM votes').get() as { n: number };
    expect(rows.n).toBe(1);
  });

  it('rejects bad user id and option id', async () => {
    const missingUser = await app.inject({
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      payload: votePayload('opt-web'),
      url: '/vote',
    });
    expect(missingUser.statusCode).toBe(400);
    expect(missingUser.json()).toEqual({ error: 'invalid_user_id' });

    const blankUser = await app.inject({
      headers: jsonHeaders('   '),
      method: 'POST',
      payload: votePayload('opt-web'),
      url: '/vote',
    });
    expect(blankUser.statusCode).toBe(400);
    expect(blankUser.json()).toEqual({ error: 'invalid_user_id' });

    const longUser = await app.inject({
      headers: jsonHeaders('x'.repeat(129)),
      method: 'POST',
      payload: votePayload('opt-web'),
      url: '/vote',
    });
    expect(longUser.statusCode).toBe(400);
    expect(longUser.json()).toEqual({ error: 'invalid_user_id' });

    const missingOption = await app.inject({
      headers: jsonHeaders('user-c'),
      method: 'POST',
      payload: JSON.stringify({}),
      url: '/vote',
    });
    expect(missingOption.statusCode).toBe(400);
    expect(missingOption.json()).toEqual({ error: 'invalid_option_id' });

    const wrongType = await app.inject({
      headers: jsonHeaders('user-d'),
      method: 'POST',
      payload: JSON.stringify({ optionId: 12 }),
      url: '/vote',
    });
    expect(wrongType.statusCode).toBe(400);
    expect(wrongType.json()).toEqual({ error: 'invalid_option_id' });

    const unknownOption = await app.inject({
      headers: jsonHeaders('user-e'),
      method: 'POST',
      payload: votePayload('unknown-option'),
      url: '/vote',
    });
    expect(unknownOption.statusCode).toBe(400);
    expect(unknownOption.json()).toEqual({ error: 'invalid_option' });

    const rows = db.prepare('SELECT COUNT(*) AS n FROM votes').get() as { n: number };
    expect(rows.n).toBe(0);
  });

  it('returns 404 when there is no active poll', async () => {
    db.exec('DELETE FROM votes; DELETE FROM options; DELETE FROM polls;');

    const vote = await app.inject({
      headers: jsonHeaders('user-f'),
      method: 'POST',
      payload: votePayload('opt-web'),
      url: '/vote',
    });
    expect(vote.statusCode).toBe(404);
    expect(vote.json()).toEqual({ error: 'no_active_poll' });

    const results = await app.inject({ method: 'GET', url: '/results' });
    expect(results.statusCode).toBe(404);
    expect(results.json()).toEqual({ error: 'no_active_poll' });
  });

  it('keeps 409 when instability would otherwise fail a second vote', async () => {
    const first = await app.inject({
      headers: jsonHeaders('user-voted'),
      method: 'POST',
      payload: votePayload('opt-web'),
      url: '/vote',
    });
    expect(first.statusCode).toBe(200);

    await app.close();
    const random = vi.fn(() => 0);
    const voteInstability: VoteInstabilityConfig = {
      rate: 1,
      delayMs: 1,
      enabled: true,
      random,
    };
    app = await buildApp(db, { logger: false, voteInstability });

    const again = await app.inject({
      headers: jsonHeaders('user-voted'),
      method: 'POST',
      payload: votePayload('opt-app'),
      url: '/vote',
    });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: 'already_voted' });
    expect(random).not.toHaveBeenCalled();

    const rows = db.prepare('SELECT COUNT(*) AS n FROM votes').get() as { n: number };
    expect(rows.n).toBe(1);
  });

  it('returns 500 without inserting when instability chooses fail', async () => {
    let calls = 0;
    const voteInstability: VoteInstabilityConfig = {
      rate: 1,
      delayMs: 1,
      enabled: true,
      random: () => {
        calls += 1;
        return calls === 1 ? 0 : 0.1;
      },
    };

    await app.close();
    db.close();
    db = openDatabase(':memory:');
    initDatabase(db);
    app = await buildApp(db, { logger: false, voteInstability });

    const response = await app.inject({
      headers: jsonHeaders('user-g'),
      method: 'POST',
      payload: votePayload('opt-web'),
      url: '/vote',
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'simulated_failure' });

    const rows = db.prepare('SELECT COUNT(*) AS n FROM votes').get() as { n: number };
    expect(rows.n).toBe(0);
  });

  it('waits then inserts when instability chooses delay', async () => {
    let calls = 0;
    const sleep = vi.fn(async () => {});
    const voteInstability: VoteInstabilityConfig = {
      rate: 1,
      delayMs: 42,
      enabled: true,
      random: () => {
        calls += 1;
        return calls === 1 ? 0 : 0.6;
      },
      sleep,
    };

    await app.close();
    db.close();
    db = openDatabase(':memory:');
    initDatabase(db);
    app = await buildApp(db, { logger: false, voteInstability });

    const response = await app.inject({
      headers: jsonHeaders('user-h'),
      method: 'POST',
      payload: votePayload('opt-web'),
      url: '/vote',
    });
    expect(response.statusCode).toBe(200);
    expect(sleep).toHaveBeenCalledWith(42);

    const rows = db.prepare('SELECT COUNT(*) AS n FROM votes').get() as { n: number };
    expect(rows.n).toBe(1);
  });

  it('GET /vote returns null option until the user votes', async () => {
    const before = await app.inject({
      headers: jsonHeaders('user-mine'),
      method: 'GET',
      url: '/vote',
    });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toEqual({ pollId: 'poll-1', optionId: null });

    await app.inject({
      headers: jsonHeaders('user-mine'),
      method: 'POST',
      payload: votePayload('opt-app'),
      url: '/vote',
    });

    const after = await app.inject({
      headers: jsonHeaders('user-mine'),
      method: 'GET',
      url: '/vote',
    });
    expect(after.statusCode).toBe(200);
    expect(after.json()).toEqual({ pollId: 'poll-1', optionId: 'opt-app' });
  });

  it('GET /vote rejects a missing user and a missing poll', async () => {
    const missingUser = await app.inject({ method: 'GET', url: '/vote' });
    expect(missingUser.statusCode).toBe(400);
    expect(missingUser.json()).toEqual({ error: 'invalid_user_id' });

    db.exec('DELETE FROM votes; DELETE FROM options; DELETE FROM polls;');
    const missingPoll = await app.inject({
      headers: jsonHeaders('user-f'),
      method: 'GET',
      url: '/vote',
    });
    expect(missingPoll.statusCode).toBe(404);
    expect(missingPoll.json()).toEqual({ error: 'no_active_poll' });
  });
});
