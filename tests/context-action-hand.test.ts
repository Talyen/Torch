import { describe, expect, it } from 'vitest';
import { actionsDuringCardPlayback, calculateHandMetrics } from '../src/ui/context-action-hand';
import type { ContextActionOption } from '../src/sim/context-actions';

function chopCard(entityId: string, kind: 'chop' | 'mine' | 'attack' = 'chop'): ContextActionOption {
  return {
    id: `context:entity:${entityId}:${kind}`,
    label: kind[0].toUpperCase() + kind.slice(1),
    source: 'entity',
    entityName: entityId,
    action: { kind, entityId, target: { x: 1, y: 0 } },
  };
}

function readyAbilityCard(abilityId: string, label: string, slot: 'basic' | 'skill' | 'ultimate'): ContextActionOption {
  return {
    id: `context:ability:${abilityId}`,
    label,
    source: 'ability',
    entityName: 'Forest Slime',
    abilityId,
    slot,
    cooldownRemaining: 0,
    action: {
      kind: 'ability',
      abilityId,
      entityId: 'slime',
      target: { x: 5, y: 2 },
    },
  };
}

describe('context action playback', () => {
  it('holds a same-key replacement until the played card finishes', () => {
    const played = chopCard('old-tree');
    const replacement = chopCard('new-tree');

    expect(actionsDuringCardPlayback([replacement], played, 'entity:chop')).toEqual([played]);
    expect(actionsDuringCardPlayback([replacement], undefined, undefined)).toEqual([replacement]);
  });

  it('retains a removed card at its original fan index', () => {
    const left = chopCard('left-tree', 'attack');
    const played = chopCard('played-tree');
    const right = chopCard('right-tree', 'mine');
    const replacement = chopCard('replacement-tree');

    expect(actionsDuringCardPlayback([left, replacement, right], played, 'entity:chop', 1)).toEqual([
      left,
      played,
      right,
    ]);
  });

  it('reflows ready cards after a played ability disappears during a cooldown update', () => {
    const left = readyAbilityCard('ability.bash', 'Bash', 'basic');
    const played = readyAbilityCard('ability.sunder', 'Sunder', 'skill');
    const right = readyAbilityCard('ability.avatar', 'Avatar', 'ultimate');

    const displayed = actionsDuringCardPlayback([left, right], played, 'ability:ability.sunder', 1);

    expect(displayed).toEqual([left, played, right]);
    expect(actionsDuringCardPlayback([left, right], undefined, undefined)).toEqual([left, right]);
    expect(actionsDuringCardPlayback([left, right], undefined, undefined)).not.toContainEqual(
      expect.objectContaining({ abilityId: 'ability.sunder' }),
    );
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
