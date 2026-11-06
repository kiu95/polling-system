# SCMP Polling System

Local development — see [issue #1](https://github.com/kiu95/scmp-polling-system/issues/1). Docker Compose and full stack polish arrive in [issue #5](https://github.com/kiu95/scmp-polling-system/issues/5).

## Stack

- **Frontend:** Vite + React + TypeScript (client scaffold still pending).
- **Backend:** Fastify + TypeScript + SQLite (`better-sqlite3`) in [`server/`](server/).

## Ports (planned)

| Service | Port |
| ------- | ---- |
| API     | 3000 |
| Vite    | 5173 |

## Install

From the repository root:

```bash
npm install
```

## Run server

From the repository root (after `npm install` and `npm run build --workspace=@scmp/shared` so shared types exist):

```bash
npm run dev --workspace=@scmp/server
```

Or seed without staying up:

```bash
npm run seed --workspace=@scmp/server
```

Client dev server is not in this slice yet. When it lands, Vite will be `http://127.0.0.1:5173`.

## Verify API

```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/poll
```

`GET /health` returns `{ "ok": true }`. `GET /poll` returns the seeded active poll (`poll-1`) and its options. Restarting the server does not duplicate that poll.

## Build

```bash
npm run build --workspace=@scmp/shared
npm run build --workspace=@scmp/server
npm run start --workspace=@scmp/server
```

## Test (server)

```bash
npm run test --workspace=@scmp/server
```

Uses Vitest against an in-memory database (no `server/data/poll.db`).

## Shared types

Cross-package types live in [`shared/`](shared/).

## Product spec

See [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).
