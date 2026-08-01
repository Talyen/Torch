# Behavior Hardening Audit

**Goal:** Strengthen confirmed correctness gaps at Torch's typed command, deterministic state-transition, and browser-preference boundaries.

## Intent

Inventory confirmed transition or persistence issues and fix them at the owner that already enforces the behavior. A clean pass is valid; do not add guards, logs, seams, or tests solely to create work. Torch's current Phase 1 slice does not yet have durable world/profile save serialization, so do not invent a save subsystem in this audit. If the scope is large, phase the plan and keep proposals under [README.md](README.md) and [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Hard stops

- Do not run broad async-lifetime or typing sweeps here; link out to `AsyncRaceAudit.md` / `TypeSafetyAudit.md`.
- Presentation-only cleanup and timer/listener lifetime issues belong to `AsyncRaceAudit.md`.
- If a duplicate command is caused by a stale timer, listener, or presentation re-entry, route that root cause to `AsyncRaceAudit.md`; keep the accepted/rejected state contract here.
- Pure simulation rules belong in `src/sim/**`; do not move them into React or Phaser callbacks to hide a transition bug.
- Do not add a durable save format, schema library, cloud provider, or migration path before the Phase 1 save decision in [ROADMAP.md](../../ROADMAP.md).

## Triage

| Priority | Examples                                                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | A command can mutate state without going through `applyCommand`, resolve twice, grant a resource twice, or leave the state invalid after a death/respawn                         |
| P1       | A rejected command changes state; enemy response, cooldown, gathering progress, reveal, or generated-entity removal is applied in the wrong turn; an error is silently discarded |
| P2       | Browser preference or key-binding corruption is hidden without a deterministic fallback or useful diagnostic                                                                     |
| P3       | Style-only error handling or defensive checks with no confirmed behavior impact                                                                                                  |

Prioritize P0–P1 by player-visible correctness and replay impact.

## Domain rules

- `src/sim/simulation.ts` is the command owner. `applyCommand` clones `GameState`, validates a typed `Command`, returns `{ state, events, accepted }`, and advances turn-consuming commands exactly once.
- `src/sim/actions.ts` and `src/sim/ability-rules.ts` own action validation and resolution; `src/sim/context-actions.ts` is a read-only projection of currently legal cards and must not become a second resolver. `GameSession` in `src/game/session.ts` routes UI/input callbacks to typed commands; screens must not mutate `GameState` directly. A stale or duplicate card dispatch whose root cause is effect lifetime or ordering belongs to `AsyncRaceAudit.md`.
- Rejected commands must not advance the turn or mutate unrelated state. Equip-ability is a non-turn state command and must use the same validation path as replayed commands.
- Death/respawn, enemy response, ability cooldowns/effects, gathering progress, sparse generated-entity removal, and visibility reveal are deterministic state transitions. Use fixed seeds and event/state assertions in `tests/simulation.test.ts` and `tests/visibility.test.ts`.
- Browser presentation settings and key bindings in `src/game/presentation-settings.ts` and `src/game/input-bindings.ts` are best-effort `localStorage` preferences, not world saves. Invalid or unavailable values should fall back to their declared defaults without changing simulation state.
- When durable save/load is implemented, establish versioned profile/world envelopes and an explicit validation/migration owner first; then extend this audit with round-trip, partial, corrupt, and interrupted-write cases. Until then, absence of a save layer is a roadmap gap, not a finding to patch here.
- An empty `catch` is only a finding when it hides a player-visible state or persistence failure. Non-critical browser preference storage may deliberately fall back when storage is unavailable.

## Known signals

Optional discovery aids — choose probes that fit the candidate.

- **Bypassed resolver:** UI or scene code writes `gameSession.state`, entity fields, inventory, health, cooldowns, or reveal maps instead of dispatching a `Command` through `GameSession`.
- **Acceptance/turn mismatch:** `applyCommand` branches that mutate state or emit a success event when `accepted` is false, or advance a turn for `equip-ability`/a rejected command.
- **Rejected-command pre-validation:** `applyCommand` calls `materializeGeneratedTrees` before validating the command. A blocked or otherwise rejected command may therefore add generated entities to the cloned state, violating the no-unrelated-mutation contract; confirm a state diff before moving materialization behind accepted-command logic.
- **Non-idempotent action:** repeated `action`, `interact`, or blocked `move` commands double-apply gathering, damage, ability effects, cooldowns, or generated-entity removal.
- **Lifecycle transition gaps:** death/respawn does not restore bound position and health, reveal the respawn area, or retain the expected death count; enemy response runs after a rejected command.
- **Generated-state drift:** `materializeGeneratedTrees` or `removedGeneratedEntities` loses a sparse mutation, resurrects a chopped tree, or makes a different result for the same seed and command transcript.
- **Malformed preference fallback:** `readShowGridPreference`, `readUiScalePreference`, or `readReduceMotionPreference` treats an unknown stored string as a meaningful value, throws at boot, or silently changes gameplay state instead of using its declared default (and the platform motion preference only where explicitly intended).
- **Unavailable-storage key bindings:** `readKeyBindings`/`setKeyBindings` must keep default or in-memory bindings usable when `localStorage` is missing or throws; confirm that storage failure does not turn a key-binding change into a lost update or a visible command error.
- **Swallowed transition errors:** empty `catch`/no-op `.catch` around command dispatch or a future save boundary that leaves the UI claiming success.

## Matching verification

Use fixed-seed headless tests first, then the smallest browser flow for a visible boundary:

```bash
npm run typecheck
npm test -- tests/simulation.test.ts tests/visibility.test.ts tests/input-bindings.test.ts
npm run test:e2e -- tests/e2e/first-light.spec.ts --reporter=line
npm run verify
```

If no confirmed correctness gap exists, report a clean pass and leave the roadmap's future save work untouched.
