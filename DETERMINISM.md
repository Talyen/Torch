# Determinism and Replay Contract

Torch's simulation is reproducible from a seed, generation version, and ordered
command transcript. Rendering and animation are presentation concerns and are
not part of the replay contract.

## Replay inputs

Every replay must identify:

- `seed`: the world seed passed to `createInitialGameState`.
- `generationVersion`: the content/generation rules version.
- `commands`: the exact ordered commands sent to `applyCommand`.

Example:

```json
{
  "seed": 1234,
  "generationVersion": 1,
  "commands": [
    { "type": "move", "direction": "east" },
    { "type": "move", "direction": "east" },
    { "type": "move", "direction": "east" },
    { "type": "move", "direction": "east" },
    { "type": "move", "direction": "east" },
    { "type": "action", "action": { "kind": "attack", "entityId": "slime", "target": { "x": 5, "y": 2 } } }
  ]
}
```

## Rules

- Gameplay randomness must come from deterministic inputs derived from the
  world seed and coordinates. Never use `Math.random()` for a game outcome.
- Commands are resolved in order. A rejected command still produces a
  deterministic result and must not advance the turn.
- A blocked cardinal move into an adjacent actionable entity resolves that
  entity's default action. The explicit `action` command and
  `availableActionsAt()` use the same validation path, so future action-choice
  UI cannot bypass adjacency, target identity, or content rules.
- Enemy ordering, resource resolution, and respawn behavior must be stable for
  the same state and command sequence.
- The simulation must not depend on wall-clock time, renderer state, browser
  APIs, or animation progress.
- Generated terrain is a pure function of `seed`, `generationVersion`, and
  coordinates. Persistent mutations are separate state.

## What to assert

Deterministic tests should compare more than the final Hero position when the
behavior matters. Prefer assertions over final state, turn count, event
sequence, entity positions, inventory, health, and revealed tiles. Include a
small fixed-seed regression case whenever a generation or action rule changes.

The replay runner itself is intentionally not implemented yet. The current
simulation tests exercise the contract directly; Phase 1 will add a reusable
command-transcript runner and save/load round-trip coverage.

## Versioning

Changing procedural generation rules requires a `generationVersion` decision.
Changing save serialization requires a separate save-schema version and
migration decision. Do not silently treat either change as a cosmetic patch:
record the reason and add a regression fixture for the affected seed.
