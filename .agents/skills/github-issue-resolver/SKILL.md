---
name: github-issue-resolver
description: >-
  Triage and resolve GitHub issues for this repo. Fetches issue via gh CLI,
  produces structured plan (summary, acceptance criteria, approach, risks, files,
  test plan). Recommended: Plan mode for triage (Cursor Plan UI + save to
  .cursor/plans/), Agent mode for implementation after approval. Auto-updates
  docs/roadmap/ when applicable. Hybrid cavecrew delegation for locate/review;
  main thread implements. Use when user mentions a GitHub issue number, issue URL,
  "resolve issue", "fix #N", or "/resolve-issue".
---

# GitHub Issue Resolver

Triage-first workflow. **Never implement until user explicitly approves** (`go`, `implement`, `proceed`, `lgtm`, or Plan **Build**).

## Recommended workflow (Plan → Agent)

| Step | Cursor mode | Skill phases | User action |
|------|-------------|--------------|-------------|
| 1 | **Plan** (Shift+Tab) | 1–2 | `Triage issue #<N> per github-issue-resolver` |
| 2 | Plan | 2–3 | Review/edit Plan UI; **Save to workspace** |
| 3 | Plan or Agent | 3 | Approve: **Build** (Plan) or say `go` (Agent) |
| 4 | **Agent** | 4 | Implement saved plan; test; lint; e2e (if UI); roadmap |

**Why split:** Plan mode owns the interactive plan editor, checkbox todos, and Build gate. Agent mode owns edits, `gh`, branch, commit, PR. A skill in Agent mode cannot populate Plan UI — use Plan mode for triage when you want it.

**Simple bugs** (obvious fix, 1–2 files): skip Plan mode; stay in Agent for Phases 1–4.

**Handoff:** After Save to workspace, plan lives at `.cursor/plans/issue-<N>-<slug>.plan.md`. Phase 4 reads that file when user references it or clicks Build.

## Phase 1 — Detect & fetch

**Trigger:** issue URL, `#42`, `issue 42`, `resolve issue`, `/resolve-issue`.

```bash
# Parse number from URL or #N
gh issue view <N> --json number,title,body,state,labels,assignees,milestone,comments,url
```

Also check linked context:

```bash
gh pr list --search "fixes #<N> OR closes #<N>" --state all --json number,title,state,url
```

Read issue body for: acceptance criteria, repro steps, linked docs, `Closes`/`Refs` mentions, screenshots.

## Phase 2 — Triage

Research codebase before filling triage. Separate **facts** (from issue/gh) from **assumptions** (inferred) — label assumptions explicitly.

### Plan mode (preferred for non-trivial issues)

Use Plan mode tools to create the plan artifact. **Do not** dump triage only as chat prose.

1. Ask clarifying questions if requirements ambiguous.
2. Create/update plan with file paths and code references (`path:line` where known).
3. Structure plan body using sections below.
4. Add implementation **todos** (one per approach step) with stable `id`s.
5. Prompt user: **Save to workspace** → `.cursor/plans/issue-<N>-<short-slug>.plan.md`
6. Stop. User edits plan, then **Build** or switches to Agent with `go`.

Plan frontmatter shape (Cursor fills most fields; ensure `todos` match approach):

```yaml
---
name: Issue <N> — <short title>
overview: <1–2 sentences>
todos:
  - id: <kebab-id>
    content: <implementation step>
    status: pending
isProject: false
---
```

### Agent mode (chat triage — simple issues)

Post this template in chat. Fill every section; write `N/A` or `None` when empty.

```markdown
## Issue #<N> — <title>

**State:** <open|closed> · **Labels:** <list> · **Milestone:** <name|none>

### Summary
<1–3 sentences: problem + desired outcome>

### Facts vs assumptions
- **Facts:** <from issue, labels, existing PRs>
- **Assumptions:** <inferred — confirm before go>

### Acceptance criteria
- [ ] <criterion from issue or inferred>
- [ ] ...

### Proposed approach
1. <step>
2. <step>

### Risks / edge cases
- <risk> → <mitigation>

### Files likely touched
| Path | Why |
|------|-----|
| `src/...` | ... |

### Test plan
- [ ] `npm run test:run` — <which modules>
- [ ] `npm run lint`
- [ ] `npm run test:e2e` — <which spec; `e2e/live-path.spec.ts` or `e2e/a11y-*.spec.ts`, or "N/A — no user-facing flow change">
- [ ] Manual: <steps if UI>

### Roadmap impact
<Yes|No> — <which docs/roadmap/ files if yes; else "no roadmap change expected">

### Architecture notes
<Layer boundaries, event-sourcing constraints, or "none">
```

**Project guardrails** (check during triage):

| Area | Rule |
|------|------|
| Domain | Logic in `src/domain/engine/`; pure, no Redux/Dexie |
| UI reads | `useAppSelector(selectGameSession)` only |
| UI writes | `useGameSession()` command helpers |
| Tests | Replay correctness first; colocate `*.test.ts` |
| E2E | UI flow/a11y change → `npm run test:e2e` locally; not in CI |
| Roadmap | See `.cursor/rules/roadmap.mdc` when feature completes |

**Offer issue comment** (needs approval):

> Post this triage as a GitHub comment? (`yes` / `no`)

On `yes`:

```bash
gh issue comment <N> --body "$(cat <<'EOF'
## Triage

<paste Summary + Approach + Test plan sections>

EOF
)"
```

## Phase 3 — Stop

**Plan mode:** end after plan is saved. User reviews in Plan UI, edits todos, then **Build** or opens Agent.

**Agent mode:** end with:

> **Ready to implement?** Say `go` to proceed, or revise the plan.

**Do not:** create branch, edit code, commit, or open PR until explicit approval (Build or `go`).

## Phase 4 — Implement (after Build or `go`)

**Entry:** user clicked **Build**, said `go` / `implement`, or referenced `.cursor/plans/issue-<N>-*.plan.md`.

1. Read saved plan if present; follow todos in order.
2. If chat-only triage (no plan file), follow Phase 2 approach from conversation.

### 4a. Branch

Ask unless user already named a branch:

```bash
git checkout -b feat/<N>-<short-slug>
```

Slug: lowercase, hyphens, ≤4 words from title (drop articles).

### 4b. Locate (hybrid cavecrew)

Spawn `cavecrew-investigator` when:

- Touch points unclear
- Need callers/defs across layers
- Issue spans 3+ modules

Skip investigator when issue + triage already name exact files.

Main thread owns implementation edits (not `cavecrew-builder` unless single-file surgical fix user requested).

### 4c. Implement

Follow project rules in `.cursor/rules/`. Minimal diff. Match existing conventions.

Domain changes → add/update colocated tests.

### 4d. Verify

```bash
npm run test:run   # required after domain/replay changes
npm run lint       # always before handoff
npm run test:e2e   # user-facing flow changed (Live path, shell, a11y)
```

Fix failures before continuing.

**E2E rules:**

| Rule | Detail |
|------|--------|
| When required | UI flow, routing, seeding, or a11y surface changed — any issue whose test plan touches a screen |
| When skippable | Pure domain/engine/refactor changes with no rendered surface |
| Local only | `npm run test:e2e` is **not** in CI — run it yourself; never claim "CI covers it" |
| Scope | `npm run test:e2e` runs `e2e/` (`chromium` live-path + `a11y` project). Use `npm run test:e2e:a11y` for a11y-only, or `npm run test:e2e -- e2e/live-path.spec.ts` for one spec |
| Setup | Playwright browsers installed (`npx playwright install chromium`); config starts Vite dev on `127.0.0.1:5173` via `webServer` |
| New flow | Add/extend a spec in `e2e/` colocated with existing helpers (`e2e/helpers/`), not a new harness |
| Failure policy | Triage spec vs app: locator drift (prototype/step-count change) → update spec; real regression → fix app |

### 4e. Review

Spawn `cavecrew-reviewer` on branch diff before commit/PR handoff.

### 4f. Roadmap (auto, no ask)

If issue completes milestone work per `.cursor/rules/roadmap.mdc`:

1. `docs/roadmap/roadmap_current_state.md`
2. `docs/roadmap/phase2_4_remaining.md`
3. `docs/roadmap/phase1_test_coverage.md` — only if test scope changed

Set `updated:` frontmatter to current date. Note in summary: "roadmap updated" or "no roadmap change".

### 4g. Commit & PR (always ask)

**Never** commit or push without explicit user request.

When asked to commit → use [caveman-commit](../caveman-commit/SKILL.md) format. Include `Closes #<N>` when appropriate.

When asked to create PR:

```bash
git push -u origin HEAD
gh pr create --title "<type>(<scope>): <summary>" --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- [ ] npm run test:run
- [ ] npm run lint
- [ ] npm run test:e2e (`<spec>` | N/A — no UI flow change)
- [ ] ...

## Roadmap
<updated | no change — reason>

Closes #<N>
EOF
)"
```

## Decision table

| Situation | Action |
|-----------|--------|
| Non-trivial / multi-file issue | Plan mode triage → save plan → Agent implements |
| Simple bug, obvious 1–2 file fix | Agent mode triage + implement in one session |
| User wants Plan UI | Plan mode for Phases 1–2 only; Agent for Phase 4 |
| Saved plan exists | Phase 4 reads `.cursor/plans/issue-*.plan.md` first |
| Issue closed | Report state; ask if reopen or new issue |
| Duplicate / blocked | Say so; suggest blocker issue |
| Scope too large | Split into sub-issues in triage; ask which slice first |
| Ambiguous requirements | List assumptions; ask clarifying questions (Plan mode) |
| Bug needs repro | Add repro steps to test plan; write failing test first; add e2e if user-facing |
| UI flow changed | `test:run` + `lint` + `test:e2e` (local) before handoff |
| Domain-only change | `test:run` required; e2e `N/A` |
| Docs-only issue | Skip domain tests; still run lint |

## gh CLI reference

```bash
gh issue view <N> --json number,title,body,state,labels,url
gh issue comment <N> --body "..."
gh issue list --assignee @me --state open
gh pr create --title "..." --body "..."
gh pr list --search "fixes #<N>"
```

Requires `gh auth status` to succeed. On auth failure: tell user to run `gh auth login`.

## Anti-patterns

- Implementing during triage (Plan or Agent mode)
- Chat-only triage in Plan mode when plan artifact was requested
- Running full skill in Plan mode through Phase 4 (no edits in Plan mode)
- Duplicate approval gates: Plan **Build** *and* skill `go` without user intent
- Committing/pushing without user ask
- Reading game state from RTK Query cache in UI fixes
- Adding UI events to domain event model
- Skipping `test:run` after `applyEvent` / replay changes
- Skipping `test:e2e` for a UI flow change, or claiming CI ran it (e2e is local-only)
- Updating roadmap for typo-only fixes
