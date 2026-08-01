import { createProfileSave, createWorldSave, decodeProfileSave, decodeWorldSave, restoreWorldSave } from '../sim';
import type { GameState, ProfileJournalState } from '../sim';
import { createSaveBundle, decodeSaveBundleJson, encodeSaveBundle } from './save-bundle';
import type { SaveProvider } from './save-provider';

export type PersistenceStatus = 'loading' | 'ready' | 'saving' | 'saved' | 'recovered' | 'error';

export interface PersistenceHydration {
  state: GameState;
  profileJournal: ProfileJournalState;
  source: 'fresh' | 'bundle' | 'legacy';
  recovered: boolean;
  diagnostics: readonly string[];
}

interface PendingWrite {
  revision: number;
  serialized: string;
}

export class PersistenceCoordinator {
  private _status: PersistenceStatus = 'ready';
  private revision = 0;
  private latestRequestedRevision = 0;
  private pending?: PendingWrite;
  private drainPromise?: Promise<void>;
  private listeners = new Set<(status: PersistenceStatus) => void>();

  public constructor(
    private readonly provider: SaveProvider,
    private readonly slot: string,
  ) {}

  public get status(): PersistenceStatus {
    return this._status;
  }

  public subscribe(listener: (status: PersistenceStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this._status);
    return () => this.listeners.delete(listener);
  }

  public async hydrate(freshState: GameState, freshProfile: ProfileJournalState): Promise<PersistenceHydration> {
    this.setStatus('loading');
    let loaded;
    try {
      loaded = await this.provider.load(this.slot);
    } catch {
      this.setStatus('error');
      return {
        state: freshState,
        profileJournal: freshProfile,
        source: 'fresh',
        recovered: false,
        diagnostics: ['provider-load-failed'],
      };
    }

    if (!loaded) {
      this.setStatus('ready');
      return {
        state: freshState,
        profileJournal: freshProfile,
        source: 'fresh',
        recovered: false,
        diagnostics: [],
      };
    }

    const diagnostics = loaded.corruptPayloads.map(() => 'storage-envelope-corrupt');
    const candidates = [...loaded.candidates].sort((left, right) => right.revision - left.revision);
    for (const candidate of candidates) {
      try {
        const bundle = decodeSaveBundleJson(candidate.serialized);
        if (bundle.revision !== candidate.revision) throw new Error('Storage and bundle revisions differ.');
        const state = restoreWorldSave(bundle.world);
        this.revision = bundle.revision;
        this.latestRequestedRevision = bundle.revision;
        const recovered = candidate.source !== 'primary' || diagnostics.length > 0;
        this.setStatus(recovered ? 'recovered' : 'ready');
        return {
          state,
          profileJournal: bundle.profile.journal,
          source: 'bundle',
          recovered,
          diagnostics,
        };
      } catch {
        diagnostics.push(`bundle-${candidate.source}-invalid`);
      }
    }

    const legacy = loaded.legacy;
    if (legacy?.worldSerialized || legacy?.profileSerialized) {
      let state = freshState;
      let profileJournal = freshProfile;
      let restoredAny = false;
      if (legacy.worldSerialized) {
        try {
          state = restoreWorldSave(decodeWorldSave(JSON.parse(legacy.worldSerialized) as unknown));
          restoredAny = true;
        } catch {
          diagnostics.push('legacy-world-invalid');
        }
      }
      if (legacy.profileSerialized) {
        try {
          profileJournal = decodeProfileSave(JSON.parse(legacy.profileSerialized) as unknown).journal;
          restoredAny = true;
        } catch {
          diagnostics.push('legacy-profile-invalid');
        }
      }
      if (restoredAny) {
        this.setStatus('recovered');
        this.requestSave(state, profileJournal);
        return { state, profileJournal, source: 'legacy', recovered: true, diagnostics };
      }
    }

    this.setStatus(diagnostics.length > 0 ? 'error' : 'ready');
    return {
      state: freshState,
      profileJournal: freshProfile,
      source: 'fresh',
      recovered: false,
      diagnostics,
    };
  }

  /** Captures both projections at one action boundary and coalesces queued writes. */
  public requestSave(state: GameState, profileJournal: ProfileJournalState): number {
    const revision = Math.max(this.revision, this.latestRequestedRevision) + 1;
    this.latestRequestedRevision = revision;
    try {
      const world = createWorldSave(state);
      const profile = createProfileSave(profileJournal);
      this.pending = { revision, serialized: encodeSaveBundle(createSaveBundle(world, profile, revision)) };
    } catch {
      this.setStatus('error');
      return revision;
    }
    this.setStatus('saving');
    this.startDrain();
    return revision;
  }

  public async flush(): Promise<void> {
    while (this.drainPromise) await this.drainPromise;
  }

  private startDrain(): void {
    if (this.drainPromise) return;
    this.drainPromise = this.drain().finally(() => {
      this.drainPromise = undefined;
      if (this.pending) this.startDrain();
    });
  }

  private async drain(): Promise<void> {
    while (this.pending) {
      const write = this.pending;
      this.pending = undefined;
      try {
        const result = await this.provider.commit(this.slot, write.serialized, write.revision);
        if (result === 'committed') this.revision = Math.max(this.revision, write.revision);
        if (write.revision !== this.latestRequestedRevision) continue;
        this.setStatus(result === 'committed' ? 'saved' : 'error');
      } catch {
        if (write.revision === this.latestRequestedRevision) this.setStatus('error');
      }
    }
  }

  private setStatus(status: PersistenceStatus): void {
    if (this._status === status) return;
    this._status = status;
    this.listeners.forEach((listener) => listener(status));
  }
}
