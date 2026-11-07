import type { PollResultOption, PollResults, ResultsMessage } from '@polling/shared';
import { useEffect, useRef, useState } from 'react';
import { fetchResults, wsUrl } from './api';

export type LiveStatus = 'connecting' | 'live' | 'reconnecting';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_CAP_MS = 15_000;

export interface LiveSocket {
  close(): void;
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'close', listener: () => void): void;
}

interface StartLiveResultsOptions {
  connect: () => LiveSocket;
  fetchSnapshot: () => Promise<PollResults | null>;
  onResults: (results: PollResults) => void;
  onStatus: (status: LiveStatus) => void;
  schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export function reconnectDelayMs(attempt: number): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** exponent);
}

export function liveStatusLabel(status: LiveStatus): string {
  switch (status) {
    case 'connecting':
      return 'Connecting';
    case 'live':
      return 'Live';
    case 'reconnecting':
      return 'Reconnecting';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

function isResultOption(value: unknown): value is PollResultOption {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const option = value as PollResultOption;
  return (
    typeof option.id === 'string' &&
    typeof option.count === 'number' &&
    typeof option.label === 'string' &&
    typeof option.percentage === 'number'
  );
}

export function readResultsMessage(raw: string): PollResults | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || !('type' in value) || !('results' in value)) {
    return null;
  }
  const message = value as Partial<ResultsMessage>;
  const results = message.results;
  if (message.type !== 'results' || typeof results !== 'object' || results === null) {
    return null;
  }
  if (typeof results.pollId !== 'string' || typeof results.total !== 'number') {
    return null;
  }
  if (!Array.isArray(results.options) || !results.options.every(isResultOption)) {
    return null;
  }
  return results;
}

export function startLiveResults(options: StartLiveResultsOptions): () => void {
  const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
  let socket: LiveSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let closed = false;
  let openedOnce = false;

  const connect = () => {
    if (closed) {
      return;
    }
    const ws = options.connect();
    socket = ws;

    ws.addEventListener('open', () => {
      attempt = 0;
      options.onStatus('live');
      if (!openedOnce) {
        openedOnce = true;
        return;
      }
      void options.fetchSnapshot().then((results) => {
        if (results && !closed) {
          options.onResults(results);
        }
      });
    });

    ws.addEventListener('message', (event) => {
      const results = readResultsMessage(String(event.data));
      if (results && !closed) {
        options.onResults(results);
      }
    });

    ws.addEventListener('close', () => {
      if (closed) {
        return;
      }
      options.onStatus('reconnecting');
      attempt += 1;
      timer = schedule(connect, reconnectDelayMs(attempt));
    });
  };

  options.onStatus('connecting');
  connect();

  return () => {
    closed = true;
    if (timer !== undefined) {
      clearTimer(timer);
    }
    socket?.close();
  };
}

export function useLiveResults(
  enabled: boolean,
  onResults: (results: PollResults) => void,
): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return startLiveResults({
      connect: () => new WebSocket(wsUrl('/ws')) as unknown as LiveSocket,
      fetchSnapshot: fetchResults,
      onResults: (results) => {
        onResultsRef.current(results);
      },
      onStatus: setStatus,
    });
  }, [enabled]);

  return status;
}
