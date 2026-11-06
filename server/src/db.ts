import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActivePoll } from '@scmp/shared';
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
