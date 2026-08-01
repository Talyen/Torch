# Torch

Torch is an agent-built, top-down, grid-based fantasy RPG and survival-crafting game.

You control one Hero exploring procedurally generated worlds one tile-action at a time. Your Torch reveals the nearby world through fog of war. You can fight, gather, craft, build a homestead, raise pets, learn abilities, solve mysteries, and return from death to a bound location without losing your world by default.

Torch combines:

- NetHack-inspired action economy, discovery, and systemic interactions
- Dwarf Fortress-inspired persistence and emergent stories at a hero-focused scale
- Rogue-lite replayability through new worlds, Hero classes, and global meta-progression
- A responsive client intended for browser development, Steam first release, and mobile later

## Current direction

- **Client:** Phaser + TypeScript, with a React application UI overlay
- **Development:** Browser-first with fast local iteration and Playwright coverage
- **Initial release target:** Steam desktop
- **Later targets:** iOS and Android; browser distribution remains possible
- **Simulation:** Single-player, offline-capable, cardinal grid movement, one action per tile
- **Worlds:** Multiple persistent world slots, each with its own Hero and physical homestead
- **Persistence:** World-local progression plus profile-level meta-progression
- **Cloud saves:** Platform-specific cloud providers with local fallback
- **Art:** Static 2D assets first, with lightweight animation, effects, weather, and lighting added incrementally

## Design pillars

1. **Think before every tile.** Movement and actions resolve discretely; enemies respond after the Hero's action.
2. **The Hero is the center of the simulation.** Nearby entities and relevant world state matter more than a fully simulated distant civilization.
3. **Infinite means streamable.** Worlds are generated deterministically in chunks and materialized around the Hero instead of held in memory as one enormous map.
4. **Failure changes the story, not the save slot.** Death returns the Hero to a bound location by default; fresh worlds are available when the player wants a new run.
5. **Content is data-driven.** Heroes, items, recipes, spells, enemies, quests, and generation rules should be easy for agents to extend and test.
6. **The simulation is portable.** Rendering and platform code must not own game rules, so the same deterministic simulation can run in browser tests and native builds.

## Documentation

- [Architecture](ARCHITECTURE.md) — technical boundaries and runtime contracts
- [Roadmap](ROADMAP.md) — staged delivery plan and current priorities
- [Agent instructions](AGENTS.md) — rules for Codex and other coding agents
- [Development workflow](DEVELOPMENT.md) — local loop, verification, and change boundaries
- [Determinism contract](DETERMINISM.md) — seeds, command transcripts, and replay rules

## Development

Install dependencies and run the browser client through Vite:

```bash
npm install
npm run assets:build
npm run dev
```

Then open [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Do not open `index.html` with a `file://` URL; the Phaser module needs the Vite development server.

Before handing off a change, run `npm run verify` to execute the UI theme
contract check, typechecking, headless tests, the production build, and the
Playwright browser smoke suite.

Raw artwork lives under [`Raw Assets/`](Raw%20Assets/). `npm run assets:build` runs [`scripts/process-assets.mjs`](scripts/process-assets.mjs), which uses the Sharp-based pipeline to create optimized WebP/PNG variants and `public/assets/manifest.json`. Raw sources are never modified by the pipeline.

## Current status

The first browser vertical slice is in place: seeded grassland with dense interactive tree groves and clear paths, bright mountain regions, deterministic ore on every walkable mountain neighbor, cardinal action movement through mouse/touch/keyboard/controller input, dark-charcoal unexplored Torch visibility, a stable pooled Phaser fog layer with a directional reveal sweep, one-action resource harvesting, context actions for combat, a responsive 3:4 Action Hand with stable card identity and event-driven card-play/replacement animation, typed Knight abilities with Trinket-inspired effects and Basic/Skill/Ultimate cooldowns, priority-based default combat actions, a disposition-driven enemy response, a full-screen Phaser board, and a React overlay with Hero, canonical unlimited Inventory ownership, simulation-backed Equipment and Tool loadouts, station-aware equipment crafting, content-sized Abilities, a framed Map in the Main Menu, an icon-grid Main Menu, and a responsive Options surface with Display, Audio, Gameplay, Controls, and Accessibility sections. Native-ratio Bash, Sunder, and Avatar ability art flows through the asset pipeline, with click-to-open detail dialogs. Accepted action boundaries now write baseline versioned WorldSave/ProfileSave projections into a checksummed local save envelope, with crash recovery and legacy local-key migration; bounded chunk/entity materialization and profile-level Journal progression are implemented as well. The next increment is homestead production, interrupted-write fault injection, unsupported schema/migration policy, broader save-provider hardening, and richer progression.
