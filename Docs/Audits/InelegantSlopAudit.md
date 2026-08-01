# Inelegant Slop Audit

**Goal:** Find and simplify hotspots of over-engineered, verbose, or un-pragmatic Torch code — from function-level ceremony up to file/folder mass hotspots with mixed jobs — without a whole-repo rewrite.

## Intent

Surface **confirmed** hotspots so authored LOC, declarations, indirection, or nesting decreases. Moving ceremony among files is not success. Prefer deleting/inlining; significant structural work remains a proposal per [README.md](README.md). A clean pass is valid. Before shipping a fix, confirm real reading/editing cost, no second need for the indirection, and a shorter local form that preserves behavior. If the fix scope is large, phase the plan.

This audit owns two scales: **local ceremony** (functions, wrappers, comments, branches) and **file/folder mass** (large authored surfaces whose size or mixed jobs cost more to read, edit, or verify than the behavior warrants). Wrong architecture ownership — even in a huge file — belongs to `StateGravityOwnershipAudit.md`.

## What “slop” means here

Slop looks industrious but fails a pragmatism test: more types, indirection, comments, or branches than the problem warrants.

| Tell                                                                  | Why it is slop                                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Interface + single implementer + factory                              | Indirection with no second implementation                                    |
| `*Manager` / `*Helper` / `*Coordinator` / `*Wrapper` for one function | Noun theater around a free function or method                                |
| Narrating comments/restated docs                                      | Rephrases the signature instead of encoding non-obvious intent               |
| Boolean parameter soup                                                | Combinatorial call sites that should be an enum or two functions             |
| Deep nesting or a giant component                                     | Complexity that should be collapsed or extracted, not layered                |
| Pass-through wrappers/rename-only aliases                             | Reachable twin/no-op shim callers can retarget → `DualPathRetentionAudit.md` |
| Premature DI/config objects for a local call                          | Ceremony without a current second consumer                                   |
| Defensive `??` / `as` / `any` stacks without a real failure mode      | Ceremony hides the invariant; typing escapes belong to `TypeSafetyAudit.md`  |
| Near-duplicate blocks with tiny diffs                                 | Copy-paste growth instead of one parameterized path                          |

Elegant Torch code is usually plain typed data, pure `src/sim/` rules, a thin `src/game/session.ts` boundary, focused Phaser scene/presentation helpers, React function components, shared UI wrappers, discriminated unions, and direct call sites.

## File & folder mass hotspots

Mass hotspots are authored production or test surfaces whose size or mixed jobs cost more than the behavior warrants: a scene that owns unrelated simulation rules, a React overlay that combines unrelated screens and state orchestration, or test support whose LOC dwarfs unique assertions. Do not treat `src/content/` catalogs, generated assets, the intentional Phaser/React composition boundary, or the intentional `src/ui/menu-overlay.tsx` menu hub as mass findings on size alone; require mixed jobs or recurring avoidable prereads beyond the documented hub ownership.

**Evidence bar** (all must hold):

- **Hotspot:** large relative to 2–3 peer files in the same owner class (`src/sim`, `src/game`, `src/ui`, `src/components/ui`, `src/content`, or test support), or it routinely forces unrelated prereads because of mixed jobs.
- **Avoidable cause:** mixed jobs, parallel scaffolding, or accumulated helpers without a second need — not inherent simulation or catalog density.
- **Existing home:** the existing simulation module, session/scene module, UI wrapper, content definition, or focused test owner can absorb the collapse or split.
- **Measurable direction:** net authored LOC/declarations/indirection down while behavior and required coverage stay intact. Architecture-expected hub moves may be LOC-neutral only when code moves into an existing owner and no parallel path remains.

File length alone is a candidate signal, never a finding. Historical churn may surface candidates but is not confirming evidence.

## Hard stops

- Do not collapse intentional seams: seeded RNG injection, typed command routing, simulation vs Phaser/React boundaries, design-system tokens, raw-art vs generated-asset boundaries, visibility/fog pooling, and planned versioned save envelopes. See [ARCHITECTURE.md](../../ARCHITECTURE.md).
- Do not rewrite simulation action, enemy-response, generation, or save invariants “for clarity” without fixed-seed tests proving equivalence.
- Do not turn this into a style-only rename sweep, documentation rewrite, or mass deletion of tests that encode real invariants.
- Prefer the owning audit when the hit is primarily dead code, reachable dual paths/shims (`DualPathRetentionAudit.md`), boundary legality, async races, type-safety escapes, duplicate UI, or state-ownership drift.
- Do not hand-edit generated output in `public/assets/` or `dist/`; fix `Raw Assets/`, `src/content/`, or `scripts/process-assets.mjs` and regenerate.
- Do not introduce a new manager, framework, package, or directory solely to make a local function look shorter.

## Remedy preference

Prefer delete unused ceremony, then inline single-use wrappers, then collapse duplicates in-module. Extract a local helper when a name removes nesting and has at least two current call sites or clear domain meaning. A generic or cross-owner abstraction requires at least three current uses (or an enforced boundary), matching the shared proposal bar. Keep shared behavior in the existing owner (`src/sim/`, `src/game/`, `src/ui/`, `src/components/ui/`, or `src/content/`); never add a layer for one call site.

## Known signals

Optional discovery aids — inspect changed paths and compare against peers; there is no dedicated complexity or single-use audit script in Torch.

- **Local ceremony:** `Manager`/`Helper`/`Coordinator`/`Wrapper`/`Factory` names, one-line forwarding functions, rename-only aliases, and comments that restate the signature.
- **Branch/nesting mass:** deeply nested `if`/`switch` chains, repeated guards, and boolean combinations in changed `.ts`/`.tsx` files. Use a before/after line or declaration count; do not invent a repo-wide complexity threshold or claim a metric from tooling that is not configured.
- **Defensive typing:** `as unknown as`, `any`, non-null assertions, and nested fallback chains. Confirm a real failure mode; typing escapes remain owned by `TypeSafetyAudit.md`.
- **Near duplicates:** repeated action validation, visibility interpolation, input mapping, or UI layout blocks. Compare `src/sim/actions.ts`, `context-actions.ts`, `ability-rules.ts`, `world.ts`, `src/game/visibility.ts`, `input-bindings.ts`, and `src/ui/` before parameterizing.
- **Mass outliers:** compare `wc -l` and declaration counts for peers in `src/sim/`, `src/game/`, `src/ui/`, `src/components/ui/`, `src/content/`, and `tests/`; then confirm mixed jobs and an existing owner. Generated `public/assets/` and authored catalogs are not production-mass evidence by themselves.
- **CSS/layout mass:** inspect repeated selectors, declarations, and media-query branches in `src/styles.css` and `src/index.css` with focused `rg`/`wc -l` probes; token ownership or palette drift belongs to `DesignSystemConsistencyAudit.md`, not a slop deletion.
- **Test scaffolding:** helpers or fixtures whose harness LOC substantially exceeds unique assertions. Route portfolio/value questions to `UnitTestAudit.md` or `E2ETestQualityAudit.md` rather than deleting coverage here.
- **Compiler feedback:** `npm run typecheck` is the configured static check (`strict`, `noUnusedLocals`, `noUnusedParameters`, and no-fallthrough). It is correctness evidence, not a complexity gate.

## Matching verification

For a local simplify, run the closest focused Vitest test (`npm test -- <path>`) and `npm run typecheck`; for CSS/theme edits also run `npm run check:theme`. For Phaser or React behavior, add the closest Playwright smoke assertion or run the affected existing spec with `--reporter=line`. For cross-layer changes, use `npm run verify` once (it already includes the theme, type, unit, build, and browser checks). If a candidate overlaps a sibling audit, state ownership goes to `StateGravityOwnershipAudit`, reachable twins to `DualPathRetentionAudit`, copied UI to `DuplicateFeatureSurfaceAudit`, and CSS/token drift to `DesignSystemConsistencyAudit` before applying a slop remedy. Report the before/after LOC/declaration/indirection direction, why the shorter form preserves the owner boundary, and the unchanged semantic test evidence.
