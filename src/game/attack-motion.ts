import type { Position } from '../sim';

export const ATTACK_MOTION = {
  durationMs: 1000,
  windupMs: 400,
  swingMs: 150,
  recoverMs: 450,
  impactMs: 550,
} as const;

export interface AttackPose {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

/**
 * Samples the shared lunge recipe in logical pixels. The offset is projected
 * along the source-to-target vector, so the same authored timing works for
 * every grid direction instead of assuming a vertical battle lane.
 */
export function attackPoseAt(progress: number, source: Position, target: Position, tileSize: number): AttackPose {
  const t = Math.max(0, Math.min(1, progress));
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const directionX = dx / length;
  const directionY = dy / length;
  const offset = piecewiseLinear(t, [
    [0, -0.12],
    [ATTACK_MOTION.windupMs / ATTACK_MOTION.durationMs, -0.12],
    [ATTACK_MOTION.impactMs / ATTACK_MOTION.durationMs, 0.28],
    [1, 0],
  ]);
  const scaleX = piecewiseLinear(t, [
    [0, 0.98],
    [ATTACK_MOTION.windupMs / ATTACK_MOTION.durationMs, 0.98],
    [ATTACK_MOTION.impactMs / ATTACK_MOTION.durationMs, 1.05],
    [1, 1],
  ]);
  const scaleY = piecewiseLinear(t, [
    [0, 1.02],
    [ATTACK_MOTION.windupMs / ATTACK_MOTION.durationMs, 1.02],
    [ATTACK_MOTION.impactMs / ATTACK_MOTION.durationMs, 0.94],
    [1, 1],
  ]);
  const rotationDegrees = piecewiseLinear(t, [
    [0, -4],
    [ATTACK_MOTION.windupMs / ATTACK_MOTION.durationMs, -4],
    [ATTACK_MOTION.impactMs / ATTACK_MOTION.durationMs, 3],
    [1, 0],
  ]);

  return {
    offsetX: directionX * offset * tileSize || 0,
    offsetY: directionY * offset * tileSize || 0,
    scaleX,
    scaleY,
    rotation: (rotationDegrees * Math.PI) / 180,
  };
}

function piecewiseLinear(progress: number, points: Array<[number, number]>): number {
  if (progress <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    const [endX, endY] = points[index];
    const [startX, startY] = points[index - 1];
    if (progress <= endX) {
      const span = endX - startX || 1;
      const local = (progress - startX) / span;
      return startY + (endY - startY) * local;
    }
  }
  return points.at(-1)?.[1] ?? 0;
}
