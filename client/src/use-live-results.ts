import type { PollResults, ResultsMessage } from '@scmp/shared';
import { useEffect, useRef, useState } from 'react';
import { fetchResults, wsUrl } from './api';

export type LiveStatus = 'live' | 'reconnecting';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_CAP_MS = 15_000;

export function reconnectDelayMs(attempt: number): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** exponent);
}

function readResultsMessage(raw: string): PollResults | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return null;
  }
  const message = value as Partial<ResultsMessage>;
  if (message.type !== 'results' || !message.results) {
    return null;
  }
  return message.results;
}

export function useLiveResults(
  enabled: boolean,
  onResults: (results: PollResults) => void,
): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('reconnecting');
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let closed = false;
    let openedOnce = false;

    const connect = () => {
      if (closed) {
        return;
      }
      const ws = new WebSocket(wsUrl('/ws'));
      socket = ws;

      ws.addEventListener('open', () => {
        attempt = 0;
        setStatus('live');
        if (!openedOnce) {
          openedOnce = true;
          return;
        }
        void fetchResults().then((results) => {
          if (results && !closed) {
            onResultsRef.current(results);
          }
        });
      });

      ws.addEventListener('message', (event) => {
        const results = readResultsMessage(String(event.data));
        if (results && !closed) {
          onResultsRef.current(results);
        }
      });

      ws.addEventListener('close', () => {
        if (closed) {
          return;
        }
        setStatus('reconnecting');
        attempt += 1;
        timer = setTimeout(connect, reconnectDelayMs(attempt));
      });
    };

    connect();

    return () => {
      closed = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      socket?.close();
    };
  }, [enabled]);

  return status;
}
