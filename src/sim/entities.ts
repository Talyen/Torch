import { entityOccupiesPosition } from './footprint';
import { CARDINAL_OFFSETS } from './coords';
import type { EntityState, GameState, Position } from './types';

/**
 * Returns the living entity occupying a tile, if any. Entity lookup is kept in
 * one simulation-owned query so action validation, AI, and context projection
 * cannot quietly diverge on what counts as an occupied tile.
 */
export function entityAt(state: GameState, position: Position): EntityState | undefined {
  return Object.values(state.entities).find(
    (entity) => (entity.health ?? 1) > 0 && entityOccupiesPosition(entity, position),
  );
}

export function blockingEntityAt(state: GameState, position: Position): EntityState | undefined {
  const entity = entityAt(state, position);
  return entity?.blocksMovement ? entity : undefined;
}

export function findAdjacentResource(state: GameState): Position | undefined {
  for (const offset of CARDINAL_OFFSETS) {
    const position = {
      x: state.hero.position.x + offset.x,
      y: state.hero.position.y + offset.y,
    };
    const entity = entityAt(state, position);
    if (entity?.kind === 'tree' || entity?.kind === 'ore') return position;
  }
  return undefined;
}
