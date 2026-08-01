# Agent Instructions for Torch

Torch is a Phaser + TypeScript game with a deterministic simulation core and a
React application overlay. Keep changes focused, understandable, and complete.

## Work safely

- Start with `git status --short` and inspect relevant existing changes. Preserve
  user work and do not reset, clean, or overwrite unrelated files.
- Stay on the current branch. Do not stage, commit, push, create branches, or
  open pull requests unless the user asks.
- Never expose credentials or private local data.
- Choose the simplest implementation that fully satisfies the current
  requirements. Prefer extending or simplifying the owning module over adding
  wrappers, managers, or parallel abstractions.
- Do not preserve backward compatibility unless the current product or saved-data
  contract explicitly requires it. Remove superseded paths instead of carrying
  legacy behavior forward by default.
- When a dependency is warranted, prefer an established, actively maintained
  library over a custom implementation. Avoid adding dependencies when the
  platform or existing stack already provides a clear, simple solution.

## Read what is relevant

Use the project document that owns the decision:

- `README.md` for product direction and status
- `ROADMAP.md` for current scope
- `ARCHITECTURE.md` for runtime boundaries and invariants
- `DETERMINISM.md` for seeds, commands, replay, and versioning
- `DESIGN_SYSTEM.md` for React UI and visual conventions
- `DEVELOPMENT.md` for commands and verification

Do not read every document by default. If relevant documents conflict in a way
that affects behavior or scope, surface the conflict instead of guessing.

For React UI work, load `.agents/skills/torch-ui-ux`. For Phaser presentation,
board, input, asset, or performance work, load `.agents/skills/torch-phaser`.
Load both only when the change crosses that boundary.

## Preserve the important boundaries

- Keep `src/sim/` independent of Phaser, React, browser APIs, and platform SDKs.
  Gameplay changes enter through typed commands and deterministic resolvers.
- Keep orchestration and input routing in `src/game/`, Phaser presentation in
  the game scene and neighboring modules, and semantic application UI in
  `src/ui/`.
- Derive gameplay outcomes from seeded, versioned inputs. Do not use wall-clock
  time, `Math.random()`, unstable ordering, or random IDs for simulation rules.
- Keep generated world data separate from sparse persistent mutations, and
  profile progression separate from world-local state.
- Keep authored sources under `Raw Assets/` and generated outputs under
  `public/assets/`. Do not hand-edit generated files.
- Follow `DESIGN_SYSTEM.md` for UI. Keep critical rules in typed, reviewable
  source rather than presentation assets or generated output.

## Verify in proportion to the change

- Add fixed-seed tests for meaningful simulation or generation behavior.
- Add or update the closest Playwright coverage for meaningful user-visible
  behavior.
- Add round-trip and migration coverage when save formats change.
- Use focused checks while iterating. Run `npm run verify` before handoff for
  code, asset, configuration, or workflow changes. Documentation-only changes
  need only relevant formatting or link checks.
- Report only checks that actually ran. Treat type errors, test failures, and
  runtime console errors as failures.

Stay within the active milestone in `ROADMAP.md`. Update the owning document
when a product decision, architecture boundary, or saved-data contract changes.
At handoff, summarize the change, checks run, relevant limitations, and any
pre-existing work left untouched.
