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
