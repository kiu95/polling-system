# github-issue-resolver

Triage-first GitHub issue workflow for inniq-frontend.

## Recommended flow (Plan → Agent)

1. **Plan mode** (Shift+Tab) — `Triage issue #42`
2. Review Plan UI; **Save to workspace** → `.cursor/plans/issue-42-*.plan.md`
3. **Build** (stays in Plan) or switch to **Agent** — `go` / `implement per saved plan`
4. Agent runs Phase 4: branch → code → `npm run test:run` → lint → roadmap → ask commit/PR

Simple 1–2 file bugs: skip Plan mode; use Agent for full flow.

## Invoke

- `resolve issue #42`
- GitHub issue URL
- `/resolve-issue`

## See also

- [`SKILL.md`](./SKILL.md) — full phases, templates, decision table
- [Cursor Plan mode docs](https://cursor.com/docs/agent/plan-mode)
- [cavecrew](../cavecrew/SKILL.md) — investigator/reviewer delegation
