import type { PollResults } from '@scmp/shared';
import { describe, expect, it } from 'vitest';
import { applyStoredVote, deriveVoteView, mergeResults, type VotePhase } from './vote-state';

const emptyResults: PollResults = {
  total: 0,
  pollId: 'poll-1',
  options: [
    { id: 'opt-web', count: 0, label: 'Web', percentage: 0 },
    { id: 'opt-app', count: 0, label: 'App', percentage: 0 },
    { id: 'opt-print', count: 0, label: 'Print', percentage: 0 },
  ],
};

const savedWeb: PollResults = {
  total: 1,
  pollId: 'poll-1',
  options: [
    { id: 'opt-web', count: 1, label: 'Web', percentage: 100 },
    { id: 'opt-app', count: 0, label: 'App', percentage: 0 },
    { id: 'opt-print', count: 0, label: 'Print', percentage: 0 },
  ],
};

describe('deriveVoteView', () => {
  it('adds one count and selects the pending option immediately', () => {
    const phase: VotePhase = { optionId: 'opt-web', status: 'pending' };
    const view = deriveVoteView(emptyResults, null, phase);

    expect(view.disabled).toBe(true);
    expect(view.pendingOptionId).toBe('opt-web');
    expect(view.selectedOptionId).toBe('opt-web');
    expect(view.errorMessage).toBeNull();
    const web = view.options.find((option) => option.id === 'opt-web');
    expect(web).toMatchObject({ count: 1, percentage: 100, selected: true });
    expect(
      view.options
        .filter((option) => option.id !== 'opt-web')
        .every((option) => option.count === 0),
    ).toBe(true);
  });

  it('drops the optimistic count when the phase is an error', () => {
    const pending = deriveVoteView(emptyResults, null, { optionId: 'opt-app', status: 'pending' });
    const rolledBack = deriveVoteView(emptyResults, null, {
      message: 'Vote did not save. Try again.',
      status: 'error',
    });

    expect(pending.options.find((option) => option.id === 'opt-app')?.count).toBe(1);
    expect(rolledBack.disabled).toBe(false);
    expect(rolledBack.selectedOptionId).toBeNull();
    expect(rolledBack.errorMessage).toBe('Vote did not save. Try again.');
    expect(
      rolledBack.options.every((option) => option.count === 0 && option.percentage === 0),
    ).toBe(true);
  });

  it('selects a stored vote without adding another count', () => {
    const view = deriveVoteView(emptyResults, null, { optionId: 'opt-app', status: 'voted' });

    expect(view.disabled).toBe(true);
    expect(view.selectedOptionId).toBe('opt-app');
    expect(view.options.every((option) => option.count === 0)).toBe(true);
  });

  it('does not bump a voted option when polled results already include it', () => {
    const view = deriveVoteView(savedWeb, null, { optionId: 'opt-web', status: 'voted' });
    expect(view.options.find((option) => option.id === 'opt-web')?.count).toBe(1);
  });

  it('keeps buttons disabled when the existing vote cannot be loaded', () => {
    const view = deriveVoteView(emptyResults, null, {
      message: 'You already voted. Refresh to see your choice.',
      status: 'blocked',
    });
    expect(view.disabled).toBe(true);
    expect(view.selectedOptionId).toBeNull();
    expect(view.errorMessage).toBe('You already voted. Refresh to see your choice.');
  });

  it('folds one accepted vote into the loaded results', () => {
    const next = applyStoredVote(emptyResults, 'opt-web');
    expect(next.total).toBe(1);
    expect(next.options.find((option) => option.id === 'opt-web')).toMatchObject({
      count: 1,
      percentage: 100,
    });
  });

  it('does not add a second count when results already include the vote', () => {
    const view = deriveVoteView(savedWeb, 'opt-web', { optionId: 'opt-web', status: 'voted' });
    expect(view.options.find((option) => option.id === 'opt-web')?.count).toBe(1);
  });

  it('drops the pending overlay once the snapshot total passes the baseline', () => {
    const phase: VotePhase = { optionId: 'opt-app', status: 'pending' };
    const view = deriveVoteView(savedWeb, null, phase, 0);
    expect(view.pendingOptionId).toBe('opt-app');
    expect(view.options.find((option) => option.id === 'opt-app')?.count).toBe(0);
    expect(view.options.find((option) => option.id === 'opt-web')?.count).toBe(1);
  });
});

describe('mergeResults', () => {
  it('keeps the current snapshot when the incoming total is lower', () => {
    expect(mergeResults(savedWeb, emptyResults)).toBe(savedWeb);
  });

  it('replaces the snapshot when the incoming total is equal or higher', () => {
    expect(mergeResults(emptyResults, savedWeb)).toBe(savedWeb);
    expect(mergeResults(savedWeb, savedWeb)).toBe(savedWeb);
  });

  it('ignores a snapshot for a different poll', () => {
    const other: PollResults = { ...savedWeb, pollId: 'poll-2', total: 9 };
    expect(mergeResults(savedWeb, other)).toBe(savedWeb);
  });
});
