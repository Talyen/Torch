/**
 * Application-facing persistence contract. Providers store opaque serialized
 * bundles and never interpret simulation rules or save DTOs.
 */
export interface StoredSaveCandidate {
  revision: number;
  serialized: string;
  source: 'primary' | 'temporary' | 'backup';
}

export interface LegacySavePayloads {
  worldSerialized?: string;
  profileSerialized?: string;
}

export interface SaveLoadResult {
  /** Newest first. The application validates candidates and may recover to an older one. */
  candidates: StoredSaveCandidate[];
  /** Opaque invalid storage payloads retained by the provider for diagnostics. */
  corruptPayloads: string[];
  /** Pre-bundle development saves, read once and migrated by the application. */
  legacy?: LegacySavePayloads;
}

export type SaveCommitResult = 'committed' | 'stale';

export interface SaveProvider {
  load(slot: string): Promise<SaveLoadResult | undefined>;
  /** Implementations must reject a revision older than their latest accepted write. */
  commit(slot: string, serialized: string, revision: number): Promise<SaveCommitResult>;
}

export const PRIMARY_SAVE_SLOT = 'primary';
export const LEGACY_PRIMARY_WORLD_SAVE_SLOT = 'world:primary';
export const LEGACY_PRIMARY_PROFILE_SAVE_SLOT = 'profile:primary';
