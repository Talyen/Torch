import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/simulation';
import { chunkForPosition, floorDiv, manhattanDistance, samePosition } from '../src/sim';
import {
  createInitialGameState,
  generatedResourceAt,
  generatedTreeId,
  isTerrainWalkable,
  tileAt,
} from '../src/sim/world';
import type { Command } from '../src/sim/types';

describe('deterministic simulation invariants', () => {
  it('keeps chunk addressing and floor division stable for negative coordinates', () => {
    for (const coordinate of [-65, -64, -63, -17, -16, -15, -1, 0, 1, 15, 16, 17, 63, 64, 65]) {
      const chunk = chunkForPosition({ x: coordinate, y: coordinate });
      expect(chunk.x).toBe(floorDiv(coordinate, 16));
      expect(chunk.y).toBe(floorDiv(coordinate, 16));
    }
  });

  it('generates the same tile and resource decisions for repeated seed inputs', () => {
    for (const seed of [1, 42, 20260730, 987654321]) {
      for (let y = -12; y <= 12; y += 3) {
        for (let x = -12; x <= 12; x += 3) {
          const position = { x, y };
          const firstTile = tileAt(seed, position);
          const secondTile = tileAt(seed, position);
          const firstResource = generatedResourceAt(seed, position);
          const secondResource = generatedResourceAt(seed, position);

          expect(secondTile).toBe(firstTile);
          expect(secondResource).toBe(firstResource);
          expect(isTerrainWalkable(firstTile)).toBe(firstTile !== 'mountain');
        }
      }
    }
  });

  it('never advances the turn for rejected commands across a fixed command matrix', () => {
    for (const seed of [42, 20260730, 987654321]) {
      const state = createInitialGameState(seed);
      const rejected: Command[] = [
        { type: 'interact', target: { x: 99, y: 99 } },
        { type: 'action', action: { kind: 'chop' as const, entityId: 'missing', target: { x: 3, y: 2 } } },
      ];

      for (const command of rejected) {
        const result = applyCommand(state, command);
        expect(result.accepted).toBe(false);
        expect(result.state.turn).toBe(state.turn);
      }
    }
  });

  it('does not materialize generated entities for a rejected movement', () => {
    const state = createInitialGameState(1234);
    // This fixed-seed tile is adjacent to a mountain while the active ring
    // also contains a generated tree. The mountain rejection must not expose
    // that unrelated tree in the returned state.
    state.hero.position = { x: 18, y: -64 };
    for (const id of Object.keys(state.entities)) {
      if (id.startsWith('generated-tree:')) delete state.entities[id];
    }
    const before = structuredClone(state);

    const result = applyCommand(state, { type: 'move', direction: 'north' });

    expect(result.accepted).toBe(false);
    expect(result.state).toEqual(before);
    expect(result.state.entities[generatedTreeId({ x: 10, y: -72 })]).toBeUndefined();
  });

  it('preserves cardinal movement and distance invariants for accepted moves', () => {
    const state = createInitialGameState(20260730);
    const result = applyCommand(state, { type: 'move', direction: 'south' });
    expect(result.accepted).toBe(true);
    expect(result.state.turn).toBe(state.turn + 1);
    expect(manhattanDistance(state.hero.position, result.state.hero.position)).toBe(1);
    expect(samePosition(result.state.hero.position, { x: 0, y: 3 })).toBe(true);
  });
});
