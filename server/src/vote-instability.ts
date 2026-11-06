const DEFAULT_DELAY_MS = 3000;
const DEFAULT_FAILURE_RATE = 0.15;

export interface VoteInstabilityConfig {
  rate: number;
  delayMs: number;
  enabled: boolean;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export type VoteInstabilityOutcome = 'fail' | 'proceed';

export const DISABLED_VOTE_INSTABILITY: VoteInstabilityConfig = {
  enabled: false,
  delayMs: DEFAULT_DELAY_MS,
  rate: DEFAULT_FAILURE_RATE,
};

function readRate(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_FAILURE_RATE;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return DEFAULT_FAILURE_RATE;
  }
  return value;
}

function readDelayMs(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_DELAY_MS;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return DEFAULT_DELAY_MS;
  }
  return value;
}

export function voteInstabilityFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): VoteInstabilityConfig {
  return {
    rate: readRate(env.VOTE_FAILURE_RATE),
    delayMs: readDelayMs(env.VOTE_DELAY_MS),
    enabled: env.VOTE_INSTABILITY?.trim() !== 'off',
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function applyVoteInstability(
  config: VoteInstabilityConfig,
): Promise<VoteInstabilityOutcome> {
  if (!config.enabled) {
    return 'proceed';
  }

  const random = config.random ?? Math.random;
  if (random() >= config.rate) {
    return 'proceed';
  }

  if (random() < 0.5) {
    return 'fail';
  }

  const sleep = config.sleep ?? defaultSleep;
  await sleep(config.delayMs);
  return 'proceed';
}
