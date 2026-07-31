import { describe, expect, it } from 'vitest';
import { cssHexColorToNumber } from '../src/game/presentation-colors';

describe('presentation color bridge', () => {
  it('converts six-digit CSS hex colors for Phaser', () => {
    expect(cssHexColorToNumber('#0c0b09', 0)).toBe(0x0c0b09);
    expect(cssHexColorToNumber('3a3328', 0)).toBe(0x3a3328);
  });

  it('uses the fallback for unsupported CSS color values', () => {
    expect(cssHexColorToNumber('rgb(12 11 9)', 0x123456)).toBe(0x123456);
    expect(cssHexColorToNumber('#fff', 0x123456)).toBe(0x123456);
  });
});
