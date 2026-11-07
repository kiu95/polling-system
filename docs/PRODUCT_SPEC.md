# High-Concurrency Polling System — Product Spec

**Approach:** Agentic coding (Cursor, Opencode, etc.)  
**Stack (project decision):** Vite + React + TypeScript · Fastify + TypeScript · SQLite · WebSocket live results · Vitest · Docker Compose (deliverable polish)

## Objective

Build a full-stack web application where users vote on poll questions and view results. The feature set is intentionally simple; the system must be architected for **concurrency**, **network instability**, and **strict data integrity**.

---

## 1. Feature requirements

### 1.1 Voting interface (frontend)

- Display a poll question with multiple-choice answers.
- Allow the user to select an answer and submit their vote.
- UI must feel instantaneous: implement **optimistic UI updates** when a vote is cast.

### 1.2 Results dashboard (frontend & backend)

- Display current vote counts and percentages for the poll.
- Keep results up to date via polling, WebSockets, or Server-Sent Events.
  - **Shipped:** WebSocket `GET /ws` (issue #4 text allowed polling; this repo uses push).

### 1.3 API (Node.js backend)

- Endpoints to:
  - fetch the active poll
  - submit a vote
  - fetch results
- Persistence: database of choice (SQLite, PostgreSQL, etc.) or a robust in-memory structure designed for concurrent access.
  - **Project default:** SQLite with transactions / atomic increments.

---

## 2. Architectural & technical constraints

These evaluate architectural judgment and code-auditing skill.

### 2.1 Concurrency & atomic updates

The system must accurately record every vote even if **100 users** submit a vote for the **exact same option** at the **exact same millisecond**. Avoid race conditions where read-modify-write cycles overwrite each other.

### 2.2 Resilience & rollback

The backend should simulate a **~15% failure rate** on vote submission (e.g. randomly return `500 Internal Server Error` **or** a ~3-second network delay). The React frontend must handle these errors gracefully by:

- rolling back the optimistic UI state
- displaying a contextual error to the user

### 2.3 Validation

Prevent the same user from voting multiple times on the same poll (simple mock user ID, session, or IP simulation). Enforcement must be **strict on the backend**, not frontend-only.

---

## 3. Deliverables

| Deliverable | Notes |
|-------------|--------|
| **Source code** | Git repository with React frontend and Node.js backend |
| **Commit history** | Atomic, logical commits; show iterative build and how the coding assistant was guided |
| **Running application** | Runnable locally (e.g. Docker) |
| **Automated tests** | At least one suite targeting a critical failure mode (e.g. backend race-safety, or frontend optimistic rollback on API failure) |
| **`AGENT_WORKFLOW.md`** | Brief markdown on AI usage for this task: prompt strategy; bugs / architectural flaws / edge cases the AI generated that required manual audit and fix |

---

## 4. Project tracking (issues)

Repo: [`kiu95/polling-system`](https://github.com/kiu95/polling-system)

| Issue | Scope |
|-------|--------|
| [#1](https://github.com/kiu95/polling-system/issues/1) | Local scaffold (no Docker) |
| [#2](https://github.com/kiu95/polling-system/issues/2) | Backend APIs + atomic votes + anti-double-vote + 15% failure sim |
| [#3](https://github.com/kiu95/polling-system/issues/3) | Frontend optimistic UI + rollback |
| [#4](https://github.com/kiu95/polling-system/issues/4) | Results dashboard + WebSocket live refresh |
| [#5](https://github.com/kiu95/polling-system/issues/5) | Critical tests + Docker Compose + `AGENT_WORKFLOW.md` + polish |

---

## 5. Explicit non-goals (time box)

- Multi-poll admin UI, real auth systems, Redis/queues unless SQLite cannot prove concurrency
- Polished visual design beyond a clear, usable UI
