/**
 * Small bridge from the CSS design tokens to Phaser's numeric color API.
 * React remains the owner of the CSS token definitions; Phaser reads only the
 * board-safe presentation colors at scene creation time.
 */

/** Stable fallbacks used before the document has loaded and by Phaser boot. */
export const BOARD_PRESENTATION_FALLBACKS = {
  background: '#0c0b09',
  grid: '#3a3328',
  fog: '#15130f',
} as const;

const BOARD_PRESENTATION_FALLBACK_NUMBERS = {
  grid: 0x3a3328,
  fog: 0x15130f,
} as const;

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

export type BoardPresentationColors = {
  background: string;
  grid: number;
  fog: number;
};

/**
 * Reads the complete board-safe palette through one explicit ownership
 * boundary. Callers should not carry token names or fallback literals into
 * Phaser scene setup.
 */
export function readBoardPresentationColors(): BoardPresentationColors {
  return {
    background: readCssColorToken('--ui-color-background', BOARD_PRESENTATION_FALLBACKS.background),
    grid: cssHexColorToNumber(
      readCssColorToken('--ui-color-grid', BOARD_PRESENTATION_FALLBACKS.grid),
      BOARD_PRESENTATION_FALLBACK_NUMBERS.grid,
    ),
    fog: cssHexColorToNumber(
      readCssColorToken('--ui-color-fog', BOARD_PRESENTATION_FALLBACKS.fog),
      BOARD_PRESENTATION_FALLBACK_NUMBERS.fog,
    ),
  };
}
