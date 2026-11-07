import type { MyVote, VoteAccepted } from '@scmp/shared';
import { apiUrl } from './api';
import type { VotePhase } from './vote-state';

const VOTE_TIMEOUT_MS = 8000;

const SAVE_FAILED = "Vote didn't save. Try again.";
const NETWORK_FAILED = 'Network problem. Vote was not saved.';
const ALREADY_VOTED = 'You already voted. Refresh to see your choice.';

interface ErrorBody {
  error?: unknown;
}

async function errorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as ErrorBody;
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

function errorPhase(message: string): VotePhase {
  return { message, status: 'error' };
}

function blockedPhase(): VotePhase {
  return { status: 'blocked', message: ALREADY_VOTED };
}

async function lockExistingVote(userId: string): Promise<VotePhase> {
  try {
    const response = await fetch(apiUrl('/vote'), {
      headers: { 'x-user-id': userId },
      signal: AbortSignal.timeout(VOTE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return blockedPhase();
    }
    const body = (await response.json()) as MyVote;
    if (!body.optionId) {
      return blockedPhase();
    }
    return { optionId: body.optionId, status: 'voted' };
  } catch {
    return blockedPhase();
  }
}

export async function submitVote(userId: string, optionId: string): Promise<VotePhase> {
  try {
    const response = await fetch(apiUrl('/vote'), {
      body: JSON.stringify({ optionId }),
      headers: {
        'content-type': 'application/json',
        'x-user-id': userId,
      },
      method: 'POST',
      signal: AbortSignal.timeout(VOTE_TIMEOUT_MS),
    });

    if (response.ok) {
      try {
        const body = (await response.json()) as VoteAccepted;
        if (typeof body.optionId === 'string' && body.optionId.length > 0) {
          return { optionId: body.optionId, status: 'voted' };
        }
      } catch {
        // The vote is stored. Lock the option we sent when the body cannot be read.
      }
      return { optionId, status: 'voted' };
    }

    if (response.status === 409) {
      return lockExistingVote(userId);
    }

    if (response.status === 400) {
      const code = await errorCode(response);
      if (code === 'invalid_option' || code === 'invalid_option_id') {
        return errorPhase("That choice isn't valid.");
      }
      return errorPhase(SAVE_FAILED);
    }

    if (response.status === 404) {
      return errorPhase('No active poll.');
    }

    return errorPhase(SAVE_FAILED);
  } catch {
    return errorPhase(NETWORK_FAILED);
  }
}
