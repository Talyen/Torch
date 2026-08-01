import { describe, expect, it } from 'vitest';
import {
  animationDurationForPhase,
  CARD_ANIMATION_PRESETS,
  cardAnimationPresetForId,
  DEFAULT_CARD_ANIMATION_PRESET,
  snapshotForCardAnimation,
} from '../src/ui/card-animation';
import type { ContextActionOption } from '../src/sim';

const action: ContextActionOption = {
  id: 'context:entity:resource-tree:chop',
  label: 'Chop',
  source: 'entity',
  entityName: 'Old Pine',
  action: { kind: 'chop', entityId: 'resource-tree', target: { x: 3, y: 2 } },
};

describe('card animation presentation contracts', () => {
  it('captures immutable target, camera, source geometry, and the selected preset', () => {
    const sourceRect = { left: 12, top: 620, width: 100, height: 133.333 };
    const snapshot = snapshotForCardAnimation(action, 'entity:chop', { x: 2, y: 2 }, sourceRect);

    expect(snapshot).toMatchObject({
      cardKey: 'entity:chop',
      presetId: DEFAULT_CARD_ANIMATION_PRESET,
      target: { x: 3, y: 2 },
      cameraPosition: { x: 2, y: 2 },
      action: { entityName: 'Old Pine' },
      sourceRect,
    });
    expect(snapshot.action).not.toBe(action);
    expect(snapshot.action.action).not.toBe(action.action);

    action.entityName = 'Removed Pine';
    action.action.target.x = 99;
    expect(snapshot.action.entityName).toBe('Old Pine');
    expect(snapshot.target).toEqual({ x: 3, y: 2 });
  });

  it('registers exactly the two source animation bundles', () => {
    expect(CARD_ANIMATION_PRESETS.map((preset) => preset.id)).toEqual(['trinket', 'alchemy']);
    expect(CARD_ANIMATION_PRESETS.every((preset) => preset.description.length > 20)).toBe(true);
    expect(cardAnimationPresetForId('trinket').transfer.playMode).toBe('dissolve');
    expect(cardAnimationPresetForId('alchemy').transfer.playMode).toBe('travel');
    expect(cardAnimationPresetForId('alchemy').transfer.drawFlip).toEqual([180, 90, 0]);
    expect(cardAnimationPresetForId('alchemy').transfer.discardFlip).toEqual([0, 90, 180]);
  });

  it('keeps source-specific phase timing and reduced-motion fallbacks typed', () => {
    const trinket = cardAnimationPresetForId('trinket');
    const alchemy = cardAnimationPresetForId('alchemy');

    expect(animationDurationForPhase(trinket, 'play')).toBe(1000);
    expect(animationDurationForPhase(alchemy, 'play')).toBe(672);
    expect(animationDurationForPhase(alchemy, 'draw')).toBe(500);
    expect(animationDurationForPhase(alchemy, 'play', true)).toBe(560);
    expect(animationDurationForPhase(trinket, 'draw', true)).toBe(1);
  });
});
