# Dual-Path & Compatibility Retention Audit

**Goal:** Delete confirmed parallel live implementations, compatibility shims past their window, and “keep both” leftovers that still compile and remain reachable.

## Intent

Confirm two reachable paths for one behavior (or a reachable shim that only forwards to the surviving owner) and remove one path. A successful fix reports authored LOC, declarations, or exported API removed by deleting the superseded path — not by wrapping it again. A clean pass is valid. Planning and phasing: [README.md](README.md).

## What counts as dual-path retention

| Tell | Why it is a finding candidate |
| --- | --- |
| Forwarding wrapper or rename-only type alias still imported beside the real owner | Extra name preserves a deleted API surface |
| Barrel dual-export of old and new names after callers moved | Side-by-side re-exports keep both names live with no unique behavior |
| Session/UI or scene helper duplicates a rule already owned by `src/sim/` | Callers can use either path and rules drift |
| Migration/legacy bridge remains on a live path after its consumer window closes | Temporary compatibility became permanent surface |
| Parallel implementations of one simulation, visibility, input, asset, or presentation rule | “Keep both for safety” has no remaining distinct consumer |
| Deprecated entry only exists to call the new entry | Reachable twin with no unique behavior |
| Permanent environment switch ships both implementations indefinitely | The losing path has no remaining distinct consumer |

**Not this audit:** zero live consumers → `DeadCodeAudit.md`; single intentional entry with no second product path → `InelegantSlopAudit.md`; wrong owner (with or without a twin) → `StateGravityOwnershipAudit.md`; duplicate product screens → `DuplicateFeatureSurfaceAudit.md`; test-only scaffolding → `UnitTestAudit.md` / `E2ETestQualityAudit.md`; async races/effect lifetime → `AsyncRaceAudit.md`. `src/ui/primitives.tsx` re-exporting Base UI and Torch-owned `src/components/ui/` components is an intentional behavior/styling boundary, not automatically a twin.

## Hard stops

- Do not collapse intentional seams listed in [ARCHITECTURE.md](../../ARCHITECTURE.md): simulation vs Phaser/React presentation, typed command routing through `src/game/session.ts`, seeded RNG inputs, `ProfileSave` vs `WorldSave` (planned persistence envelopes), raw assets vs the Sharp-generated `public/assets/` manifest, and platform adapters kept outside simulation rules.
- Do not delete a save or schema compatibility path while a real save/resume/fixture consumer requires it. Durable save serialization and migrations are not implemented yet; do not invent a migration window or treat the future browser/platform providers as current duplicate paths. Check [ROADMAP.md](../../ROADMAP.md) and [DETERMINISM.md](../../DETERMINISM.md) before making a persistence claim.
- Do not rewrite simulation math, command contracts, or save wire format under this audit; prove equivalence through the existing `src/sim/` owner and its fixed-seed tests when a twin is confirmed. A resolver and a read-only context/default-action projection are not twins merely because they mention the same rule; compare inputs, mutation, and call sites before collapsing either path.
- Do not demote or delete `src/sim/index.ts` or other barrel exports solely because they re-export a symbol. Inventory live imports first, then preserve stable cross-folder contracts.
- Prefer the owning audit when the hit is primarily unused, ceremony-only (no twin), wrong ownership, duplicate UI, test-portfolio fit, or async isolation.

## Evidence bar

Either:

- **Two reachable paths** for one behavior, both referenced from product code or tests, with one path able to absorb callers; or
- **Reachable no-op shim:** the shim/deprecated entry has live references but adds no unique behavior beyond forwarding to the surviving owner.

Plus a delete-one-path remedy that preserves behavior. Speculative “might need later” is not evidence. For a migration or legacy bridge, inventory actual save/resume/schema/fixture consumers and document why the window is closed; comments or age alone are insufficient.

`DeadCodeAudit.md` owns symbols with **zero** live consumers. This audit owns reachable twins and reachable no-op shims.

## Remedy preference

Prefer delete the superseded path → retarget callers to the surviving owner → remove forwarding wrappers and rename-only aliases → remove leftover exports. Do not leave a pass-through “for compatibility” after callers move. Significant folder moves or new seams remain proposals per [README.md](README.md).

## Domain rules

When neither path is marked deprecated, choose the survivor in this order:

1. The architecture- or simulation-owned path over a UI/scene/session duplicate.
2. The path with unique behavior over a pure forwarder.
3. The newer entry only after those; call-site count is a last tie-break, not ownership.

For Torch, use these ownership anchors while inventorying candidates:

- Rules, state transitions, seeded generation, and deterministic validation: `src/sim/`.
- Session orchestration and input mode: `src/game/session.ts`; physical-key normalization/rebinding: `src/game/input-bindings.ts`; Phaser pointer/keyboard subscription and world-input gating: `src/game/scene.ts`.
- Phaser world presentation and presentation math: `src/game/scene.ts` and neighboring `src/game/*.ts` modules.
- React overlay and interaction surfaces: `src/ui/`, with shared vendor/styled wrappers in `src/ui/primitives.tsx` and `src/components/ui/`.
- Stable content IDs and authored definitions: `src/content/`; optimized outputs are generated under `public/assets/` by `scripts/process-assets.mjs`.

## Known signals

Optional discovery aids — confirm every hit with a call-site inventory and behavior comparison.

- **Deprecated/compat names:** `rg -n "legacy|compat|deprecated|shim|bridge|v1|old" src tests scripts` (case-insensitive) is noisy discovery only; exclude comments/docs/generated output and confirm each candidate with live imports, selectors, and runtime references.
- **Barrel dual-exports:** `src/sim/index.ts` or `src/ui/primitives.tsx` exporting old and new names side by side after callers moved to one; inspect any future content re-export the same way.
- **Parallel rule paths:** overlapping helpers in `src/sim/actions.ts`, `context-actions.ts`, `ability-rules.ts`, `simulation.ts`, `world.ts`, or `entities.ts`; compare blocked-move defaults, explicit actions, and context projections before deleting anything. Preserve a projection that is intentionally read-only or presentation-shaped when the resolver remains the mutation authority.
- **Session/renderer twins:** a React callback or Phaser pointer handler that mutates state directly instead of routing through `GameSession.dispatch()`/`applyCommand()`, or a second visibility/fog calculation beside `src/game/visibility.ts`.
- **Live UI selectors:** before calling a path unused, inventory CSS selectors, DOM IDs, `data-testid` contracts, texture keys, and dynamic action/screen lookups; a selector-backed surface is a live consumer even without a TypeScript import.
- **Generated/source twins:** code importing a generated `public/assets/manifest.json` path and a hand-authored alternate path for the same stable asset. Fix `Raw Assets/`, `src/content/`, or the pipeline; never hand-edit generated output.
- **Flagged implementations:** `import.meta.env`/Vite branches that keep two reachable implementations of one behavior. `vite.config.ts` currently defines a single browser entry; do not claim an absent desktop/mobile branch as evidence.
- **Closed persistence windows:** only after a versioned save envelope exists, inventory real provider/round-trip/migration consumers and focused tests; until then, record “not applicable” rather than inventing legacy-save paths.

## Matching verification

After retargeting callers, run a focused Vitest test for the behavior (`npm test -- <path>`), `npm run typecheck`, and the closest Playwright spec if the removed path was browser-reachable. Run `npm run check:theme`, `npm run build`, or `npm run assets:build` only when those owners changed; use `npm run verify` for a cross-layer deletion. Report the removed declarations/LOC/export surface, surviving owner, call-site inventory, and unchanged deterministic/browser evidence.
