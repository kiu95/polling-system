import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { corsOriginFromEnv } from './cors-origin.js';
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
    expect(resolveListenHost({ HOST: '   ' })).toBe('127.0.0.1');
    expect(resolveListenHost({ HOST: ' 0.0.0.0 ' })).toBe('0.0.0.0');
    expect(resolveListenPort({})).toBe(3000);
    expect(resolveListenPort({ PORT: '   ' })).toBe(3000);
    expect(resolveListenPort({ PORT: '8080' })).toBe(8080);
  });

  it('rejects a PORT that is not an integer from 1 to 65535', () => {
    expect(() => resolveListenPort({ PORT: 'abc' })).toThrow(/invalid PORT: abc/);
    expect(() => resolveListenPort({ PORT: '0' })).toThrow(/invalid PORT: 0/);
    expect(() => resolveListenPort({ PORT: '65536' })).toThrow(/invalid PORT: 65536/);
    expect(() => resolveListenPort({ PORT: '3000.5' })).toThrow(/invalid PORT: 3000.5/);
  });

  it('reads CORS_ORIGIN as reflect, off, or an allowlist', () => {
    expect(corsOriginFromEnv({})).toBe(true);
    expect(corsOriginFromEnv({ CORS_ORIGIN: ' reflect ' })).toBe(true);
    expect(corsOriginFromEnv({ CORS_ORIGIN: 'off' })).toBe(false);
    expect(
      corsOriginFromEnv({ CORS_ORIGIN: 'http://127.0.0.1:8080, http://localhost:8080' }),
    ).toEqual(['http://127.0.0.1:8080', 'http://localhost:8080']);
  });
});
