import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { initDatabase, openDatabase, type SqliteDatabase } from './db.js';

describe('HTTP API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let db: SqliteDatabase;

  beforeAll(async () => {
    db = openDatabase(':memory:');
    initDatabase(db);
    initDatabase(db);
    app = await buildApp(db, { logger: false });
  });

  afterAll(async () => {
    await app.close();
    db.close();
  });

  it('seed is idempotent after double init', () => {
    const pollRows = db.prepare('SELECT COUNT(*) AS n FROM polls').get() as { n: number };
    const optionRows = db.prepare('SELECT COUNT(*) AS n FROM options').get() as { n: number };
    expect(pollRows.n).toBe(1);
    expect(optionRows.n).toBeGreaterThanOrEqual(2);
  });

  it('GET /health returns ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('GET /poll returns seeded poll with options', async () => {
    const response = await app.inject({ method: 'GET', url: '/poll' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      id: string;
      options: Array<{ id: string; label: string }>;
      question: string;
    };
    expect(body.id).toBe('poll-1');
    expect(body.question.length).toBeGreaterThan(0);
    expect(body.options.length).toBeGreaterThanOrEqual(2);
    expect(body.options.every((option) => option.id && option.label)).toBe(true);
  });
});
