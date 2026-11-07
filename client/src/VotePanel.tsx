import type { ActivePoll, PollResults } from '@polling/shared';
import { type FC, useRef, useState } from 'react';
import { submitVote } from './submit-vote';
import { deriveVoteView, type VotePhase } from './vote-state';

interface VotePanelProps {
  userId: string;
  poll: ActivePoll;
  results: PollResults;
  serverOptionId: string | null;
  onVoteAccepted: (optionId: string) => void;
}

export const VotePanel: FC<VotePanelProps> = ({
  poll,
  userId,
  results,
  serverOptionId,
  onVoteAccepted,
}) => {
  const [phase, setPhase] = useState<VotePhase>(() =>
    serverOptionId ? { optionId: serverOptionId, status: 'voted' } : { status: 'idle' },
  );
  const [baselineCount, setBaselineCount] = useState<number | null>(null);
  const busy = useRef(false);
  const view = deriveVoteView(results, phase, baselineCount);

  const choose = (optionId: string) => {
    if (busy.current || phase.status === 'voted' || phase.status === 'blocked') {
      return;
    }
    busy.current = true;
    const currentCount = results.options.find((option) => option.id === optionId)?.count ?? 0;
    setBaselineCount(currentCount);
    setPhase({ optionId, status: 'pending' });
    void submitVote(userId, optionId).then((next) => {
      busy.current = next.status === 'voted' || next.status === 'blocked';
      setBaselineCount(null);
      if (next.status === 'voted') {
        onVoteAccepted(next.optionId);
      }
      setPhase(next);
    });
  };

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-serif text-4xl leading-tight tracking-tight">{poll.question}</h1>
      <div className="flex flex-col gap-3">
        {view.options.map((option) => {
          const pending = view.pendingOptionId === option.id;
          return (
            <button
              type="button"
              key={option.id}
              disabled={view.disabled}
              aria-pressed={option.selected}
              className={`min-h-11 cursor-pointer rounded-lg border px-4 py-3 text-left transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                option.selected
                  ? 'border-zinc-950 bg-zinc-950 text-white'
                  : 'border-zinc-200 bg-white text-zinc-950'
              }`}
              onClick={() => {
                choose(option.id);
              }}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span>
                  {option.label}
                  {pending ? <span className="ml-2 text-sm text-white/80">Saving…</span> : null}
                </span>
                <span className="tabular-nums">{option.count}</span>
              </span>
              <span
                className={`mt-2 block h-1 overflow-hidden rounded-full ${
                  option.selected ? 'bg-white/25' : 'bg-zinc-200'
                }`}
              >
                <span
                  className={`block h-full ${option.selected ? 'bg-white' : 'bg-zinc-950'}`}
                  style={{ width: `${option.percentage}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
      {phase.status === 'voted' ? <p className="text-sm text-zinc-600">Your vote is in.</p> : null}
      {view.errorMessage ? (
        <p role="alert" className="text-sm text-red-700">
          {view.errorMessage}
        </p>
      ) : null}
    </section>
  );
};
