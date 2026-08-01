import { CARDINAL_OFFSETS, floorDiv, positionKey, samePosition } from './coords';
import { unitRandom } from './rng';
import type { GameState, Position, TileKind } from './types';
import { enemyDefinitions } from '../content/enemies';
import { GATHERING_ACTION_COSTS } from './gathering';
import { heroDefinitions } from '../content/heroes';
import { createInitialWorldJournalState } from './journal';

export const GENERATION_VERSION = 6;
export const CHUNK_SIZE = 16;
export const TORCH_RADIUS = 3;

export function worldIdForSeed(seed: number): string {
  return `world:${seed}`;
}

export interface GeneratedTile {
  position: Position;
  kind: TileKind;
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/** Smooth value noise keeps adjacent tiles in the same biome instead of scattering colors. */
function valueNoise(seed: number, position: Position, scale: number, salt: number): number {
  const cellX = floorDiv(position.x, scale);
  const cellY = floorDiv(position.y, scale);
  const localX = smoothStep((position.x - cellX * scale) / scale);
  const localY = smoothStep((position.y - cellY * scale) / scale);
  const top = lerp(unitRandom(seed, cellX, cellY, salt), unitRandom(seed, cellX + 1, cellY, salt), localX);
  const bottom = lerp(unitRandom(seed, cellX, cellY + 1, salt), unitRandom(seed, cellX + 1, cellY + 1, salt), localX);
  return lerp(top, bottom, localY);
}

function safeSpawnArea(position: Position): boolean {
  return Math.abs(position.x) <= 4 && Math.abs(position.y - 2) <= 4;
}

/** Broad seeded bands stay grass so tree groves and mountain regions leave routes around them. */
function pathSignal(seed: number, position: Position): number {
  const phaseX = unitRandom(seed, 0, 0, 94) * Math.PI * 2;
  const phaseY = unitRandom(seed, 0, 0, 95) * Math.PI * 2;
  const vertical = Math.abs(Math.sin(position.x / 17 + Math.sin(position.y / 23 + phaseX)));
  const horizontal = Math.abs(Math.sin(position.y / 21 + Math.sin(position.x / 29 + phaseY)));
  return Math.min(vertical, horizontal);
}

export function tileAt(seed: number, position: Position): TileKind {
  if (safeSpawnArea(position)) return 'grass';

  const elevation = valueNoise(seed, position, 14, 11) * 0.72 + valueNoise(seed, position, 6, 12) * 0.28;
  const path = pathSignal(seed, position) < 0.18;

  if (!path && elevation > 0.76) return 'mountain';
  return 'grass';
}

export function isTerrainWalkable(kind: TileKind): boolean {
  return kind !== 'mountain';
}

export type GeneratedResourceKind = 'ore';

/** Every walkable tile directly beside mountain terrain contains ore by default. */
export function generatedResourceAt(seed: number, position: Position): GeneratedResourceKind | undefined {
  if (!isTerrainWalkable(tileAt(seed, position))) return undefined;
  const besideMountain = CARDINAL_OFFSETS.some(
    (offset) => tileAt(seed, { x: position.x + offset.x, y: position.y + offset.y }) === 'mountain',
  );
  return besideMountain ? 'ore' : undefined;
}

function groveSignal(seed: number, position: Position): number {
  return valueNoise(seed, position, 16, 21) * 0.7 + valueNoise(seed, position, 8, 22) * 0.3;
}

/** Forests are interactive tree entities layered over grass, never terrain kinds. */
export function generatedTreeAt(seed: number, position: Position): boolean {
  if (safeSpawnArea(position) || tileAt(seed, position) !== 'grass') return false;
  if (pathSignal(seed, position) < 0.18 || groveSignal(seed, position) <= 0.4) return false;
  return unitRandom(seed, position.x, position.y, 101) > 0.28;
}

export function generatedTreeId(position: Position): string {
  return `generated-tree:${positionKey(position)}`;
}

/** Materialize only a bounded ring of generated trees and retain chop mutations. */
export function materializeGeneratedTrees(state: GameState, center: Position, radius = TORCH_RADIUS + 5): void {
  const activeIds = new Set<string>();

  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      const position = { x, y };
      if (!generatedTreeAt(state.seed, position)) continue;

      const id = generatedTreeId(position);
      activeIds.add(id);
      if (state.removedGeneratedEntities[id] || state.entities[id]) continue;
      if (Object.values(state.entities).some((entity) => samePosition(entity.position, position))) continue;

      state.entities[id] = {
        id,
        kind: 'tree',
        name: 'Forest Tree',
        position,
        blocksMovement: true,
        resourceType: 'wood',
        gatheringActionCost: GATHERING_ACTION_COSTS.chop,
        remainingGatheringActions: state.gatheringProgress?.[id] ?? GATHERING_ACTION_COSTS.chop,
        actions: ['chop'],
      };
    }
  }

  for (const [id] of Object.entries(state.entities)) {
    if (id.startsWith('generated-tree:') && !activeIds.has(id)) {
      delete state.entities[id];
    }
  }
}

export function findGeneratedResourcePosition(
  seed: number,
  origin: Position,
  resource: GeneratedResourceKind,
  searchRadius = 10,
): Position | undefined {
  for (let distance = 2; distance <= searchRadius; distance += 1) {
    for (let y = origin.y - distance; y <= origin.y + distance; y += 1) {
      for (let x = origin.x - distance; x <= origin.x + distance; x += 1) {
        if (Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) !== distance) continue;
        const position = { x, y };
        if (resource === 'ore' && generatedResourceAt(seed, position)) return position;
      }
    }
  }
  return undefined;
}

export function generateChunk(seed: number, chunkX: number, chunkY: number, chunkSize = CHUNK_SIZE): GeneratedTile[] {
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
  const orePosition = findGeneratedResourcePosition(seed, heroPosition, 'ore') ?? { x: -3, y: 2 };

  const state: GameState = {
    worldId: worldIdForSeed(seed),
    seed,
    generationVersion: GENERATION_VERSION,
    turn: 0,
    homestead,
    unlockedStations: { workbench: true },
    hero: {
      heroId: heroDefinitions.knight.id,
      position: heroPosition,
      boundPosition: homestead,
      health: 10,
      maxHealth: 10,
      deaths: 0,
      inventory: {
        'iron-sword': 1,
        'steel-dagger': 1,
        'iron-axe': 1,
        'stone-pickaxe': 1,
        'iron-hammer': 1,
        'field-shovel': 1,
        wood: 12,
        ore: 6,
        'silver-ore': 2,
        bark: 8,
        'healing-potion': 3,
        antidote: 2,
        'trail-ration': 5,
        'torch-oil': 4,
        'ancient-coin': 2,
        'old-key': 1,
        'unidentified-relic': 1,
      },
      block: 0,
      primaryStats: { ...heroDefinitions.knight.primaryStats },
      equippedAbilities: {
        basic: 'ability.bash',
        skill: 'ability.sunder',
        ultimate: 'ability.avatar',
      },
      equippedItems: {},
      equippedTools: {},
      abilityCooldowns: {
        'ability.bash': 0,
        'ability.sunder': 0,
        'ability.avatar': 0,
      },
      activeAbilityEffects: [],
    },
    entities: {
      homestead: {
        id: 'homestead',
        kind: 'homestead',
        name: 'Bound Homestead',
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
        gatheringActionCost: GATHERING_ACTION_COSTS.chop,
        remainingGatheringActions: GATHERING_ACTION_COSTS.chop,
        actions: ['chop'],
      },
      'resource-ore': {
        id: 'resource-ore',
        kind: 'ore',
        name: 'Copper Vein',
        position: orePosition,
        blocksMovement: true,
        resourceType: 'ore',
        gatheringActionCost: GATHERING_ACTION_COSTS.mine,
        remainingGatheringActions: GATHERING_ACTION_COSTS.mine,
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
    removedGeneratedEntities: {},
    gatheringProgress: {},
    discoveries: {},
    revealedTiles: {},
    journal: createInitialWorldJournalState(),
  };

  revealAround(state, heroPosition);
  materializeGeneratedTrees(state, heroPosition);
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
