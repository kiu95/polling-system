import type { PollResults } from '@polling/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  type LiveSocket,
  readResultsMessage,
  reconnectDelayMs,
  startLiveResults,
} from './use-live-results';

const snapshot: PollResults = {
  total: 1,
  pollId: 'poll-1',
  options: [{ id: 'opt-web', count: 1, label: 'Web', percentage: 100 }],
};

class FakeSocket implements LiveSocket {
  private listeners = new Map<string, Set<(event: { data: unknown }) => void>>();

  addEventListener(
    type: 'open' | 'message' | 'close',
    listener: (event: { data: unknown }) => void,
  ): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  emit(type: 'open' | 'message' | 'close', data?: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data });
    }
  }

  close(): void {
    this.emit('close');
  }
}

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

describe('readResultsMessage', () => {
  it('accepts a results snapshot and rejects a bad payload', () => {
    expect(readResultsMessage(JSON.stringify({ type: 'results', results: snapshot }))).toEqual(
      snapshot,
    );
    expect(readResultsMessage('not-json')).toBeNull();
    expect(
      readResultsMessage(JSON.stringify({ type: 'results', results: { total: 1 } })),
    ).toBeNull();
  });
});

describe('startLiveResults', () => {
  it('applies messages, resyncs after reconnect, and stops on unmount', async () => {
    const sockets: FakeSocket[] = [];
    const onResults = vi.fn();
    const onStatus = vi.fn();
    const fetchSnapshot = vi.fn(async () => snapshot);
    let scheduled: (() => void) | undefined;
    const stop = startLiveResults({
      connect: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      fetchSnapshot,
      onResults,
      onStatus,
      schedule: (callback) => {
        scheduled = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {
        scheduled = undefined;
      },
    });

    expect(onStatus).toHaveBeenCalledWith('connecting');
    const first = sockets[0];
    if (!first) {
      throw new Error('missing socket');
    }
    first.emit('open');
    expect(onStatus).toHaveBeenCalledWith('live');
    expect(fetchSnapshot).not.toHaveBeenCalled();
    first.emit('message', JSON.stringify({ type: 'results', results: snapshot }));
    expect(onResults).toHaveBeenCalledWith(snapshot);
    first.emit('message', '{"type":"results","results":{}}');
    expect(onResults).toHaveBeenCalledTimes(1);

    first.emit('close');
    expect(onStatus).toHaveBeenCalledWith('reconnecting');
    scheduled?.();
    const second = sockets[1];
    if (!second) {
      throw new Error('missing reconnect socket');
    }
    second.emit('open');
    await Promise.resolve();
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(onResults).toHaveBeenCalledTimes(2);

    onStatus.mockClear();
    stop();
    expect(onStatus).not.toHaveBeenCalledWith('reconnecting');
  });
});
