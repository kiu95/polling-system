---
name: domain-registry-patterns
description: >-
  Extension playbook for the event-sourced domain engine, derived from the
  4-stage refactor (PRs #416-#420). Use when adding a game event type, a game
  command, a pitch effect, a contact-play outcome, or a composite parent kind;
  when refactoring an if-chain or switch into a registry; or when a change must
  keep replay deterministic and the persisted event shape unchanged. Triggers:
  "add event type", "new command", "registry", "extension point", "where does
  X go", "applyEvent", "commandToEvent", "payload cast".
---

# Domain registry patterns

Standard shapes for this engine. Copy the existing pattern instead of inventing a branch.

## The five invariants

1. **Payload is correlated with type.** `switch (event.type)` must narrow `event.payload` on its own. A new `payload as X` cast is a bug, not a shortcut.
2. **Extension points are total registries.** Keyed by a union (`{ [K in GameEventType]: … }`), so adding a union member breaks the build until the entry exists. No `default: return state`.
3. **One dispatch cast, documented.** A mapped-type registry cannot be indexed by a runtime union. Keep exactly one cast per layer with a comment saying why it is sound. Do not scatter casts through call sites.
4. **Order is data, not control flow.** Ordered lists (`STRATEGIES`, `RULES`) with named entries and a terminal default, not `if (type === 'X')` chains.
5. **Refactors preserve behaviour.** Persisted row shape `{ id, gameId, sequence, type, occurredAt, payload?, subEvents?, version? }`, replay determinism, and public function signatures stay identical. Behaviour changes ship in their own PR with a test that proves them.

## Where each extension goes

| Adding… | Touch | Registry |
|---|---|---|
| Event type | `types/event-payloads.ts` (+ `primitives.ts` for shared shapes) | `EventPayloadMap` |
| Its `GameState` effect | `engine/atomic/handlers.ts` | `ATOMIC_HANDLERS` |
| Pitch count effect | `engine/atomic/pitch-effects.ts` | `PITCH_EFFECTS` |
| New stub / audit-only event | `engine/atomic/handlers.ts` | `noop` entry + stats layer |
| Contact-play outcome | `engine/composite/contact-finalizer.ts` | `CONTACT_FINALIZE_RULES` |
| Sub ordering for a parent kind | `engine/composite/strategies.ts` | `COMPOSITE_STRATEGIES` |
| Game command | `commands/command-handlers.ts` | `COMMAND_HANDLERS` |
| Hit command | `commands/command-mappers.ts` | `HIT_MARKER` |

## Adding an event type

1. Add the payload to `EventPayloadMap` in `src/domain/types/event-payloads.ts` (`undefined` for markers). Typecheck now fails everywhere the union is consumed — that list *is* the checklist.
2. Add the `ATOMIC_HANDLERS` entry in `src/domain/engine/atomic/handlers.ts`. Stateful handlers return the new `GameState`; audit-only markers use `noop` and put their credit in `engine/stats/`.
3. If the event carries subs and orders them specially, add a strategy: `eraseStrategy` / `forTypes` entry in `engine/composite/strategies.ts`, placed **before** the family checks (`PITCH`, `RUNNER_MOVEMENT`, `PUT_IN_PLAY`) and before `DEFAULT_COMPOSITE`.
4. Add a colocated `*.test.ts` asserting `GameState` outcomes (bases, outs, count, score) — not internals.

```ts
// atomic/handlers.ts
export type AtomicHandlerOf<K extends GameEventType> = (
  state: GameState,
  event: Extract<GameEvent, { type: K }>,
  ctx: AtomicContext,
) => GameState;
```

The handler receives `event.payload` already narrowed. If a guard is genuinely needed (a coarser union such as `STOLEN_BASE | DEFENSIVE_INDIFFERENCE`), share a handler function and narrow inside it — see `applyStolenBase` taking a `type` argument.

## Adding a command

1. Add the variant to `GameCommand` in `src/domain/commands/types.ts`.
2. Add the `COMMAND_HANDLERS` entry in `src/domain/commands/command-handlers.ts`. Choose deliberately:
   - `simple('RECORD_X')` when the event is `type` + payload + normalized subs.
   - `stateless(...)` when it needs no `gameState` (or only optional context, like steals of home).
   - `stateful(...)` when it needs `gameState`; the context type makes `gameState` non-optional, so never write `if (!context?.gameState) throw` in a handler.
   - `rejected(reason)` for non-domain commands (`UNDO_LAST_EVENT`, `UPDATE_RUN_CREDITS`, `ATTACH_*`).
3. `commandToEvent(command, context)` is the only entry point and keeps its signature. `application/dispatch-command.ts` must not change.
4. `CommandEventDraft` is `PlayEvent` — build a correlated draft, not a loose object.

## Composite parents

A strategy owns two decisions: how the parent orders its subs, and what the parent frame does after them.

```ts
// engine/composite/strategies.ts — first match wins, default last
export const COMPOSITE_STRATEGIES: readonly CompositeStrategy[] = [
  CATCHER_INTERFERENCE, OFFENSIVE_SUBSTITUTION, DEFENSIVE_SUBSTITUTION,
  BATTER_REACH_PARENT, PITCH, RUNNER_MOVEMENT, PUT_IN_PLAY,
  STOLEN_BASE, CAUGHT_STEALING, PICK_OFF_ATTEMPT, DEFAULT_COMPOSITE,
];
```

- Strategies receive a `CompositeRuntime` (`applyOne`, `applyParent`, `applySubs`, `applySubsByIndex`) — **never import `applyEvent.composite.ts`**, that is the cycle the runtime injection exists to prevent.
- `eraseStrategy` is sound only because the registry calls `apply` after `matches` returned true. Keep that pairing; do not reuse a strategy without its guard.
- Cover a new parent kind with a routing assertion in `strategies.test.ts` (`type -> strategy name`) and keep strategy names unique.

## Refactoring an if-chain

1. Read the chain top to bottom; the branch order is the spec. Preserve it exactly.
2. Extract one module per branch into a folder (`atomic/`, `composite/`) — each file gets a doc comment stating what it owns.
3. Replace the chain with the keyed table, then re-run tests **before** touching anything else. Green here means the split was mechanical.
4. Land it behaviour-preserving, even if the result is more files. Structure first, semantics later.

## Verification gate

Run all four. They are independent; a green typecheck does not imply green lint.

```bash
npm run typecheck                      # tsc -b --noEmit
npm run lint                           # warnings must stay <= baseline (currently 6)
npm run test:run                       # >= 1778 passing
npx vitest bench --run --compare /tmp/replay-before.json
```

- Capture the bench baseline **before** editing (`--outputJson /tmp/replay-before.json`). Compare against that file, not `bench/replay-baseline.json` — the committed baseline is stale and currently reads several times slower than reality. Say so in the PR instead of hiding the delta.
- Report the number honestly. Registry indirection costs single-digit percent; do not claim speedups you did not measure.
- Check the shape of the change: `rg 'payload as ' src/domain --glob '!*.test.ts'` should not grow, and no file above 500 LOC.

## Anti-patterns

| Wrong | Right |
|---|---|
| `const payload = event.payload as X \| undefined; if (!payload) return state;` | Narrow by `event.type`, or a typed sub guard `isRunnerOutSub` |
| `default: return state;` in a `switch (event.type)` | Total `Record` — the missing case is a compile error |
| `if (event.type === 'A') … else if …` for ordered parent kinds | Named entry in an ordered list |
| New `throw new Error('<CMD> requires gameState')` per handler | `needsState: true`; the check lives once |
| Strategy importing `applyCompositeEvent` | Inject `CompositeRuntime` |
| Behaviour tweak bundled into a structural refactor | Separate PR with a test asserting the old behaviour changed |
| Re-baselining the bench file to make the gate pass | Keep the baseline, state the delta |

## Out of scope for this pattern

- Storage/sync boundaries (`persistence/`, `sync/`) keep their own loose decoders (`asGameEvent`, `StoredEventRow`). The union protects the domain, not the wire.
- Stats reconstruction helpers take already-erased sub lists; those casts are historical, not new licence.
