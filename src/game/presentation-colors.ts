/**
 * Small bridge from the CSS design tokens to Phaser's numeric color API.
 * React remains the owner of the CSS token definitions; Phaser reads only the
 * board-safe presentation colors at scene creation time.
 */
export function readCssColorToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function cssHexColorToNumber(value: string, fallback: number): number {
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return Number.parseInt(normalized, 16);
}
