import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitVote } from './submit-vote';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
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

  it('returns a network error when the submit throws and no vote is stored', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        return jsonResponse({ pollId: 'poll-1', optionId: null }, 200);
      }),
    );

    await expect(submitVote('user-1', 'opt-web')).resolves.toEqual({
      message: 'Network problem. Vote was not saved.',
      status: 'error',
    });
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
