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
- [x] Add first-pass Settings plus dedicated Hero, consolidated Inventory/Gear/Tools, and Ability screens.
- [x] Add a read-only explored-terrain Map screen with a relative Hero marker.
- [x] Add native-ratio Bash, Sunder, and Avatar ability artwork to the asset pipeline.
- [x] Add a minimal asset/content manifest convention.
- [x] Document the development verification workflow and deterministic replay contract.

## Phase 1 — First playable vertical slice

- [x] Generate a deterministic world around a Hero spawn point.
- [x] Render an orthographic grid with responsive resizing.
- [x] Reveal a Torch-centered visibility radius through fog of war.
- [ ] Move cardinally by mouse, touch, keyboard, and a basic controller mapping.
- [x] Resolve one action per tile and pause after every tile.
- [x] Add disposition-driven enemy response after the Hero.
- [x] Add one tree, one ore node, and basic gathering actions.
- [x] Resolve context actions for blocked movement (attack, chop, and mine).
- [x] Make resource gathering a single Chop/Mine action (with a configurable cost field retained for future work actions).
- [x] Add a contextual Action Hand with responsive 3:4 cards for gathering and combat.
- [x] Add typed starter ability actions with cooldowns and deterministic combat resolution.
- [x] Add a simple homestead location and bound respawn point.
- [x] Add seeded grassland with interactive tree groves, clear traversal corridors, bright mountain regions, and ore on every walkable mountain neighbor.
- [ ] Save, reload, die, and respawn deterministically.
- [ ] Run the same seed and command transcript in automated tests.

## Phase 2 — Core survival and homestead loop

- [ ] Inventory, equipment state, item stacking, and encumbrance (the current React inventory/loadout surfaces are prototypes only).
- [ ] Crafting with data-driven recipes.
- [ ] Homestead building placement, farms, storage, and basic production.
- [ ] Time-of-day presentation and lightweight weather effects.
- [ ] Pets with follow, wait, interact, and simple combat behavior.
- [ ] World-local quests and discovery tracking.
- [ ] Durable versioned save envelopes with local fallback.

## Phase 3 — RPG depth

- [ ] Hero classes and class-specific starting choices.
- [ ] Experience, levels, attributes, spells, and expanded abilities (starter ability effects and cooldowns exist; progression and durable loadout saves remain).
- [ ] Equipment progression, enchantments, and item identification where appropriate.
- [ ] More enemies, hazards, resources, and environmental interactions.
- [ ] Hand-authored quests and mystery content.
- [ ] Template-driven or semi-randomized radiant quests.
- [ ] Dungeon generation and dungeon-specific rules.

## Phase 4 — Replayability and meta-progression

- [ ] Profile-level meta-progression separate from world saves.
- [ ] Unlockable Hero classes, recipes, abilities, and content families.
- [ ] New world seeds and biomes with meaningful variation.
- [ ] Run/world summaries and discovery history.
- [ ] Balance passes that preserve old worlds as safely as practical.
- [ ] Optional platform cloud-save providers with local fallback.

## Phase 5 — Steam release candidate

- [ ] Package the browser client as a desktop Steam build.
- [ ] Verify keyboard, mouse, controller, window resizing, and high-refresh rendering.
- [ ] Add Steam Cloud support if the save provider is stable.
- [ ] Test clean installs, interrupted saves, corrupted saves, and upgrades.
- [ ] Profile representative worlds on supported desktop hardware.
- [ ] Add store assets, onboarding, accessibility review, and release telemetry only if needed.

## Phase 6 — Mobile release

- [ ] Package the same client for iOS and Android.
- [ ] Validate touch targeting, safe areas, portrait/landscape layouts, and suspend/resume.
- [ ] Profile on recent and lower-end target devices.
- [ ] Add platform cloud providers where useful.
- [ ] Complete store-specific compliance, entitlement, and lifecycle work.

## Explicit non-goals for the initial architecture

- Multiplayer or shared online worlds
- A fully simulated civilization-scale history
- Permanent death as the default progression model
- Modding support
- A bespoke game-design editor
- A requirement to preserve every old save across every rules change

## Current next milestone

Implement Phase 1 as one end-to-end slice before adding broad content. The slice should prove that movement, visibility, nearby simulation, procedural generation, saving, and browser automation work together.
