import { checksumSerialized } from '../game/save-bundle';
import type {
  LegacySavePayloads,
  SaveCommitResult,
  SaveLoadResult,
  SaveProvider,
  StoredSaveCandidate,
} from '../game/save-provider';
import { LEGACY_PRIMARY_PROFILE_SAVE_SLOT, LEGACY_PRIMARY_WORLD_SAVE_SLOT } from '../game/save-provider';

const STORAGE_PREFIX = 'torch.save.';
const BUNDLE_FORMAT_VERSION = 1 as const;

interface StoredBundleEnvelope {
  formatVersion: typeof BUNDLE_FORMAT_VERSION;
  revision: number;
  data: string;
  checksum: string;
}

interface LegacyStoredSave {
  revision: number;
  data: string;
}

function decodeEnvelope(raw: string): StoredBundleEnvelope | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    if (
      record.formatVersion !== BUNDLE_FORMAT_VERSION ||
      !Number.isSafeInteger(record.revision) ||
      (record.revision as number) < 0 ||
      typeof record.data !== 'string' ||
      typeof record.checksum !== 'string'
    ) {
      return undefined;
    }
    if (checksumSerialized(record.data) !== record.checksum) return undefined;
    return {
      formatVersion: BUNDLE_FORMAT_VERSION,
      revision: record.revision as number,
      data: record.data,
      checksum: record.checksum,
    };
  } catch {
    return undefined;
  }
}

function unwrapLegacy(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return raw;
    const record = value as Record<string, unknown>;
    if (Number.isSafeInteger(record.revision) && typeof record.data === 'string') {
      return (record as unknown as LegacyStoredSave).data;
    }
    return raw;
  } catch {
    return raw;
  }
}

/** Crash-safe localStorage adapter with primary, temporary, and backup snapshots. */
export class LocalStorageSaveProvider implements SaveProvider {
  private acceptedRevisions = new Map<string, number>();

  public constructor(private readonly storageOverride?: Storage | null) {}

  public load(slot: string): Promise<SaveLoadResult | undefined> {
    const storage = this.storage();
    if (!storage) return Promise.resolve(undefined);

    const candidates: StoredSaveCandidate[] = [];
    const corruptPayloads: string[] = [];
    const sources = ['primary', 'temporary', 'backup'] as const;
    for (const source of sources) {
      const raw = storage.getItem(this.bundleKey(slot, source));
      if (!raw) continue;
      const envelope = decodeEnvelope(raw);
      if (!envelope) {
        corruptPayloads.push(raw);
        continue;
      }
      candidates.push({ revision: envelope.revision, serialized: envelope.data, source });
    }
    candidates.sort((left, right) => right.revision - left.revision);
    if (candidates[0]) {
      this.acceptedRevisions.set(slot, Math.max(this.acceptedRevisions.get(slot) ?? -1, candidates[0].revision));
    }

    const legacy: LegacySavePayloads = {
      worldSerialized: unwrapLegacy(storage.getItem(this.legacyKey(LEGACY_PRIMARY_WORLD_SAVE_SLOT))),
      profileSerialized: unwrapLegacy(storage.getItem(this.legacyKey(LEGACY_PRIMARY_PROFILE_SAVE_SLOT))),
    };
    const hasLegacy = Boolean(legacy.worldSerialized || legacy.profileSerialized);
    if (candidates.length === 0 && corruptPayloads.length === 0 && !hasLegacy) return Promise.resolve(undefined);
    return Promise.resolve({ candidates, corruptPayloads, ...(hasLegacy ? { legacy } : {}) });
  }

  public commit(slot: string, serialized: string, revision: number): Promise<SaveCommitResult> {
    const storage = this.storage();
    if (!storage) return Promise.resolve('committed');

    const latestRevision = this.latestRevision(storage, slot);
    if (revision < latestRevision) return Promise.resolve('stale');

    const envelope: StoredBundleEnvelope = {
      formatVersion: BUNDLE_FORMAT_VERSION,
      revision,
      data: serialized,
      checksum: checksumSerialized(serialized),
    };
    const encoded = JSON.stringify(envelope);
    const primaryKey = this.bundleKey(slot, 'primary');
    const temporaryKey = this.bundleKey(slot, 'temporary');
    const backupKey = this.bundleKey(slot, 'backup');
    const priorPrimary = storage.getItem(primaryKey);
    if (priorPrimary && decodeEnvelope(priorPrimary)) storage.setItem(backupKey, priorPrimary);

    storage.setItem(temporaryKey, encoded);
    const verifiedTemporary = storage.getItem(temporaryKey);
    const decodedTemporary = verifiedTemporary ? decodeEnvelope(verifiedTemporary) : undefined;
    if (
      !verifiedTemporary ||
      !decodedTemporary ||
      decodedTemporary.revision !== revision ||
      decodedTemporary.data !== serialized
    ) {
      throw new Error('Temporary save verification failed.');
    }
    storage.setItem(primaryKey, verifiedTemporary);
    storage.removeItem(temporaryKey);
    this.acceptedRevisions.set(slot, revision);
    return Promise.resolve('committed');
  }

  private latestRevision(storage: Storage, slot: string): number {
    const remembered = this.acceptedRevisions.get(slot) ?? -1;
    const primaryRaw = storage.getItem(this.bundleKey(slot, 'primary'));
    const primary = primaryRaw ? decodeEnvelope(primaryRaw) : undefined;
    return Math.max(remembered, primary?.revision ?? -1);
  }

  private bundleKey(slot: string, source: 'primary' | 'temporary' | 'backup'): string {
    return `${STORAGE_PREFIX}bundle.${slot}.${source}`;
  }

  private legacyKey(slot: string): string {
    return `${STORAGE_PREFIX}${slot}`;
  }

  private storage(): Storage | undefined {
    if (this.storageOverride === null) return undefined;
    if (this.storageOverride) return this.storageOverride;
    if (typeof window === 'undefined') return undefined;
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  }
}
