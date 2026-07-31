import { TORCH_RADIUS } from '../sim';

export function tileSizeForViewport(width: number, height: number, radius = TORCH_RADIUS): number {
  const shortestSide = Math.max(1, Math.min(width, height));
  return shortestSide / (radius * 2 + 1);
}

export function viewRadiusForViewport(
  width: number,
  height: number,
  tileSize: number,
  margin = 2,
): { x: number; y: number } {
  return {
    x: Math.ceil(width / tileSize / 2) + margin,
    y: Math.ceil(height / tileSize / 2) + margin,
  };
}
