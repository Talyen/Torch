import { describe, expect, it } from 'vitest';
import {
  captureVisibilitySnapshot,
  directionalVisibilityProgress,
  entityVisibilityAlpha,
  fogAlphaForVisibility,
  REMEMBERED_TILE_MIX,
  interpolatedVisibilityLevel,
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

  it('sweeps visibility along the direction of movement', () => {
    const previousHero = { x: 0, y: 2 };
    const currentHero = { x: 1, y: 2 };

    const trailingTile = directionalVisibilityProgress(previousHero, currentHero, { x: -2, y: 2 }, 0.35);
    const leadingTile = directionalVisibilityProgress(previousHero, currentHero, { x: 4, y: 2 }, 0.35);

    expect(trailingTile).toBeGreaterThan(leadingTile);
    expect(leadingTile).toBe(0);
    expect(directionalVisibilityProgress(previousHero, currentHero, { x: 4, y: 2 }, 1)).toBe(1);
  });

  it('keeps newly revealed entities hidden until the fog reaches their tile', () => {
    const beforeState = createInitialGameState(1234);
    const afterState = applyCommand(beforeState, { type: 'move', direction: 'east' }).state;
    const before = captureVisibilitySnapshot(beforeState);
    const after = captureVisibilitySnapshot(afterState);
    const newlyRevealed = { x: 4, y: 2 };

    expect(interpolatedVisibilityLevel(before, after, newlyRevealed, 0)).toBe(0);
    expect(entityVisibilityAlpha(interpolatedVisibilityLevel(before, after, newlyRevealed, 0))).toBe(0);
    expect(entityVisibilityAlpha(interpolatedVisibilityLevel(before, after, newlyRevealed, 1))).toBe(1);
  });

  it('maps the three visibility states to stable fog alpha values', () => {
    expect(fogAlphaForVisibility(0)).toBeGreaterThan(fogAlphaForVisibility(1));
    expect(fogAlphaForVisibility(1)).toBeGreaterThan(fogAlphaForVisibility(2));
    expect(fogAlphaForVisibility(2)).toBe(0);
  });
});
