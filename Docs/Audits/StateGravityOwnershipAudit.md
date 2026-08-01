# State Gravity & Ownership Audit

**Goal:** Pull misplaced rules, persistence, input, and presentation logic out
of oversized Torch modules and restore each concern to the existing runtime
owner—without adding a new manager, store, or parallel command path.

The contracts are defined in [`ARCHITECTURE.md`](../../ARCHITECTURE.md),
[`DEVELOPMENT.md`](../../DEVELOPMENT.md), and
[`DETERMINISM.md`](../../DETERMINISM.md). The runtime uses a typed session
boundary and the module owners listed below; keep new work within those
owners.

## Current ownership map

| Concern                                                                                                                                  | Owner                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules, validation, deterministic action resolution, entities, generation, and visibility facts (`revealedTiles`, lit/revealed decisions) | `src/sim/` (`simulation.ts`, `actions.ts`, `ability-rules.ts`, `world.ts`, `entities.ts`, `types.ts`)                                                   |
| Application/session command routing and action-boundary snapshots                                                                        | `src/game/session.ts`                                                                                                                                   |
| Physical-key normalization, rebinding, and input preference storage                                                                      | `src/game/input-bindings.ts`                                                                                                                            |
| Phaser pointer/keyboard subscription and world-input gating                                                                              | `src/game/scene.ts` and `GameSession.inputMode`                                                                                                         |
| Phaser world presentation, camera, fog, terrain/entity draw orchestration                                                                | `src/game/scene.ts`                                                                                                                                     |
| Pure board/layout/presentation math and CSS color bridge                                                                                 | `src/game/layout.ts`, `src/game/visibility.ts` (renderer-facing snapshot/interpolation/alpha math only), `src/game/presentation-colors.ts`              |
| React HUD, menus, dialogs, selectors, settings, and screen-only state                                                                    | `src/ui/menu-overlay.tsx`, `src/ui/context-action-hand.tsx`                                                                                             |
| Shared React behavior boundary and styled controls                                                                                       | `src/ui/primitives.tsx`, `src/components/ui/`                                                                                                           |
| Stable content definitions and asset IDs                                                                                                 | `src/content/`                                                                                                                                          |
| Browser presentation preferences                                                                                                         | `src/game/presentation-settings.ts`                                                                                                                     |
| Save codecs and provider persistence                                                                                                     | `src/sim/world-save.ts`, `src/sim/profile-save.ts`, `src/game/save-provider.ts`, `src/platform/local-save-provider.ts`, routed by `src/game/session.ts` |
| Raw artwork processing and generated outputs                                                                                             | `Raw Assets/`, `scripts/process-assets.mjs`, `public/assets/` (generated; never hand-edit)                                                              |

## Intent

Identify mixed-lifetime or mixed-layer clusters, then move code to an existing
owner and delete the old forwarding path. A move is justified only when the
concern has a different lifetime, imports a forbidden layer, creates duplicate
tests, or makes a module own unrelated workflows. New modules are acceptable
only when they are a clear pure helper or adapter with a real boundary, not as
a renamed gravity well.

## What “state gravity” means in Torch

| Tell                                                                                      | Why it is a finding                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Damage, cooldown, gathering, enemy response, or generation math in `*.tsx` or `scene.ts`  | Rules bypass the deterministic `src/sim` command resolver          |
| React callback mutates `GameState` or a content definition directly                       | UI becomes a second simulation authority                           |
| `GameSession` grows feature-specific state or UI layout APIs                              | Application routing hub has absorbed domain/presentation concerns  |
| `src/sim` imports Phaser, React, browser APIs, or platform SDKs                           | Simulation portability and deterministic tests are broken          |
| `scene.ts` owns durable settings or save policy                                           | Renderer lifetime leaks into adapters/persistence                  |
| Menu screen duplicates authoritative Hero/loadout/health state and writes around commands | Local presentation mirror can drift from action-boundary snapshots |
| Content definitions import React/Lucide or hide game rules in artwork                     | Data and rules cannot be tested independently                      |
| New `*Manager`, `*Store`, or alternate command resolver for one flow                      | Parallel hub instead of extending the real owner                   |

Local React state for screen selection, focused card, dialog visibility, or
transient feedback is valid. It must not become canonical `GameState` or
replace the typed `gameSession.dispatch`/`performAction` path.

Read-only action-boundary snapshots may mirror simulation facts when captured
from `GameSession` and kept synchronized; they are not a second authority.
Roadmap-scoped UI fixture state is valid only when clearly marked as a fixture
and never written as canonical simulation state. Current inventory, equipment,
and tool surfaces are backed by the simulation snapshot and typed commands.

## Hard stops

- Do not move presentation into `src/sim`; simulation remains Phaser/React-free.
- Do not collapse intentional seams: seeded RNG and generation versioning,
  action-boundary snapshots, asset/codegen boundaries, or the React/Phaser
  presentation split.
- Do not add a second state library, event bus, or generic app controller to
  solve a single flow.
- Do not make `GameSession` own save schemas or provider storage. It may route
  the existing versioned save codecs through `SaveProvider` at action
  boundaries; new persistence behavior must follow those contracts.
- Do not turn a state-ownership finding into a duplicate-surface or token
  migration; route those findings to their owning audit.
- Pure `tileAt(seed, position)` terrain lookups or renderer caches are valid
  presentation reads; flag a scene only when it owns terrain generation,
  mutation, or rules rather than a deterministic lookup.

## Remedy preference

1. Classify canonical simulation facts, synchronized mirrors, and roadmap
   fixtures before moving anything; only the first belongs in the resolver.
2. Move pure rules/calculations into the matching `src/sim` module and route
   state changes through a typed `Command`/`applyCommand` result.
3. Keep `GameSession` thin: dispatch, subscribe, input mode, and small
   application-level convenience methods only; keep key decoding in
   `input-bindings.ts` and scene event ownership in `scene.ts`.
4. Keep UI-derived state in React and subscribe to action-boundary snapshots;
   use `src/game/presentation-settings.ts` for local display preferences.
5. Keep Phaser-only draw/tween orchestration in `scene.ts`; extract a pure
   helper to `src/game/` when it can be tested without Phaser.
6. Keep content data stable and framework-free. Add adapters at the platform
   boundary rather than scattering browser conditionals through rules.

## Known signals

Focused probes:

- `rg -n "from .*react|from .*phaser|from .*@base-ui|from .*lucide-react" src/sim src/content`
- `rg -n "gameSession\.state\." src/ui src/game`
- `rg -n "applyCommand|dispatch|performAction|equipAbility|setInputMode" src/ui src/game`
- React handlers that update a copy of Hero health, equipped abilities, or
  cooldowns without subscribing to the session or dispatching a typed command.
- `src/game/scene.ts` calculating damage, target legality, terrain generation,
  or inventory/equipment rules; a pure `tileAt` lookup/cache for drawing is not
  evidence of misplaced ownership.
- Browser preference writes in `src/sim`, or use of wall-clock time,
  `Math.random()`, or unstable iteration in gameplay code.
- New files named `*Manager`, `*Store`, `*Controller`, or `*Service` that own a
  single screen instead of extending the owner above.
- Tests whose setup imports the renderer to prove a simulation invariant, or
  E2E tests that compensate for missing command/session boundaries.

## Verification

After an ownership move, run the narrowest semantic-owner check (focused
Vitest, `npm run check:theme`, or the affected Playwright flow) and then run
`npm run verify` once for a cross-layer change. `verify` already includes
theme, typecheck, unit, build, and browser checks, so do not repeat its
constituent commands just to duplicate verification.

If a candidate is also a reachable twin, copied React surface, CSS/token issue,
side-effect lifetime issue, or ceremony/mass issue, route that independent
concern to `DualPathRetentionAudit`, `DuplicateFeatureSurfaceAudit`,
`DesignSystemConsistencyAudit`, `SideEffectSurfaceAudit`, or
`InelegantSlopAudit`; keep State Gravity responsible for canonical state and
owner placement.

For simulation moves, include fixed-seed outcomes and command/event assertions.
For UI moves, verify menu input-mode blocking, focus restoration, responsive
containment, and unchanged `data-testid`/accessible-name contracts. Report
which files were moved, which forwarding paths were deleted, and any durable
save or product ownership decision still open.
