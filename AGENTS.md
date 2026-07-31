# Agent Instructions for Torch

Torch is a data-driven Phaser + TypeScript game with a deterministic
simulation core and a React application overlay. Agents are contributors to
the product, code, tests, and authored content. Keep this file operational:
project behavior belongs in the documents listed below.

## 1. Work safely in the checkout

- Start with `git status --short` and inspect the relevant diff. The worktree
  may contain user changes; preserve them and never reset, clean, revert, or
  overwrite unrelated work.
- Stay on the current branch and worktree. Do not create branches, stage,
  commit, push, tag, or open pull requests unless the user explicitly asks for
  that publishing action.
- Never rewrite published history or force-push. A passing CI check is a safety
  signal, not authorization to publish.
- Keep the change narrow and end-to-end. Reuse or remove existing code before
  adding an abstraction, wrapper, manager, compatibility path, or dependency.
- If an approach fails twice, stop speculative iteration and reassess the
  owning module, the project docs, and the diagnostics.
- Do not expose credentials, local environment values, or private data in
  source, fixtures, logs, screenshots, or handoffs.

## 2. Establish context before editing

Read the project document that governs the area you are changing:

- `README.md` — product direction and current status
- `ARCHITECTURE.md` — runtime boundaries and invariants
- `ROADMAP.md` — active milestone and scope
- `DEVELOPMENT.md` — commands, verification, and change boundaries
- `DETERMINISM.md` — seeds, commands, replay, and versioning
- `DESIGN_SYSTEM.md` — React UI tokens and layout contracts

Do not silently resolve a conflict between documents. Prefer the most specific
current decision, and surface the conflict when it changes implementation
scope, behavior, or a saved-data contract. If a product or architectural
decision changes, update the governing document in the same change.

Load the local skills before relevant work:

- `.agents/skills/torch-ui-ux` for React, CSS, accessibility, responsive UI,
  menus, HUDs, dialogs, inventory, hero/ability/map/settings surfaces,
  context actions, or browser UI review.
- `.agents/skills/torch-phaser` for Phaser scenes, board/camera behavior,
  scale/resize, tiles/grids, assets, input, tweens, or render performance.
- Load both when work crosses the React overlay and Phaser board boundary.

Follow the selected skill's references and checklist; report material findings
in the handoff.

## 3. Preserve the architecture

- Keep `src/sim/` independent of Phaser, React, browser APIs, and platform
  SDKs. Put rules, state transitions, validation, generation, and selectors
  there; keep orchestration in `src/game/`, world presentation in Phaser, and
  semantic application UI in `src/ui/`.
- Every gameplay-state-changing action must enter through a typed command and
  deterministic resolver. UI callbacks and rendering may request actions but
  may not own game rules. Presentation-only actions such as opening a menu do
  not need simulation commands.
- Preserve the turn/action economy: cardinal movement is one tile per move
  command unless an explicit rule says otherwise. Do not add a real-time loop
  to solve a turn-based problem.
- Derive gameplay outcomes from seeded, versioned inputs. Never use
  `Math.random()`, wall-clock time, unstable iteration order, or random IDs in
  simulation behavior. Generated output must be reproducible from the seed,
  generation/content version, and coordinates. Record generation/save version
  changes and inject deterministic sources where needed.
- Keep generated terrain/entities separate from sparse persistent mutations;
  materialize only a bounded active world ring. Keep profile meta-progression
  separate from world-local state and hide platform-specific behavior behind
  adapters.

## 4. Implement in the owning layer

- Prefer small typed modules with pure functions and explicit inputs/outputs.
  Use stable IDs and data-driven definitions for content, entities, recipes,
  abilities, and saves.
- Extend the module that owns a behavior. Delete replaced paths rather than
  leaving parallel implementations or forwarding wrappers.
- Preserve the existing package manager and lockfile. Add a dependency only
  for a demonstrated need, and verify the resulting lockfile and build.
- Keep authored source under `Raw Assets/` and content definitions; generated
  artifacts under `public/assets/` and `dist/` must come from the pipeline and
  must not be hand-edited.
- Do not put critical game rules in images, editor-only artifacts, or other
  unreviewable generated output. Keep generated content traceable to its
  deterministic source inputs.
- Build React UI from `DESIGN_SYSTEM.md`: semantic DOM, explicit props,
  accessible labels, visible focus, and Lucide React for generic icons. Keep
  game artwork at its native aspect ratio; cropping must be an intentional
  thumbnail/world-token variant.

## 5. Prove the change

- Simulation or generation changes need fixed-seed headless tests covering a
  meaningful invariant or consequential behavior.
- User-visible behavior needs the closest Playwright smoke coverage. Keep one
  semantic owner for each journey; cosmetic changes may use the closest
  existing smoke flow.
- Save changes need round-trip serialization and migration coverage. For
  procedural bugs, record seed, generation version, coordinates, and command
  sequence needed to reproduce them.
- While iterating, use focused checks from `DEVELOPMENT.md`. Before handoff,
  run `npm run verify` unless the change is documentation-only and does not
  alter commands or workflows. If port `4173` is occupied, use
  `TORCH_E2E_PORT=4174 npm run verify`.
- Treat type errors, test failures, flaky browser checks, correctness-relevant
  build warnings, and runtime console errors as failures. Never claim a check
  passed unless it ran; record missing tools or intentional skips.

## 6. Keep scope and handoff honest

Follow the active milestone in `ROADMAP.md`; finish a coherent playable path
before adding disconnected content families. Do not introduce multiplayer,
modding, civilization-scale simulation, default permanent death, or a bespoke
editor without an explicit product decision.

Every handoff must state:

- what changed and which files belong to this task
- checks that actually ran and their result
- known limitations, intentional omissions, and open product/architecture
  decisions
- which relevant work predated this task and remains in the dirty tree
