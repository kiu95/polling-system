import type { PollResults } from '@scmp/shared';

export type VotePhase =
  | { status: 'idle' }
  | { optionId: string; status: 'pending' }
  | { optionId: string; status: 'voted' }
  | { message: string; status: 'blocked' }
  | { message: string; status: 'error' };

export interface VoteViewOption {
  id: string;
  count: number;
  label: string;
  selected: boolean;
  percentage: number;
}

export interface VoteView {
  disabled: boolean;
  options: VoteViewOption[];
  errorMessage: string | null;
  pendingOptionId: string | null;
  selectedOptionId: string | null;
}

function votePercentage(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((count / total) * 1000) / 10;
}

function selectedId(phase: VotePhase): string | null {
  if (phase.status === 'pending' || phase.status === 'voted') {
    return phase.optionId;
  }
  return null;
}

export function applyStoredVote(results: PollResults, optionId: string): PollResults {
  if (!results.options.some((option) => option.id === optionId)) {
    return results;
  }

  const total = results.total + 1;
  return {
    total,
    pollId: results.pollId,
    options: results.options.map((option) => {
      const count = option.id === optionId ? option.count + 1 : option.count;
      return {
        count,
        id: option.id,
        label: option.label,
        percentage: votePercentage(count, total),
      };
    }),
  };
}

export function deriveVoteView(
  results: PollResults,
  _serverOptionId: string | null,
  phase: VotePhase,
): VoteView {
  const selectedOptionId = selectedId(phase);
  const counts = results.options.map((option) =>
    phase.status === 'pending' && option.id === selectedOptionId ? option.count + 1 : option.count,
  );
  const total = counts.reduce((sum, count) => sum + count, 0);

  return {
    selectedOptionId,
    errorMessage: phase.status === 'error' || phase.status === 'blocked' ? phase.message : null,
    disabled: phase.status === 'pending' || phase.status === 'voted' || phase.status === 'blocked',
    pendingOptionId: phase.status === 'pending' ? phase.optionId : null,
    options: results.options.map((option, index) => {
      const count = counts[index] ?? option.count;
      return {
        count,
        id: option.id,
        label: option.label,
        selected: option.id === selectedOptionId,
        percentage: votePercentage(count, total),
      };
    }),
  };
}
