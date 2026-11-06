import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from './app.js';
import { initDatabase, openDatabase, resolveDatabasePath } from './db.js';

const dbPath = resolveDatabasePath();
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = openDatabase(dbPath);
initDatabase(db);

const app = await buildApp(db, { logger: true });
const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
