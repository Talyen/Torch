import { describe, expect, it } from 'vitest';
import { attackPoseAt, ATTACK_MOTION } from '../src/game/attack-motion';
import { feedbackRequestsForBatch } from '../src/game/feedback-presenter';
import { applyCommand, createInitialGameState } from '../src/sim';
import type { ActionBatch } from '../src/game/session';

describe('combat presentation contracts', () => {
  it('projects a lunge along the grid direction and returns to rest', () => {
    const windup = attackPoseAt(ATTACK_MOTION.windupMs / ATTACK_MOTION.durationMs, { x: 0, y: 0 }, { x: 1, y: 0 }, 100);
    const impact = attackPoseAt(ATTACK_MOTION.impactMs / ATTACK_MOTION.durationMs, { x: 0, y: 0 }, { x: 1, y: 0 }, 100);
    const rest = attackPoseAt(1, { x: 0, y: 0 }, { x: 1, y: 0 }, 100);

    expect(windup.offsetX).toBe(-12);
    expect(windup.offsetY).toBe(0);
    expect(impact.offsetX).toBeCloseTo(28);
    expect(rest).toEqual({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 });
  });

  it('emits stable attack facts before a defeated target is removed', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };
    state.entities.slime.health = 1;

    const result = applyCommand(state, {
      type: 'action',
      action: { kind: 'attack', entityId: 'slime', target: { x: 5, y: 2 } },
    });
    const attack = result.events.find((event) => event.type === 'attack-resolved');

    expect(attack).toMatchObject({
      action: 'attack',
      amount: 1,
      targetDefeated: true,
      attacker: { id: state.hero.heroId, kind: 'hero', position: { x: 4, y: 2 } },
      target: { id: 'slime', kind: 'enemy', position: { x: 5, y: 2 } },
    });
    expect(result.state.entities.slime).toBeUndefined();
  });

  it('maps damage and gathering outcomes into anchored feedback requests', () => {
    const batch = {
      batchId: 8,
      accepted: true,
      previousState: createInitialGameState(1234),
      nextState: createInitialGameState(1234),
      events: [
        {
          type: 'attack-resolved',
          attackId: '1:attack:0:hero.knight:slime',
          action: 'attack',
          attacker: { id: 'hero.knight', kind: 'hero', name: 'Hero', position: { x: 4, y: 2 } },
          target: { id: 'slime', kind: 'enemy', name: 'Forest Slime', position: { x: 5, y: 2 } },
          amount: 2,
          targetDefeated: false,
        },
        { type: 'resource-gathered', resource: 'wood', amount: 2, collectorPosition: { x: 4, y: 2 } },
      ],
    } satisfies ActionBatch;

    expect(feedbackRequestsForBatch(batch)).toEqual([
      expect.objectContaining({ id: '8:attack:1:attack:0:hero.knight:slime', text: '-2', delayMs: 550 }),
      expect.objectContaining({ text: '+2', iconKey: 'resource.homestead.wood', anchor: { x: 4, y: 2 } }),
    ]);
  });
});
