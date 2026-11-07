import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveDatabasePath } from './db.js';
import { resolveListenHost, resolveListenPort } from './listen.js';

describe('runtime config', () => {
  it('uses DATABASE_PATH when set', () => {
    expect(resolveDatabasePath({ DATABASE_PATH: '  /data/poll.db  ' })).toBe('/data/poll.db');
  });

  it('defaults the sqlite file beside the server package', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    expect(resolveDatabasePath({})).toBe(path.join(here, '..', 'data', 'poll.db'));
  });

  it('binds 127.0.0.1 and port 3000 unless HOST or PORT is set', () => {
    expect(resolveListenHost({})).toBe('127.0.0.1');
    expect(resolveListenHost({ HOST: ' 0.0.0.0 ' })).toBe('0.0.0.0');
    expect(resolveListenPort({})).toBe(3000);
    expect(resolveListenPort({ PORT: '8080' })).toBe(8080);
  });
});
