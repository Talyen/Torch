import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/session';
import type { SaveProvider } from '../src/game/save-provider';

class MemorySaveProvider implements SaveProvider {
  public data?: string;
  public writes: Array<{ revision: number; data: string }> = [];

  public load(): string | undefined {
    return this.data;
  }

  public save(_slot: string, serialized: string, revision: number): void {
    this.writes.push({ revision, data: serialized });
    if (revision >= (this.writes.at(-2)?.revision ?? -1)) this.data = serialized;
  }
}

describe('GameSession persistence boundary', () => {
  it('restores a deterministic world from one addressed provider slot', async () => {
    const provider = new MemorySaveProvider();
    const first = new GameSession(1234);
    first.attachSaveProvider(provider);
    first.move('east');
    await Promise.resolve();

    expect(first.saveStatus).toBe('saved');
    expect(provider.writes).toHaveLength(1);

    const restored = new GameSession(9999);
    restored.attachSaveProvider(provider);

    expect(restored.saveStatus).toBe('loaded');
    expect(restored.state.seed).toBe(1234);
    expect(restored.state.hero.position).toEqual({ x: 1, y: 2 });
    expect(restored.state.turn).toBe(1);
  });

  it('keeps simulation valid when persistence fails', async () => {
    const provider: SaveProvider = {
      load: () => undefined,
      save: () => {
        throw new Error('storage unavailable');
      },
    };
    const session = new GameSession(1234);
    session.attachSaveProvider(provider);
    session.move('east');
    await Promise.resolve();

    expect(session.state.hero.position).toEqual({ x: 1, y: 2 });
    expect(session.saveStatus).toBe('error');
  });
});
