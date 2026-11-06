import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActivePoll, PollResults } from '@scmp/shared';
import BetterSqlite3 from 'better-sqlite3';

export type SqliteDatabase = BetterSqlite3.Database;

interface OptionRow {
  id: string;
  label: string;
}

interface PollRow {
  id: string;
  question: string;
}

interface SeedOption {
  id: string;
  label: string;
}

interface ResultRow {
  id: string;
  count: number;
  label: string;
}

export interface InsertVoteInput {
  userId: string;
  optionId: string;
}

export type InsertVoteResult =
  | { ok: true; pollId: string; optionId: string }
  | { ok: false; reason: 'already_voted' | 'invalid_option' | 'no_active_poll' };

const SEED_POLL = {
  id: 'poll-1',
  question: 'Which format do you read most?',
  options: [
    { id: 'opt-web', label: 'Web' },
    { id: 'opt-app', label: 'App' },
    { id: 'opt-print', label: 'Print' },
  ] satisfies SeedOption[],
};

export function resolveDatabasePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, '..', 'data', 'poll.db');
}

export function openDatabase(filename: string): SqliteDatabase {
  const db = new BetterSqlite3(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function initSchema(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL REFERENCES polls(id),
      label TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL REFERENCES polls(id),
      option_id TEXT NOT NULL REFERENCES options(id),
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, poll_id)
    );
  `);
}

export function seedIfNeeded(db: SqliteDatabase): void {
  const existing = db.prepare('SELECT id FROM polls WHERE id = ?').get(SEED_POLL.id);
  if (existing) {
    return;
  }

  const insertPoll = db.prepare('INSERT INTO polls (id, question, is_active) VALUES (?, ?, 1)');
  const insertOption = db.prepare(
    'INSERT INTO options (id, poll_id, label, position) VALUES (?, ?, ?, ?)',
  );
  const run = db.transaction(() => {
    insertPoll.run(SEED_POLL.id, SEED_POLL.question);
    SEED_POLL.options.forEach((option, position) => {
      insertOption.run(option.id, SEED_POLL.id, option.label, position);
    });
  });
  run();
}

export function initDatabase(db: SqliteDatabase): void {
  initSchema(db);
  seedIfNeeded(db);
}

export function getActivePoll(db: SqliteDatabase): ActivePoll | null {
  const poll = db
    .prepare('SELECT id, question FROM polls WHERE is_active = 1 ORDER BY id LIMIT 1')
    .get() as PollRow | undefined;
  if (!poll) {
    return null;
  }

  const options = db
    .prepare('SELECT id, label FROM options WHERE poll_id = ? ORDER BY position ASC, id ASC')
    .all(poll.id) as OptionRow[];

  return {
    id: poll.id,
    question: poll.question,
    options,
  };
}

function getActivePollId(db: SqliteDatabase): string | null {
  const poll = db.prepare('SELECT id FROM polls WHERE is_active = 1 ORDER BY id LIMIT 1').get() as
    | { id: string }
    | undefined;
  return poll?.id ?? null;
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof BetterSqlite3.SqliteError && error.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

function votePercentage(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((count / total) * 1000) / 10;
}

export function insertVote(db: SqliteDatabase, input: InsertVoteInput): InsertVoteResult {
  const findOption = db.prepare('SELECT id FROM options WHERE id = ? AND poll_id = ?');
  const insert = db.prepare(
    'INSERT INTO votes (id, poll_id, option_id, user_id) VALUES (?, ?, ?, ?)',
  );

  const run = db.transaction((): InsertVoteResult => {
    const pollId = getActivePollId(db);
    if (!pollId) {
      return { ok: false, reason: 'no_active_poll' };
    }

    const option = findOption.get(input.optionId, pollId);
    if (!option) {
      return { ok: false, reason: 'invalid_option' };
    }

    try {
      insert.run(randomUUID(), pollId, input.optionId, input.userId);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        return { ok: false, reason: 'already_voted' };
      }
      throw error;
    }

    return { ok: true, pollId: pollId, optionId: input.optionId };
  });

  return run();
}

export function getResults(db: SqliteDatabase): PollResults | null {
  const pollId = getActivePollId(db);
  if (!pollId) {
    return null;
  }

  const rows = db
    .prepare(
      `SELECT o.id AS id, o.label AS label, COUNT(v.id) AS count
       FROM options o
       LEFT JOIN votes v ON v.option_id = o.id AND v.poll_id = o.poll_id
       WHERE o.poll_id = ?
       GROUP BY o.id
       ORDER BY o.position ASC, o.id ASC`,
    )
    .all(pollId) as ResultRow[];

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return {
    total,
    pollId,
    options: rows.map((row) => ({
      id: row.id,
      count: row.count,
      label: row.label,
      percentage: votePercentage(row.count, total),
    })),
  };
}
