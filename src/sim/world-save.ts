import {
  entityStateAt,
  exactKeys,
  fail,
  booleanAt,
  heroStateAt,
  integerAt,
  nonNegativeIntegerAt,
  positiveIntegerAt,
  recordAt,
  safeRecordKey,
  stringAt,
} from './save-validation';
import { cloneSerializable } from './state';
import type {
  EntityState,
  GameState,
  HeroState,
  JournalEntryRuntime,
  JournalEntryStatus,
  Position,
  WaypointStatus,
  WorldJournalState,
} from './types';
import { createInitialGameState, GENERATION_VERSION, materializeGeneratedTrees, worldIdForSeed } from './world';

export const WORLD_SAVE_SCHEMA_VERSION = 2;

export interface WorldSaveV2 {
  schemaVersion: 2;
  worldId: string;
  seed: number;
  generationVersion: number;
  turn: number;
  hero: HeroState;
  homestead: Position;
  unlockedStations: Record<string, true>;
  entityMutations: {
    updated: Record<string, EntityState>;
    removed: string[];
  };
  removedGeneratedEntities: Record<string, true>;
  gatheringProgress: Record<string, number>;
  discoveries: Record<string, true>;
  revealedTiles: Record<string, true>;
  journal: WorldJournalState;
}

/** Current development save shape. Older development saves are intentionally
 * invalidated rather than migrated while the game is still changing quickly. */
export type WorldSave = WorldSaveV2;

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

function entityMutationsFor(state: GameState): WorldSaveV2['entityMutations'] {
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

export function createWorldSave(state: GameState): WorldSaveV2 {
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
    unlockedStations: cloneRecord(state.unlockedStations),
    entityMutations: entityMutationsFor(state),
    removedGeneratedEntities: cloneRecord(state.removedGeneratedEntities),
    gatheringProgress: cloneRecord(state.gatheringProgress),
    discoveries: cloneRecord(state.discoveries),
    revealedTiles: cloneRecord(state.revealedTiles),
    journal: cloneSerializable(state.journal),
  };
}

/** Encode a validated v2 DTO with stable object insertion order. */
export function encodeWorldSave(save: WorldSaveV2): string {
  return JSON.stringify(save);
}

/** Decode a serialized v2 DTO without making JSON parsing part of the sim. */
export function decodeWorldSaveJson(serialized: string): WorldSaveV2 {
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

const JOURNAL_STATUSES = new Set<JournalEntryStatus>([
  'locked',
  'active',
  'complete',
  'reward-ready',
  'claimed',
  'failed',
  'expired',
  'abandoned',
]);

function journalRuntimeAt(value: unknown, path: string): JournalEntryRuntime {
  const record = recordAt(value, path);
  exactKeys(record, ['status', 'progress', 'discoveredClueIds', 'seen'], ['lastUpdatedTurn'], path);
  const status = stringAt(record.status, `${path}.status`) as JournalEntryStatus;
  if (!JOURNAL_STATUSES.has(status)) fail(`${path}.status`, 'unexpected value');
  const progress = numberRecordAt(record.progress, `${path}.progress`);
  return {
    status,
    progress,
    discoveredClueIds: trueRecordAt(record.discoveredClueIds, `${path}.discoveredClueIds`),
    seen: booleanAt(record.seen, `${path}.seen`),
    ...(Object.hasOwn(record, 'lastUpdatedTurn')
      ? { lastUpdatedTurn: nonNegativeIntegerAt(record.lastUpdatedTurn, `${path}.lastUpdatedTurn`) }
      : {}),
  };
}

function waypointAt(value: unknown, path: string): WorldJournalState['waypoint'] {
  const record = recordAt(value, path);
  exactKeys(record, ['entryId', 'target', 'status'], [], path);
  const target = recordAt(record.target, `${path}.target`);
  const kind = stringAt(target.kind, `${path}.target.kind`);
  const status = stringAt(record.status, `${path}.status`);
  if (!new Set(['active', 'unresolved', 'removed']).has(status)) fail(`${path}.status`, 'unexpected value');
  if (kind === 'coordinate') {
    const position = recordAt(target.position, `${path}.target.position`);
    exactKeys(position, ['x', 'y'], [], `${path}.target.position`);
    return {
      entryId: stringAt(record.entryId, `${path}.entryId`),
      target: {
        kind,
        position: {
          x: integerAt(position.x, `${path}.target.position.x`),
          y: integerAt(position.y, `${path}.target.position.y`),
        },
      },
      status: status as WaypointStatus,
    };
  }
  if (kind !== 'location' && kind !== 'entity' && kind !== 'derived') fail(`${path}.target.kind`, 'unexpected value');
  const targetCopy =
    kind === 'location'
      ? { kind: 'location' as const, locationId: stringAt(target.locationId, `${path}.target.locationId`) }
      : kind === 'entity'
        ? { kind: 'entity' as const, entityId: stringAt(target.entityId, `${path}.target.entityId`) }
        : {
            kind: 'derived' as const,
            resolverId: stringAt(target.resolverId, `${path}.target.resolverId`),
            parameters: stringRecordAt(target.parameters, `${path}.target.parameters`),
          };
  return { entryId: stringAt(record.entryId, `${path}.entryId`), target: targetCopy, status: status as WaypointStatus };
}

function stringRecordAt(value: unknown, path: string): Record<string, string> {
  const record = recordAt(value, path);
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    safeRecordKey(key, `${path}.${key}`);
    result[key] = stringAt(entry, `${path}.${key}`);
  }
  return result;
}

function worldJournalAt(value: unknown, path: string): WorldJournalState {
  const record = recordAt(value, path);
  exactKeys(record, ['schemaVersion', 'entries', 'rewardClaims'], ['focusedEntryId', 'waypoint'], path);
  if (positiveIntegerAt(record.schemaVersion, `${path}.schemaVersion`) !== 1)
    fail(`${path}.schemaVersion`, 'unsupported Journal schema version');
  const entriesRecord = recordAt(record.entries, `${path}.entries`);
  const entries: Record<string, JournalEntryRuntime> = {};
  for (const [key, value] of Object.entries(entriesRecord)) {
    safeRecordKey(key, `${path}.entries.${key}`);
    entries[key] = journalRuntimeAt(value, `${path}.entries.${key}`);
  }
  return {
    schemaVersion: 1,
    entries,
    rewardClaims: trueRecordAt(record.rewardClaims, `${path}.rewardClaims`),
    ...(Object.hasOwn(record, 'focusedEntryId')
      ? { focusedEntryId: stringAt(record.focusedEntryId, `${path}.focusedEntryId`) }
      : {}),
    ...(Object.hasOwn(record, 'waypoint') ? { waypoint: waypointAt(record.waypoint, `${path}.waypoint`) } : {}),
  };
}

export function decodeWorldSave(value: unknown): WorldSaveV2 {
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
      'unlockedStations',
      'entityMutations',
      'removedGeneratedEntities',
      'gatheringProgress',
      'discoveries',
      'revealedTiles',
      'journal',
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
    unlockedStations: trueRecordAt(record.unlockedStations, 'worldSave.unlockedStations'),
    entityMutations: { updated, removed },
    removedGeneratedEntities: trueRecordAt(
      record.removedGeneratedEntities,
      'worldSave.removedGeneratedEntities',
      'generated-tree:',
    ),
    gatheringProgress: numberRecordAt(record.gatheringProgress, 'worldSave.gatheringProgress', 'generated-tree:'),
    discoveries: trueRecordAt(record.discoveries, 'worldSave.discoveries'),
    revealedTiles: trueRecordAt(record.revealedTiles, 'worldSave.revealedTiles'),
    journal: worldJournalAt(record.journal, 'worldSave.journal'),
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
  state.unlockedStations = cloneRecord(save.unlockedStations);
  state.removedGeneratedEntities = cloneRecord(save.removedGeneratedEntities);
  state.gatheringProgress = cloneRecord(save.gatheringProgress);
  state.discoveries = cloneRecord(save.discoveries);
  state.revealedTiles = cloneRecord(save.revealedTiles);
  state.journal = cloneSerializable(save.journal);

  for (const id of Object.keys(state.entities)) {
    if (isGeneratedEntityId(id)) delete state.entities[id];
  }
  for (const id of save.entityMutations.removed) delete state.entities[id];
  for (const [id, entity] of Object.entries(save.entityMutations.updated)) {
    state.entities[id] = cloneSerializable(entity);
  }

  materializeGeneratedTrees(state, state.hero.position);
  return cloneSerializable(state);
}
