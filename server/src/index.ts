import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from './app.js';
import { initDatabase, openDatabase, resolveDatabasePath } from './db.js';
import { resolveListenHost, resolveListenPort } from './listen.js';
import { voteInstabilityFromEnv } from './vote-instability.js';

const dbPath = resolveDatabasePath();
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = openDatabase(dbPath);
initDatabase(db);

const voteInstability = voteInstabilityFromEnv();
const app = await buildApp(db, { logger: true, voteInstability });
if (voteInstability.enabled) {
  app.log.info(
    { rate: voteInstability.rate, delayMs: voteInstability.delayMs },
    'vote instability enabled',
  );
}
const host = resolveListenHost();
const port = resolveListenPort();

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
