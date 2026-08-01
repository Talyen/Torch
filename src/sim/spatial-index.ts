import { floorDiv, positionKey } from './coords';
import { entityFootprint, footprintPositions } from './footprint';
import type { EntityState, GameState, Position } from './types';

export interface EntitySpatialIndex {
  chunkSize: number;
  byPosition: Map<string, string[]>;
  byChunk: Map<string, string[]>;
}

const indexes = new WeakMap<GameState, EntitySpatialIndex>();

function chunkKeyForPosition(position: Position, chunkSize: number): string {
  return `${floorDiv(position.x, chunkSize)},${floorDiv(position.y, chunkSize)}`;
}

function append(index: Map<string, string[]>, key: string, entity: EntityState): void {
  const ids = index.get(key);
  if (ids) ids.push(entity.id);
  else index.set(key, [entity.id]);
}

function appendUnique(index: Map<string, string[]>, key: string, entity: EntityState): void {
  const ids = index.get(key);
  if (!ids) index.set(key, [entity.id]);
  else if (!ids.includes(entity.id)) ids.push(entity.id);
}

function buildIndex(state: GameState, chunkSize: number): EntitySpatialIndex {
  const index: EntitySpatialIndex = { chunkSize, byPosition: new Map(), byChunk: new Map() };
  for (const entity of Object.values(state.entities)) {
    for (const occupied of footprintPositions(entity.position, entityFootprint(entity))) {
      append(index.byPosition, positionKey(occupied), entity);
      appendUnique(index.byChunk, chunkKeyForPosition(occupied, chunkSize), entity);
    }
  }
  indexes.set(state, index);
  return index;
}

export function entitySpatialIndex(state: GameState, chunkSize: number): EntitySpatialIndex {
  const current = indexes.get(state);
  return current?.chunkSize === chunkSize ? current : buildIndex(state, chunkSize);
}

export function invalidateEntitySpatialIndex(state: GameState): void {
  indexes.delete(state);
}
