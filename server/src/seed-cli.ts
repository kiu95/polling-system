import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { initDatabase, openDatabase, resolveDatabasePath } from './db.js';

const dbPath = resolveDatabasePath();
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = openDatabase(dbPath);
initDatabase(db);
db.close();

console.log(`seed ok: ${dbPath}`);
