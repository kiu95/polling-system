# SCMP Polling System

Local development — see [issue #1](https://github.com/kiu95/scmp-polling-system/issues/1). Docker Compose and full stack polish arrive in [issue #5](https://github.com/kiu95/scmp-polling-system/issues/5).

## Stack

- **Frontend:** Vite + React + TypeScript in [`client/`](client/).
- **Backend:** Fastify + TypeScript + SQLite (`better-sqlite3`) in [`server/`](server/).

## Ports

| Service | Port |
| ------- | ---- |
| API     | 3000 |
| Vite    | 5173 |

## Install

From the repository root:

```bash
npm install
```

## Run both (root)

API on 3000 and Vite on 5173 together. `predev` builds [`shared/`](shared/) so server and client can resolve `@scmp/shared`.

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. Leave `VITE_API_URL` empty so Vite proxies `/health` and `/poll` to the API. See [`client/.env.example`](client/.env.example).

## Run one package only

```bash
npm run dev --workspace=@scmp/server
npm run dev --workspace=@scmp/client
```

Seed the on-disk DB without keeping the process up:

```bash
npm run seed
```

## Verify API

```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/poll
```

`GET /health` returns `{ "ok": true }`. `GET /poll` returns the seeded active poll (`poll-1`) and its options. Restarting the server does not duplicate that poll.

## Build

```bash
npm run build
npm run start --workspace=@scmp/server
```

## Test

```bash
npm test
```

Server tests use an in-memory database (no `server/data/poll.db`). Client tests cover the API URL helper only.

## Lint and format

Biome checks `client/` and `server/` (see [`biome.json`](biome.json): 2-space indent, width 100, single quotes, semicolons).

```bash
npm run lint
npm run lint:fix
```

Per package:

```bash
npm run lint --workspace=@scmp/client
npm run lint --workspace=@scmp/server
```

## Shared types

Cross-package types live in [`shared/`](shared/).

## Product spec

See [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).
