import { describe, expect, it } from 'vitest';
import { tileSizeForViewport, viewRadiusForViewport } from '../src/game/layout';

describe('responsive board layout', () => {
  it('fits the full Torch diameter to the shortest viewport side', () => {
    expect(tileSizeForViewport(1280, 720)).toBe(720 / 7);
    expect(tileSizeForViewport(390, 844)).toBe(390 / 7);
  });

  it('keeps a usable positive tile size during transient resize states', () => {
    expect(tileSizeForViewport(0, 0)).toBe(1 / 7);
  });

  it('provides a small render margin beyond the visible viewport', () => {
    expect(viewRadiusForViewport(720, 720, 720 / 7)).toEqual({ x: 6, y: 6 });
  });
});
