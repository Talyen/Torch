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

> Foundation work is complete; the remaining work below is the active Phase 1
> vertical slice. The heading is retained so the historical foundation scope
> remains visible while the roadmap wording is consolidated.

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

## Phase 2 — Core survival and homestead loop

- [x] Canonical inventory projection, item stacking, and a first data-driven crafting slice for gathered materials and consumables.
- [ ] Equipment/loadout state, encumbrance, and station-gated or equipment crafting (the remaining React gear surface is still a prototype).
- [ ] Homestead building placement, farms, storage, and basic production.
- [ ] Time-of-day presentation and lightweight weather effects.
- [ ] Pets with follow, wait, interact, and simple combat behavior.
- [x] World-local quests, mystery clues, waypoint targets, and Journal progress tracking.
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

- [x] Profile-level Journal onboarding milestones and rewards separate from world saves.
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

Complete the remaining Phase 2 survival loop around the Journal slice: equipment/loadouts, homestead production, and station-aware content while preserving deterministic saves and browser coverage.

## Deferred plan follow-ups

The completed Tech Stack and UI/UX plans are archived under `Plans/Completed/`.
The following items remain intentionally deferred because they require a
separate product decision, a broader cleanup slice, or release-specific
validation rather than a safe incremental change during the current Journal
work:

### Persistence, release, and verification

- Define the save-recovery contract for interrupted writes, last-known-good
  snapshots, migration policy, and multiple world slots before implementing
  those behaviors.
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

### UI/UX follow-ups

- Consolidate the historical duplicate CSS cascade and complete the feature
  token/color audit without mixing it into active Journal/Profile work.
- Finish the visual review of action-hand fan layouts, board framing, Hero and
  equipment hierarchy, ability detail affordances, and large explored-map
  scaling at all four required viewports.
- Decide whether fixed-shell whitespace is intentionally theatrical, and set
  the final Map frame grammar and disabled-destination product copy.
- Add screenshot/geometry coverage for every menu surface, focus restoration
  path, reduced-motion state, and short-viewport safe-area combination after
  the current broad browser smoke flow is split by ownership.
