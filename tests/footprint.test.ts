import { describe, expect, it } from 'vitest';
import { entityOccupiesPosition, footprintPositions } from '../src/sim';

describe('entity footprints', () => {
  it('occupies a contiguous multi-tile area from its anchor position', () => {
    const entity = {
      id: 'large-enemy',
      kind: 'enemy' as const,
      name: 'Large Enemy',
      position: { x: 4, y: 5 },
      blocksMovement: true,
      footprint: { width: 2, height: 2 },
    };

    expect(entityOccupiesPosition(entity, { x: 5, y: 6 })).toBe(true);
    expect(entityOccupiesPosition(entity, { x: 6, y: 6 })).toBe(false);
    expect(footprintPositions(entity.position, entity.footprint)).toEqual([
      { x: 4, y: 5 },
      { x: 5, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
    ]);
  });
});
