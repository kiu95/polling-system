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

## Requirements

- **Node.js 24 or newer** — required by [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (native prebuilds; older Node versions often fall back to a source compile that can fail). This repo is also verified on **Node.js 24.x** (darwin arm64).
- Optional: place an [`.nvmrc`](.nvmrc) at the repo root and run `nvm use` before `npm install`.

## Install

From the repository root:

```bash
npm install
```

Build [`shared/`](shared/) before TypeScript resolves `@scmp/shared` in other packages. Root `pretest` and `predev` run that build automatically; if you run `npm run test` or `npm run dev --workspace=@scmp/server` **without** going through those hooks, run `npm run build --workspace=@scmp/shared` once first.

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

`pretest` builds `@scmp/shared` so workspace tests resolve types and package exports. Server tests use an in-memory database (no `server/data/poll.db`). Client tests cover the API URL helper only.

## Lint and format

Biome checks `client/`, `server/`, and `shared/` (see [`biome.json`](biome.json): 2-space indent, width 100, single quotes, semicolons).

```bash
npm run lint
npm run lint:fix
```

Per package:

```bash
npm run lint --workspace=@scmp/client
npm run lint --workspace=@scmp/server
npm run lint --workspace=@scmp/shared
```

## Shared types

Cross-package types live in [`shared/`](shared/).

## Product spec

See [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).
