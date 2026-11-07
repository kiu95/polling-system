# Agent workflow

How the coding assistant was guided on this repo, and which of its choices had to be corrected. Written 2026-11-06, during the local scaffold ([issue #1](https://github.com/kiu95/polling-system/issues/1)). Backend, UI, WebSocket results, and Docker Compose deliverables are summarized below. [Issue #5](https://github.com/kiu95/polling-system/issues/5) implementation is on branch `feat/5-docker-compose` until merged. This file records what already happened. It is not a claim that open GitHub issues are closed until the repo or issue says so.

## Prompt strategy

The product spec and GitHub issues are the source of scope. The assistant does not invent the stack.

1. **Triage from the issue, not from a blank prompt.** "Plan on issue #1" meant fetch the issue, confirm no open PR already closed it, and read issues #2–#5 before choosing a schema. #2 already requires `polls`, `options`, and `votes` with a unique `(userId, pollId)`. The scaffold creates that `votes` table empty. It does not add `POST /vote`.
2. **Lock assumptions in the plan and wait.** npm workspaces, `better-sqlite3` (not Prisma), `GET /poll`, ports 3000 and 5173, idempotent seed. Docker, failure simulation, and the voting UI stay out. Implementation starts only after an explicit "go".
3. **Slice by todo.** "Go for the first 2" stopped at `.gitignore`, `README.md`, and `shared/` types. "Go for the 3rd" stopped at the Fastify server. "Go for the 4th" was server Vitest only (`app.test.ts`, `vitest.config.ts`, `package.json` `test`). Client, root `dev` / `test`, and concurrent install stayed out.
4. **Check the machine, not the plan.** A written plan that says `better-sqlite3` is not evidence the native module installs. `npm install`, `tsc`, a double seed, and `curl` against a running server are the check.
5. **Keep this file current.** The user asked for a Cursor rule, not another feature. `.cursor/rules/agent-workflow.mdc` (`alwaysApply`) now requires each later slice to append prompt strategy and any assistant-caused defect here, in the same change. No new defect in that step.
6. **Fourth todo (Vitest smoke).** User said `go for 4th todo item`; scope was `@polling/server` only: Vitest `inject` for `GET /health` and `GET /poll`, `:memory:` DB with `initDatabase` called twice to assert idempotent seed. Root `npm run test`, client, and concurrent `dev` stayed out.
7. **Fifth todo (client page).** User said `go for 5th todo item`. Scope was `@polling/client`: Vite React page, dev proxy for `/health` and `/poll`, render health OK and the seed question. No vote button. Root `dev` / `concurrently` stayed on the sixth todo. `client` was added to workspaces so `npm install` can see the package.
8. **Sixth todo (root scripts).** User said `go remaining todo`. Scope was root `package.json` scripts: `dev` runs server and client with `concurrently`, `predev` builds `@polling/shared`, `build` builds shared then server then client, `test` runs both workspaces, `seed` delegates to the server. README updated for the one-command flow.
9. **Biome.** User asked to add Biome for linting and formatting on `client` and `server`. Later the same user asked to include [`shared/`](shared/) in root `lint` / `lint:fix` and matching scripts on `@polling/shared`.
10. **PR #6 review (pre-merge).** Review pasted in chat: add Node `engines` and README Node version; `pretest` builds shared; CORS comment for local-only
11. **[GitHub issue #2](https://github.com/kiu95/polling-system/issues/2) — backend poll / vote / results (plan todos).** Delivered in order; user drove with `go 1st todo item` through `remaining todo`.
    - **Shared types** ([`shared/src/index.ts`](shared/src/index.ts)): `VoteAccepted`, `PollResultOption`, `PollResults`. Property-sort order (`pollId` before `optionId`; `total` before `pollId`; `count` before `label`). Nothing else in that slice.
    - **DB** ([`server/src/db.ts`](server/src/db.ts)): `busy_timeout`, `insertVote` in a transaction (unique `(user_id, poll_id)` → `already_voted`), `getResults` via `COUNT` and one-decimal percentage. No stored vote counter.
    - **Instability** ([`server/src/vote-instability.ts`](server/src/vote-instability.ts), [`server/src/index.ts`](server/src/index.ts), config on `buildApp`): `voteInstabilityFromEnv` (on unless `VOTE_INSTABILITY=off`), `applyVoteInstability` (~`VOTE_FAILURE_RATE`, then half fail / half delay). Tests default omitted config so they do not roll the sim until routes opt in with injected config.
    - **Routes** ([`server/src/app.ts`](server/src/app.ts)): `POST /vote` (`x-user-id`, body `optionId`); instability runs before `insertVote`; `GET /results`. Statuses: `200` / `400` (`invalid_user_id`, `invalid_option_id`, `invalid_option`) / `404` (`no_active_poll`) / `409` (`already_voted`) / `500` (`simulated_failure`). That slice did not add `vote.test.ts`, README, or Vite proxy.
    - **Tests + docs** ([`server/src/vote.test.ts`](server/src/vote.test.ts), [`README.md`](README.md), this file): Vitest covers happy path, `409`, 100 parallel users same option, parallel duplicate user, validation, empty DB, forced `500` and delay. README: curls, env (`VOTE_INSTABILITY`, `VOTE_FAILURE_RATE`, `VOTE_DELAY_MS`), note Vite still proxies only `/health` and `/poll` until issue #3. No [`client/vite.config.ts`](client/vite.config.ts) proxy for `/vote` or `/results`.
12. **PR #7 review.** User pasted the review. Scope: run eligibility (`assessVote`) before `applyVoteInstability`, so a second vote, a bad option, and a missing poll stay `409` / `400` / `404` while chaos is on; `simulated_failure` only when the insert would otherwise succeed. Removed unused `app.decorate('voteInstability')`. README puts `VOTE_INSTABILITY=off` on the vote curl. Test: already-voted user plus a forced-fail config still returns `409` and does not roll. Happy-path results assert zero-vote percentages and `100` after one vote.
13–14. **[GitHub issue #3](https://github.com/kiu95/polling-system/issues/3) — voting UI.** User drove `work on first 5 todo items` then `work remaining todo` (docs only). Grouped record: [Issue #3 — voting UI (summary)](#issue-3--voting-ui-summary).
15. **Issue #3 ship.** User asked to group the workflow summary, then split **six commits** by plan todo, push `feat/3-voting-ui`, open [PR #8](https://github.com/kiu95/polling-system/pull/8). Vite proxy commit landed before Tailwind so `vite.config.ts` grows in two commits. The branch then gained a seventh commit for this split note.
16. **PR #8 review.** User pasted the review. No blockers. Fixes in the same slice:
    - Optimistic +1 only while `pending`. A successful vote calls `onVoteAccepted`, which sets `serverOptionId` and `applyStoredVote` once. A later `GET /results` poll ([#4](https://github.com/kiu95/polling-system/issues/4)) must replace `results` and must not add another local +1 on `voted`.
    - [`submit-vote.test.ts`](client/src/submit-vote.test.ts): `500`, timeout, `409` lock, failed follow-up read, unreadable `200` body.
    - Failed `409` follow-up is `blocked` (buttons stay disabled). Message still says refresh.
    - A `200` whose JSON cannot be read locks the option that was posted, not a network error.
    - Left as-is: system `font-serif` (no webfont), no React Testing Library on `VotePanel`, and prompt item 11’s “instability runs before `insertVote`” sentence (history; item 12 is the correction).
17. **[GitHub issue #4](https://github.com/kiu95/polling-system/issues/4) — live results (plan todo 1).** User approved plan with WebSocket preferred over issue default HTTP polling. First todo only: `ResultsMessage` in [`shared/src/index.ts`](shared/src/index.ts) (`type: 'results'` + `PollResults`). Server WS, client hook, and docs stayed out.
18. **Issue #4 plan todos 2–5.** User said `work 2nd - 5th todo`. Scope: `@fastify/websocket`, [`server/src/results-hub.ts`](server/src/results-hub.ts), `GET /ws` plus broadcast after a successful `insertVote`, [`server/src/ws.test.ts`](server/src/ws.test.ts), `mergeResults` and pending baseline in [`client/src/vote-state.ts`](client/src/vote-state.ts), [`client/src/use-live-results.ts`](client/src/use-live-results.ts) (backoff, resync on reconnect, close on unmount), Vite `/ws` proxy, accept path refetches `GET /results` instead of `applyStoredVote`. README stayed on the docs todo. Optimistic rule: pending +1 only while `results.total` is still at the click-time baseline; a newer snapshot replaces counts; a lower total or other `pollId` is ignored.
19. **Issue #4 commits by todo.** User asked to commit by plan todo and ignore this file. Five commits on `feat/4-live-result-websockets`: shared `ResultsMessage`, server WS hub, client `mergeResults`, live hook + proxy, `App`/`VotePanel` reconcile.
20. **Issue #4 plan todos docs + verify.** User said `work remaining todo`, then summarize here. Scope: [`README.md`](README.md), [`client/.env.example`](client/.env.example), workflow summary below; `npm run lint`, `npm run typecheck`, `npm test`; manual check — two tabs on `http://127.0.0.1:5173/` with `VOTE_INSTABILITY=off`, external `POST /vote` updated Print count on both without reload (**Live**).
21. **PR #9 review.** User pasted the review. Fixes in this slice: pending overlay baseline is the chosen option’s count (other votes no longer clear it); `/ws` registers close/error before the snapshot send and drops the socket if send throws; broadcast closes a client whose `bufferedAmount` exceeds 1 MiB; first status is **Connecting**; README names [`submit-vote.test.ts`](client/src/submit-vote.test.ts); `readResultsMessage` checks `pollId`, `total`, and option fields; removed unused `applyStoredVote` and `deriveVoteView`’s unused server-option argument; live-socket tests cover open, message, reconnect resync, and stop. [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) now says WebSocket. Commit `fd081c8` subject typo `pdate` left as-is (already on the remote).
22. **[GitHub issue #5](https://github.com/kiu95/polling-system/issues/5) — first four plan todos.** User said `work first 4 todo`. Scope: server `HOST` / `PORT` / `DATABASE_PATH`, Dockerfiles, Compose, critical-test gate. README Docker section and the fuller workflow pass stayed on later todos.
    - Listen defaults stay `127.0.0.1:3000` ([`server/src/listen.ts`](server/src/listen.ts)). `DATABASE_PATH` overrides the sqlite file ([`server/src/db.ts`](server/src/db.ts)). Tests in [`server/src/runtime-config.test.ts`](server/src/runtime-config.test.ts).
    - [`server/Dockerfile`](server/Dockerfile), [`client/Dockerfile`](client/Dockerfile), [`client/nginx.conf`](client/nginx.conf), [`.dockerignore`](.dockerignore), [`docker-compose.yml`](docker-compose.yml). nginx proxies `/health`, `/poll`, `/vote`, `/results`, and `/ws` to the `server` service. Named volume `poll-data`. UI on port 8080. `VOTE_INSTABILITY` passes through (default on).
    - Extra race test in [`server/src/vote.test.ts`](server/src/vote.test.ts): 99 parallel votes split across Web / App / Print; counts sum to 99 and each option is 33. Existing 100-user and duplicate-user tests stayed. Client rollback suite already in [`client/src/submit-vote.test.ts`](client/src/submit-vote.test.ts). `npm test` 21 server + 25 client.
23. **Issue #5 remaining plan todos.** User said `open new branch, split commits by todo` then `work remaining items`. Branch `feat/5-docker-compose` with five commits (env, Dockerfiles, compose, race test, workflow). This slice: [`README.md`](README.md) Docker run/stop/volume, architecture notes, critical-test table; verify pass (`npm run lint`, `npm run typecheck`, `npm test`, Docker smoke). No new product code.
24. **PR #10 review.** User pasted the review. Fixes in this slice:
    - CORS comment no longer points at a future #5. [`corsOriginFromEnv`](server/src/cors-origin.ts): default `reflect` for Vite; Compose sets `CORS_ORIGIN=off` because nginx is same-origin and the API port is unpublished.
    - [`resolveListenPort`](server/src/listen.ts) rejects non-integers and ports outside 1–65535. Tests cover that, blank `HOST` / `PORT`, and `CORS_ORIGIN`.
    - `SIGTERM` / `SIGINT` call `app.close()` then `db.close()`.
    - API process runs as uid 1000 via `gosu` after `chown -R` on `/data`. Base images pinned by digest. nginx API and `/ws` locations send HTTP/1.1 and `X-Forwarded-*`.
    - Left as-is: server runtime image still installs `@polling/client` production dependencies (React). Review called that acceptable for the demo.
25. **npm scope rename.** User asked to replace namespace `@scmp` with `@polling`. Scope: all workspace package names (`@polling/shared`, `@polling/server`, `@polling/client`), TypeScript imports, root and workspace scripts, Dockerfiles, README, and `package-lock.json` via `npm install`. No behavior change.
26. **Spec review gaps.** User asked to review the app against [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md), then said yes to a plan that closed two gaps. Scope: after a thrown `POST /vote`, [`submit-vote.ts`](client/src/submit-vote.ts) reads `GET /vote` before it tells the user the vote was not saved. README **Known limitations** records that `x-user-id` is a mock and that auth stays a non-goal. No server change, no commit.
27. **PR #11 review.** User pasted the review. Scope: an empty `GET /vote` after a client timeout is not proof the vote failed, because the server can still be inside the instability delay and then insert. [`reconcileAfterNetworkError`](client/src/submit-vote.ts) re-reads up to three times, 500ms apart. A later stored option locks as voted. Reads that stay empty, or a failed read, use the existing unconfirmed message. The 409 follow-up path is unchanged.

## Issue #3 — voting UI (summary)

Reference: [issue #3](https://github.com/kiu95/polling-system/issues/3), [PRODUCT_SPEC §1.1 / §2.2](docs/PRODUCT_SPEC.md). Live count updates are on [#4](#issue-4--live-results-via-websocket-summary) (WebSocket, not HTTP polling).

### How it was scoped

- Plan mode triage first; user added **Tailwind v4** before implementation (`@tailwindcss/vite`, zinc editorial layout — no full ui-ux-pro-max landing treatment).
- Six plan todos: server read path → Vite proxy → pure optimistic state → Tailwind → submit + panel → README / workflow.

### Delivery slices

| Slice | User gate | In scope | Out of scope |
| ----- | --------- | -------- | ------------ |
| Implementation | `work on first 5 todo items` | `GET /vote`, client vote flow, Tailwind UI, tests | README, HTTP polling |
| Docs | `work remaining todo` | [`README.md`](README.md), [`client/.env.example`](client/.env.example), workflow cross-refs | Code |

### What shipped

**Shared / server**

- [`MyVote`](shared/src/index.ts) (`pollId`, `optionId` nullable).
- [`getMyVote`](server/src/db.ts) and `GET /vote` in [`server/src/app.ts`](server/src/app.ts) — same `x-user-id` rules as `POST`; `200` with `optionId: null` when the user has not voted.
- Vitest in [`server/src/vote.test.ts`](server/src/vote.test.ts) for empty vote, after insert, bad user, no poll.

**Client**

- Dev proxy: `/vote`, `/results` in [`client/vite.config.ts`](client/vite.config.ts).
- [`deriveVoteView`](client/src/vote-state.ts): pending +1 on counts/percentages; error rolls back; voted locks selection (server option wins on `409` via [`submit-vote.ts`](client/src/submit-vote.ts) → `GET /vote`).
- Mock user: [`readUserId`](client/src/user-id.ts) (`poll-user-id` in `localStorage`, in-memory fallback).
- Submit: `POST /vote` with **8s** `AbortSignal.timeout` (above default `VOTE_DELAY_MS`).
- UI: [`VotePanel.tsx`](client/src/VotePanel.tsx) + [`App.tsx`](client/src/App.tsx) — Tailwind option buttons, count bar, `role="alert"` on failure; buttons re-enabled after error for retry.

### Behaviour (acceptance mapping)

| Requirement | Mechanism |
| ----------- | --------- |
| Instant feedback | `pending` phase before `fetch` resolves |
| Rollback on failure | `500` / timeout / network → `error` phase; counts restore |
| No FE-only double-vote guard | Load + lock from `GET /vote`; `409` re-fetches mine |
| Drill with instability | Default server sim unchanged; client shows rollback message |

### Verification

- `npm test`, `npm run lint`, `npm run typecheck`; client `vite build`.
- Browser (`VOTE_INSTABILITY=off`): vote survives reload; stubbed `POST` `500` → “Vote didn't save. Try again.” and count restored; retry succeeds.

### Docs touched (docs slice)

- README: Tailwind in stack, proxy list, voting UI, `GET /vote` curl, client test paths.
- [`client/.env.example`](client/.env.example): proxy paths.
- This file: prompt items 13–14, summary section, “what was built” client line, “still not done”.

No new assistant-caused defects recorded for issue #3 slices.

## Issue #4 — live results via WebSocket (summary)

Reference: [issue #4](https://github.com/kiu95/polling-system/issues/4). Issue text defaulted to HTTP polling; user chose WebSocket in plan mode.

### How it was scoped

- Plan mode triage on #4; implementation split into seven todos (shared type → server → merge → hook → reconcile → docs → verify).
- User gates: todo 1 alone, todos 2–5 together, remaining todo for README + verification; commits per todo (excluding this file).

### What shipped

| Layer | Pieces |
| ----- | ------ |
| **Shared** | [`ResultsMessage`](shared/src/index.ts) (`type: 'results'`, `PollResults`). |
| **Server** | `@fastify/websocket`, [`results-hub.ts`](server/src/results-hub.ts), `GET /ws` in [`app.ts`](server/src/app.ts) (snapshot on connect, broadcast after successful `insertVote` only), [`ws.test.ts`](server/src/ws.test.ts) via `injectWS` (needs `await app.ready()`). |
| **Client** | [`mergeResults`](client/src/vote-state.ts), pending **baseline** on [`VotePanel`](client/src/VotePanel.tsx), [`use-live-results.ts`](client/src/use-live-results.ts) (`wsUrl`, exponential reconnect cap 15s, `GET /results` after reconnect), [`App.tsx`](client/src/App.tsx) (**Live** / **Reconnecting**, WS-driven `setView`, accept → refetch not `applyStoredVote`), Vite `proxy['/ws'].ws`. |

### Behaviour (acceptance mapping)

| Criterion | Mechanism |
| --------- | --------- |
| Counts + percentages | Unchanged UI; data from snapshots + `deriveVoteView`. |
| Auto-refresh | `useLiveResults` + `mergeResults`; unmount closes socket and timers. |
| Sensible interval / cleanup | Reconnect backoff 1s → 15s cap; not HTTP polling. |
| Works with optimistic vote | Pending +1 only while `total <= baselineTotal`; accept refetches; merge ignores stale lower totals. |

### Verification

- `npm run lint`, `npm run typecheck`, `npm test` (16 server + 24 client).
- `npm run dev` with `VOTE_INSTABILITY=off`; two browser tabs; vote via API as another user → both tabs showed updated Print count with **Live**.

### Docs touched

- README: `/ws` proxy, WebSocket message shape, optimistic vs live rules, test paths.
- `.env.example`: `/ws` in proxy comment.

GitHub issue #4 may still show open until closed there.

## What was built under that strategy

- Root `.gitignore`, `README.md`, and an npm workspace for `@polling/shared` (`ActivePoll`, `PollOption`).
- `@polling/server`: Fastify `GET /health`, `GET /poll`, `GET /results`, `POST /vote`, `GET /ws` (WebSocket results push), instability on vote only, CORS, SQLite file `server/data/poll.db`, WAL, foreign keys, schema for `polls` / `options` / `votes`, seed of `poll-1` only when that id is missing, Vitest in `server/src/app.test.ts`, `server/src/vote.test.ts`, and `server/src/ws.test.ts` (in-memory DB).
- `@polling/client`: Vite React + Tailwind v4; dev proxy for poll/vote/results/ws; optimistic voting UI — see [Issue #3 summary](#issue-3--voting-ui-summary); live results over WebSocket — see [Issue #4 summary](#issue-4--live-results-via-websocket-summary).
- Root scripts: `npm run dev`, `npm test`, `npm run build`, `npm run seed`, `npm run lint` / `npm run lint:fix` (see [`package.json`](package.json)). Root [`package.json`](package.json) has `"engines": { "node": ">=24" }`; [`.nvmrc`](.nvmrc) pins 24 for nvm. `pretest` runs `build` on `@polling/shared` so `npm test` works without a manual shared build.
- Docker: [`docker-compose.yml`](docker-compose.yml), [`server/Dockerfile`](server/Dockerfile), [`client/Dockerfile`](client/Dockerfile) + nginx proxy; UI at `http://127.0.0.1:8080`. Server env `HOST`, `PORT`, `DATABASE_PATH` for containers.
- Verified on this machine: second seed still leaves 1 poll and 3 options; `GET /health` returns `{"ok":true}`; `GET /poll` returns the seed question and Web / App / Print; `journal_mode` is `wal`. Browser at `http://127.0.0.1:5173/` showed Health OK, “Which format do you read most?”, and Web / App / Print.

## Defects the assistant introduced

These were caught by running the code or by reading the repo rules. They were not caught by the plan text.

### `better-sqlite3` 11 does not install on Node 24

The plan assumed Node 22 and pinned `better-sqlite3` at `^11.8.1`. This machine is Node v24.22.1 (darwin arm64). npm resolved 11.10.0, found no prebuilt binary, and compiled from source. The compile died immediately:

```text
./src/better_sqlite3.lzz:2:10: fatal error: 'climits' file not found
```

`xcode-select` points at `/Library/Developer/CommandLineTools`. node-gyp used that SDK and still could not see the C++ standard library headers. The plan said to stop and ask before leaving `better-sqlite3`. The assistant stayed on `better-sqlite3` but did **not** stop to ask: it moved the dependency to `^12.6.2`. npm installed 12.11.1, which ships a Node 24 prebuild. A direct `import('better-sqlite3')` against `:memory:` succeeded, then the HTTP checks above passed.

Audit point: the version bump is still `better-sqlite3`, not Prisma, but it was an unprompted change. Node 24 is the real constraint. A future install on a machine without that prebuild will hit the same `climits` failure until the Command Line Tools C++ headers are actually on the include path.

### Cursor rules describe a different application

`.cursor/rules/code-style.mdc` specifies a baseball event-sourced app: Dexie, Redux, `applyEvent`, `GameEvent`. Following it would have put poll logic in the wrong layers. The assistant ignored that architecture and kept the server as Fastify plus a SQL file. The React rules (`FC<Props>`, property sort) do apply. The first `ActivePoll` draft listed `options` before `question`; it was reordered to `id`, `question`, `options` to match the shorter-entry rule. That reorder was self-corrected before the file was left as the source of truth. The baseball rule file is still in the repo and will mislead the next session if it is treated as project architecture.

### Shared types resolve only after a build

`@polling/shared` exports `dist/index.d.ts`. Server `tsc` cannot see `ActivePoll` until `npm run build --workspace=@polling/shared` has been run. Root `predev` and `pretest` run that build; README still documents running it yourself when skipping those hooks. TypeScript project references remain a follow-up.

### README described a server that already existed

After the server landed, the README still said the backend was not wired. The same slice rewrote those sections. Stale docs are part of the assistant's output. They need a pass against the scripts that actually exist, not against the plan.

### First Vitest draft bundled three checks into one `it`

Symptom: one test mixed row counts and both routes; a failure would not say which assertion broke. Cause: rush to green in a single block. Fix: split `beforeAll` / `afterAll` and three `it` blocks in `server/src/app.test.ts`. Assistant fixed before handoff; user did not report it.

### Vite listened on IPv6 only

Symptom: `http://127.0.0.1:5173/` refused the connection while `http://localhost:5173/` returned 200. Cause: Vite's default `localhost` bind on this Mac was `[::1]:5173` only. The README tells people to open `127.0.0.1`. Fix: `server.host: '127.0.0.1'` in `client/vite.config.ts`. The assistant found it by curling the documented URL and fixed it in the same slice. The user did not edit it.

### `poll.db-shm` and `poll.db-wal` were committed by accident

Symptom: `git status` showed tracked SQLite sidecar files under [`server/data/`](server/data/). Cause: local dev wrote WAL mode files; they were staged before `.gitignore` covered them. Fix: ignore `*.db-shm` and `*.db-wal`, `git rm --cached` those paths. Assistant fixed when opening the PR for #1.

### `biome.json` used a removed `files.ignore` key

Symptom: `biome check` failed with “unknown key `ignore`”. Cause: Biome 2.6 expects `files.includes` with negated globs, not `ignore`. Fix: `npx biome migrate --write`.

### README typo `better-sqlitejs`

Symptom: first draft of the Requirements section linked the wrong package name. Fix: correct to [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) before merge.

### Root `dev` accepts extra `GET` probes to port 3000

Symptom: Fastify logs show `GET /`, `GET /json/version` on 3000 right after `npm run dev` from tooling. Cause: harmless probes, not in the user-facing flow. Fix: none. If those 404 lines are noisy later, turn down server log level or filter probes.

### Instability ran before the duplicate-vote check

Symptom: with `VOTE_INSTABILITY` left on, a second vote from the same user could return `500 simulated_failure` instead of `409 already_voted`. Unknown options and a missing poll had the same gap. Cause: `POST /vote` called `applyVoteInstability` before `insertVote`, so chaos applied to requests that were never going to insert. Fix: `assessVote` first; instability only after that returns ok; `insertVote` still enforces the unique constraint for races. Test covers the already-voted plus forced-fail path. Assistant fixed after the PR #7 review; the user did not edit it by hand.

### `injectWS` hung until `app.ready()`

Symptom: both `GET /ws` tests timed out at 5000ms inside `app.injectWS`. Cause: `@fastify/websocket`'s `injectWS` does not call `ready()`, so the upgrade never completed and the client `open` event never fired. Fix: `await app.ready()` in the test `beforeEach`. Assistant fixed it after the test run; the user did not edit it by hand.

### Pending overlay used the poll total

Symptom: while a vote was pending, another user’s vote raised `total` and the local +1 disappeared until the POST finished. Cause: `deriveVoteView` treated any higher `total` as “my vote is already in the snapshot.” Fix: baseline is the chosen option’s count. Overlay stays while that count has not moved. PR #9 review; assistant fixed it; the user did not edit it by hand.

### Snapshot send ran before socket cleanup

Symptom: a throw from the initial `socket.send` could leave the socket in the hub until a later broadcast. Cause: `close` / `error` listeners were registered after the send. Fix: register those listeners first, and `remove` the socket if send throws. Same review.

### First paint said Reconnecting

Symptom: the header showed **Reconnecting** before the socket had ever opened. Cause: the hook’s initial status was `reconnecting`. Fix: initial status `connecting`, label **Connecting**. Same review.

### Non-root API could not write the existing SQLite volume

Symptom: after the process dropped to uid 1000, `POST /vote` returned `500` with `SQLITE_READONLY`. Cause: the entrypoint ran `chown node:node /data`, which changes the directory only. `poll.db` from the earlier root-owned volume stayed root and mode `644`. Fix: `chown -R node:node /data` before `gosu`. A vote then survived `docker compose stop` / `start`. Assistant fixed it in the same review slice; the user did not edit it by hand.

### Production `npm ci` ran Husky and failed the image

Symptom: `docker compose up --build` died in the server runtime stage with `sh: 1: husky: not found` during `prepare`. Cause: root `prepare` always runs `husky`, and `npm ci --omit=dev` does not install Husky. `HUSKY=0` only helps when the `husky` binary exists (the build stage skipped cleanly). Fix: runtime stage uses `npm ci --omit=dev --ignore-scripts`, then `npm rebuild better-sqlite3 --workspace=@polling/server`. Rebuild warned that install scripts are outside `allowScripts`, but `/health` returned ok and a vote persisted, so the prebuild loaded. Assistant fixed it in the same slice; the user did not edit it by hand.

### Empty vote read reported as not saved

Symptom: after a client timeout, one `GET /vote` with `optionId: null` showed "Vote was not saved" and allowed a retry, while the original `POST` could still finish and insert. Cause: reconcile treated a missing row as a confirmed failure. The client timeout does not cancel the server handler, and instability inserts only after the delay. Fix: re-read a few times, then the unconfirmed message. Caught by the PR #11 review. The assistant fixed it. The user did not edit it by hand.

### `npm audit` after Vitest

Symptom: `npm install` pulled Vitest and reported `3 vulnerabilities (1 moderate, 2 critical)` in transitive packages. Cause: new dev dependency tree, not triaged here. Fix: none in this slice; run `npm audit` locally before production or pin overrides if needed.

## Edge cases deliberately left in place

- **Empty `votes` table on first boot.** Unique `(user_id, poll_id)` is enforced by SQLite. Vote and results routes exist; see [`README.md`](README.md) and [`server/src/vote.test.ts`](server/src/vote.test.ts).
- **Seed is idempotent on poll id only.** Restarting, or running `npm run seed` twice, does not insert a second `poll-1`. Editing the question in code and restarting will **not** update the row already stored. The seed is insert-if-missing, not upsert.
- **npm warned that install scripts were not approved** (`better-sqlite3`, `esbuild`, `allowScripts`). The 12.11.1 prebuild still loaded. If a later `npm install` skips the install script entirely, `require` of `better-sqlite3` will fail until the script is allowed or the binary is rebuilt.

## Still not done

Merge `feat/5-docker-compose` and close [#5](https://github.com/kiu95/polling-system/issues/5) on GitHub when the PR lands. Optional: CI workflow for `npm test` and `docker compose build`. Issue #4 implementation is summarized in [Issue #4 summary](#issue-4--live-results-via-websocket-summary); other issues may still show open until closed there.
