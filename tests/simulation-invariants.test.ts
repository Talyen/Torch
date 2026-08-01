import { describe, expect, it } from 'vitest';
import {
  activeChunkCoordinates,
  applyCommand,
  chunkForPosition,
  entityIdsInChunk,
  floorDiv,
  generatedTreeAt,
  generatedTreeId,
  manhattanDistance,
  materializeGeneratedTrees,
  remainingGatheringActionsFor,
  samePosition,
} from '../src/sim';
import { createInitialGameState, generatedResourceAt, isTerrainWalkable, tileAt } from '../src/sim/world';
import type { Command } from '../src/sim/types';

describe('deterministic simulation invariants', () => {
  it('keeps chunk addressing and floor division stable for negative coordinates', () => {
    for (const coordinate of [-65, -64, -63, -17, -16, -15, -1, 0, 1, 15, 16, 17, 63, 64, 65]) {
      const chunk = chunkForPosition({ x: coordinate, y: coordinate });
      expect(chunk.x).toBe(floorDiv(coordinate, 16));
      expect(chunk.y).toBe(floorDiv(coordinate, 16));
    }
  });

  it('orders the bounded active chunk window deterministically across negative boundaries', () => {
    expect(activeChunkCoordinates({ x: -16, y: -16 }, 8)).toEqual([
      { x: -2, y: -2 },
      { x: -1, y: -2 },
      { x: -2, y: -1 },
      { x: -1, y: -1 },
    ]);
  });

  it('materializes only the active window and deterministically rehydrates generated mutations', () => {
    const state = createInitialGameState(1234);
    const center = { x: -48, y: -48 };
    const radius = 8;
    materializeGeneratedTrees(state, center, radius);

    const generated = Object.values(state.entities).filter((entity) => entity.id.startsWith('generated-tree:'));
    const expectedIds: string[] = [];
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        const position = { x, y };
        if (generatedTreeAt(state.seed, position)) expectedIds.push(generatedTreeId(position));
      }
    }
    expect(generated.length).toBeLessThanOrEqual((radius * 2 + 1) ** 2);
    expect(generated.map((entity) => entity.id)).toEqual(expectedIds);
    expect(
      generated.every(
        (entity) =>
          Math.abs(entity.position.x - center.x) <= radius && Math.abs(entity.position.y - center.y) <= radius,
      ),
    ).toBe(true);

    const target = generated.find((entity) => generatedTreeAt(state.seed, entity.position));
    expect(target).toBeDefined();
    state.gatheringProgress[target!.id] = 2;
    expect(target!.remainingGatheringActions).toBeUndefined();
    expect(remainingGatheringActionsFor(state, target!, 3)).toBe(2);

    materializeGeneratedTrees(state, { x: 48, y: 48 }, radius);
    expect(state.entities[target!.id]).toBeUndefined();
    materializeGeneratedTrees(state, center, radius);
    expect(state.entities[target!.id]?.position).toEqual(target!.position);
    expect(remainingGatheringActionsFor(state, state.entities[target!.id], 3)).toBe(2);
  });

  it('indexes active entity positions and chunks without duplicating large footprints', () => {
    const state = createInitialGameState(1234);
    state.entities['large-negative-entity'] = {
      id: 'large-negative-entity',
      kind: 'enemy',
      name: 'Large Entity',
      position: { x: -17, y: -17 },
      footprint: { width: 2, height: 2 },
      blocksMovement: true,
      health: 1,
    };

    expect(entityIdsInChunk(state, -2, -2).filter((id) => id === 'large-negative-entity')).toEqual([
      'large-negative-entity',
    ]);
    expect(entityIdsInChunk(state, -1, -1)).toContain('large-negative-entity');
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

  it('does not copy exploration-sized sparse records for commands that do not mutate them', () => {
    const state = createInitialGameState(20260730);
    for (let index = 0; index < 25_000; index += 1) state.revealedTiles[`${index},${-index}`] = true;

    const result = applyCommand(state, { type: 'wait' });

    expect(result.accepted).toBe(true);
    expect(result.state.revealedTiles).toBe(state.revealedTiles);
    expect(result.state.removedGeneratedEntities).toBe(state.removedGeneratedEntities);
    expect(result.state.gatheringProgress).toBe(state.gatheringProgress);
    expect(result.state.entities).not.toBe(state.entities);
    expect(result.state.hero).not.toBe(state.hero);
  });
});
