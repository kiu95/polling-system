# Agent workflow

How the coding assistant was guided on this repo, and which of its choices had to be corrected. Written 2026-11-06, during the local scaffold ([issue #1](https://github.com/kiu95/scmp-polling-system/issues/1)). Docker, the vote API, and the critical test suite are still [issue #5](https://github.com/kiu95/scmp-polling-system/issues/5) and [issue #2](https://github.com/kiu95/scmp-polling-system/issues/2). This file records what already happened. It is not a claim that those later issues are done.

## Prompt strategy

The product spec and GitHub issues are the source of scope. The assistant does not invent the stack.

1. **Triage from the issue, not from a blank prompt.** "Plan on issue #1" meant fetch the issue, confirm no open PR already closed it, and read issues #2–#5 before choosing a schema. #2 already requires `polls`, `options`, and `votes` with a unique `(userId, pollId)`. The scaffold creates that `votes` table empty. It does not add `POST /vote`.
2. **Lock assumptions in the plan and wait.** npm workspaces, `better-sqlite3` (not Prisma), `GET /poll`, ports 3000 and 5173, idempotent seed. Docker, failure simulation, and the voting UI stay out. Implementation starts only after an explicit "go".
3. **Slice by todo.** "Go for the first 2" stopped at `.gitignore`, `README.md`, and `shared/` types. "Go for the 3rd" stopped at the Fastify server. "Go for the 4th" was server Vitest only (`app.test.ts`, `vitest.config.ts`, `package.json` `test`). Client, root `dev` / `test`, and concurrent install stayed out.
4. **Check the machine, not the plan.** A written plan that says `better-sqlite3` is not evidence the native module installs. `npm install`, `tsc`, a double seed, and `curl` against a running server are the check.
5. **Keep this file current.** The user asked for a Cursor rule, not another feature. `.cursor/rules/agent-workflow.mdc` (`alwaysApply`) now requires each later slice to append prompt strategy and any assistant-caused defect here, in the same change. No new defect in that step.
6. **Fourth todo (Vitest smoke).** User said `go for 4th todo item`; scope was `@scmp/server` only: Vitest `inject` for `GET /health` and `GET /poll`, `:memory:` DB with `initDatabase` called twice to assert idempotent seed. Root `npm run test`, client, and concurrent `dev` stayed out.
7. **Fifth todo (client page).** User said `go for 5th todo item`. Scope was `@scmp/client`: Vite React page, dev proxy for `/health` and `/poll`, render health OK and the seed question. No vote button. Root `dev` / `concurrently` stayed on the sixth todo. `client` was added to workspaces so `npm install` can see the package.
8. **Sixth todo (root scripts).** User said `go remaining todo`. Scope was root `package.json` scripts: `dev` runs server and client with `concurrently`, `predev` builds `@scmp/shared`, `build` builds shared then server then client, `test` runs both workspaces, `seed` delegates to the server. README updated for the one-command flow.
9. **Biome.** User asked to add Biome for linting and formatting on `client` and `server`. Later the same user asked to include [`shared/`](shared/) in root `lint` / `lint:fix` and matching scripts on `@scmp/shared`.
10. **PR #6 review (pre-merge).** Review pasted in chat: add Node `engines` and README Node version; `pretest` builds shared; CORS comment for local-only; stricter seed option count in tests; `App` as plain `function` (no empty `FC` props); keep misleading `.cursor/rules/code-style.mdc` for a separate PR.

## What was built under that strategy

- Root `.gitignore`, `README.md`, and an npm workspace for `@scmp/shared` (`ActivePoll`, `PollOption`).
- `@scmp/server`: Fastify `GET /health` and `GET /poll`, CORS, SQLite file `server/data/poll.db`, WAL, foreign keys, schema for `polls` / `options` / `votes`, seed of `poll-1` only when that id is missing, Vitest smoke in `server/src/app.test.ts` (in-memory DB).
- `@scmp/client`: Vite React page. Empty `VITE_API_URL` uses the dev proxy. The page shows health OK, the seed question, and option labels. No vote control.
- Root scripts: `npm run dev`, `npm test`, `npm run build`, `npm run seed`, `npm run lint` / `npm run lint:fix` (see [`package.json`](package.json)). Root [`package.json`](package.json) has `"engines": { "node": ">=24" }`; [`.nvmrc`](.nvmrc) pins 24 for nvm. `pretest` runs `build` on `@scmp/shared` so `npm test` works without a manual shared build.
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

`@scmp/shared` exports `dist/index.d.ts`. Server `tsc` cannot see `ActivePoll` until `npm run build --workspace=@scmp/shared` has been run. Root `predev` and `pretest` run that build; README still documents running it yourself when skipping those hooks. TypeScript project references remain a follow-up.

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

### `npm audit` after Vitest

Symptom: `npm install` pulled Vitest and reported `3 vulnerabilities (1 moderate, 2 critical)` in transitive packages. Cause: new dev dependency tree, not triaged here. Fix: none in this slice; run `npm audit` locally before production or pin overrides if needed.

## Edge cases deliberately left in place

- **Empty `votes` table.** Unique `(user_id, poll_id)` is schema for issue #2. There is no vote route, no user id, and no failure simulation. A reviewer who calls `POST /vote` will get Fastify's 404. That is intended.
- **Seed is idempotent on poll id only.** Restarting, or running `npm run seed` twice, does not insert a second `poll-1`. Editing the question in code and restarting will **not** update the row already stored. The seed is insert-if-missing, not upsert.
- **npm warned that install scripts were not approved** (`better-sqlite3`, `esbuild`, `allowScripts`). The 12.11.1 prebuild still loaded. If a later `npm install` skips the install script entirely, `require` of `better-sqlite3` will fail until the script is allowed or the binary is rebuilt.

## Still not done

Vote and results APIs, optimistic UI, HTTP polling of results, the race-condition test, and Docker Compose. Those stay on issues #2, #3, #4, and #5.
