import { describe, expect, it } from 'vitest';
import { apiUrl } from './api';

describe('apiUrl', () => {
  it('stays relative when the base is empty', () => {
    expect(apiUrl('/health', '')).toBe('/health');
  });

  it('prefixes an absolute base and strips a trailing slash', () => {
    expect(apiUrl('/poll', 'http://127.0.0.1:3000/')).toBe('http://127.0.0.1:3000/poll');
  });
});
