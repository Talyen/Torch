import { describe, expect, it } from 'vitest';
import { layoutProfileForSize, mapFitForViewport, positiveSize } from '../src/ui/responsive-layout';

describe('shared responsive layout contract', () => {
  it('classifies surfaces from their available CSS-pixel size', () => {
    expect(layoutProfileForSize(1366, 768)).toBe('wide');
    expect(layoutProfileForSize(1024, 600)).toBe('short');
    expect(layoutProfileForSize(768, 1024)).toBe('wide');
    expect(layoutProfileForSize(390, 844)).toBe('compact');
    expect(layoutProfileForSize(598, 376)).toBe('tiny');
    expect(layoutProfileForSize(360, 800)).toBe('tiny');
  });

  it('sanitizes transient measurements without inventing negative space', () => {
    expect(positiveSize({ width: -10, height: Number.NaN })).toEqual({ width: 0, height: 0 });
  });

  it('fits square map cells inside the measured viewport', () => {
    const fit = mapFitForViewport(640, 420, 7, 5);
    expect(fit).toBeDefined();
    expect((fit?.columns ?? 0) * (fit?.cellSize ?? 0)).toBeCloseTo(640);
    expect((fit?.rows ?? 0) * (fit?.cellSize ?? 0)).toBeLessThanOrEqual(420.0001);
    expect(fit?.columns).toBeGreaterThanOrEqual(7);
    expect(fit?.rows).toBeGreaterThanOrEqual(5);
  });

  it('returns no fit while a surface is still collapsing to zero', () => {
    expect(mapFitForViewport(0, 400, 7, 5)).toBeUndefined();
    expect(mapFitForViewport(400, 0, 7, 5)).toBeUndefined();
  });
});
