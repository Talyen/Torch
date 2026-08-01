# Torch Roadmap

This roadmap is deliberately staged around playable risk. Each phase should leave behind a running, testable game rather than a large collection of disconnected systems.

## Product principles

- Prefer a small number of coherent systemic rules over many one-off exceptions.
- Keep the Hero's immediate decisions interesting before expanding world scale.
- Make procedural output reproducible from a seed and generation version.
- Treat mobile and desktop as different input/layout surfaces over the same simulation.
- Add content only after the underlying interaction is observable, saveable, and testable.

## Phase 0 — Foundation (current)

- [x] Create the public GitHub repository.
- [x] Record the product vision and technical direction.
- [x] Choose Phaser + TypeScript.
- [x] Scaffold the browser client and TypeScript packages.
- [x] Add a deterministic random-number and coordinate utility layer.
- [x] Establish a headless simulation test harness.
- [x] Establish browser smoke testing with Playwright.
- [x] Add a responsive React UI overlay shell with a minimal menu.
- [x] Add a UI-only Inventory prototype with category tabs, sorting, square item cells, and Item Detail.
- [x] Add first-pass Options plus dedicated Hero, consolidated Inventory/Gear/Tools, and Ability screens.
- [x] Add a read-only explored-terrain Map screen with a relative Hero marker.
- [x] Add native-ratio Bash, Sunder, and Avatar ability artwork to the asset pipeline.
- [x] Add a minimal asset/content manifest convention.
- [x] Document the development verification workflow and deterministic replay contract.
- [ ] Add content and schema validation for stable IDs, orphaned references, and generated test fixtures.
- [ ] Add save fault-injection coverage for interrupted writes, corrupted envelopes, last-known-good recovery, and migrations.
- [ ] Add seed/replay export and import, including a small developer state and event inspector.
- [ ] Establish shared contracts for input rebinding, audio, haptics, reduced motion, and larger text.

> The initial foundation slice is complete; these hardening items remain while
> the active Phase 1 vertical slice progresses. The heading is retained so the
> historical foundation scope remains visible while the roadmap wording is
> consolidated.

## Phase 1 — First playable vertical slice

- [x] Generate a deterministic world around a Hero spawn point.
- [x] Render an orthographic grid with responsive resizing.
- [x] Reveal a Torch-centered visibility radius through fog of war.
- [x] Move cardinally by mouse, touch, keyboard, and a basic controller mapping.
- [x] Resolve one action per tile and pause after every tile.
- [x] Add disposition-driven enemy response after the Hero.
- [x] Add one tree, one ore node, and basic gathering actions.
- [x] Resolve context actions for blocked movement (attack, chop, and mine).
- [x] Make resource gathering a single Chop/Mine action (with a configurable cost field retained for future work actions).
- [x] Add a contextual Action Hand with responsive 3:4 cards for gathering and combat.
- [x] Add typed starter ability actions with cooldowns and deterministic combat resolution.
- [x] Add a simple homestead location and bound respawn point.
- [x] Add seeded grassland with interactive tree groves, clear traversal corridors, bright mountain regions, and ore on every walkable mountain neighbor.
- [x] Save, reload, die, and respawn deterministically.
- [x] Run the same seed and command transcript in automated tests.
- [ ] Add a short First Light onboarding expedition that teaches Torch visibility, one-tile turns, context actions, combat, gathering, and returning home.
- [ ] Add a universal Inspect/Examine action for tiles, creatures, resources, hazards, and discovered lore.
- [ ] Add a simple rest or camp interaction plus a post-expedition report for loot, discoveries, damage, and new Journal entries.
- [ ] Add minimum audiovisual feedback for turn resolution, enemy response, blocked movement, damage, gathering, and death.

## Phase 2 — Core survival and homestead loop

- [x] Canonical inventory projection, item stacking, and a first data-driven crafting slice for gathered materials and consumables.
- [x] Simulation-backed equipment/tool loadout state, station-gated crafting, and the canonical React Gear surface (inventory remains unlimited).
- [ ] Homestead building placement, farms, storage, and basic production.
- [ ] Time-of-day presentation and lightweight weather effects.
- [ ] Pets with follow, wait, interact, and simple combat behavior.
- [x] World-local quests, mystery clues, waypoint targets, and Journal progress tracking.
- [x] Versioned `WorldSave`/`ProfileSave` envelopes with a local provider (recovery, migration, and provider hardening remain future work).
- [ ] Materialize world chunks and nearby entities with deterministic sleep/wake rules and sparse persistent mutations.
- [ ] Add a visible homestead upgrade graph with repaired rooms, station dependencies, storage expansion, and production improvements.
- [ ] Add renewable resource and production cadence such as crop cycles, regrowing nodes, and fuel or other recurring resource sinks.
- [ ] Add a lightweight economy for trading, selling surplus, purchasing seeds or tools, and optionally recruiting a specialist.
- [ ] Add a death-aftermath mechanic such as a recoverable expedition pack or last-known-location marker.
- [ ] Add pet bonding and training progression beyond follow, wait, interact, and combat.
- [ ] Decide whether survival includes one restrained pressure such as fatigue or exposure; avoid a full hunger/thirst stack unless the core loop needs it.

## Phase 3 — RPG depth

- [ ] Hero classes and class-specific starting choices.
- [ ] Experience, levels, attributes, spells, and expanded abilities (starter ability effects and cooldowns exist; progression remains, while current loadouts persist through `WorldSave`).
- [ ] Equipment progression, enchantments, and item identification where appropriate.
- [ ] More enemies, hazards, resources, and environmental interactions.
- [ ] Hand-authored quests and mystery content.
- [ ] Template-driven or semi-randomized radiant quests.
- [ ] Dungeon generation and dungeon-specific rules.
- [ ] Define a world arc or victory condition that culminates in a major threat, dungeon, or transformation of the world.
- [ ] Add status effects, resistances, enemy abilities, and readable combat counterplay.
- [ ] Add factions, NPC relationships, reputation, and consequential dialogue or quest outcomes.
- [ ] Add stronger Hero identity through passive choices, training, respec decisions, or class-specific interactions.
- [ ] Add pet or companion progression with tactical roles.
- [ ] Add elite enemies, bosses, and landmark encounters.
- [ ] Add a bestiary and discovery codex tied to the existing Journal.

## Phase 4 — Replayability and meta-progression

- [x] Profile-level Journal onboarding milestones and rewards separate from world saves.
- [ ] Unlockable Hero classes, recipes, abilities, and content families.
- [ ] New world seeds, biome archetypes, rare landmarks, and world rules with meaningful variation.
- [ ] Add run/world summaries, a discovery atlas, and an archive of major events, deaths, completed objectives, and abandoned worlds.
- [ ] Balance passes that preserve old worlds as safely as practical.
- [ ] Optional platform cloud-save providers with local fallback.
- [ ] Add run/world contracts or modifiers that change strategic priorities.
- [ ] Add shareable deterministic challenge seeds, including optional daily or weekly-style challenges.
- [ ] Add a profile-level meta hub that explains unlocks and prevents excessive replay grind.
- [ ] Add a retire or archive flow so completing or abandoning a world has a satisfying endpoint.

## Phase 5 — Steam release candidate

- [ ] Package the browser client as a desktop Steam build.
- [ ] Verify keyboard, mouse, controller, window resizing, and high-refresh rendering.
- [ ] Add Steam Cloud support if the save provider is stable.
- [ ] Test clean installs, interrupted saves, corrupted saves, and upgrades.
- [ ] Profile representative worlds on supported desktop hardware.
- [ ] Add store assets, onboarding, accessibility review, and release telemetry only if needed.
- [ ] Verify Steam Deck and Big Picture behavior.
- [ ] Add Steam achievements, statistics, and optional Rich Presence.
- [ ] Add controller remapping, controller glyphs, and reliable focus and pause behavior.
- [ ] Add save backup/export and clear cloud-conflict resolution.
- [ ] Add first-run onboarding, graphics and performance settings, and a privacy-conscious diagnostics path.
- [ ] Add localization readiness, including font fallback and text-expansion testing.
- [ ] Complete accessibility review for keyboard, controller, contrast, motion, focus, and screen-reader-adjacent behavior.

## Phase 6 — Mobile release

- [ ] Package the same client for iOS and Android.
- [ ] Validate touch targeting, safe areas, portrait/landscape layouts, and suspend/resume.
- [ ] Profile on recent and lower-end target devices.
- [ ] Add platform cloud providers where useful.
- [ ] Complete store-specific compliance, entitlement, and lifecycle work.
- [ ] Make autosave transactional across backgrounding, suspension, termination, and interrupted resume.
- [ ] Add touch-first interactions such as tap targeting, hold-to-inspect, drag or gesture alternatives, and one-handed layouts.
- [ ] Add haptics and audio-session interruption handling.
- [ ] Set battery, thermal, memory, and asset-cache budgets.
- [ ] Support VoiceOver/TalkBack, Dynamic Type, larger touch targets, reduced motion, and color or contrast needs.
- [ ] Validate phone, tablet, and foldable layouts.
- [ ] Support offline resume plus account or cloud restore and conflict handling.

## Explicit non-goals for the initial architecture

- Multiplayer or shared online worlds
- A fully simulated civilization-scale history
- Permanent death as the default progression model
- Modding support
- A bespoke game-design editor
- A requirement to preserve every old save across every rules change

## Current next milestone

Complete the remaining Phase 2 survival loop around the Journal slice: homestead
production, chunk/entity materialization, save-provider hardening, and profile
progression while preserving deterministic saves and browser coverage.

## Deferred plan follow-ups

The completed Tech Stack and UI/UX plans are archived under `Plans/Completed/`.
The following items remain intentionally deferred because they require a
separate product decision, a broader cleanup slice, or release-specific
validation rather than a safe incremental change during the current Journal
work:

### Persistence, release, and verification

- Define the save-recovery contract for interrupted writes, last-known-good
  snapshots, migration policy, and multiple world slots before implementing
  recovery, migration, backup, or multi-slot behavior.
- Choose the desktop shell, native lifecycle/filesystem adapter contract, and
  whether cloud saves or telemetry are release requirements.
- Add a scheduled browser matrix for Mobile Chrome and WebKit after supported
  browser policy and CI installation cost are approved.
- Add a true property-based generator suite and fixed-seed presentation
  performance fixtures with agreed p99, one-percent-low, long-task, and render
  time budgets. The current invariant matrix and coverage report are baseline
  signals, not release gates.
- Incrementally enable the remaining strict TypeScript flags after deciding
  whether the resulting indexed-map/test cleanup belongs in one hardening
  slice or several module-owned changes.
- Produce bundle composition reports and per-asset/freshness budgets once the
  initial-load budget and authored-output policy are agreed.
- Split the remaining `menu-overlay.tsx`, `scene.ts`, and `styles.css`
  ownership hotspots after the current Journal/Profile slice stabilizes.
