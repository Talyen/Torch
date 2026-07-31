# Agent Instructions for Torch

Torch is a code-and-data-driven Phaser + TypeScript game. Agents are the
primary development and content-authoring contributors.

## Working agreement

- Preserve the existing dirty tree. Inspect in-flight changes before editing,
  keep unrelated user work intact, and never clean, reset, revert, or overwrite
  changes you did not make for the current request.
- Keep work within the requested scope. Prefer the smallest change that fully
  satisfies the request; delete or reuse before introducing a new abstraction,
  dependency, manager, wrapper, or compatibility path.
- Use honest judgment. Surface tradeoffs and challenge a weak product or
  architecture direction when a stronger option is clear, while still making
  reasonable progress without unnecessary clarification.
- If the same approach fails three times, stop and reassess using the relevant
  docs and diagnostics instead of continuing speculative fixes.
- Stay on the current branch and worktree unless the user explicitly asks for
  branch or worktree management.

## Publishing policy

Agents must not stage, commit, push, create branches, tag releases, or open
pull requests unless the user explicitly asks for that publishing action.
The default handoff is a verified working tree left for the user to review.

When publishing is explicitly requested:

1. Confirm the intended scope and review `git status` and the diff.
2. Stage only task-related files and use a concise commit message.
3. For normal solo work, commit and push directly to `main`; use a branch or
   pull request only when explicitly requested or when the change is knowingly
   isolated for collaboration or risk management.
4. Watch the GitHub Actions run for the pushed HEAD and report failures with
   the failed job, annotations, and a short relevant log excerpt.

Never rewrite published history or force-push. A CI check does not authorize a
push; it is a safety gate after the user has authorized publishing.

## Read before changing code

Read these project documents before changing the corresponding area:

1. `README.md` for product direction and current status.
2. `ARCHITECTURE.md` for runtime boundaries and invariants.
3. `ROADMAP.md` for the current milestone and scope.
4. `DESIGN_SYSTEM.md` before adding or changing React UI.
5. `DEVELOPMENT.md` and `DETERMINISM.md` when changing workflows, tooling,
   seeds, replay behavior, or simulation reproducibility.

If a change alters a product decision, architectural invariant, workflow, or
command documented in these files, update the relevant document in the same
working change.

## Non-negotiable architecture

- Keep the simulation core independent of Phaser, React, browser APIs, and
  platform SDKs.
- Route every player action through a typed command and deterministic action
  resolver. Rendering and UI callbacks must not own important game rules.
- Keep cardinal movement and one-tile action resolution as the baseline.
- Keep world generation seeded and reproducible. Never use `Math.random()` for
  gameplay outcomes; use the seeded RNG utilities and record the generation
  version when behavior changes.
- Keep generated terrain/entities separate from sparse persistent world
  mutations. Generated output must be reproducible from seed, version, and
  coordinates; player actions such as chopping a generated tree need an
  explicit mutation rather than an untracked rendering side effect.
- Keep profile meta-progression separate from world-local state.
- Do not add a real-time simulation loop to solve a turn-based problem.
- Do not store the infinite world as one unbounded in-memory grid. Materialize
  only a bounded active ring and prune distant presentation entities.
- Keep platform-specific behavior behind adapters rather than scattering SDK
  conditionals through the simulation.

## Implementation style

- Prefer small typed modules with explicit inputs and outputs and pure
  functions for generation, pathing, validation, calculations, and selectors.
- Use stable IDs for content, generated entities, and save references.
- Keep Heroes, enemies, items, equipment, abilities, recipes, quests, and
  generation parameters data-driven and easy to inspect in review.
- Extend the module that already owns a behavior before adding a new file or
  generic abstraction. Remove replaced code rather than leaving parallel paths
  or forwarding wrappers.
- Avoid introducing a framework or dependency unless it solves a demonstrated
  project need.
- Keep comments focused on invariants and non-obvious decisions.
- Build React UI from the tokens and layout contracts in `DESIGN_SYSTEM.md`.
  Use semantic DOM, explicit prop types, accessible labels, visible focus
  states, and Lucide React for generic interface icons. Reserve authored art
  for game-content visuals.
- Preserve native artwork aspect ratios. Cropping must be an intentional
  thumbnail or world-token variant, never an accidental menu constraint.

## Assets and generated output

- Treat `Raw Assets/` and authored content definitions as source material.
  Record source metadata and stable asset IDs when adding an asset pipeline.
- Never hand-edit generated output such as `public/assets/`, its manifest, or
  `dist/`; edit the raw source or pipeline and regenerate.
- Do not embed critical game rules in images, editor-only artifacts, or other
  unreviewable generated files.
- Keep generated content traceable to its source and deterministic inputs.

## Testing and verification

- For simulation changes, add or extend headless tests with fixed seeds and
  meaningful invariants. Cover distinct consequential behavior, not trivial
  plumbing, framework behavior, or display constants.
- For user-visible client changes, add or extend the closest browser smoke
  flow. Keep one semantic owner for each important journey instead of
  duplicating the same assertion across many test layers.
- For save changes, test round-trip serialization and migration behavior.
- For procedural debugging, capture the seed, generation version, coordinates,
  and command sequence needed to reproduce the issue.
- Run the repository's available checks before handoff. The normal gate is:
  `npm run verify`. If port `4173` is occupied, use an isolated port, for
  example `TORCH_E2E_PORT=4174 npm run verify`.
- Do not claim a command passed if the scaffold does not define it or if it was
  not run. Document missing tooling or known skips explicitly.
- Treat type errors, test failures, flaky browser tests, build warnings that
  affect correctness, and runtime console errors as real quality issues.

## Scope control

The current milestone is the first playable vertical slice. Prefer completing
a narrow end-to-end path—seeded world, movement, Torch visibility, nearby
simulation, one enemy, gathering, saving, and respawn—over adding disconnected
content types.

Do not introduce multiplayer, modding, civilization-scale simulation,
permanent-death-only progression, or a bespoke game editor without an explicit
product decision.

## Handoff

Every implementation handoff should state:

- what changed
- which tests and checks ran
- any known limitations or intentionally untouched areas
- any architectural or product decision that remains open
- whether the working tree is clean or contains uncommitted changes
