import {
  entityStateAt,
  exactKeys,
  fail,
  heroStateAt,
  integerAt,
  nonNegativeIntegerAt,
  positiveIntegerAt,
  recordAt,
  safeRecordKey,
} from './save-validation';
import { cloneGameState, cloneSerializable } from './state';
import type { EntityState, GameState, HeroState, Position } from './types';
import { createInitialGameState, GENERATION_VERSION, materializeGeneratedTrees, worldIdForSeed } from './world';

export const WORLD_SAVE_SCHEMA_VERSION = 1;

export interface WorldSaveV1 {
  schemaVersion: 1;
  worldId: string;
  seed: number;
  generationVersion: number;
  turn: number;
  hero: HeroState;
  homestead: Position;
  entityMutations: {
    updated: Record<string, EntityState>;
    removed: string[];
  };
  removedGeneratedEntities: Record<string, true>;
  gatheringProgress: Record<string, number>;
  discoveries: Record<string, true>;
  revealedTiles: Record<string, true>;
}

function isGeneratedEntityId(id: string): boolean {
  return id.startsWith('generated-tree:');
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((entry, index) => valuesEqual(entry, right[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(rightRecord, key) && valuesEqual(leftRecord[key], rightRecord[key]))
  );
}

function cloneRecord<T>(value: Record<string, T>): Record<string, T> {
  return cloneSerializable(value);
}

function entityMutationsFor(state: GameState): WorldSaveV1['entityMutations'] {
  const baseline = createInitialGameState(state.seed);
  const updated: Record<string, EntityState> = {};
  const removed: string[] = [];
  const ids = new Set([...Object.keys(baseline.entities), ...Object.keys(state.entities)]);

  for (const id of [...ids].sort()) {
    if (isGeneratedEntityId(id)) continue;
    const baselineEntity = baseline.entities[id];
    const currentEntity = state.entities[id];
    if (!currentEntity) {
      removed.push(id);
    } else if (!baselineEntity || !valuesEqual(currentEntity, baselineEntity)) {
      updated[id] = cloneSerializable(currentEntity);
    }
  }

  return { updated, removed };
}

export function createWorldSave(state: GameState): WorldSaveV1 {
  if (state.generationVersion !== GENERATION_VERSION) {
    throw new Error(`Cannot save generation version ${state.generationVersion}; expected ${GENERATION_VERSION}.`);
  }
  if (state.worldId !== worldIdForSeed(state.seed)) {
    throw new Error(`Cannot save world ${state.worldId}; expected ${worldIdForSeed(state.seed)}.`);
  }

  return {
    schemaVersion: WORLD_SAVE_SCHEMA_VERSION,
    worldId: state.worldId,
    seed: state.seed,
    generationVersion: state.generationVersion,
    turn: state.turn,
    hero: cloneSerializable(state.hero),
    homestead: cloneSerializable(state.homestead),
    entityMutations: entityMutationsFor(state),
    removedGeneratedEntities: cloneRecord(state.removedGeneratedEntities),
    gatheringProgress: cloneRecord(state.gatheringProgress),
    discoveries: cloneRecord(state.discoveries),
    revealedTiles: cloneRecord(state.revealedTiles),
  };
}

/** Encode a validated v1 DTO with stable object insertion order. */
export function encodeWorldSave(save: WorldSaveV1): string {
  return JSON.stringify(save);
}

/** Decode a serialized v1 DTO without making JSON parsing part of the sim. */
export function decodeWorldSaveJson(serialized: string): WorldSaveV1 {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    fail('worldSave', 'contains invalid JSON');
  }
  return decodeWorldSave(value);
}

function trueRecordAt(value: unknown, path: string, requiredPrefix?: string): Record<string, true> {
  const record = recordAt(value, path);
  const result: Record<string, true> = {};
  for (const [key, entry] of Object.entries(record)) {
    safeRecordKey(key, `${path}.${key}`);
    if (requiredPrefix && !key.startsWith(requiredPrefix)) fail(`${path}.${key}`, `expected a ${requiredPrefix} key`);
    if (entry !== true) fail(`${path}.${key}`, 'expected true');
    result[key] = true;
  }
  return result;
}

function numberRecordAt(value: unknown, path: string, requiredPrefix?: string): Record<string, number> {
  const record = recordAt(value, path);
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(record)) {
    safeRecordKey(key, `${path}.${key}`);
    if (requiredPrefix && !key.startsWith(requiredPrefix)) fail(`${path}.${key}`, `expected a ${requiredPrefix} key`);
    result[key] = nonNegativeIntegerAt(entry, `${path}.${key}`);
  }
  return result;
}

export function decodeWorldSave(value: unknown): WorldSaveV1 {
  const record = recordAt(value, 'worldSave');
  exactKeys(
    record,
    [
      'schemaVersion',
      'worldId',
      'seed',
      'generationVersion',
      'turn',
      'hero',
      'homestead',
      'entityMutations',
      'removedGeneratedEntities',
      'gatheringProgress',
      'discoveries',
      'revealedTiles',
    ],
    [],
    'worldSave',
  );

  const schemaVersion = positiveIntegerAt(record.schemaVersion, 'worldSave.schemaVersion');
  if (schemaVersion !== WORLD_SAVE_SCHEMA_VERSION) {
    fail('worldSave.schemaVersion', `unsupported schema version ${schemaVersion}`);
  }

  const mutations = recordAt(record.entityMutations, 'worldSave.entityMutations');
  exactKeys(mutations, ['updated', 'removed'], [], 'worldSave.entityMutations');
  const updatedRecord = recordAt(mutations.updated, 'worldSave.entityMutations.updated');
  const updated: Record<string, EntityState> = {};
  for (const [id, entityValue] of Object.entries(updatedRecord)) {
    safeRecordKey(id, `worldSave.entityMutations.updated.${id}`);
    if (isGeneratedEntityId(id))
      fail(`worldSave.entityMutations.updated.${id}`, 'generated baseline entities must not be serialized');
    const entity = entityStateAt(entityValue, `worldSave.entityMutations.updated.${id}`);
    if (entity.id !== id) fail(`worldSave.entityMutations.updated.${id}.id`, 'must match its record key');
    updated[id] = entity;
  }

  if (!Array.isArray(mutations.removed)) fail('worldSave.entityMutations.removed', 'expected an array');
  const removed = mutations.removed.map((entry, index) => {
    if (typeof entry !== 'string' || entry.length === 0) {
      return fail(`worldSave.entityMutations.removed[${index}]`, 'expected a non-empty string');
    }
    safeRecordKey(entry, `worldSave.entityMutations.removed[${index}]`);
    if (isGeneratedEntityId(entry)) {
      fail(`worldSave.entityMutations.removed[${index}]`, 'generated removals belong in removedGeneratedEntities');
    }
    return entry;
  });
  if (new Set(removed).size !== removed.length) fail('worldSave.entityMutations.removed', 'contains duplicate IDs');
  for (const id of removed) {
    if (updated[id]) fail(`worldSave.entityMutations.${id}`, 'cannot be both updated and removed');
  }

  const homesteadRecord = recordAt(record.homestead, 'worldSave.homestead');
  exactKeys(homesteadRecord, ['x', 'y'], [], 'worldSave.homestead');

  return {
    schemaVersion: WORLD_SAVE_SCHEMA_VERSION,
    worldId:
      typeof record.worldId === 'string' && record.worldId.length > 0
        ? record.worldId
        : fail('worldSave.worldId', 'expected a non-empty string'),
    seed: integerAt(record.seed, 'worldSave.seed'),
    generationVersion: positiveIntegerAt(record.generationVersion, 'worldSave.generationVersion'),
    turn: nonNegativeIntegerAt(record.turn, 'worldSave.turn'),
    hero: heroStateAt(record.hero, 'worldSave.hero'),
    homestead: {
      x: integerAt(homesteadRecord.x, 'worldSave.homestead.x'),
      y: integerAt(homesteadRecord.y, 'worldSave.homestead.y'),
    },
    entityMutations: { updated, removed },
    removedGeneratedEntities: trueRecordAt(
      record.removedGeneratedEntities,
      'worldSave.removedGeneratedEntities',
      'generated-tree:',
    ),
    gatheringProgress: numberRecordAt(record.gatheringProgress, 'worldSave.gatheringProgress', 'generated-tree:'),
    discoveries: trueRecordAt(record.discoveries, 'worldSave.discoveries'),
    revealedTiles: trueRecordAt(record.revealedTiles, 'worldSave.revealedTiles'),
  };
}

export function restoreWorldSave(value: unknown): GameState {
  const save = decodeWorldSave(value);
  if (save.generationVersion !== GENERATION_VERSION) {
    throw new Error(`Cannot load generation version ${save.generationVersion}; expected ${GENERATION_VERSION}.`);
  }

  const state = createInitialGameState(save.seed);
  if (save.worldId !== worldIdForSeed(save.seed)) {
    throw new Error(`Cannot load world ${save.worldId}; expected ${worldIdForSeed(save.seed)}.`);
  }
  state.turn = save.turn;
  state.worldId = save.worldId;
  state.hero = cloneSerializable(save.hero);
  state.homestead = cloneSerializable(save.homestead);
  state.removedGeneratedEntities = cloneRecord(save.removedGeneratedEntities);
  state.gatheringProgress = cloneRecord(save.gatheringProgress);
  state.discoveries = cloneRecord(save.discoveries);
  state.revealedTiles = cloneRecord(save.revealedTiles);

  for (const id of Object.keys(state.entities)) {
    if (isGeneratedEntityId(id)) delete state.entities[id];
  }
  for (const id of save.entityMutations.removed) delete state.entities[id];
  for (const [id, entity] of Object.entries(save.entityMutations.updated)) {
    state.entities[id] = cloneSerializable(entity);
  }

  materializeGeneratedTrees(state, state.hero.position);
  return cloneGameState(state);
}
