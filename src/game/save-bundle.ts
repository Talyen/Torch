import { PROFILE_SAVE_SCHEMA_VERSION, WORLD_SAVE_SCHEMA_VERSION, decodeProfileSave, decodeWorldSave } from '../sim';
import type { ProfileSaveV1, WorldSave } from '../sim';

export const SAVE_BUNDLE_SCHEMA_VERSION = 1 as const;
export const SAVE_INTEGRITY_ALGORITHM = 'fnv1a32' as const;

interface SaveBundlePayload {
  schemaVersion: typeof SAVE_BUNDLE_SCHEMA_VERSION;
  revision: number;
  worldId: string;
  profileId: string;
  generationVersion: number;
  worldSaveSchemaVersion: number;
  profileSaveSchemaVersion: number;
  world: WorldSave;
  profile: ProfileSaveV1;
}

export interface SaveBundle extends SaveBundlePayload {
  integrity: {
    algorithm: typeof SAVE_INTEGRITY_ALGORITHM;
    checksum: string;
  };
}

/** Stable non-cryptographic corruption check suitable for local save envelopes. */
export function checksumSerialized(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function payloadFor(world: WorldSave, profile: ProfileSaveV1, revision: number): SaveBundlePayload {
  return {
    schemaVersion: SAVE_BUNDLE_SCHEMA_VERSION,
    revision,
    worldId: world.worldId,
    profileId: profile.profileId,
    generationVersion: world.generationVersion,
    worldSaveSchemaVersion: WORLD_SAVE_SCHEMA_VERSION,
    profileSaveSchemaVersion: PROFILE_SAVE_SCHEMA_VERSION,
    world,
    profile,
  };
}

export function createSaveBundle(world: WorldSave, profile: ProfileSaveV1, revision: number): SaveBundle {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Save bundle revision must be non-negative.');
  const payload = payloadFor(world, profile, revision);
  return {
    ...payload,
    integrity: {
      algorithm: SAVE_INTEGRITY_ALGORITHM,
      checksum: checksumSerialized(JSON.stringify(payload)),
    },
  };
}

export function encodeSaveBundle(bundle: SaveBundle): string {
  return JSON.stringify(bundle);
}

function recordAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function integerAt(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${path} must be a non-negative integer.`);
  return value as number;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${path} must be a non-empty string.`);
  return value;
}

export function decodeSaveBundle(value: unknown): SaveBundle {
  const record = recordAt(value, 'saveBundle');
  const integrity = recordAt(record.integrity, 'saveBundle.integrity');
  if (record.schemaVersion !== SAVE_BUNDLE_SCHEMA_VERSION) throw new Error('Unsupported save bundle schema version.');
  if (integrity.algorithm !== SAVE_INTEGRITY_ALGORITHM) throw new Error('Unsupported save integrity algorithm.');

  const world = decodeWorldSave(record.world);
  const profile = decodeProfileSave(record.profile);
  const revision = integerAt(record.revision, 'saveBundle.revision');
  const worldId = stringAt(record.worldId, 'saveBundle.worldId');
  const profileId = stringAt(record.profileId, 'saveBundle.profileId');
  const generationVersion = integerAt(record.generationVersion, 'saveBundle.generationVersion');
  const worldSaveSchemaVersion = integerAt(record.worldSaveSchemaVersion, 'saveBundle.worldSaveSchemaVersion');
  const profileSaveSchemaVersion = integerAt(record.profileSaveSchemaVersion, 'saveBundle.profileSaveSchemaVersion');
  const checksum = stringAt(integrity.checksum, 'saveBundle.integrity.checksum');

  if (worldId !== world.worldId || profileId !== profile.profileId)
    throw new Error('Save bundle identity does not match its projections.');
  if (generationVersion !== world.generationVersion)
    throw new Error('Save bundle generation version does not match its world.');
  if (
    worldSaveSchemaVersion !== WORLD_SAVE_SCHEMA_VERSION ||
    profileSaveSchemaVersion !== PROFILE_SAVE_SCHEMA_VERSION
  ) {
    throw new Error('Save bundle projection version is unsupported.');
  }

  const payload = payloadFor(world, profile, revision);
  if (checksumSerialized(JSON.stringify(payload)) !== checksum) throw new Error('Save bundle integrity check failed.');
  return { ...payload, integrity: { algorithm: SAVE_INTEGRITY_ALGORITHM, checksum } };
}

export function decodeSaveBundleJson(serialized: string): SaveBundle {
  return decodeSaveBundle(JSON.parse(serialized) as unknown);
}
