# SCMP Polling System

Local development — see [issue #1](https://github.com/kiu95/scmp-polling-system/issues/1). Docker Compose and full stack polish arrive in [issue #5](https://github.com/kiu95/scmp-polling-system/issues/5).

## Stack

- **Frontend:** Vite + React + TypeScript (not wired in this repo slice until client scaffold lands).
- **Backend:** Fastify + TypeScript + SQLite (`better-sqlite3`) (not wired until server scaffold lands).

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

## Run (when client + server exist)

You will run the API and the dev server in separate terminals, or use the root `npm run dev` script once it is defined.

```bash
# terminal 1 — API (planned)
cd server && npm run dev

# terminal 2 — client (planned)
cd client && npm run dev
```

Then open `http://127.0.0.1:5173` in a browser.

## Verify API (when server exists)

```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/poll
```

Expect `GET /health` to return JSON with `{ "ok": true }` and `GET /poll` to return the seeded active poll with options.

## Build & test (when packages exist)

```bash
npm run build
npm run test
```

## Shared types

Cross-package types live in [`shared/`](shared/).

## Product spec

See [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).
