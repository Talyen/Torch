# Agent Instructions for Torch

Torch is a code-and-data-driven Phaser + TypeScript game. Agents are the primary development and content-authoring contributors.

## Read first

Before changing the project, read:

1. `README.md` for the product direction.
2. `ARCHITECTURE.md` for runtime boundaries and invariants.
3. `ROADMAP.md` for the current milestone and scope.
4. `DESIGN_SYSTEM.md` before adding or changing React UI.

If a change alters a product or architectural decision, update the relevant document in the same change.

## Non-negotiable boundaries

- Keep the simulation core independent of Phaser and platform SDKs.
- Route every player action through a typed command and deterministic action resolver.
- Keep cardinal movement and one-tile action resolution as the baseline behavior.
- Keep world generation seeded and reproducible.
- Keep generated terrain separate from persistent world mutations.
- Keep profile meta-progression separate from world-local state.
- Do not add a real-time simulation loop to solve a turn-based problem.
- Do not store the infinite world as one unbounded in-memory grid.
- Do not use `Math.random()` for gameplay outcomes.
- Do not put important rules only in rendering code or UI callbacks.

## Implementation style

- Prefer small, typed modules with explicit inputs and outputs.
- Use stable IDs for content and save references.
- Keep content definitions data-driven and easy to inspect in code review.
- Make platform-specific behavior an adapter, not a conditional scattered through the simulation.
- Favor deterministic pure functions for generation, pathing, validation, and calculations.
- Avoid introducing a framework or dependency unless it solves a demonstrated project need.
- Keep comments focused on invariants and non-obvious decisions.
- Build React UI from the shared design tokens and layout contracts in `DESIGN_SYSTEM.md`; avoid one-off spacing, radii, or icon treatments.
- Use Lucide React for generic interface icons and reserve authored art for game-content visuals.

## Testing expectations

For simulation changes, add or update headless tests with fixed seeds. For client changes, add a browser smoke test when the behavior is user-visible. For save changes, test round-trip serialization and migration behavior.

Before reporting completion, run the repository's available typecheck, unit, and browser tests. Do not claim a command passed if the scaffold does not define it yet; document missing tooling as an explicit follow-up.

When debugging procedural behavior, capture the seed, generation version, coordinates, and command sequence needed to reproduce it.

## Scope control

The current milestone is the first playable vertical slice. Prefer completing a narrow end-to-end path—seeded world, movement, Torch visibility, one enemy, gathering, saving, and respawn—over adding many disconnected content types.

Do not introduce multiplayer, modding, civilization-scale simulation, permanent-death-only progression, or a bespoke game editor without an explicit product decision.

## Assets and generated content

Keep generated assets and content definitions traceable. When an asset pipeline is added, record source metadata and stable asset IDs. Do not embed critical game rules in an image, editor-only artifact, or unreviewable generated file.

## Change handoff

Every implementation handoff should state:

- what changed
- which tests or checks ran
- any known limitations
- any architectural or product decision that remains open
