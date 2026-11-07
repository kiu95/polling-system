import type { ResultsMessage } from '@polling/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { initDatabase, openDatabase, type SqliteDatabase } from './db.js';

interface MessageSocket {
  close(): void;
  on(event: 'message', listener: (data: unknown) => void): void;
}

function trackMessages(socket: MessageSocket): ResultsMessage[] {
  const messages: ResultsMessage[] = [];
  socket.on('message', (data: unknown) => {
    messages.push(JSON.parse(String(data)) as ResultsMessage);
  });
  return messages;
}

async function waitForMessages(messages: ResultsMessage[], count: number): Promise<void> {
  const started = Date.now();
  while (messages.length < count) {
    if (Date.now() - started > 2000) {
      throw new Error(`timed out with ${messages.length} message(s)`);
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }
}

describe('GET /ws', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let db: SqliteDatabase;
  const sockets: MessageSocket[] = [];

  beforeEach(async () => {
    db = openDatabase(':memory:');
    initDatabase(db);
    app = await buildApp(db, { logger: false });
    await app.ready();
  });

  afterEach(async () => {
    for (const socket of sockets) {
      socket.close();
    }
    sockets.length = 0;
    await app.close();
    db.close();
  });

  it('sends the current snapshot and broadcasts after an accepted vote', async () => {
    let messages: ResultsMessage[] = [];
    const socket = await app.injectWS(
      '/ws',
      {},
      {
        onInit(client) {
          messages = trackMessages(client);
        },
      },
    );
    sockets.push(socket);

    await waitForMessages(messages, 1);
    expect(messages[0]).toMatchObject({ type: 'results', results: { pollId: 'poll-1', total: 0 } });

    const vote = await app.inject({
      headers: { 'content-type': 'application/json', 'x-user-id': 'user-a' },
      method: 'POST',
      payload: JSON.stringify({ optionId: 'opt-web' }),
      url: '/vote',
    });
    expect(vote.statusCode).toBe(200);

    await waitForMessages(messages, 2);
    expect(messages[1]?.type).toBe('results');
    expect(messages[1]?.results.total).toBe(1);
    expect(messages[1]?.results.options.find((option) => option.id === 'opt-web')?.count).toBe(1);
  });

  it('does not broadcast when the vote is rejected', async () => {
    let messages: ResultsMessage[] = [];
    const first = await app.injectWS(
      '/ws',
      {},
      {
        onInit(client) {
          messages = trackMessages(client);
        },
      },
    );
    sockets.push(first);
    await waitForMessages(messages, 1);

    await app.inject({
      headers: { 'content-type': 'application/json', 'x-user-id': 'user-b' },
      method: 'POST',
      payload: JSON.stringify({ optionId: 'opt-web' }),
      url: '/vote',
    });
    await waitForMessages(messages, 2);

    const duplicate = await app.inject({
      headers: { 'content-type': 'application/json', 'x-user-id': 'user-b' },
      method: 'POST',
      payload: JSON.stringify({ optionId: 'opt-app' }),
      url: '/vote',
    });
    expect(duplicate.statusCode).toBe(409);

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
    expect(messages).toHaveLength(2);
  });
});
