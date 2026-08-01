# Torch Architecture

This document records the boundaries that should remain stable as Torch grows.
Current feature behavior belongs in code, tests, and the roadmap.

## Goals

- A hero-centric, turn/action-based game.
- Reproducible procedural generation and simulation.
- Persistent worlds with world-local progression.
- Browser-first development, followed by a desktop shell and later mobile.
- Offline play with replaceable save providers.
- Rendering that stays responsive without coupling frame rate to game rules.

## Runtime boundaries

```text
Platform adapters
  storage, cloud saves, lifecycle, input devices

Phaser client
  scenes, camera, world rendering, audio, effects

React UI
  HUD, menus, dialogs, forms, accessibility

Application
  command routing, action queue, session orchestration

Simulation
  rules, entities, combat, gathering, crafting, progression

Content and generation
  stable IDs, definitions, recipes, seeded world generation
```

The simulation must not import Phaser, React, browser APIs, or platform SDKs.
Clients submit typed commands and render the resulting state and events. React
state is never the canonical game state.

## Turns and commands

Torch is discrete even when presentation is animated:

1. An input adapter submits a typed command.
2. The simulation validates and resolves it deterministically.
3. Turn-consuming commands advance active actors in a stable order. State-only
   commands may change loadouts or similar configuration without advancing time.
4. The simulation returns the next state and presentation events.
5. The client presents the result before accepting the next command.

Cardinal movement is one tile per command. A longer path is a sequence of
individually validated moves so the player and nearby actors can respond after
each step. Presentation-only actions such as opening a menu do not need
simulation commands.

## World model and determinism

Each world has a stable ID, seed, generation/content version, Hero and homestead
state, generated baseline, and sparse persistent mutations. World generation is
a pure function of versioned inputs and coordinates.

Only the chunks intersecting a bounded tile window around the Hero are active.
Generated entities dehydrate when they leave that window and deterministically
rehydrate from the seed plus sparse removal and gathering-progress mutations.
Position and chunk indexes cover only materialized entities and are derived,
never saved. Keep generated terrain and entities separate from player changes
so distant regions can be recreated rather than stored wholesale.

Simulation randomness comes from an injected seeded source. Game outcomes must
not depend on `Math.random()`, wall-clock time, random IDs, or unstable iteration
order. Reproduction data includes the seed, relevant versions, coordinates, and
command sequence.

## Presentation

Phaser owns the world canvas; React owns semantic application UI in the sibling
`#ui-root` overlay. React UI requests commands through the session boundary and
subscribes to action-boundary state rather than polling each frame.

Torch keeps world positions and board geometry in logical CSS-pixel units. The
Phaser presentation layer may render into a denser device-pixel backing surface,
but DPR is applied only by the scale/camera bridge and Phaser's input transform;
it must not leak into simulation coordinates, React layout, or board-anchor math.
Resize and device-pixel-ratio changes update the backing surface, camera
projection, and pointer conversion as one coalesced presentation update.

Keep logical tile coordinates independent from device pixels. Use Phaser's
container-aware scale contract and the presentation resize bridge to keep
canvas sizing responsive while backing density changes. Rendering may
interpolate between action-boundary snapshots, but it must not invent gameplay
state or rules.

Visibility is determined by the simulation and presented by Phaser. Terrain,
objects, actors, fog, effects, and UI should remain separable enough to update
bounded work without rebuilding the whole scene. Prefer simple cached or pooled
rendering when profiling shows it is needed; do not add a specialized rendering
path preemptively.

The browser entry point constructs and hydrates one `GameRuntime` before mounting
React or Phaser. Both clients receive that runtime through their composition
boundary; feature modules do not import a process-global session. The runtime
exposes read-only action-boundary snapshots, action batches, typed command
dispatch, and input mode. Persistence codecs and providers remain private to the
application/platform boundary.

The React Action Hand captures an immutable card-animation snapshot immediately
before dispatching an action. The snapshot owns the stable presentation key,
target tile, camera position, target label, source geometry, and selected source
preset; the simulation also includes the target name in its action-boundary
events before a gatherable or defeated enemy is removed. This keeps card copy
truthful while the result is presented. The active card keeps its stable keyed
DOM node and moves through a presentation-only `data-card-animation-phase`
transition. The hand has one renderer and two typed source bundles: Trinket
owns the spring fan, held-card tilt, staggered draw, and dissolve cast; Alchemy
owns the precise hover fan, 3D draw/discard flips, and target-travel ghost.
The animation layer may use visual draw/discard anchors, but it never adds deck
state or gameplay semantics to the simulation.

Development builds expose a temporary Card Animation Lab with exactly two
presentation-only presets (`trinket` and `alchemy`). It selects the complete
hand, hover, reflow, draw, discard, and play behavior for the real Action Hand,
not a second replay engine. The lab never changes simulation rules, persistence,
or production UI.

Use smooth filtering for painterly artwork and pixel sampling only for assets
authored for it. The Gold/Charcoal palette applies to UI chrome and board
scaffolding, not to semantic game-content colors.

Menus switch the session to UI input mode so world input cannot advance the
simulation while an overlay is active. Turn-based play needs no separate
real-time pause loop.

## Input

Mouse, touch, keyboard, and controller adapters may differ in layout, but they
route into the same command contracts and never mutate game state directly.
Platform-specific behavior stays behind adapters.

## Persistence

Keep profile-wide and world-local projections separate inside one transactional,
versioned bundle:

```text
SaveBundle
  revision, projection versions, generation version, and integrity metadata
  ProfileSave
    account-wide unlocks and meta-progression
  WorldSave
    seed and versions, Hero, homestead, quests, discoveries, and mutations
```

Save portable state, not generated data that can be reproduced from its inputs.
The application captures both projections at one action boundary and queues one
bundle commit. Writes prevent older asynchronous snapshots from replacing newer
ones. The local provider uses verified primary, temporary, and last-known-good
backup envelopes; invalid bytes are retained for diagnostics. Storage failures
do not invalidate the running simulation.
Cloud storage is an optional provider, not an authority for game rules.

Schema changes require an explicit version and migration or a deliberate reset
decision. During early development, unsupported older world-save schemas may
deliberately start a fresh deterministic world. The application migrates the
legacy independent local world/profile keys into a bundle without deleting the
source payloads. Keep profile progression separate from world-local state.

## Content and assets

Heroes, enemies, items, equipment, abilities, recipes, quests, structures, and
generation templates are data-driven and referenced by stable IDs. Validate
content at load time, and keep content definitions independent of React.

Original artwork lives under `Raw Assets/`. `scripts/process-assets.mjs`
generates web variants and `public/assets/manifest.json`; code references
stable asset IDs and generated paths. Crops are intentional named variants
rather than incidental CSS distortion.

## Testing and packaging

Test the simulation headlessly with fixed seeds. Use browser tests for UI and
input journeys, and round-trip tests for saves. Measure rendering performance in
representative dense scenes and on relevant hardware before changing the
architecture around a suspected bottleneck.

The browser client is the reference runtime. Desktop and mobile packaging wrap
the same client, with platform SDKs and save providers behind adapters so the
simulation and save format stay portable.
