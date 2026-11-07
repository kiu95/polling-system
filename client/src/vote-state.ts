import type { PollResults } from '@scmp/shared';

export type VotePhase =
  | { status: 'idle' }
  | { optionId: string; status: 'pending' }
  | { optionId: string; status: 'voted' }
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

function bumpTarget(phase: VotePhase): string | null {
  if (phase.status === 'pending' || phase.status === 'voted') {
    return phase.optionId;
  }
  return null;
}

export function deriveVoteView(
  results: PollResults,
  serverOptionId: string | null,
  phase: VotePhase,
): VoteView {
  const selectedOptionId = bumpTarget(phase);
  const includeBump = selectedOptionId !== null && selectedOptionId !== serverOptionId;
  const counts = results.options.map((option) =>
    includeBump && option.id === selectedOptionId ? option.count + 1 : option.count,
  );
  const total = counts.reduce((sum, count) => sum + count, 0);

  return {
    selectedOptionId,
    errorMessage: phase.status === 'error' ? phase.message : null,
    disabled: phase.status === 'pending' || phase.status === 'voted',
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
