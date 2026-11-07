# Polling System

Live poll with optimistic voting, rollback on failed submits, and WebSocket result pushes. Run locally with Node ([issue #1](https://github.com/kiu95/polling-system/issues/1)) or as a full stack via Docker Compose ([issue #5](https://github.com/kiu95/polling-system/issues/5)).

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS v4 in [`client/`](client/).
- **Backend:** Fastify + TypeScript + SQLite (`better-sqlite3`) in [`server/`](server/).
- **Shared types:** [`shared/`](shared/) (`ActivePoll`, votes, results, WebSocket messages).

## Ports

| Mode | What | Port |
| ---- | ---- | ---- |
| Local dev | Fastify API | 3000 |
| Local dev | Vite dev server | 5173 |
| Docker Compose | nginx + static client (proxies API and `/ws`) | 8080 |

## Requirements

- **Node.js 24 or newer** for local dev — required by [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (native prebuilds; older Node versions often fall back to a source compile that can fail). This repo is also verified on **Node.js 24.x** (darwin arm64).
- **Docker** with Compose v2 for the container path (no local Node install required to run the stack).

## Install

From the repository root:

```bash
npm install
```

Build [`shared/`](shared/) before TypeScript resolves `@polling/shared` in other packages. Root `pretest` and `predev` run that build automatically; if you run `npm run test` or `npm run dev --workspace=@polling/server` **without** going through those hooks, run `npm run build --workspace=@polling/shared` once first.

## Run both (root)

API on 3000 and Vite on 5173 together. `predev` builds [`shared/`](shared/) so server and client can resolve `@polling/shared`.

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. Leave `VITE_API_URL` empty so Vite proxies `/health`, `/poll`, `/vote`, `/results`, and `/ws` to the API (see [`client/vite.config.ts`](client/vite.config.ts)). The page loads the active poll, result counts, and this browser’s vote (`GET /vote`), then submits with optimistic selection. While a vote is saving, the UI may show a temporary +1 on the chosen option; failed submits roll back and show an error; a stored vote survives reload. Counts stay live: the client opens `GET /ws` and applies pushed `{ "type": "results", "results" }` snapshots; after each reconnect it also refetches `GET /results` to close gaps. The header shows **Connecting**, **Live**, or **Reconnecting**.

On vote accept, the client refetches results instead of bumping counts locally, so WebSocket snapshots and your own vote do not double-count. While **pending**, the +1 overlay uses the chosen option’s count at click time. Other options can rise without clearing that overlay. The overlay drops once the chosen option’s own count moves past the baseline. Stale snapshots with a lower `total` or another `pollId` are ignored. A socket whose outbound buffer exceeds 1 MiB is closed on the next broadcast.

To hit the API without the proxy, set `VITE_API_URL` to `http://127.0.0.1:3000` (see [`client/.env.example`](client/.env.example)); the client maps that to `ws://` or `wss://` for `/ws`.

## Run one package only

```bash
npm run dev --workspace=@polling/server
npm run dev --workspace=@polling/client
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
VOTE_INSTABILITY=off npm run dev --workspace=@polling/server
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

By default the server enables **unstable vote submits** for frontend rollback drills (see [issue #2](https://github.com/kiu95/polling-system/issues/2)): about **15%** of votes that pass validation either return **`500`** with `{ "error": "simulated_failure" }` (no row written) or **wait about 3 seconds** then succeed. Duplicate votes, unknown options, and a missing poll stay `409` / `400` / `404`.

Turn it off for predictable curls and tests:

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `VOTE_INSTABILITY` | Set to `off` to disable the simulation | on |
| `VOTE_FAILURE_RATE` | Fraction of votes that enter the unstable path (`0`–`1`) | `0.15` |
| `VOTE_DELAY_MS` | Delay in ms when the unstable path chooses wait-then-success | `3000` |
| `CORS_ORIGIN` | `reflect` (any Origin), `off` (no CORS headers), or a comma-separated allowlist | `reflect` |
| `HOST` | Bind address | `127.0.0.1` |
| `PORT` | Bind port (integer 1–65535; anything else exits on startup) | `3000` |
| `DATABASE_PATH` | SQLite file | `server/data/poll.db` |

The vote curl above uses the same `VOTE_INSTABILITY=off` switch.

## Docker

From the repository root, build and start **server** (API + SQLite on a named volume) and **client** (production Vite build behind nginx):

```bash
docker compose up --build
```

Open `http://127.0.0.1:8080`. The browser talks to nginx on port 8080 only; nginx proxies `/health`, `/poll`, `/vote`, `/results`, and `/ws` to the `server` service on the Compose network (same paths as the Vite dev proxy).

Useful commands:

```bash
docker compose up --build -d          # detached
docker compose logs -f server         # API logs
docker compose stop                   # stop containers
docker compose down                   # stop and remove containers
docker compose down -v                # also delete the poll-data volume (fresh DB)
```

Vote instability follows the same env vars as local dev. The compose file passes `VOTE_INSTABILITY` from the host (default **on**). For stable demos or curls through nginx:

```bash
VOTE_INSTABILITY=off docker compose up --build
curl -s http://127.0.0.1:8080/health
```

Server bind and database file inside the container are set in [`server/Dockerfile`](server/Dockerfile) and [`docker-compose.yml`](docker-compose.yml): `HOST=0.0.0.0`, `DATABASE_PATH=/data/poll.db` on volume `poll-data`, `CORS_ORIGIN=off` (nginx is same-origin; the API port is not published). The entrypoint `chown`s `/data` and runs the API as the image `node` user. `SIGTERM` / `SIGINT` close Fastify and the database. Local `npm run dev` is unchanged (`127.0.0.1:3000`, reflected CORS, `server/data/poll.db` unless `DATABASE_PATH` is set). The runtime image still installs workspace production dependencies, including the client’s React packages.

## Architecture (brief)

```text
Browser ──► Vite (dev) or nginx (Docker) ──► Fastify
                                              ├── SQLite (votes, options, polls)
                                              └── WebSocket hub (results snapshots)
```

- **Votes** — One row per `(user_id, poll_id)` with a unique index. `insertVote` runs in a transaction; concurrent submits rely on SQLite, not an application-level counter column. Results are always `COUNT(*)` per option ([`server/src/db.ts`](server/src/db.ts)).
- **Race safety (critical tests)** — Vitest fires many parallel `POST /vote` injects (same option and split across options) and duplicate-user races; see [`server/src/vote.test.ts`](server/src/vote.test.ts).
- **Instability** — Eligibility (`assessVote`) runs before the optional failure simulator, so `409` / `400` / `404` stay stable under chaos; `500 simulated_failure` only when a row would have been inserted ([`server/src/vote-instability.ts`](server/src/vote-instability.ts)).
- **Live results** — After a successful insert, the server broadcasts `{ "type": "results", "results": … }` on `/ws` ([`server/src/results-hub.ts`](server/src/results-hub.ts)).
- **Optimistic UI** — Pending +1 on the chosen option’s count; rollback on `500`. A timeout or dropped connection checks `GET /vote` before the UI says the vote was not saved. Refetch results on accept so WebSocket updates do not double-count ([`client/src/vote-state.ts`](client/src/vote-state.ts), [`client/src/submit-vote.ts`](client/src/submit-vote.ts)).

## Build

```bash
npm run build
npm run start --workspace=@polling/server
```

## Test

```bash
npm test
```

`pretest` builds `@polling/shared` so workspace tests resolve types and package exports. Vitest runs in both workspaces ([`server/vitest.config.ts`](server/vitest.config.ts), [`client/vite.config.ts`](client/vite.config.ts) `test` block).

**Critical failure-mode suites** (assignment [#5](https://github.com/kiu95/polling-system/issues/5)):

| Area | File | What it proves |
| ---- | ---- | -------------- |
| Concurrent votes / races | [`server/src/vote.test.ts`](server/src/vote.test.ts) | 100 parallel users on one option; 99 parallel votes split across three options; parallel duplicate user → one row and `409` |
| Optimistic rollback | [`client/src/submit-vote.test.ts`](client/src/submit-vote.test.ts) | `500`, timeout reconcile (`GET /vote` saved, missing, or also failed), bad body, `409` lock, failed `GET /vote` after accept |

Other server coverage: smoke and idempotent seed in [`server/src/app.test.ts`](server/src/app.test.ts), listen/DB path env in [`server/src/runtime-config.test.ts`](server/src/runtime-config.test.ts), WebSocket snapshot/broadcast in [`server/src/ws.test.ts`](server/src/ws.test.ts). Client: `mergeResults`, live socket hook, API URL helpers, vote view derivation under pending + live updates.

Before a PR, also run:

```bash
npm run lint
npm run typecheck
```

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
npm run lint --workspace=@polling/client
npm run lint --workspace=@polling/server
npm run lint --workspace=@polling/shared
```

## Shared types

Cross-package types live in [`shared/`](shared/).

## Known limitations

The voter id is a mock. The browser stores it in `localStorage` under `poll-user-id` and sends it as `x-user-id`. The server rejects a second vote for that id and the active poll. Clearing storage, or sending a different header, starts a new voter. An IP check would block people who share a network. A real fix needs authentication, which [the spec](docs/PRODUCT_SPEC.md) lists as a non-goal.

## Product spec

See [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).
