import type { EntityState, Footprint, Position } from './types';

export const DEFAULT_FOOTPRINT: Footprint = { width: 1, height: 1 };

export function entityFootprint(entity: EntityState): Footprint {
  return entity.footprint ?? DEFAULT_FOOTPRINT;
}

export function entityOccupiesPosition(entity: EntityState, position: Position): boolean {
  const footprint = entityFootprint(entity);
  return position.x >= entity.position.x
    && position.x < entity.position.x + footprint.width
    && position.y >= entity.position.y
    && position.y < entity.position.y + footprint.height;
}

export function footprintPositions(origin: Position, footprint: Footprint): Position[] {
  const positions: Position[] = [];
  for (let y = 0; y < footprint.height; y += 1) {
    for (let x = 0; x < footprint.width; x += 1) {
      positions.push({ x: origin.x + x, y: origin.y + y });
    }
  }
  return positions;
}
