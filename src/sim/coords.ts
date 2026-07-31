import type { Direction, Position } from './types';

export const DIRECTION_DELTAS: Record<Direction, Position> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  east: { x: 1, y: 0 },
};

export function directionDelta(direction: Direction): Position {
  return DIRECTION_DELTAS[direction];
}

export function addPosition(position: Position, delta: Position): Position {
  return { x: position.x + delta.x, y: position.y + delta.y };
}

export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isCardinallyAdjacent(a: Position, b: Position): boolean {
  return manhattanDistance(a, b) === 1;
}

export function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

export function chunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

export function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}
