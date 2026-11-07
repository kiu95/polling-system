import type { PollResults } from '@scmp/shared';
import { describe, expect, it } from 'vitest';
import { createResultsHub, MAX_BUFFERED_BYTES, type ResultsClient } from './results-hub.js';

const results: PollResults = {
  total: 1,
  pollId: 'poll-1',
  options: [{ id: 'opt-web', count: 1, label: 'Web', percentage: 100 }],
};

function client(bufferedAmount: number): ResultsClient & { closed: boolean; sent: string[] } {
  return {
    bufferedAmount,
    closed: false,
    readyState: 1,
    sent: [],
    close() {
      this.closed = true;
      this.readyState = 3;
    },
    send(data: string) {
      this.sent.push(data);
    },
  };
}

describe('createResultsHub', () => {
  it('closes a client whose send buffer is over the cap', () => {
    const hub = createResultsHub();
    const slow = client(MAX_BUFFERED_BYTES + 1);
    const fast = client(0);
    hub.add(slow);
    hub.add(fast);

    hub.broadcast(results);

    expect(slow.closed).toBe(true);
    expect(slow.sent).toEqual([]);
    expect(fast.sent).toHaveLength(1);
    expect(JSON.parse(fast.sent[0] ?? '')).toMatchObject({ type: 'results', results });
  });
});
