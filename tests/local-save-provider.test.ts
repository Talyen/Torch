import { describe, expect, it } from 'vitest';
import { PersistenceCoordinator } from '../src/game/persistence-coordinator';
import { createSaveBundle, encodeSaveBundle } from '../src/game/save-bundle';
import { LocalStorageSaveProvider } from '../src/platform/local-save-provider';
import {
  createInitialGameState,
  createInitialProfileJournalState,
  createProfileSave,
  createWorldSave,
  encodeProfileSave,
  encodeWorldSave,
} from '../src/sim';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  public get length(): number {
    return this.values.size;
  }

  public clear(): void {
    this.values.clear();
  }

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function serializedBundle(revision: number, turn = 0): string {
  const state = createInitialGameState(1234);
  state.turn = turn;
  return encodeSaveBundle(
    createSaveBundle(createWorldSave(state), createProfileSave(createInitialProfileJournalState()), revision),
  );
}

describe('LocalStorageSaveProvider', () => {
  it('round-trips one checksummed bundle and rejects an older write', async () => {
    const storage = new MemoryStorage();
    const provider = new LocalStorageSaveProvider(storage);

    expect(await provider.commit('primary', serializedBundle(2), 2)).toBe('committed');
    expect(await provider.commit('primary', serializedBundle(1), 1)).toBe('stale');
    const loaded = await provider.load('primary');

    expect(loaded?.candidates).toHaveLength(1);
    expect(loaded?.candidates[0]?.revision).toBe(2);
    expect(loaded?.corruptPayloads).toEqual([]);
  });

  it('recovers the last-known-good backup and retains corrupt primary bytes', async () => {
    const storage = new MemoryStorage();
    const provider = new LocalStorageSaveProvider(storage);
    await provider.commit('primary', serializedBundle(1, 1), 1);
    await provider.commit('primary', serializedBundle(2, 2), 2);
    const primaryKey = 'torch.save.bundle.primary.primary';
    storage.setItem(primaryKey, '{corrupt-primary');

    const coordinator = new PersistenceCoordinator(provider, 'primary');
    const hydration = await coordinator.hydrate(createInitialGameState(9999), createInitialProfileJournalState());

    expect(hydration.recovered).toBe(true);
    expect(hydration.state.seed).toBe(1234);
    expect(hydration.state.turn).toBe(1);
    expect(coordinator.status).toBe('recovered');
    expect(storage.getItem(primaryKey)).toBe('{corrupt-primary');
  });

  it('falls back when a storage-valid candidate has invalid bundle integrity', async () => {
    const storage = new MemoryStorage();
    const provider = new LocalStorageSaveProvider(storage);
    await provider.commit('primary', serializedBundle(1, 1), 1);
    const tampered = serializedBundle(2, 2).replace('"turn":2', '"turn":9');
    await provider.commit('primary', tampered, 2);

    const coordinator = new PersistenceCoordinator(provider, 'primary');
    const hydration = await coordinator.hydrate(createInitialGameState(9999), createInitialProfileJournalState());

    expect(hydration.recovered).toBe(true);
    expect(hydration.state.turn).toBe(1);
    expect(hydration.diagnostics).toContain('bundle-primary-invalid');
  });

  it('migrates legacy independent projections into a transactional bundle', async () => {
    const storage = new MemoryStorage();
    const legacyState = createInitialGameState(4321);
    legacyState.turn = 5;
    const legacyProfile = createInitialProfileJournalState();
    legacyProfile.observations['open-journal'] = true;
    storage.setItem('torch.save.world:primary', encodeWorldSave(createWorldSave(legacyState)));
    storage.setItem('torch.save.profile:primary', encodeProfileSave(createProfileSave(legacyProfile)));

    const provider = new LocalStorageSaveProvider(storage);
    const coordinator = new PersistenceCoordinator(provider, 'primary');
    const hydration = await coordinator.hydrate(createInitialGameState(9999), createInitialProfileJournalState());
    await coordinator.flush();

    expect(hydration.source).toBe('legacy');
    expect(hydration.state.seed).toBe(4321);
    expect(hydration.state.turn).toBe(5);
    expect(hydration.profileJournal.observations['open-journal']).toBe(true);
    expect(storage.getItem('torch.save.bundle.primary.primary')).not.toBeNull();
    expect(storage.getItem('torch.save.world:primary')).not.toBeNull();
    expect(storage.getItem('torch.save.profile:primary')).not.toBeNull();
  });
});
