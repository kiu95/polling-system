import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECONCILE_ATTEMPTS, RECONCILE_GAP_MS, submitVote } from './submit-vote';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('submitVote', () => {
  it('returns an error phase on 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'simulated_failure' }, 500)),
    );

    await expect(submitVote('user-1', 'opt-web')).resolves.toEqual({
      message: "Vote didn't save. Try again.",
      status: 'error',
    });
  });

  it('locks the stored option when the submit throws but the vote is saved', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        return jsonResponse({ pollId: 'poll-1', optionId: 'opt-web' }, 200);
      }),
    );

    await expect(submitVote('user-1', 'opt-web')).resolves.toEqual({
      optionId: 'opt-web',
      status: 'voted',
    });
  });

  it('locks the vote when an empty read is followed by a stored vote', async () => {
    let reads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        reads += 1;
        if (reads === 1) {
          return jsonResponse({ pollId: 'poll-1', optionId: null }, 200);
        }
        return jsonResponse({ pollId: 'poll-1', optionId: 'opt-web' }, 200);
      }),
    );
    vi.useFakeTimers();

    const pending = submitVote('user-1', 'opt-web');
    await vi.advanceTimersByTimeAsync(RECONCILE_GAP_MS);

    await expect(pending).resolves.toEqual({
      optionId: 'opt-web',
      status: 'voted',
    });
    expect(reads).toBe(2);
  });

  it('stays unconfirmed when reads stay empty', async () => {
    let reads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        reads += 1;
        return jsonResponse({ pollId: 'poll-1', optionId: null }, 200);
      }),
    );
    vi.useFakeTimers();

    const pending = submitVote('user-1', 'opt-web');
    await vi.advanceTimersByTimeAsync(RECONCILE_GAP_MS * (RECONCILE_ATTEMPTS - 1));

    await expect(pending).resolves.toEqual({
      message: 'Could not confirm your vote. Refresh to check.',
      status: 'error',
    });
    expect(reads).toBe(RECONCILE_ATTEMPTS);
  });

  it('asks for a refresh when the submit and the follow-up both fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      }),
    );

    await expect(submitVote('user-1', 'opt-web')).resolves.toEqual({
      message: 'Could not confirm your vote. Refresh to check.',
      status: 'error',
    });
  });

  it('locks the stored option after 409', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return jsonResponse({ error: 'already_voted' }, 409);
        }
        return jsonResponse({ pollId: 'poll-1', optionId: 'opt-print' }, 200);
      }),
    );

    await expect(submitVote('user-1', 'opt-web')).resolves.toEqual({
      optionId: 'opt-print',
      status: 'voted',
    });
  });

  it('blocks further votes when the follow-up read fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return jsonResponse({ error: 'already_voted' }, 409);
        }
        return jsonResponse({ error: 'no_active_poll' }, 404);
      }),
    );

    await expect(submitVote('user-1', 'opt-web')).resolves.toEqual({
      status: 'blocked',
      message: 'You already voted. Refresh to see your choice.',
    });
  });

  it('locks the submitted option when a 200 body cannot be parsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not-json', { status: 200 })),
    );

    await expect(submitVote('user-1', 'opt-app')).resolves.toEqual({
      optionId: 'opt-app',
      status: 'voted',
    });
  });
});
