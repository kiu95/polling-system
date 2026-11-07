import type { ActivePoll, MyVote, PollResults } from '@scmp/shared';
import { type FC, useEffect, useState } from 'react';
import { apiUrl } from './api';
import { readUserId } from './user-id';
import { VotePanel } from './VotePanel';
import { applyStoredVote } from './vote-state';

type ViewState =
  | { status: 'loading' }
  | { message: string; status: 'error' }
  | {
      status: 'ready';
      poll: ActivePoll;
      healthOk: boolean;
      results: PollResults;
      serverOptionId: string | null;
    };

const pageClass = 'min-h-screen bg-zinc-50 font-sans text-zinc-950';
const columnClass = 'mx-auto flex w-full max-w-lg flex-col justify-center px-4 py-10';

export const App: FC = () => {
  const [userId] = useState(() => readUserId(localStorage, () => crypto.randomUUID()));
  const [view, setView] = useState<ViewState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [healthResponse, pollResponse, resultsResponse, voteResponse] = await Promise.all([
          fetch(apiUrl('/health')),
          fetch(apiUrl('/poll')),
          fetch(apiUrl('/results')),
          fetch(apiUrl('/vote'), { headers: { 'x-user-id': userId } }),
        ]);
        if (!healthResponse.ok || !pollResponse.ok || !resultsResponse.ok || !voteResponse.ok) {
          throw new Error('API request failed');
        }
        const health = (await healthResponse.json()) as { ok: boolean };
        const poll = (await pollResponse.json()) as ActivePoll;
        const results = (await resultsResponse.json()) as PollResults;
        const mine = (await voteResponse.json()) as MyVote;
        if (!cancelled) {
          setView({
            poll,
            results,
            status: 'ready',
            healthOk: health.ok,
            serverOptionId: mine.optionId,
          });
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Request failed';
          setView({ message, status: 'error' });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const onVoteAccepted = (optionId: string) => {
    setView((current) => {
      if (current.status !== 'ready' || current.serverOptionId === optionId) {
        return current;
      }
      return {
        poll: current.poll,
        results: applyStoredVote(current.results, optionId),
        status: 'ready',
        healthOk: current.healthOk,
        serverOptionId: optionId,
      };
    });
  };

  if (view.status === 'loading') {
    return (
      <main className={pageClass}>
        <div className={columnClass}>
          <p>Loading</p>
        </div>
      </main>
    );
  }

  if (view.status === 'error') {
    return (
      <main className={pageClass}>
        <div className={columnClass}>
          <p role="alert">Error: {view.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={pageClass}>
      <div className={columnClass}>
        <p className="mb-6 text-sm text-zinc-500">Health: {view.healthOk ? 'OK' : 'not ok'}</p>
        <VotePanel
          userId={userId}
          poll={view.poll}
          results={view.results}
          serverOptionId={view.serverOptionId}
          onVoteAccepted={onVoteAccepted}
        />
      </div>
    </main>
  );
};
