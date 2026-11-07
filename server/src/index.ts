import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from './app.js';
import { corsOriginFromEnv } from './cors-origin.js';
import { initDatabase, openDatabase, resolveDatabasePath } from './db.js';
import { resolveListenHost, resolveListenPort } from './listen.js';
import { voteInstabilityFromEnv } from './vote-instability.js';

const dbPath = resolveDatabasePath();
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = openDatabase(dbPath);
initDatabase(db);

const corsOrigin = corsOriginFromEnv();
const voteInstability = voteInstabilityFromEnv();
const app = await buildApp(db, { corsOrigin, logger: true, voteInstability });
if (voteInstability.enabled) {
  app.log.info(
    { rate: voteInstability.rate, delayMs: voteInstability.delayMs },
    'vote instability enabled',
  );
}

let shuttingDown = false;

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down');
  try {
    await app.close();
    db.close();
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
  process.exit(0);
};

try {
  const host = resolveListenHost();
  const port = resolveListenPort();
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
