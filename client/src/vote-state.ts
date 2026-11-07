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

export function mergeResults(current: PollResults, incoming: PollResults): PollResults {
  if (incoming.pollId !== current.pollId || incoming.total < current.total) {
    return current;
  }
  return incoming;
}

export function deriveVoteView(
  results: PollResults,
  phase: VotePhase,
  baselineCount: number | null = null,
): VoteView {
  const selectedOptionId = selectedId(phase);
  const selectedCount =
    results.options.find((option) => option.id === selectedOptionId)?.count ?? 0;
  const pendingBump =
    phase.status === 'pending' && (baselineCount === null || selectedCount <= baselineCount);
  const counts = results.options.map((option) =>
    pendingBump && option.id === selectedOptionId ? option.count + 1 : option.count,
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
