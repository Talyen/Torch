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

1. An input adapter produces a typed command such as movement, gathering, an
   explicit action, waiting, or an out-of-turn loadout change.
2. The simulation validates the command against the current state.
3. Turn-consuming commands consume one or more action units; state commands
   such as equipping an ability update the cloned state without advancing the
   turn or running enemy responses.
4. The Hero, nearby enemies, hazards, and other active actors resolve in
   deterministic order for turn-consuming commands.
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
- Keep the Gold/Charcoal design-system palette scoped to UI chrome and board
  presentation scaffolding. `src/game/presentation-colors.ts` bridges the
  shared background, fog, and grid tokens into Phaser; terrain, entities,
  resources, HP feedback, and authored artwork retain their semantic content
  colors.

The current Phase 1 presentation uses a Torch radius of 3 and derives the screen tile size from the shortest viewport dimension divided by seven. This keeps three tiles of lit distance reaching the screen edge while adapting to portrait and landscape layouts. Device pixels remain a presentation concern, not a simulation rule.

The simulation decides what is visible and lit. Phaser decides how that information is presented.

Visibility transition math is kept in the renderer-facing pure module
`src/game/visibility.ts`: it snapshots action-boundary visibility, compares
snapshots, and interpolates fog levels without importing Phaser. The scene owns
only the bounded draw and tween orchestration. A visibility-changing move first
renders the previous mask, then interpolates toward the new mask; it never
briefly draws the destination mask before the tween starts. Terrain is rendered
as a cached base layer and a dedicated Phaser fog container holds a small pool
of stable rectangle tiles for the charcoal overlay. The pool updates position,
alpha, and optional grid stroke in place; it does not clear and rebuild display
list geometry during a reveal. This deliberately favors a readable, tile-aligned
edge over unstable sub-tile gradients or a WebGL-only filter. Terrain geometry
is rebuilt only when the camera tile, viewport, tile size, seed, or grid
preference changes; the fog tile pool is reused for every frame. Both layers
cover only the viewport plus a one-tile margin, so the fixed-size generated-
entity ring is not mistaken for a second visibility or world-streaming
authority. The optional Show Grid presentation preference is a browser-side
setting and never enters simulation
state.

The game board is a full-screen Phaser canvas. Application UI mounts in a sibling `#ui-root` overlay owned by React. This keeps inventory, settings, quest journals, crafting, talents, equipment, and modal flows in semantic DOM while Phaser owns world-space presentation and effects. Base UI supplies the accessible interaction behavior for complex React patterns, while the checked-in shadcn source components in `src/components/ui` provide the shared styled layer. Screens consume those through the Torch-owned wrappers in `src/ui/primitives.tsx`; neither layer may become the simulation authority or own game-content layout decisions.

The current UI exposes a compact, bottom-centered HUD rail: the Hero icon, HP bar, Inventory action, Equipment action, Abilities action, and Main Menu action. Inventory is an items-only surface; Equipment is a dedicated surface with native-ratio hero art, paper-doll equipment, a single-row jewelry cluster, and a single-row tool loadout (including Hammer and Shovel). The Main Menu is an opaque, icon-first grid of secondary destinations and includes Map; the Map screen can also be opened with the configurable Map binding (M by default). The Map screen fills its dominant viewport with a responsive framed map of square cells, expanding the rendered bounds with unexplored cells whenever the explored bounds do not match the viewport aspect ratio, and keeps a minimum-size Hero token at the Hero's world-relative position; it is a presentation surface over `GameState.revealedTiles`, not a second map authority. Opening the menu switches the session input mode to `ui`, preventing keyboard or pointer input from advancing the world while a menu is open. Because action resolution is turn-based, no separate real-time simulation pause is required.

The gameplay HUD also exposes a contextual Action Hand anchored to the HP rail. Cards fan upward from behind the rail, with their lower edge tucked beneath the toolbar so the rail remains the readable foreground surface. `src/sim/context-actions.ts` projects one focused adjacent target into stable, typed cards: ready equipped abilities for enemies and entity actions such as Chop or Mine for gatherables. Cooldown abilities are omitted from the hand rather than shown as translucent disabled cards. `src/ui/context-action-hand.tsx` owns only the responsive DOM presentation: 3:4 artwork, dynamic fan geometry, hover/focus/press/drag states, reflow motion, and action callbacks. Card identity is keyed to the ability or action type rather than the current target, so retargeting an unchanged ability card does not replay its entrance animation; genuinely new cards animate as a reflow. The animation is driven by the typed `ability-used` and `action-resolved` events, so clicked actions and default actions triggered by blocked movement receive the same feedback. A played card hands off to a transient ghost that travels toward the board before the replacement card reveals. The hand is hidden while menus are open and never replaces the simulation's blocked-movement default action.

The main menu is intentionally reserved for secondary destinations such as
Map, Crafting, Journal, Talents, and Options; Hero, Inventory, Equipment, and
Abilities are opened from their dedicated HUD actions.
Options uses behavior-backed sections for Display, Audio, Gameplay, Controls,
and Accessibility. Presentation preferences are persisted by the client in
`src/game/presentation-settings.ts`; simulation rules remain independent of
those settings.
Rebindable keyboard actions are stored by the client input adapter in
`src/game/input-bindings.ts`; Escape remains reserved for dismissal and is not
rebindable. Hero details keep native-ratio art and a single-column Stats list in
an equal side-by-side pane at every orientation and target no scrolling in
normal device viewports. Equipment presents large, subtly blurred and dimmed
native-ratio Hero art as the surface background, with equal square slots
overlaid in paper-doll rows: Helm; Main Hand/Body/Off-Hand; Gloves/Belt/Boots;
then Jewelry and Tools rows. The four jewelry slots are Amulet, Trinket, Ring,
Ring, and the tool row is Axe, Pickaxe, Hammer, Shovel.
Clicking a gear or tool slot or an ability card transitions to a dedicated
selector submenu with a grid of compatible artwork; choosing an item immediately
returns to the loadout. The three starter ability definitions use stable IDs and
native 3:4 art variants; their effects and loadout changes resolve through typed
simulation commands. Durable save serialization for that state remains future
work.

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
`src/sim/actions.ts` and `src/sim/context-actions.ts`: moving into a blocked
adjacent entity resolves its default action (attack, chop, or mine), while the
context projection exposes a typed list for the React Action Hand. Abilities
are also typed simulation actions with stable IDs, data-driven damage, effect,
and cooldown rules in `src/sim/ability-rules.ts`, and Hero loadout / cooldown
state. Basic abilities have no cooldown, Skills have a three-action cooldown,
and Ultimates have a six-action cooldown. When a blocked move targets an enemy,
the default shortcut chooses the strongest ready equipped ability in Ultimate >
Skill > Basic order before falling back to Attack. Bash applies a one-action
stun, Sunder halves the target's Block pool after dealing damage, and Avatar
records Holy damage equal to the Hero's current Block for two actions. The
session routes loadout changes through the same command resolver without
consuming a turn. Attacking or using an ability sets an enemy's `alerted` flag so
a neutral enemy can respond on later action boundaries. The React Abilities
screen keeps click as loadout selection and uses a 520 ms pointer hold to open
an accessible full-art detail dialog.
Primary attributes are typed in `src/sim/stats.ts` and use a shared
`PRIMARY_STAT_BUDGET` of 60 for Heroes and enemies.
The starting Knight definition is `14 / 10 / 14 / 12 / 10`; the Forest Slime
definition is `12 / 12 / 20 / 6 / 10`. Both totals are covered by fixed-seed
tests.

The current UI-only Inventory fixtures follow the same boundary in
`src/content/inventory.ts`: content stores stable IDs, category IDs, quantities,
descriptions, and presentation icon IDs, while React maps those icon IDs to
Lucide components. Content definitions do not import React or Lucide.

Terrain generation uses smooth seeded elevation fields over a single vibrant
grassland base. Mountains are impassable terrain. Forests are not terrain kinds:
seeded grove signals materialize bounded, interactive tree entities on grass,
while path bands stay clear so groves leave traversal routes between them. Every
walkable tile directly adjacent to a mountain is an ore candidate; the initial
ore node is materialized from that rule while broader chunk/entity materialization
remains future work. Generated trees are pruned outside the active Hero ring and
chopped trees are retained as sparse removal mutations. The spawn area is an
authored grassland safety ring so the first few actions remain readable.

Visibility transitions are rendered from immutable action-boundary snapshots. The
Torch level is interpolated per tile and staggered along the Hero's movement
vector, producing a directional reveal sweep for newly visible and remembered
tiles rather than recoloring the entire board at once. The scene gives the
movement-linked sweep a slightly longer presentation window and updates the
pooled fog rectangles in place. Entity tokens derive eased alpha from that same
interpolated level and remain mounted while transparent, so a newly revealed
tree or ore node dissolves in without display-list visibility churn or a
one-frame pop. The homestead remains in simulation state as the
bind/respawn location but is intentionally not rendered as a world-space marker
until a player-facing indicator is designed.

Gathering is also action-economy state, not a rendering shortcut. Trees and ore
carry a configurable `gatheringActionCost` plus mutable
`remainingGatheringActions`; the current defaults resolve Chop and Mine in one
turn and immediately grant the resource. The fields remain in the state shape
so a future work action can add staged gathering without changing command or
save contracts.

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

The prototype does not currently stream or unload nearby art: the Knight texture is loaded during Phaser preload, and terrain plus simple entities are generated/drawn synchronously. Therefore a movement hitch at this stage is more likely to come from the immediate-mode Graphics redraw, browser scheduling/GC, renderer uploads, or development tooling than from an asset being fetched as it enters the view. The render loop prewarms a one-ring margin of deterministic terrain and keeps entity tokens in their own presentation layer. During a tile tween, the cached board and fog surfaces are translated as one bounded viewport while every entity token is repositioned from its previous tile to its new tile. Terrain geometry is redrawn once when the camera tile changes; fog geometry is redrawn only for the visibility transition or a changed presentation key. A full RenderTexture or custom shader mask is intentionally deferred: the active presentation ring is fixed and small, so a GPU mask would add a WebGL-only path without reducing the current bounded work.

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
