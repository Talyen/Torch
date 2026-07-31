# Unit Test Portfolio Audit

**Goal:** Reduce redundant Vitest setup and assertions while preserving the
unique semantic owners for Torch's deterministic simulation and pure client
helpers.

The unit-test contract is described in
[`ARCHITECTURE.md`](../../ARCHITECTURE.md) and
[`DETERMINISM.md`](../../DETERMINISM.md). Vitest configuration is in
[`vitest.config.ts`](../../vitest.config.ts); unit files live directly under
`tests/`. Browser behavior belongs in `tests/e2e/` and
`E2ETestQualityAudit.md`.

## Intent

Confirm duplicate, weaker, implementation-detail, slow, or over-expanded cases
with a stronger owner elsewhere, then delete or merge the weaker case. A clean
pass is valid. Add a test only for a confirmed behavioral gap in an existing
owner; do not manufacture coverage or introduce a new test framework.

Track authored declarations and expanded table cases separately. A reduction is
useful only when it lowers duplicate setup, execution time, or maintenance
surface—not merely the number of `it` calls.

## Current ownership map

| Concern | Semantic owner |
| --- | --- |
| Seeded terrain/chunks, cardinal movement, gathering, combat, abilities, cooldowns, death/respawn | `src/sim/**` → `tests/simulation.test.ts` |
| Simulation visibility state and revealed tiles | `src/sim/**` → `tests/simulation.test.ts` |
| Entity footprint math | `src/sim/footprint.ts` → `tests/footprint.test.ts` |
| Board tile sizing and responsive view radius | `src/game/layout.ts` → `tests/layout.test.ts` |
| Fog/visibility transition math | `src/game/visibility.ts` → `tests/visibility.test.ts` |
| Phaser fog transition orchestration | `src/game/scene.ts` → the closest browser smoke contract |
| CSS color bridge used by Phaser | `src/game/presentation-colors.ts` → `tests/presentation-colors.test.ts` |
| Keyboard normalization and rebinding | `src/game/input-bindings.ts` → `tests/input-bindings.test.ts` |
| Development frame metric helpers | `src/dev/frame-monitor.ts` → `tests/frame-monitor.test.ts` |
| Action Hand playback replacement helper | `src/ui/context-action-hand.tsx` → `tests/context-action-hand.test.ts` |
| Rendered menu/HUD, focus, responsive geometry, assets, theme | `tests/e2e/first-light.spec.ts` and `tests/e2e/theme.spec.ts` |

The current checkout has no feature-store or migration-test hierarchy and no
DOM testing harness. Keep the audit aligned with the top-level Vitest files and
the owners above.

## Hard stops

- Do not invent a coverage percentage gate. Coverage may be a local discovery
  tool only if separately installed and explicitly reported.
- Do not delete fixed-seed generation, command-result/event, cooldown, or
  death/respawn assertions merely to shrink the suite.
- Do not replace outcome assertions with function-exists checks, snapshots of
  implementation details, log fingerprints, or soft failures.
- Do not move browser journeys into Vitest or expand this audit into Playwright
  flake work.
- Do not use wall-clock sleeps in unit tests. Inject deterministic inputs and
  compare state, events, inventory, health, revealed tiles, and turn counts.

## Reduction priorities

1. Duplicate simulation assertions across `tests/simulation.test.ts` and a
   helper test; keep the case that owns the behavior and remove the echo.
2. Repeated fixed-seed setup that can use a small local fixture without hiding
   the seed or command sequence.
3. Assertions on plain constants/struct shapes that do not protect a player
   outcome.
4. Expanded sibling cases where a table can preserve distinct consequential
   branches with less setup and runtime.
5. Redundant assertions inside a kept case, only after confirming they do not
   document a separate invariant.

## Quality and determinism rules

- Prefer `createInitialGameState(seed)` plus ordered `applyCommand` calls over
  a browser/session spin. Keep the seed, generation version, and command
  sequence obvious in regression cases.
- Assert rejected-command behavior as well as successful outcomes when the
  validation boundary matters. Rejected commands must not advance the turn.
- Keep generated terrain separate from persistent mutations in assertions;
  prove a chopped tree or defeated entity changes state through an explicit
  mutation, not a renderer side effect.
- Keep UI helper tests pure where possible. DOM focus, menu dismissal, asset
  loading, and responsive geometry belong to Playwright.
- Reuse small fixtures only when at least three cases benefit and the fixture
  does not conceal a meaningful setup difference.

## Known signals

- `rg -n "setTimeout|waitForTimeout|sleep\\(" tests --glob '*.test.ts*'`
- Tests asserting only `toBeDefined`, object key counts, or exact catalog
  lengths without a gameplay invariant.
- Duplicate seed/command transcripts; probe with `rg -n "createInitialGameState|applyCommand|seed|move\(|wait\(|gather\(" tests --glob '*.test.ts*'` before extracting or deleting a case.
- Direct imports of React/Phaser into tests covering a `src/sim` rule.
- A browser-only expectation duplicated in unit tests, or a pure helper
  expectation duplicated wholesale in an E2E flow.
- `tests/simulation.test.ts` cases that stop before checking events, state
  mutations, or turn economy despite claiming to cover an action.

## Verification

Run a focused file first, then the normal unit/type gate:

```bash
npm test -- tests/simulation.test.ts
npm test -- tests/context-action-hand.test.ts tests/input-bindings.test.ts
npm run typecheck
npm test
npm run verify
```

Report any intentionally retained duplicate-looking case and the invariant it
protects. Do not claim coverage or speed improvements without running the
relevant command.
