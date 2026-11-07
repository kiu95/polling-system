import { describe, expect, it } from 'vitest';
import { apiUrl, wsUrl } from './api';

describe('apiUrl', () => {
  it('stays relative when the base is empty', () => {
    expect(apiUrl('/health', '')).toBe('/health');
  });

  it('prefixes an absolute base and strips a trailing slash', () => {
    expect(apiUrl('/poll', 'http://127.0.0.1:3000/')).toBe('http://127.0.0.1:3000/poll');
  });
});

describe('wsUrl', () => {
  it('uses the page host when the base is empty', () => {
    expect(wsUrl('/ws', '')).toBe('ws://127.0.0.1:5173/ws');
  });

  it('maps http and https bases onto ws and wss', () => {
    expect(wsUrl('/ws', 'http://127.0.0.1:3000/')).toBe('ws://127.0.0.1:3000/ws');
    expect(wsUrl('/ws', 'https://example.com')).toBe('wss://example.com/ws');
  });
});
