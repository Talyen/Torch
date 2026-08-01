# Torch Tech Stack Evolution Plan

Status: implemented through the Phase 1 guardrail/save/controller slice
Scope: architecture, developer tooling, quality gates, and delivery workflow
Current milestone: Phase 1 first playable vertical slice

## Executive assessment

Torch's core stack is appropriate for the product:

- Phaser for world rendering and interaction.
- React for semantic application UI.
- TypeScript for the simulation, application, and presentation layers.
- Vite for browser development and production builds.
- Vitest for renderer-independent simulation tests.
- Playwright for browser smoke and responsive UI checks.
- Sharp for the authored-art processing pipeline.

The project does not need a framework migration, a server backend, a global state
library, or a second renderer. The missing pieces are the engineering system
around the runtime: formatting and linting, enforced boundaries, runtime
validation, save/replay contracts, broader verification, and explicit
performance/dependency budgets.

The most important product-facing gaps are the remaining Phase 1 requirements:
basic controller mapping, deterministic world save/reload/death/respawn, and a
reusable command-transcript runner. Tooling should strengthen that vertical
slice rather than become a disconnected infrastructure project.

### Phase alignment note

The roadmap currently calls Phase 0 “current” near the top while identifying
Phase 1 as the current next milestone near the bottom. Before implementation,
reconcile that wording in `ROADMAP.md` and state which work is actively in
flight. This plan treats Phase 1 as the product milestone while treating the
guardrails below as a small foundation slice, not a replacement milestone.

### Implementation status — 2026-07-31

The first implementation slice is now present in the working tree:

- Prettier, flat ESLint, React Hooks, JSX accessibility, simulation boundary
  restrictions, `tsconfig.sim.json`, recursive theme discovery, content/asset
  integrity checks, and a post-build bundle-size budget.
- Node 22 plus npm 10.9.3 is declared and CI activates that npm line. TypeScript
  is pinned to 6.0.x because the selected `typescript-eslint` release supports
  TypeScript below 6.1; this is an explicit compatibility decision, not a
  runtime architecture change.
- `WorldSave` schema version 1, strict decode validation, generated-baseline
  re-materialization, fixed-seed replay checkpoints, one local revisioned save
  slot, and action-boundary persistence through `GameSession`.
- Standard browser controller mapping with deadzone and edge-trigger handling,
  plus focused unit tests and a production-preview reload smoke journey.

The remaining roadmap work is deliberately deferred: profile saves, migrations,
multiple-slot UX, interrupted-write recovery qualification, cloud providers,
additional browser engines, and large UI/scene/CSS ownership refactors.

## Current stack and evidence

### Runtime and source organization

The repository currently uses Phaser 4, React 19, TypeScript 6, Vite 8,
Tailwind 4, Base UI/shadcn-style primitives, Lucide, and Sharp. The intended
ownership is:

```text
Platform adapters
  local storage, files, cloud providers, lifecycle, devices

Client / game
  Phaser scenes, camera, tile/chunk rendering, fog, effects, input

Application UI
  React overlay, menus, panels, forms, accessibility

Application
  session orchestration, commands, notifications, save coordination

Simulation core
  deterministic rules, entities, AI, combat, gathering, generation

Content and generation
  stable IDs, definitions, recipes, templates, seeded output
```

The simulation boundary is documented clearly, but most restrictions are
conventions rather than mechanical checks. The simulation is compiled as part
of the same DOM-capable TypeScript project as the client, so the compiler does
not independently prevent browser types from entering `src/sim/`.

### Pre-implementation verification baseline

The current `npm run verify` command runs:

1. Gold/Charcoal theme contract check.
2. TypeScript checking.
3. Vitest unit tests.
4. Asset processing and production build.
5. Playwright browser smoke tests.

The check passed during this review on 2026-07-31. These are checkout snapshots,
not durable project guarantees:

- Theme check passed.
- 9 Vitest files passed.
- 48 Vitest tests passed.
- Production build passed.
- 6 Playwright tests passed.

The build produced approximately:

- 1.85 MB minified JavaScript / 509 KB gzip.
- 184 KB CSS.
- A Vite warning for a JavaScript chunk over 500 KB.

The browser run produced frequent development-only frame-hitch diagnostics,
including occasional multi-hundred-millisecond long tasks. These warnings are
currently diagnostic and should not be converted into a noisy CI failure until
there is a controlled performance harness.

`npm audit` reported zero vulnerabilities in this checkout. `npm outdated`
reported only minor React type-package updates.

### Current gaps confirmed in the checkout

- No coverage command or coverage artifact (deferred until a meaningful
  threshold can be chosen).
- No separate import-graph command; expressible boundaries now belong to ESLint
  and the simulation-only TypeScript project.
- The asset build fails on unreadable/missing sources and records dimensions, but
  there is no independent uniqueness, reference-integrity, orphan-output,
  freshness, or size validation.
- One Playwright project: desktop Chromium. The existing suite already exercises
  the documented responsive viewport geometry; missing coverage is browser
  engines, device emulation, and real hardware.
- No profile/migration/recovery schema beyond the implemented WorldSave v1.
- No production desktop shell or cloud platform adapter implementation.
- Large ownership hotspots: `src/ui/menu-overlay.tsx`, `src/game/scene.ts`, and
  `src/styles.css`.

## Priority gaps and recommended direction

### P0 — Formatting and linting

Add a formatter and a type-aware linter, but introduce them without creating a
massive unrelated diff in the current dirty tree.

Recommended tooling:

- Prettier for TypeScript, TSX, CSS, JSON, Markdown, and YAML.
- ESLint flat config.
- `typescript-eslint` recommended rules first, then type-aware rules for the
  source tree.
- `eslint-plugin-react-hooks` for React hook correctness.
- A small high-signal JSX accessibility baseline now; defer broad/noisy rules
  until the screen split is underway.
- `eslint-config-prettier` so lint and formatting do not fight each other.

Initial lint rules should cover:

- Unused values and unreachable branches.
- Unsafe `any`, broad assertions, and unnecessary non-null assertions.
- React hook dependency and hook-order errors.
- Floating promises and misused promises at async boundaries.
- No production `console` calls, with an explicit exception for development
  diagnostics and asset scripts.
- Type-only imports.
- Restricted imports and globals for architecture boundaries.
- No `Math.random`, wall-clock time, browser globals, or renderer imports in
  `src/sim/`.
- No direct Base UI vendor imports from feature screens.
- No React imports from content definitions.

Add these scripts:

```text
npm run format
npm run format:check
npm run lint
npm run lint:fix
```

Create the initial formatter configuration and run a baseline formatting pass in
its own reviewable change. Do not reformat the entire current dirty tree as part
of a feature change.

### P0 — Architecture enforcement

Use one policy owner per rule. Express import and global restrictions with ESLint
`no-restricted-imports`/`no-restricted-globals` overrides and use the simulation
TypeScript project below for the DOM boundary. Add a small
`scripts/check-architecture.mjs` only for a proven invariant that ESLint and
TypeScript cannot express; do not duplicate the same rule in a second scanner.

Add a `check:architecture` script only when that residual rule is identified and
include it in `verify`.

Add a separate simulation-only TypeScript check:

```text
tsconfig.sim.json
  lib: ["ES2022"]
  types: []
  include: ["src/sim", "src/content"]
```

The client configuration can retain DOM libraries. This creates a compiler
signal if browser APIs leak into deterministic code, while ESLint owns the
import-direction rules.

### P0 — Phase 1 save, replay, and runtime validation

Implement only the minimum proof required by Phase 1. Do not pull Phase 2
durable-envelope breadth or Phase 5 recovery qualification into this slice.

#### Replay

Create a pure command-transcript runner that accepts:

- `seed`.
- `generationVersion`.
- Ordered typed commands.

It should return state checkpoints, structured semantic events, and a compact
deterministic summary useful in regression fixtures. Define canonical ordering
for record-like state before hashing or serializing a summary. Exact message text
should not be the primary replay invariant because copy can change without a
simulation-rule change.

Tests should compare more than the final Hero position: turn count, structured
events, entity positions, health, inventory, cooldowns, and revealed tiles where
relevant.

#### World save projection

Implement a version-1 `WorldSave` only. Record `saveSchemaVersion: 1` now, but
do not write speculative migration code before a second schema exists. Defer a
separate `ProfileSave` until profile progression is real.

The Phase 1 projection should contain:

```text
WorldSave v1
  world ID, seed, generation version,
  Hero, homestead, discoveries, revealed tiles,
  sparse mutations, gathering progress, and required active state
```

Generated baseline terrain/entities must not be blindly serialized. Add a
round-trip test proving that the save can re-materialize the generated baseline
from seed/version while restoring sparse mutations such as removed generated
entities and gathering progress.

Keep save-schema versioning separate from procedural `generationVersion`.

#### Save ownership and provider

Keep browser preferences in `localStorage`. The browser-independent save DTO,
codec, and migration boundary belong with simulation/domain code. The
`SaveProvider` interface belongs at the application/session boundary, currently
owned by `src/game/session.ts`. A browser IndexedDB/local provider belongs in a
platform adapter only when the first implementation exists; choose IndexedDB
based on the actual Phase 1 projection and operational requirements rather than
future-size assumptions.

The Phase 1 provider should:

- Save only after completed action boundaries.
- Assign monotonically increasing snapshot revisions.
- Prevent a slower older write from overwriting a newer snapshot.
- Expose recoverable save-failure status without invalidating simulation dispatch.
- Remain portable to future file and cloud adapters.
- Never become authoritative for simulation rules.

#### Runtime validation

Do not cast arbitrary `JSON.parse` output directly to a save type. Start with a
small hand-written version-1 codec if the schema remains manageable. Introduce
one runtime schema library only when save complexity justifies it; do not add
both Zod and Valibot or a general validation framework prematurely.

Required Phase 1 tests:

- Version-1 round-trip serialization.
- Unknown, missing, corrupt, and unsupported-version data fails safely.
- Fixed-seed save/load/replay equivalence.
- One addressed world slot behind a provider interface.
- Save failure produces a recoverable status signal.

Defer profile saves, multiple-slot UX, old-version migration, last-known-good
recovery, and interrupted-write qualification to their roadmap phases unless the
product roadmap is explicitly changed.

### P1 — TypeScript hardening

Keep the current `strict` baseline. Enable these immediately after fixing the
small current diagnostic set:

- `noImplicitOverride` — already clean in the current checkout.
- `verbatimModuleSyntax` — currently exposes a small number of type-only import
  corrections.

Adopt these incrementally by module rather than switching them on globally in a
single noisy diff:

- `noUncheckedIndexedAccess`.
- `exactOptionalPropertyTypes`.
- `noPropertyAccessFromIndexSignature`.

The current checkout produces many errors under the latter flags, especially in
tests, frame-monitor diagnostics, and indexed entity maps. That is useful
information, but it should be handled as a deliberate hardening slice.

### P1 — Test portfolio

Keep Vitest as the only unit-test runner. Add:

- A coverage command using Vitest's V8 provider.
- Coverage reports as an observed baseline first, not an arbitrary global
  percentage gate.
- Property-based tests for coordinates, chunk addressing, visibility bounds,
  generation reproducibility, and rejected commands not advancing turns.
- Fixed-seed simulation fixtures for every new action family.

Split Playwright by ownership:

```text
Smoke
  boot, movement, visibility, one action, save/load, respawn

UI regression
  inventory, equipment, abilities, map, settings, focus restoration

Responsive/release
  mobile and short viewport geometry, browser matrix, visual snapshots
```

Keep the current single-worker behavior for Phaser-rendering jobs if it avoids
artificial contention. Add Mobile Chrome and WebKit as scheduled or release
validation first, then promote them to pull-request gates when runtime is
stable.

E2E tests should fail on unexpected console errors. Explicitly allow the known
development `[Torch perf]` warnings until those are separated into a dedicated
performance test mode.

Add a small high-signal accessibility lint baseline now: valid ARIA props,
semantic interaction warnings, and meaningful image text. Defer broad/noisy
rules and runtime axe coverage until the major screens are split. Existing
role/name/focus assertions remain the primary semantic contract.

Add one production-preview browser path. The current integrated suite builds
`dist` but then launches the Vite development server; a `vite preview` smoke
path is more valuable for release confidence than immediately adding more
browser engines.

Phase 1 also still owns the unchecked basic controller mapping requirement. The
stack plan does not replace that product work: it should be routed through the
same typed input/session boundary and covered by the smoke path when it lands.

### P1 — Bundle, asset, and performance budgets

The current build warning is a signal to measure, not a reason to rewrite the
renderer immediately.

First steps:

1. Generate a bundle composition report.
2. Establish current JavaScript, CSS, and asset-size baselines.
3. Add a small `check:size` script with an explicit regression margin.
4. Inspect which modules actually dominate the initial load.
5. Extract ownership cleanly where justified, then lazy-load only modules whose
   exclusion improves initial loading.
6. Keep the Phaser bootstrap, HUD, and first playable area in the initial load.
7. Validate that the Sharp asset pipeline emits deterministic manifests and no
   orphaned or duplicate assets.

Asset validation should check:

- Stable IDs are unique.
- Every referenced source exists.
- Every expected generated variant exists.
- Dimensions and aspect ratios match the declaration.
- Generated output is deterministic and produces no unexpected git diff after
  the asset build.
- File sizes stay within declared budgets.

Also make the existing theme check discover `src/ui/**/*.tsx`,
`src/components/ui/**/*.tsx`, and feature CSS automatically. A hardcoded file
list will silently lose coverage as the UI is modularized.

Do not introduce a simulation worker or alternate rendering pipeline until a
fixed-seed performance fixture demonstrates that the current main-thread model
is the cause of a meaningful regression.

The existing frame monitor should remain diagnostic. Add controlled fixtures for
dense visible chunks, fog updates, pathing, and nearby actors, reporting p99
frame time, one-percent-low FPS, long tasks, and Phaser render time.

### P1 — Modularity and ownership hotspots

After persistence and replay are stable, first identify and remove superseded
rules, then split the largest modules by existing ownership rather than merely
creating more files or introducing new state managers.

Target shape:

```text
src/ui/
  overlay-shell.tsx
  screens/
    hero.tsx
    inventory.tsx
    equipment.tsx
    abilities.tsx
    map.tsx
    settings.tsx
  components/
  primitives.tsx

src/game/
  scene.ts
  rendering/
    terrain-layer.ts
    fog-layer.ts
    entity-layer.ts
    hero-layer.ts
  input/
  presentation/

src/styles/
  tokens.css
  base.css
  hud.css
  menus.css
  inventory.css
  loadout.css
  settings.css
  action-hand.css
```

`TorchScene` should remain the Phaser lifecycle owner. Extracted renderers must
not become new session or simulation authorities.

The current code mixes Tailwind utilities in shared primitives with semantic
handwritten CSS for feature surfaces. Keep that arrangement for now, but make
the policy explicit:

- Canonical tokens remain in `src/styles.css`.
- Feature composition remains semantic CSS.
- Tailwind is used primarily by checked-in primitives and small utility
  composition.
- Do not begin a repository-wide Tailwind migration as part of this plan.
- Do not add Stylelint until CSS ownership is split and there is a demonstrated
  need.

### P2 — Dependency and environment governance

Add to `package.json`:

- A supported Node engine range.
- A package-manager declaration.

Add one runtime-version file (`.nvmrc` or `.node-version`) matching CI. The
current local runtime is Node 24 while CI uses Node 22; the project should
choose and document one supported line.

Add, subject to explicit repository-governance approval for external automation:

- Dependabot for npm and GitHub Actions.
- Scheduled full `npm audit`.
- High-severity audit failure in CI.
- Monthly dependency review.
- Playwright and bundle artifacts retained on failure.

Keep the lockfile authoritative and continue using `npm ci` in CI. A
`packageManager` field alone does not guarantee npm parity; if parity is a
requirement, CI must explicitly activate/install that npm version. Otherwise,
promise Node parity only.

### P2 — Platform and release architecture

The platform layer is documented but not implemented, which is correct for the
current phase. Keep audio and world-input ownership in the existing client/game
layers; platform adapters should bridge native SDKs only when they exist. Before
Steam packaging:

- Define lifecycle, file-system, and save-provider adapters, plus native bridges
  for controller/audio only where the desktop shell requires them.
- Prototype the desktop shell against the actual built client.
- Verify suspend/resume, window resizing, controller input, and filesystem saves.
- Decide whether cloud saves are optional or release-critical.
- Add release-only diagnostics or telemetry only if an operational need is
  demonstrated.

Do not add Electron, Tauri, a server backend, Zustand, Redux, or another global
state manager now.

## Proposed command and CI gate

The eventual local gate should be ordered from cheapest to most integrated:

```text
npm run format:check
npm run lint
npm run check:theme
npm run check:architecture       # only if a residual non-ESLint rule exists
npm run check:content
npm run typecheck:sim
npm test
npm run build
npm run check:size
npm run test:e2e:prod -- --reporter=line
```

`npm run build` owns asset processing, normal typechecking, and `vite build`, so
the gate should not run those steps twice. `npm run test:e2e` can remain the
development-server command for focused iteration; `test:e2e:prod` should start
`vite preview` against the already-built `dist` output.

`npm run verify` should compose this sequence. Keep CI as one job while the
current suite remains small and deterministic; split static and browser jobs
only if duration or flakiness provides evidence that the duplication is worth
the extra checkout/install complexity. The browser job should retain one worker
for the Phaser client unless measurements show safe parallelism.

## Target architecture

```text
src/sim/
  deterministic rules, state, commands, generation, replay projections

src/content/
  stable IDs, definitions, validation inputs, asset references

src/game/
  GameSession, command routing, save coordination,
  Phaser lifecycle, rendering, input adapters, presentation effects

src/ui/
  React overlay, semantic screens, accessibility, shared primitives

src/platform/
  browser/local provider, later files/cloud and native lifecycle bridges

scripts/
  asset processing, content validation, architecture checks, size checks
```

Create `src/platform` only when the first real adapter has an owner. Keep
orchestration in the existing `src/game/session.ts` unless an explicit
architecture decision moves it and updates `AGENTS.md`, `DEVELOPMENT.md`, and
the source-of-truth docs together. Empty abstraction directories would add
ceremony without reducing risk.

## Sequenced implementation plan

### Phase 0: guardrails

1. Pin Node/npm versions.
2. Add Prettier and ESLint flat configuration.
3. Add format, lint, and content checks; add architecture checking only for a
   residual invariant that ESLint and TypeScript cannot own.
4. Enable `noImplicitOverride` and `verbatimModuleSyntax`.
5. Add the simulation-only TypeScript check.
6. Establish bundle and asset baselines.
7. Update CI to run the new mechanical checks.

### Phase 1: persistence contract

1. Complete the unchecked basic controller mapping through the typed input
   boundary.
2. Define the browser-independent version-1 `WorldSave` projection and codec.
3. Implement the command-transcript runner.
4. Add deterministic checkpoint fixtures and canonical semantic comparisons.
5. Add one local provider behind the existing session/application boundary.
6. Add version-1 round-trip, unsupported/corrupt-data, and fixed-seed
   save/load/replay tests.
7. Add save/load/death/respawn to the Playwright smoke flow, including a
   production-preview check.
8. Update `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DEVELOPMENT.md`,
   `DETERMINISM.md`, and `AGENTS.md` together if ownership or contracts change.

### Phase 2: verification maturity

1. Promote the Phase 1 world-save proof into a durable versioned local-fallback
   implementation.
2. Add coverage reporting.
3. Add property-based simulation tests.
4. Split Playwright projects and test ownership.
5. Add mobile/browser release matrices.
6. Add bundle and asset budgets.
7. Split the largest UI and scene modules after removing superseded rules.
8. Add fixed-seed performance fixtures.

### Phase 3: release foundation

1. Add platform adapters.
2. Choose and validate a desktop shell.
3. Add release build metadata and a source-map strategy.
4. Verify clean installs, upgrades, corrupted/interrupted saves, controller
   behavior, and window resizing.
5. Add optional telemetry only after the operational requirement is explicit.

## Acceptance criteria

The stack evolution is successful when:

- Every authored source file is format-checked in CI.
- ESLint catches the documented React, TypeScript, and boundary classes.
- `src/sim` can be typechecked without DOM libraries.
- No new simulation/browser/platform boundary violations can land silently.
- Save data has explicit version-1 schema validation and safe unsupported-data
  handling; migration and recovery coverage is added when the corresponding
  roadmap phase exists.
- A seed plus command transcript reproduces state and event checkpoints.
- The browser suite has a fast smoke path and a separately owned responsive/
  release path.
- Bundle, asset, and performance regressions produce measurable reports.
- CI and local development use the same supported Node line, and CI explicitly
  activates the declared npm version if npm parity is part of the contract.
- No new framework or state manager is introduced without a demonstrated owner
  and a measured problem.

## Decisions to record before implementation

These decisions should be written as short architecture decision records when
the corresponding phase begins:

1. Browser persistence mechanism for the Phase 1 world projection.
2. Hand-written save codec versus one runtime schema package.
3. Supported Node version and whether CI installs the declared npm version.
4. Browser support and Playwright release matrix.
5. Initial JavaScript/CSS/asset size budgets.
6. Desktop shell selection for Steam.
7. Whether production telemetry is required.
8. Whether Dependabot automation is enabled for the repository.

## Explicit non-goals

- Replacing Phaser, React, Vite, or Vitest.
- Adding a server or account backend.
- Adding Zustand, Redux, or another global state store.
- Moving deterministic rules into React or Phaser.
- Introducing a worker before profiling demonstrates a need.
- Migrating all CSS to Tailwind.
- Adding a bespoke content editor.
- Turning development frame warnings into a flaky CI gate.
- Enabling Dependabot or other external automation without explicit repository
  governance approval.

## Publishing boundary

Every phase should produce verified working-tree changes for review. Staging,
commits, branches, pushes, pull requests, and activation of external update
automation remain separate user-authorized actions.

## References

- [Torch Architecture](../ARCHITECTURE.md)
- [Torch Roadmap](../ROADMAP.md)
- [Development Workflow](../DEVELOPMENT.md)
- [Determinism and Replay Contract](../DETERMINISM.md)
- [Torch UI Design System](../DESIGN_SYSTEM.md)
- [ESLint configuration files](https://eslint.org/docs/latest/use/configure/configuration-files)
- [typescript-eslint typed linting](https://typescript-eslint.io/getting-started/typed-linting/)
- [Prettier installation](https://prettier.io/docs/install.html)
- [Vitest coverage](https://vitest.dev/guide/coverage.html)
- [Playwright projects](https://playwright.dev/docs/test-projects)
- [Vite production builds and code splitting](https://vite.dev/guide/build)
- [GitHub Dependabot version updates](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-version-updates)
