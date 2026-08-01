import { describe, expect, it } from 'vitest';
import { GameRuntime, createGameRuntime } from '../src/game/session';
import { presentationGate } from '../src/game/presentation-gate';
import { canAcceptWorldInput } from '../src/game/scene-world-input';
import type { SaveCommitResult, SaveLoadResult, SaveProvider, StoredSaveCandidate } from '../src/game/save-provider';

class MemorySaveProvider implements SaveProvider {
  public candidate?: StoredSaveCandidate;

  public load(): Promise<SaveLoadResult | undefined> {
    return Promise.resolve(this.candidate ? { candidates: [this.candidate], corruptPayloads: [] } : undefined);
  }

  public commit(_slot: string, serialized: string, revision: number): Promise<SaveCommitResult> {
    if (this.candidate && revision < this.candidate.revision) return Promise.resolve('stale');
    const candidate = { revision, serialized, source: 'primary' as const };
    this.candidate = candidate;
    return Promise.resolve('committed');
  }
}

describe('GameRuntime persistence boundary', () => {
  it('restores one transactional world and profile bundle', async () => {
    const provider = new MemorySaveProvider();
    const first = await createGameRuntime(1234, { saveProvider: provider });
    first.move('east');
    first.recordProfileObservation('open-inventory');
    await first.flushPersistence();

    expect(first.saveStatus).toBe('saved');

    const restored = await createGameRuntime(9999, { saveProvider: provider });

    expect(restored.runtimeStatus).toBe('ready');
    expect(restored.state.seed).toBe(1234);
    expect(restored.state.hero.position).toEqual({ x: 1, y: 2 });
    expect(restored.state.turn).toBe(1);
    expect(restored.profileJournal.observations['open-inventory']).toBe(true);
  });

  it('rejects commands while asynchronous hydration is pending', async () => {
    let finishLoad: ((value: SaveLoadResult | undefined) => void) | undefined;
    const provider: SaveProvider = {
      load: () => new Promise((resolve) => (finishLoad = resolve)),
      commit: () => Promise.resolve('committed'),
    };
    const runtime = new GameRuntime(1234, { saveProvider: provider });
    const boot = runtime.boot();

    expect(runtime.runtimeStatus).toBe('loading');
    expect(runtime.dispatch({ type: 'move', direction: 'east' }).accepted).toBe(false);
    expect(runtime.state.turn).toBe(0);

    finishLoad?.(undefined);
    await boot;
    expect(runtime.runtimeStatus).toBe('ready');
    expect(runtime.dispatch({ type: 'move', direction: 'east' }).accepted).toBe(true);
  });

  it('keeps the simulation playable when persistence fails', async () => {
    const provider: SaveProvider = {
      load: () => Promise.resolve(undefined),
      commit: () => Promise.reject(new Error('storage unavailable')),
    };
    const runtime = await createGameRuntime(1234, { saveProvider: provider });
    runtime.move('east');
    await runtime.flushPersistence();

    expect(runtime.state.hero.position).toEqual({ x: 1, y: 2 });
    expect(runtime.saveStatus).toBe('error');
  });

  it('allows world input after a runtime error while honoring loading and presentation gates', async () => {
    let rejectLoad: ((reason?: unknown) => void) | undefined;
    const provider: SaveProvider = {
      load: () =>
        new Promise<SaveLoadResult | undefined>((_resolve, reject) => {
          rejectLoad = reject;
        }),
      commit: () => Promise.reject(new Error('storage unavailable')),
    };
    const runtime = new GameRuntime(1234, { saveProvider: provider });
    const boot = runtime.boot();

    expect(runtime.runtimeStatus).toBe('loading');
    expect(canAcceptWorldInput(runtime, false)).toBe(false);

    rejectLoad?.(new Error('storage unavailable'));
    await boot;

    expect(runtime.runtimeStatus).toBe('error');
    expect(canAcceptWorldInput(runtime, false)).toBe(true);
    expect(runtime.dispatch({ type: 'move', direction: 'east' }).accepted).toBe(true);

    expect(canAcceptWorldInput(runtime, true)).toBe(false);

    const releasePresentationGate = presentationGate.acquire();
    try {
      expect(canAcceptWorldInput(runtime, false)).toBe(false);
    } finally {
      releasePresentationGate();
    }

    runtime.setInputMode('ui');
    expect(canAcceptWorldInput(runtime, false)).toBe(false);
    runtime.setInputMode('world');
    expect(canAcceptWorldInput(runtime, false)).toBe(true);
    await runtime.flushPersistence();
  });

  it('isolates independent runtime state, subscriptions, and input modes', async () => {
    const first = await createGameRuntime(1234);
    const second = await createGameRuntime(5678);
    let firstUpdates = 0;
    let secondUpdates = 0;
    first.subscribeSnapshot(() => (firstUpdates += 1));
    second.subscribeSnapshot(() => (secondUpdates += 1));

    first.setInputMode('ui');
    second.move('east');

    expect(first.state.seed).toBe(1234);
    expect(first.state.turn).toBe(0);
    expect(first.inputMode).toBe('ui');
    expect(second.state.seed).toBe(5678);
    expect(second.state.turn).toBe(1);
    expect(second.inputMode).toBe('world');
    expect(firstUpdates).toBe(2);
    expect(secondUpdates).toBe(2);
  });
});
