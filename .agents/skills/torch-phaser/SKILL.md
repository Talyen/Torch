---
name: torch-phaser
description: Review and implement Torch Phaser presentation work, including scenes, scaling, camera/layout, tile and fog grids, sprites and authored assets, keyboard/pointer input, tweens, cleanup, and browser performance. Use for changes under src/game, src/main.ts, or any UI work that depends on the Phaser board.
---

# Torch Phaser

Use this skill for every Phaser-facing change. Preserve the simulation boundary: Phaser renders deterministic state and emits typed actions; it does not own gameplay rules, persistence, or random outcomes.

## Workflow

1. Read `AGENTS.md`, `ARCHITECTURE.md`, and the relevant scene/layout module. Inspect existing scene lifecycle, session subscriptions, layers, and resize handling before editing.
2. Keep lifecycle work in Phaser lifecycle methods. Initialize per-run state in `init`/`create`, use SceneManager transitions, and remove subscriptions, observers, DOM listeners, tweens, and input handlers on shutdown.
3. Treat scale as a contract. Derive board geometry from the actual canvas/container bounds, keep camera math and pointer-to-tile math in the same coordinate space, and verify wide, short, portrait, and high-DPI viewports.
4. Keep presentation layers explicit: board/terrain, fog, grid, entities, hero, effects, and UI overlay. Do not redraw large transient graphics unnecessarily; update mounted objects in place when practical.
5. Preserve authored image aspect ratios and intentional crop variants. Set texture filtering deliberately, provide stable asset keys, and avoid stretching content to fit a menu or tile.
6. Route keyboard, pointer, and touch input through the existing session/input-binding boundary. Ignore world input while menus or animations own focus, and make hit targets and feedback legible.
7. Use tweens only for presentation between action-boundary states. Make cancellation, reduced-motion behavior, and cleanup explicit; never use animation to hide a state or mutate simulation truth.
8. Verify with fixed-seed simulation tests, browser smoke flows, visual checks, and `npm run verify`. Inspect console/frame diagnostics when changing render density or effects.

## Torch defaults

- `TorchScene` owns Phaser objects and presentation subscriptions; `gameSession` remains the action/state boundary.
- Keep fog and tile-grid rendering in separate layers so visible grid strokes are not hidden by fog alpha. `SHOW_GRID_EVENT` and `readShowGridPreference()` are the presentation-settings path.
- Preserve seeded world generation and sparse mutations. Never add `Math.random()` or an unbounded world render structure.
- Prefer bounded active-ring rendering and stable object reuse. Clean all listeners in `Phaser.Scenes.Events.SHUTDOWN`.
- Read [phaser-checklist.md](references/phaser-checklist.md) for the detailed scene, scale, layer, input, asset, animation, and performance checks.

## Coordination

Load `$torch-ui-ux` alongside this skill when the Phaser change affects HUD composition, overlay geometry, accessibility, responsive behavior, or any React/CSS surface.
