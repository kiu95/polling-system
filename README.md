# SCMP Polling System

Local development — see [issue #1](https://github.com/kiu95/scmp-polling-system/issues/1). Docker Compose and full stack polish arrive in [issue #5](https://github.com/kiu95/scmp-polling-system/issues/5).

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS v4 in [`client/`](client/).
- **Backend:** Fastify + TypeScript + SQLite (`better-sqlite3`) in [`server/`](server/).

## Ports

| Service | Port |
| ------- | ---- |
| API     | 3000 |
| Vite    | 5173 |

## Requirements

- **Node.js 24 or newer** — required by [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (native prebuilds; older Node versions often fall back to a source compile that can fail). This repo is also verified on **Node.js 24.x** (darwin arm64).

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

Open `http://127.0.0.1:5173`. Leave `VITE_API_URL` empty so Vite proxies `/health`, `/poll`, `/vote`, `/results`, and `/ws` to the API (see [`client/vite.config.ts`](client/vite.config.ts)). The page loads the active poll, result counts, and this browser’s vote (`GET /vote`), then submits with optimistic selection. While a vote is saving, the UI may show a temporary +1 on the chosen option; failed submits roll back and show an error; a stored vote survives reload. Counts stay live: the client opens `GET /ws` and applies pushed `{ "type": "results", "results" }` snapshots; after each reconnect it also refetches `GET /results` to close gaps. The header shows **Live** or **Reconnecting**.

On vote accept, the client refetches results instead of bumping counts locally, so WebSocket snapshots and your own vote do not double-count. While **pending**, the +1 overlay stays only until the server `total` rises past the total at click time (so a broadcast that already includes your vote does not add a second bump). Stale snapshots with a lower `total` or another `pollId` are ignored.

To hit the API without the proxy, set `VITE_API_URL` to `http://127.0.0.1:3000` (see [`client/.env.example`](client/.env.example)); the client maps that to `ws://` or `wss://` for `/ws`.

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
curl -s http://127.0.0.1:3000/results
```

`POST /vote` is unstable by default (about 15% `500` or a ~3s wait). Start the API with `VOTE_INSTABILITY=off` before this curl if you want a stable `200`:

```bash
VOTE_INSTABILITY=off npm run dev --workspace=@scmp/server
curl -s -X POST http://127.0.0.1:3000/vote \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: demo-user' \
  -d '{"optionId":"opt-web"}'
```

`GET /health` returns `{ "ok": true }`. `GET /poll` returns the seeded active poll (`poll-1`) and its options. Restarting the server does not duplicate that poll.

`GET /results` returns vote counts and one-decimal percentages per option. Rounded shares of one total can add up to `99.9` or `100.1`.

`GET /ws` (WebSocket upgrade) sends the current `PollResults` JSON on connect, then broadcasts the same shape after each accepted `POST /vote`. Rejected votes (`409`, `400`, and so on) do not broadcast. Message shape: `{ "type": "results", "results": { … } }` ([`ResultsMessage`](shared/src/index.ts)).

`GET /vote` with a non-empty `x-user-id` header returns `{ "pollId", "optionId" }` where `optionId` is `null` until that user has voted on the active poll. Missing user is `400` (`invalid_user_id`). No active poll is `404` (`no_active_poll`).

`POST /vote` expects JSON `{ "optionId": "<id>" }` and the same `x-user-id` header (mock user, up to 128 characters after trim). Success is `200` with `{ "pollId", "optionId" }`. Same user and poll again returns `409` with `{ "error": "already_voted" }`. A bad option is `400`. No active poll is `404`. Those responses are stable; the failure simulation runs only after the vote would otherwise be stored.

Example after a vote (same `x-user-id` as `POST /vote`):

```bash
curl -s http://127.0.0.1:3000/vote -H 'x-user-id: demo-user'
```

### Vote instability (local practice)

By default the server enables **unstable vote submits** for frontend rollback drills (see [issue #2](https://github.com/kiu95/scmp-polling-system/issues/2)): about **15%** of votes that pass validation either return **`500`** with `{ "error": "simulated_failure" }` (no row written) or **wait about 3 seconds** then succeed. Duplicate votes, unknown options, and a missing poll stay `409` / `400` / `404`.

Turn it off for predictable curls and tests:

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `VOTE_INSTABILITY` | Set to `off` to disable the simulation | on |
| `VOTE_FAILURE_RATE` | Fraction of votes that enter the unstable path (`0`–`1`) | `0.15` |
| `VOTE_DELAY_MS` | Delay in ms when the unstable path chooses wait-then-success | `3000` |

The vote curl above uses the same `VOTE_INSTABILITY=off` switch.

## Build

```bash
npm run build
npm run start --workspace=@scmp/server
```

## Test

```bash
npm test
```

`pretest` builds `@scmp/shared` so workspace tests resolve types and package exports. Server tests use an in-memory database (no `server/data/poll.db`), including concurrent vote injects, `GET /vote` in [`server/src/vote.test.ts`](server/src/vote.test.ts), and WebSocket snapshot/broadcast checks in [`server/src/ws.test.ts`](server/src/ws.test.ts). Client tests cover API/WebSocket URL helpers, `mergeResults`, reconnect backoff, optimistic vote view derivation, and mock user id storage in [`client/src/`](client/src/).

## Typecheck

Builds [`shared/`](shared/) (for `dist/*.d.ts` that other packages consume), then runs `tsc --noEmit` in [`server/`](server/) and [`client/`](client/).

```bash
npm run typecheck
```

## Lint and format

Biome checks `client/`, `server/`, `shared/`, and [`scripts/`](scripts/) (see [`biome.json`](biome.json): 2-space indent, width 100, single quotes, semicolons).

[Husky](https://typicode.github.io/husky/) runs **`npm run typecheck`** then **[lint-staged](https://github.com/lint-staged/lint-staged)** on **pre-commit** (see [`.husky/pre-commit`](.husky/pre-commit)). lint-staged runs Biome on staged `*.ts` / `*.tsx` and runs Vitest **related** tests for staged files under `client/src` and `server/src` (see [`scripts/lint-staged-vitest-related.mjs`](scripts/lint-staged-vitest-related.mjs)); any staged `shared/**/*.ts` runs **both** workspace test suites. Fresh clones run `prepare` after `npm install`, which points Git at [`.husky/_`](.husky/_).

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
