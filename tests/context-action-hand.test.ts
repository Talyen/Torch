import { describe, expect, it } from 'vitest';
import { actionsDuringCardPlayback, calculateHandMetrics } from '../src/ui/context-action-hand';
import type { ContextActionOption } from '../src/sim/context-actions';

function chopCard(entityId: string): ContextActionOption {
  return {
    id: `context:entity:${entityId}:chop`,
    label: 'Chop',
    source: 'entity',
    entityName: entityId,
    action: { kind: 'chop', entityId, target: { x: 1, y: 0 } },
  };
}

describe('context action playback', () => {
  it('holds a same-key replacement until the played card finishes', () => {
    const played = chopCard('old-tree');
    const replacement = chopCard('new-tree');

    expect(actionsDuringCardPlayback([replacement], played, 'entity:chop')).toEqual([played]);
    expect(actionsDuringCardPlayback([replacement], undefined, undefined)).toEqual([replacement]);
  });

  it('keeps the card geometry stable while deriving a proportional tuck depth', () => {
    const metrics = calculateHandMetrics(560, 3);

    expect(metrics.cardWidth).toBeGreaterThanOrEqual(72);
    expect(metrics.cardWidth).toBeLessThanOrEqual(132);
    expect(metrics.cardHeight / metrics.cardWidth).toBeCloseTo(4 / 3, 5);
    expect(metrics.tuckDepth).toBeCloseTo(metrics.cardHeight * 0.1, 5);
    expect(metrics.step).toBeLessThan(metrics.cardWidth);
    expect(metrics.angleStep).toBeGreaterThan(0);
  });
});
