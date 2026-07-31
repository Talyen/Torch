import { describe, expect, it } from 'vitest';
import { percentile } from '../src/dev/frame-monitor';

describe('development frame metrics', () => {
  it('calculates interpolated percentiles without mutating the samples', () => {
    const samples = [16, 18, 20, 24];

    expect(percentile(samples, 0.5)).toBe(19);
    expect(percentile(samples, 0.99)).toBeCloseTo(23.88);
    expect(samples).toEqual([16, 18, 20, 24]);
  });

  it('returns zero for an empty sample window', () => {
    expect(percentile([], 0.99)).toBe(0);
  });
});
