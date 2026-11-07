import { describe, expect, it } from 'vitest';
import { reconnectDelayMs } from './use-live-results';

describe('reconnectDelayMs', () => {
  it('starts at 1s and caps at 15s', () => {
    expect(reconnectDelayMs(1)).toBe(1000);
    expect(reconnectDelayMs(2)).toBe(2000);
    expect(reconnectDelayMs(3)).toBe(4000);
    expect(reconnectDelayMs(4)).toBe(8000);
    expect(reconnectDelayMs(5)).toBe(15_000);
    expect(reconnectDelayMs(8)).toBe(15_000);
  });
});
