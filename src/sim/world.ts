import { floorDiv, positionKey } from './coords';
import { unitRandom } from './rng';
import type { GameState, Position, TileKind } from './types';
import { enemyDefinitions } from '../content/enemies';
import { heroDefinitions } from '../content/heroes';

export const GENERATION_VERSION = 1;
export const CHUNK_SIZE = 16;
export const TORCH_RADIUS = 3;

export interface GeneratedTile {
  position: Position;
  kind: TileKind;
}

export function tileAt(seed: number, position: Position): TileKind {
  const sample = unitRandom(seed, position.x, position.y, 11);

  if (sample < 0.08) return 'water';
  if (sample < 0.22) return 'stone-floor';
  if (sample < 0.42) return 'forest-floor';
  return 'grass';
}

export function generateChunk(
  seed: number,
  chunkX: number,
  chunkY: number,
  chunkSize = CHUNK_SIZE,
): GeneratedTile[] {
  const tiles: GeneratedTile[] = [];
  const startX = chunkX * chunkSize;
  const startY = chunkY * chunkSize;

  for (let localY = 0; localY < chunkSize; localY += 1) {
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const position = { x: startX + localX, y: startY + localY };
      tiles.push({ position, kind: tileAt(seed, position) });
    }
  }

  return tiles;
}

export function chunkForPosition(position: Position, chunkSize = CHUNK_SIZE): { x: number; y: number } {
  return { x: floorDiv(position.x, chunkSize), y: floorDiv(position.y, chunkSize) };
}

export function createInitialGameState(seed = 20260730): GameState {
  const homestead = { x: 0, y: 0 };
  const heroPosition = { x: 0, y: 2 };

  const state: GameState = {
    seed,
    generationVersion: GENERATION_VERSION,
    turn: 0,
    homestead,
    hero: {
      heroId: heroDefinitions.knight.id,
      position: heroPosition,
      boundPosition: homestead,
      health: 10,
      maxHealth: 10,
      deaths: 0,
      inventory: {},
      primaryStats: { ...heroDefinitions.knight.primaryStats },
    },
    entities: {
      homestead: {
        id: 'homestead',
        kind: 'homestead',
        name: 'First Light Homestead',
        position: homestead,
        blocksMovement: false,
      },
      'resource-tree': {
        id: 'resource-tree',
        kind: 'tree',
        name: 'Old Pine',
        position: { x: 3, y: 2 },
        blocksMovement: true,
        resourceType: 'wood',
        actions: ['chop'],
      },
      'resource-ore': {
        id: 'resource-ore',
        kind: 'ore',
        name: 'Copper Vein',
        position: { x: -3, y: 2 },
        blocksMovement: true,
        resourceType: 'ore',
        actions: ['mine'],
      },
      slime: {
        id: enemyDefinitions.slime.id,
        kind: 'enemy',
        name: enemyDefinitions.slime.name,
        position: { x: 5, y: 2 },
        blocksMovement: true,
        health: enemyDefinitions.slime.health,
        maxHealth: enemyDefinitions.slime.health,
        attack: enemyDefinitions.slime.attack,
        assetId: enemyDefinitions.slime.assetId,
        disposition: enemyDefinitions.slime.disposition,
        alerted: false,
        actions: [...enemyDefinitions.slime.actions],
        primaryStats: { ...enemyDefinitions.slime.primaryStats },
        footprint: { ...enemyDefinitions.slime.footprint },
      },
    },
    revealedTiles: {},
  };

  revealAround(state, heroPosition);
  return state;
}

export function revealAround(state: GameState, center: Position, radius = TORCH_RADIUS): void {
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      const distanceSquared = (x - center.x) ** 2 + (y - center.y) ** 2;
      if (distanceSquared <= radius ** 2) {
        state.revealedTiles[positionKey({ x, y })] = true;
      }
    }
  }
}
