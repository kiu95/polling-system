import type { ActivePoll } from '@scmp/shared';
import { type FC, useEffect, useState } from 'react';
import { apiUrl } from './api';

type AppProps = Record<string, never>;

type ViewState =
  | { status: 'loading' }
  | { message: string; status: 'error' }
  | { status: 'ready'; poll: ActivePoll; healthOk: boolean };

export const App: FC<AppProps> = () => {
  const [view, setView] = useState<ViewState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [healthResponse, pollResponse] = await Promise.all([
          fetch(apiUrl('/health')),
          fetch(apiUrl('/poll')),
        ]);
        if (!healthResponse.ok || !pollResponse.ok) {
          throw new Error('API request failed');
        }
        const health = (await healthResponse.json()) as { ok: boolean };
        const poll = (await pollResponse.json()) as ActivePoll;
        if (!cancelled) {
          setView({ poll, status: 'ready', healthOk: health.ok });
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
  }, []);

  if (view.status === 'loading') {
    return <p>Loading</p>;
  }

  if (view.status === 'error') {
    return <p>Error: {view.message}</p>;
  }

  return (
    <main>
      <p>Health: {view.healthOk ? 'OK' : 'not ok'}</p>
      <h1>{view.poll.question}</h1>
      <ul>
        {view.poll.options.map((option) => (
          <li key={option.id}>{option.label}</li>
        ))}
      </ul>
    </main>
  );
};
