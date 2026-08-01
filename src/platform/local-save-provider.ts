import type { SaveProvider } from '../game/save-provider';

const STORAGE_PREFIX = 'torch.save.';

interface StoredSave {
  revision: number;
  data: string;
}

function isStoredSave(value: unknown): value is StoredSave {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Number.isSafeInteger(record.revision) && (record.revision as number) >= 0 && typeof record.data === 'string';
}

/** Synchronous localStorage adapter used by the browser vertical slice. */
export class LocalStorageSaveProvider implements SaveProvider {
  public readonly supportsIndependentSlots = true;
  private revisions = new Map<string, number>();

  public load(slot: string): string | undefined {
    const storage = this.storage();
    if (!storage) return undefined;

    let raw: string | null = null;
    try {
      raw = storage.getItem(this.key(slot));
      if (!raw) return undefined;
      const parsed: unknown = JSON.parse(raw);
      if (isStoredSave(parsed)) {
        this.revisions.set(slot, parsed.revision);
        return parsed.data;
      }
      // Permit a raw v1 save from an early development build to be read once;
      // the next action rewrites it in the revisioned envelope.
      return raw ?? undefined;
    } catch {
      // Return the opaque payload so GameSession can surface a recoverable
      // decode error instead of silently treating corruption as no save.
      return raw ?? undefined;
    }
  }

  public save(slot: string, serialized: string, revision: number): void {
    const previousRevision = this.revisions.get(slot) ?? -1;
    if (revision < previousRevision) return;
    const storage = this.storage();
    if (!storage) return;

    try {
      storage.setItem(this.key(slot), JSON.stringify({ revision, data: serialized } satisfies StoredSave));
      this.revisions.set(slot, revision);
    } catch (error) {
      // Private/embedded contexts can reject storage. The session surfaces the
      // failure through its save status without invalidating the simulation.
      throw error;
    }
  }

  private key(slot: string): string {
    return `${STORAGE_PREFIX}${slot}`;
  }

  private storage(): Storage | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  }
}
