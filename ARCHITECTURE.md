# Torch Architecture

This document describes the contracts that should remain stable as the game grows. It is intentionally more important than any individual framework API.

## Goals

- A hero-centric, turn/action-based simulation.
- Deterministic procedural generation that can be reproduced in tests.
- Multiple persistent world slots with world-local homesteads.
- Browser-first development with Steam desktop packaging first and mobile later.
- Offline-capable play with replaceable save providers.
- Agent-friendly, code-and-data-driven development without a bespoke editor.
- A 60 FPS floor where supported, with rendering decoupled from action resolution.

## Runtime layers

```text
Platform adapters
  local files, browser storage, cloud saves, lifecycle, input devices

Client
  Phaser scenes, camera, tile/chunk rendering, fog, audio, effects

Application UI
  React overlay, menus, panels, forms, accessibility, responsive layout

Application
  command routing, action queue, session orchestration, notifications

Simulation core
  rules, entities, AI, combat, gathering, crafting, quests, progression

Content and generation
  stable IDs, definitions, recipes, templates, seeded world/chunk generation
```

The simulation core must not import Phaser, browser APIs, Electron, Capacitor, or platform SDKs. The client sends commands to the simulation and renders the resulting events.

## Action economy

The game is discrete even when presentation includes movement or spell animations.

1. An input adapter produces a command such as `MoveNorth`, `Chop`, or `CastSpell`.
2. The simulation validates the command against the current state.
3. The command consumes one or more action units.
4. The Hero, nearby enemies, hazards, and other active actors resolve in deterministic order.
5. The simulation emits state changes and presentation events.
6. The client animates the result and accepts the next command.

Cardinal movement is the initial topology. A tap or click path is a sequence of one-tile movement commands; each step is revalidated so the player can reconsider after every tile and enemies can respond.

## World and chunks

Each world has:

- a stable `worldId`
- a world seed
- a generation/content version
- a Hero and homestead state
- generated baseline terrain and entities
- sparse mutations for player actions and persistent discoveries

The world is addressed with integer tile coordinates and chunk coordinates. Generation is a pure function of the seed, coordinate, and generation version. Chunks are loaded around the active Hero area; distant regions are dormant unless revisited.

Do not represent the infinite world as one giant array or create one rendering object for every possible tile. Render only visible/loaded chunks and keep the generated baseline separate from mutations.

The exact chunk dimensions and active radius are performance parameters to benchmark during Phase 1, not product rules.

## Rendering

- Use an orthographic square grid as the default presentation.
- Keep logical tile coordinates independent from device pixels.
- Render the Phaser canvas at the host device pixel ratio (capped at 2x) while keeping its CSS footprint responsive, so high-density displays do not soften artwork.
- Separate visual size, interaction footprint, collision footprint, and anchor point.
- Entity footprints are explicit data. A one-tile entity such as the Slime uses
  a 1×1 footprint; larger tokens render across their full footprint with
  rounded transparent corners so the underlying tiles remain barely visible.
- Render terrain, objects, actors, effects, and UI as distinct layers.
- Implement Torch visibility as a deterministic visibility/lit mask; presentation may add a lightweight tint, vignette, or post-process effect. Unexplored terrain uses a dark charcoal color, while remembered terrain retains a dimmed version of its generated tile color.
- Keep fog, weather, lighting, and spell effects incremental so static art remains useful.
- Use responsive camera and HUD layout rather than assuming a fixed orientation.
- Keep Phaser texture filtering smooth for painterly artwork; enable pixel-art sampling only for assets explicitly authored for that style.

The current Phase 1 presentation uses a Torch radius of 3 and derives the screen tile size from the shortest viewport dimension divided by seven. This keeps three tiles of lit distance reaching the screen edge while adapting to portrait and landscape layouts. Device pixels remain a presentation concern, not a simulation rule.

The simulation decides what is visible and lit. Phaser decides how that information is presented.

Visibility transition math is kept in the renderer-facing pure module
`src/game/visibility.ts`: it snapshots action-boundary visibility, compares
snapshots, and interpolates fog colors without importing Phaser. The scene owns
only the bounded draw and tween orchestration. A visibility-changing move first
renders the previous mask, then interpolates toward the new mask; it never
briefly draws the destination mask before the tween starts. When visibility is
unchanged, movement translates the existing board surface instead of rebuilding
its Graphics geometry; entity token geometry is rebuilt only when the tile scale
changes.

The game board is a full-screen Phaser canvas. Application UI mounts in a sibling `#ui-root` overlay owned by React. This keeps inventory, settings, quest journals, crafting, talents, equipment, and modal flows in semantic DOM while Phaser owns world-space presentation and effects. A component source system such as shadcn/ui may be added selectively for those screens, but it must not become the simulation authority.

The current UI exposes a compact, bottom-centered HUD rail: the Hero icon, HP bar, Inventory action, Equipment action, Abilities action, and Main Menu action. Opening the menu switches the session input mode to `ui`, preventing keyboard or pointer input from advancing the world while a menu is open. Because action resolution is turn-based, no separate real-time simulation pause is required.

The main menu is intentionally reserved for secondary destinations such as
Crafting, Journal, Talents, and Settings; Hero, Inventory, Equipment, and
Abilities are opened from their dedicated HUD actions. Hero details keep native-ratio art and Stats side
by side at every orientation and target no scrolling in normal device
viewports. Equipment and Abilities each have a dedicated centered screen with
compact slots. Slot selection replaces that screen's slot view with an inline
compatible-item or ability picker, so the player does not lose context by being
sent to a separate inventory flow. The three starter ability definitions use
stable IDs and native 3:4 art variants; gameplay effects and durable loadout
state remain simulation/save work.

## Input

All input surfaces produce the same command types:

- mouse click and drag
- touch tap and gesture
- keyboard shortcuts
- controller buttons and directional input

Input adapters must not mutate game state directly. Platform-specific layouts may differ, but they should route into the same command and action contracts.

The React UI may dispatch application commands through the session boundary, but React state is never the canonical `GameState`. UI updates should subscribe to action-boundary snapshots rather than polling or re-rendering on every Phaser frame.

## Persistence

Use separate, versioned save envelopes:

```text
ProfileSave
  meta-progression and account-wide unlocks

WorldSave
  seed, generation version, Hero, homestead, quests,
  discoveries, chunk mutations, and world-local progression
```

Save after completed action boundaries and important lifecycle events. A `SaveProvider` interface should support local storage first and platform providers later. Cloud storage is never authoritative for simulation rules; it stores portable save data and must tolerate fallback to local saves.

Cross-platform synchronization is optional. Platform-specific cloud saves should not be confused with a universal account backend.

## Content and generation

Heroes, classes, enemies, items, equipment, spells, abilities, recipes, quests, structures, and generation templates should be data-driven and referenced by stable IDs.

Enemy combat stance is modeled as an `EnemyDisposition`: `neutral` entities
remain passive until an action alerts them, while `hostile` entities can chase
and attack during the enemy response phase. The current slice includes a
neutral Forest Slime near the starting area. Context actions live in
`src/sim/actions.ts`: moving into a blocked adjacent entity resolves its
default action (attack, chop, or mine), while `availableActionsAt()` exposes a
typed list for future multi-action choice UI. Attacking sets an enemy's
`alerted` flag so a neutral enemy can respond on later action boundaries.
Primary attributes are typed in `src/sim/stats.ts` and use a shared
`PRIMARY_STAT_BUDGET` of 60 for Heroes and enemies.
The starting Knight definition is `14 / 10 / 14 / 12 / 10`; the Forest Slime
definition is `12 / 12 / 20 / 6 / 10`. Both totals are covered by fixed-seed
tests.

The current UI-only Inventory fixtures follow the same boundary in
`src/content/inventory.ts`: content stores stable IDs, category IDs, quantities,
descriptions, and presentation icon IDs, while React maps those icon IDs to
Lucide components. Content definitions do not import React or Lucide.

Terrain generation uses smooth seeded elevation fields and derives mountain
regions over a single vibrant grassland base. Seeded path bands keep grass
corridors open so mountain regions do not form traversal walls. Mountains are
impassable terrain and grass is walkable. Ore candidates are deterministic walkable tiles adjacent to
mountains; the initial ore node is materialized from that rule while broader
chunk/entity materialization remains future work. The spawn area is an authored
grassland safety ring so the first few actions remain readable.

Visibility transitions are rendered from immutable action-boundary snapshots. The
Torch level is interpolated per tile and staggered along the Hero's movement
vector, producing a directional reveal sweep for newly visible and remembered
tiles rather than recoloring the entire board at once.

Content definitions should be validated at load time. Procedural systems should compose authored definitions rather than hide important game rules in opaque generator logic. Generated output must record the seed and relevant version so failures can be reproduced.

## Art assets

Original artwork is stored under `Raw Assets/` and is treated as immutable source material. The Node/Sharp pipeline in `scripts/process-assets.mjs` generates web-ready variants under `public/assets/` and writes `public/assets/manifest.json`. A single source may produce multiple intentional variants, such as an original-ratio menu image and a focused square crop for compact UI or world presentation. Code references stable asset IDs and generated paths rather than importing raw files directly. The Slime source preserves the original Trinket HEIC and keeps a pipeline-compatible JPEG copy beside it because the local Sharp build cannot decode HEIC directly.

## Testing and determinism

- Unit-test the simulation without a renderer.
- Use fixed seeds for fixtures and regression cases.
- Record command transcripts for deterministic replay tests.
- Use Playwright for browser smoke flows and UI/input verification.
- Test save/load after every major action family.
- Keep performance fixtures for dense visible chunks, fog updates, pathing, and many nearby actors.
- Verify on real mobile hardware before making feel or performance claims.

Randomness inside the simulation must come from an injected, seeded source. Do not use `Math.random()` for game outcomes.

### Development performance diagnostics

In development builds, the client runs a lightweight frame monitor that samples browser `requestAnimationFrame` timing over a rolling two-second window. It reports average FPS, p50/p99 frame time, a 60 FPS one-percent-low estimate, frame-budget misses, stutters, Phaser loop delta, and the measured `scene.render` and `simulation` phases. A minimal current-FPS readout is visible in the upper-left corner and the latest snapshot is exposed as `window.__torchPerf` for browser automation.

The monitor also observes browser Long Tasks when the Performance Timeline supports them. A hitch is correlated with the longest measured phase, an overlapping Long Task attribution, the Phaser loop delta, or otherwise labeled as browser/OS/GPU/uninstrumented work. This is diagnostic evidence rather than proof of causality: GPU stalls, compositing, thermal throttling, browser scheduling, and work outside our instrumentation may still require Chrome DevTools Performance, Phaser renderer stats, and real-device profiling. The monitor is disabled in production builds.

The on-screen development affordance is intentionally only the current FPS number in the upper-left so it does not compete with the game view. Full rolling-window diagnostics remain in the console and `window.__torchPerf`.

### Asset and nearby-content warmup

The prototype does not currently stream or unload nearby art: the Knight texture is loaded during Phaser preload, and terrain plus simple entities are generated/drawn synchronously. Therefore a movement hitch at this stage is more likely to come from the immediate-mode Graphics redraw, browser scheduling/GC, renderer uploads, or development tooling than from an asset being fetched as it enters the view. The render loop now prewarms a one-ring margin of deterministic terrain and keeps entity tokens in their own presentation layer. During a tile tween, the board is translated as one surface and every entity token is repositioned from its previous tile to its new tile. When Torch visibility changes, the board performs a bounded redraw for the same 180 ms movement window so unexplored, remembered, and fully lit tile colors interpolate instead of snapping; when visibility is unchanged, no per-frame board redraw is needed.

As content grows, movement must never be the first place an asset is requested. The loading flow should build a manifest for all static art, fonts, audio, and UI textures needed for the first playable area and warm those assets behind an explicit loading screen. Deterministic terrain/chunk data should be memoized by `seed + generationVersion + chunkKey`; a small ring of chunks around the Hero should be generated and validated ahead of the active view, with the next ring expanded during idle time. Rendering should reuse pooled sprites/graphics objects and update visibility rather than create/destroy objects during a tile move. This preserves the user's preferred one-time startup cost while keeping future streaming bounded and deterministic.

## Packaging

Development and browser testing use the Phaser web client directly. Steam packaging is a later desktop shell over the same client, initially biased toward runtime parity with the browser. Mobile packaging follows after Steam using a native web runtime layer.

Keep platform SDK calls behind adapters so the simulation and save format remain portable.

## Open implementation choices

These do not block the architecture and should be resolved through the vertical slice:

- exact chunk dimensions and active simulation radius
- tile pixel dimensions and art atlas conventions
- desktop shell choice for Steam
- local storage format for browser saves
- platform cloud-provider details
- animation/effect budget on target devices
- authored versus templated content ratios
