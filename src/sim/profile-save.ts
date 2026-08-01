import {
  booleanAt,
  exactKeys,
  fail,
  nonNegativeIntegerAt,
  positiveIntegerAt,
  recordAt,
  safeRecordKey,
  stringAt,
} from './save-validation';
import { cloneSerializable } from './state';
import { createInitialProfileJournalState } from './journal';
import type { JournalEntryRuntime, JournalEntryStatus, ProfileJournalState } from './types';

export const PROFILE_SAVE_SCHEMA_VERSION = 1 as const;

export interface ProfileSaveV1 {
  schemaVersion: 1;
  profileId: string;
  journal: ProfileJournalState;
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

function trueRecordAt(value: unknown, path: string): Record<string, true> {
  const record = recordAt(value, path);
  const result: Record<string, true> = {};
  for (const [key, entry] of Object.entries(record)) {
    safeRecordKey(key, `${path}.${key}`);
    if (entry !== true) fail(`${path}.${key}`, 'expected true');
    result[key] = true;
  }
  return result;
}

function runtimeAt(value: unknown, path: string): JournalEntryRuntime {
  const record = recordAt(value, path);
  exactKeys(record, ['status', 'progress', 'discoveredClueIds', 'seen'], ['lastUpdatedTurn'], path);
  const status = stringAt(record.status, `${path}.status`) as JournalEntryStatus;
  if (!JOURNAL_STATUSES.has(status)) fail(`${path}.status`, 'unexpected value');
  const progressRecord = recordAt(record.progress, `${path}.progress`);
  const progress: Record<string, number> = {};
  for (const [key, entry] of Object.entries(progressRecord)) {
    safeRecordKey(key, `${path}.progress.${key}`);
    progress[key] = nonNegativeIntegerAt(entry, `${path}.progress.${key}`);
  }
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

function journalAt(value: unknown, path: string): ProfileJournalState {
  const record = recordAt(value, path);
  exactKeys(record, ['schemaVersion', 'entries', 'rewardClaims', 'unlocks', 'observations'], [], path);
  if (positiveIntegerAt(record.schemaVersion, `${path}.schemaVersion`) !== 1) {
    fail(`${path}.schemaVersion`, 'unsupported Journal schema version');
  }
  const entriesRecord = recordAt(record.entries, `${path}.entries`);
  const entries: Record<string, JournalEntryRuntime> = {};
  for (const [key, entry] of Object.entries(entriesRecord)) {
    safeRecordKey(key, `${path}.entries.${key}`);
    entries[key] = runtimeAt(entry, `${path}.entries.${key}`);
  }
  return {
    schemaVersion: 1,
    entries,
    rewardClaims: trueRecordAt(record.rewardClaims, `${path}.rewardClaims`),
    unlocks: trueRecordAt(record.unlocks, `${path}.unlocks`),
    observations: trueRecordAt(record.observations, `${path}.observations`),
  };
}

export function createInitialProfileSave(profileId = 'profile:primary'): ProfileSaveV1 {
  return { schemaVersion: PROFILE_SAVE_SCHEMA_VERSION, profileId, journal: createInitialProfileJournalState() };
}

export function createProfileSave(journal: ProfileJournalState, profileId = 'profile:primary'): ProfileSaveV1 {
  return { schemaVersion: PROFILE_SAVE_SCHEMA_VERSION, profileId, journal: cloneSerializable(journal) };
}

export function encodeProfileSave(save: ProfileSaveV1): string {
  return JSON.stringify(save);
}

export function decodeProfileSaveJson(serialized: string): ProfileSaveV1 {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    fail('profileSave', 'contains invalid JSON');
  }
  return decodeProfileSave(value);
}

export function decodeProfileSave(value: unknown): ProfileSaveV1 {
  const record = recordAt(value, 'profileSave');
  exactKeys(record, ['schemaVersion', 'profileId', 'journal'], [], 'profileSave');
  if (positiveIntegerAt(record.schemaVersion, 'profileSave.schemaVersion') !== PROFILE_SAVE_SCHEMA_VERSION) {
    fail('profileSave.schemaVersion', 'unsupported schema version');
  }
  return {
    schemaVersion: PROFILE_SAVE_SCHEMA_VERSION,
    profileId: stringAt(record.profileId, 'profileSave.profileId'),
    journal: journalAt(record.journal, 'profileSave.journal'),
  };
}
