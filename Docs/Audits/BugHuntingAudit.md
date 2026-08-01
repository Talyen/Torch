# Strategic Bug Hunting Audit

**Goal:** Find and fix real defects in the browser-first Torch slice — an opportunistic hunt, not a sibling-audit re-run.

## Intent

Confirm candidate defects and fix them. A pass with no confirmed defect is successful. Do not re-run sibling audits’ full suites; defer P4/P5 by default. Significant structural remedies are proposals per [README.md](README.md). If the scope is large, phase the plan.

**Default discovery mode:** hunt the diff. On a repeat cadence, review commits since the last pass (`git log`/`git diff` on authored paths) for defects introduced or exposed by recent work. Whole-repo signal greps are the secondary, periodic mode.

When the checkout is dirty, inspect `git status --short` plus `git diff`/`git diff --cached` on the relevant paths, but keep pre-existing edits separate from the current pass; do not clean, reset, or attribute the entire dirty tree to one change.

This is an **opportunistic defect hunt**. When a hit is clearly owned by a sibling (idempotency/persistence → `BehaviorHardeningAudit.md`, effect lifetime → `AsyncRaceAudit.md`, unused API → `DeadCodeAudit.md`, typing escapes → `TypeSafetyAudit.md`), hand it off rather than duplicating that audit’s full pass.

## Hard stops

- Do not rename/restyle or opportunistically refactor unrelated code. Fix the confirmed bug’s root cause; larger structural remedies are proposals, not unsupervised rewrites.
- Do not expand into speculative backlog or edit generated output under `public/assets/`; change `Raw Assets/`, `src/content/`, or the asset pipeline only when it directly causes the confirmed defect.
- Keep the simulation portable: do not move game rules into Phaser, React, or browser-only code while fixing a presentation symptom. See [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Confirmation policy

- **Auto-fix** P0–P2 correctness bugs (crashes, corrupted state, double grants, stuck input, clear wrong simulation or UI behavior).
- **Skip and note** balance retunes, player-facing copy/layout choices, or ambiguous product intent — do not block waiting for answers.
- Never ask about naming, file structure, or obvious internal guards.

## Severity

| Sev | Criteria                                                                                          | Default disposition           |
| --- | ------------------------------------------------------------------------------------------------- | ----------------------------- |
| P0  | Crash, data loss, save corruption, or a deterministic replay divergence that can destroy progress | Fix now                       |
| P1  | Wrong simulation, progression, visibility, input-mode, or UI state                                | Fix now                       |
| P2  | Degraded UX (stuck menu, missing dismissal, ghost input, duplicate action feedback)               | Fix when confirmed and scoped |
| P3  | Recoverable failure without useful diagnostics                                                    | Fix only if trivial           |
| P4  | Maintainability (orphaned state)                                                                  | Defer to `DeadCodeAudit.md`   |
| P5  | Async/effect lifetime risk                                                                        | Defer to `AsyncRaceAudit.md`  |

## Known signals

Optional discovery aids — choose probes that match the changed area. A hit is not a finding until a deterministic reproduction or user-visible trace confirms it.

- **Simulation bounds and identity:** unchecked entity/ability/resource lookups in `src/sim/`, especially `actions.ts`, `ability-rules.ts`, `context-actions.ts`, `entities.ts`, and `world.ts`; confirm adjacency, occupancy, health, cooldown, and empty-state guards.
- **Command contract drift:** compare blocked cardinal movement, explicit `action` commands, and `availableActionsAt()` for the same target. All state-changing input must reach `applyCommand()` through `src/game/session.ts` as required by [DETERMINISM.md](../../DETERMINISM.md).
- **Turn and numeric edges:** health, block, cooldown, gathering progress, inventory quantities, enemy movement, and respawn paths that can underflow, double-advance, or resolve after a rejected command.
- **Deterministic generation/visibility:** fixed-seed terrain, entity materialization, removed-entity mutations, `generationVersion`, revealed tiles, and visibility transition snapshots that disagree between runs or briefly show the destination mask before a reveal tween.
- **Phaser lifecycle and input:** pointer/resize listeners, tweens, pooled fog/grid/entity objects, and shutdown cleanup in `src/game/scene.ts`; reproduce rapid resize, menu-open input, repeated movement, and scene restart if the changed path touches them.
- **React overlay actions:** rapid clicks, pointer holds, keyboard dismissal, and menu transitions in `src/ui/` and `src/components/ui/` that dispatch twice, leave `GameSession` in the wrong `world`/`ui` input mode, or lose focus. Pure lifetime/cancellation findings belong to `AsyncRaceAudit.md`.
- **Asset boundary failures:** stable IDs or generated manifest paths that disagree with `scripts/process-assets.mjs`, `public/assets/manifest.json`, or native-ratio variants; do not “fix” generated files by hand.
- **Swallowed orchestration errors:** empty `catch` blocks or ignored rejected work around session setup, asset processing, or the current save-provider boundary. The local provider is implemented; cloud adapters and migration behavior remain future, so do not invent bugs for absent providers.

## Matching verification

Choose the cheapest semantic owner, then run the broader gate if the fix crosses layers:

- Simulation/rules: `npm test -- tests/simulation.test.ts` (or the closest focused Vitest file) with a fixed seed and command sequence.
- Renderer/presentation: `npm test -- tests/visibility.test.ts tests/frame-monitor.test.ts` and a focused Playwright spec when browser behavior changes.
- React/input: the closest Vitest test plus `npm run test:e2e -- tests/e2e/first-light.spec.ts --reporter=line` or `theme.spec.ts`.
- Asset/theme/build: `npm run assets:build`, `npm run check:theme`, or `npm run build` as applicable.
- Cross-layer fixes: `npm run verify` (use `TORCH_E2E_PORT=4174` if port 4173 is occupied).

Report the reproduction inputs (seed, generation version, coordinates, and command sequence when relevant), observed evidence, root cause, changed paths, and the matching verification. A clean pass is a valid outcome.
