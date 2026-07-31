# Torch Phaser Checklist

## Scene lifecycle

- Do not overwrite `scene.sys` or injected Phaser systems.
- Reset run-specific values in lifecycle methods, not constructors.
- Unsubscribe session listeners and remove scale, resize, DOM, keyboard, and pointer handlers on `SHUTDOWN`.
- Stop/cancel tweens and observers when a scene exits.

## Scale and coordinate space

- Derive scale dimensions from the real canvas parent bounds and account for device pixel ratio.
- Keep `tileSize`, camera center, drawing positions, and `screenToTile` in one coordinate contract.
- Verify resize/orientation changes without stale positions, clipped boards, or input drift.
- Keep React overlays independent of Phaser's world coordinate space.

## Render layers and assets

- Keep board, fog, grid, entities, hero, and effects in explicit depth/layer ownership.
- Keep grid strokes separate from fog fills so enabled grid lines remain visible on lit tiles.
- Reuse bounded objects where possible and avoid clearing/rebuilding large graphics on every action.
- Preserve native artwork ratios and choose texture filtering intentionally.

## Input and animation

- Ignore world input when a React surface owns focus or when an action-boundary tween is active.
- Route actions through `gameSession` and typed input bindings.
- Make pointer-to-tile math match the draw math; support keyboard and pointer parity.
- Animate only presentation state, cancel safely, and provide a reduced-motion path.

## Determinism and performance

- Never put gameplay randomness or rules in Phaser.
- Keep generated world data seeded and bounded to the active presentation ring.
- Use fixed seeds for tests and retain the coordinates/command sequence for repro.
- Inspect frame diagnostics and console output after changing render density, effects, or resize behavior.
