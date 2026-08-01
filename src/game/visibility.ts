import { positionKey, samePosition } from '../sim';
import { TORCH_RADIUS } from '../sim';
import type { GameState, Position } from '../sim';

export const REMEMBERED_TILE_MIX = 0.34;

/**
 * The simulation owns the visibility facts; this immutable snapshot lets the
 * renderer animate from one action-boundary result to the next.
 */
export interface VisibilitySnapshot {
  hero: Position;
  revealedTiles: Set<string>;
}

export function captureVisibilitySnapshot(state: GameState): VisibilitySnapshot {
  return {
    hero: { ...state.hero.position },
    revealedTiles: new Set(Object.keys(state.revealedTiles)),
  };
}

export function visibilityChanged(previous: VisibilitySnapshot, current: VisibilitySnapshot): boolean {
  if (!samePosition(previous.hero, current.hero)) return true;
  if (previous.revealedTiles.size !== current.revealedTiles.size) return true;

  for (const tile of current.revealedTiles) {
    if (!previous.revealedTiles.has(tile)) return true;
  }

  return false;
}

/** 0 = unexplored, 1 = remembered, 2 = currently lit. */
export function visibilityLevel(snapshot: VisibilitySnapshot, position: Position): number {
  if (!snapshot.revealedTiles.has(positionKey(position))) return 0;

  const distanceSquared = (position.x - snapshot.hero.x) ** 2 + (position.y - snapshot.hero.y) ** 2;
  return distanceSquared <= TORCH_RADIUS ** 2 ? 2 : 1;
}

/**
 * Returns the same per-tile visibility interpolation used by the fog layer.
 * Keeping entity presentation on this value prevents a newly revealed object
 * from appearing before the fog has reached its tile.
 */
export function interpolatedVisibilityLevel(
  previous: VisibilitySnapshot,
  current: VisibilitySnapshot,
  position: Position,
  progress: number,
): number {
  const from = visibilityLevel(previous, position);
  const to = visibilityLevel(current, position);
  const tileProgress = directionalVisibilityProgress(previous.hero, current.hero, position, progress);
  return from + (to - from) * tileProgress;
}

/** Maps a visibility level to the alpha used for world-space entities. */
export function entityVisibilityAlpha(level: number): number {
  if (level <= 1) return 0;
  const normalized = Math.max(0, Math.min(1, level - 1));
  return smoothStep(normalized);
}

/** Converts a visibility level to the charcoal overlay alpha used by the fog layer. */
export function fogAlphaForVisibility(visibility: number): number {
  if (visibility <= 0) return 0.96;
  if (visibility >= 2) return 0;
  return 0.72 * (2 - visibility);
}

/** Returns the optional tile-boundary stroke alpha for a visibility state. */
export function gridAlphaForVisibility(showGrid: boolean, visibility: number): number {
  if (!showGrid || visibility <= 0) return 0;
  return Math.max(0, Math.min(1, visibility / 2)) * 0.62;
}

export function visibilityColor(
  baseColor: number,
  visibility: number,
  unseenColor: number,
  rememberedColor: number,
): number {
  const rememberedTileColor = mixColor(rememberedColor, baseColor, REMEMBERED_TILE_MIX);

  if (visibility <= 1) {
    return mixColor(unseenColor, rememberedTileColor, Math.max(0, visibility));
  }

  return mixColor(rememberedTileColor, baseColor, Math.min(1, visibility - 1));
}

/**
 * Staggers a visibility transition along the Hero's movement direction. The
 * leading edge reveals after the tiles behind it, which makes fog changes feel
 * like a moving Torch sweep instead of a simultaneous recolor. The delayed
 * portion is intentionally long enough to read at the game's movement speed.
 */
export function directionalVisibilityProgress(
  previousHero: Position,
  currentHero: Position,
  position: Position,
  progress: number,
): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  if (clampedProgress >= 1) return 1;

  const directionX = currentHero.x - previousHero.x;
  const directionY = currentHero.y - previousHero.y;
  const movement = Math.max(Math.abs(directionX), Math.abs(directionY));
  if (movement === 0) return clampedProgress;

  const forwardX = directionX / movement;
  const forwardY = directionY / movement;
  const projection = (position.x - currentHero.x) * forwardX + (position.y - currentHero.y) * forwardY;
  const sweepRange = TORCH_RADIUS * 2 + 2;
  const normalizedProjection = Math.max(0, Math.min(1, (projection + TORCH_RADIUS + 1) / sweepRange));
  const delay = normalizedProjection * 0.72;
  const localProgress = Math.max(0, Math.min(1, (clampedProgress - delay) / (1 - delay)));
  return localProgress * localProgress * (3 - 2 * localProgress);
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

export function mixColor(from: number, to: number, progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  const fromRed = (from >> 16) & 0xff;
  const fromGreen = (from >> 8) & 0xff;
  const fromBlue = from & 0xff;
  const toRed = (to >> 16) & 0xff;
  const toGreen = (to >> 8) & 0xff;
  const toBlue = to & 0xff;
  const red = Math.round(fromRed + (toRed - fromRed) * clamped);
  const green = Math.round(fromGreen + (toGreen - fromGreen) * clamped);
  const blue = Math.round(fromBlue + (toBlue - fromBlue) * clamped);

  return (red << 16) | (green << 8) | blue;
}
