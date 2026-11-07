import type { PollResults, ResultsMessage } from '@scmp/shared';

const SOCKET_OPEN = 1;

/** Drop a client once `ws` has queued more than this many bytes. */
export const MAX_BUFFERED_BYTES = 1_048_576;

export interface ResultsClient {
  readyState: number;
  bufferedAmount: number;
  close(): void;
  send(data: string): void;
}

export interface ResultsHub {
  close(): void;
  add(client: ResultsClient): void;
  remove(client: ResultsClient): void;
  broadcast(results: PollResults): void;
}

export function createResultsHub(): ResultsHub {
  const clients = new Set<ResultsClient>();

  return {
    close() {
      for (const client of clients) {
        client.close();
      }
      clients.clear();
    },
    add(client) {
      clients.add(client);
    },
    remove(client) {
      clients.delete(client);
    },
    broadcast(results) {
      const message: ResultsMessage = { type: 'results', results };
      const payload = JSON.stringify(message);
      for (const client of clients) {
        if (client.readyState !== SOCKET_OPEN || client.bufferedAmount > MAX_BUFFERED_BYTES) {
          clients.delete(client);
          try {
            client.close();
          } catch {
            // Socket already failed.
          }
          continue;
        }
        try {
          client.send(payload);
        } catch {
          clients.delete(client);
          try {
            client.close();
          } catch {
            // Socket already failed.
          }
        }
      }
    },
  };
}
