import { describe, expect, it } from 'vitest';
import { PersistenceCoordinator } from '../src/game/persistence-coordinator';
import type { SaveCommitResult, SaveLoadResult, SaveProvider } from '../src/game/save-provider';
import { createInitialGameState, createInitialProfileJournalState } from '../src/sim';

describe('PersistenceCoordinator', () => {
  it('coalesces queued snapshots and ignores an older completion status', async () => {
    let releaseFirst: (() => void) | undefined;
    const writes: number[] = [];
    const provider: SaveProvider = {
      load: () => Promise.resolve(undefined),
      commit: async (_slot, _serialized, revision): Promise<SaveCommitResult> => {
        writes.push(revision);
        if (revision === 1) await new Promise<void>((resolve) => (releaseFirst = resolve));
        return 'committed';
      },
    };
    const coordinator = new PersistenceCoordinator(provider, 'test');
    const state = createInitialGameState(1234);
    const profile = createInitialProfileJournalState();

    coordinator.requestSave(state, profile);
    await Promise.resolve();
    coordinator.requestSave({ ...state, turn: 1 }, profile);
    coordinator.requestSave({ ...state, turn: 2 }, profile);
    expect(coordinator.status).toBe('saving');

    releaseFirst?.();
    await coordinator.flush();
    expect(writes).toEqual([1, 3]);
    expect(coordinator.status).toBe('saved');
  });

  it('surfaces a stale latest revision as a conflict', async () => {
    const provider: SaveProvider = {
      load: (): Promise<SaveLoadResult | undefined> => Promise.resolve(undefined),
      commit: () => Promise.resolve('stale'),
    };
    const coordinator = new PersistenceCoordinator(provider, 'test');
    coordinator.requestSave(createInitialGameState(1234), createInitialProfileJournalState());
    await coordinator.flush();
    expect(coordinator.status).toBe('error');
  });
});
