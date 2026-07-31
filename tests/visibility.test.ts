import { describe, expect, it } from 'vitest';
import {
  captureVisibilitySnapshot,
  REMEMBERED_TILE_MIX,
  visibilityChanged,
  visibilityColor,
  visibilityLevel,
  mixColor,
} from '../src/game/visibility';
import { applyCommand, createInitialGameState } from '../src/sim';

describe('visibility presentation helpers', () => {
  it('captures and compares action-boundary visibility without mutating simulation state', () => {
    const state = createInitialGameState(1234);
    const before = captureVisibilitySnapshot(state);
    const result = applyCommand(state, { type: 'move', direction: 'east' });
    const after = captureVisibilitySnapshot(result.state);

    expect(visibilityChanged(before, before)).toBe(false);
    expect(visibilityChanged(before, after)).toBe(true);
    expect(state.hero.position).toEqual({ x: 0, y: 2 });
    expect(visibilityLevel(after, { x: 1, y: 2 })).toBe(2);
    expect(visibilityLevel(after, { x: 8, y: 2 })).toBe(0);
  });

  it('interpolates fog colors at stable endpoints', () => {
    const unseen = 0x151719;
    const remembered = 0x111722;
    const lit = 0x263c2a;

    expect(visibilityColor(lit, 0, unseen, remembered)).toBe(unseen);
    expect(visibilityColor(lit, 1, unseen, remembered)).toBe(mixColor(remembered, lit, REMEMBERED_TILE_MIX));
    expect(visibilityColor(lit, 2, unseen, remembered)).toBe(lit);
  });
});
