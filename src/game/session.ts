import {
  applyCommand,
  decodeWorldSave,
  createInitialGameState,
  createWorldSave,
  encodeWorldSave,
  findAdjacentResource,
  latestMessage,
  restoreWorldSave,
} from '../sim';
import type { AbilitySlotId, ActionRequest, Command, Direction, GameState, SimEvent } from '../sim';
import { devFrameMonitor } from '../dev/frame-monitor';
import type { SaveProvider } from './save-provider';
import { PRIMARY_WORLD_SAVE_SLOT } from './save-provider';

export type SessionListener = (state: GameState, events: SimEvent[]) => void;
export type SessionInputMode = 'world' | 'ui';
export type SaveStatus = 'unconfigured' | 'loaded' | 'saved' | 'error';

export interface GameSessionOptions {
  saveProvider?: SaveProvider;
  saveSlot?: string;
}

export class GameSession {
  private listeners = new Set<SessionListener>();
  private lastEvents: SimEvent[] = [];
  private _state: GameState;
  private _inputMode: SessionInputMode = 'world';
  private saveProvider?: SaveProvider;
  private saveSlot = PRIMARY_WORLD_SAVE_SLOT;
  private saveRevision = 0;
  private _saveStatus: SaveStatus = 'unconfigured';

  public constructor(seed = 20260730, options: GameSessionOptions = {}) {
    this._state = createInitialGameState(seed);
    if (options.saveSlot) this.saveSlot = options.saveSlot;
    if (options.saveProvider) this.attachSaveProvider(options.saveProvider);
  }

  public get state(): GameState {
    return this._state;
  }

  public get message(): string {
    return latestMessage(this.lastEvents) ?? 'The Torch reveals a path into the dark.';
  }

  public get inputMode(): SessionInputMode {
    return this._inputMode;
  }

  public get saveStatus(): SaveStatus {
    return this._saveStatus;
  }

  /** Attach storage at the platform boundary and restore the addressed world once. */
  public attachSaveProvider(provider: SaveProvider, slot = this.saveSlot): void {
    this.saveProvider = provider;
    this.saveSlot = slot;
    let serialized: string | undefined;
    try {
      serialized = provider.load(slot);
    } catch {
      this._saveStatus = 'error';
      return;
    }
    if (!serialized) {
      this._saveStatus = 'unconfigured';
      return;
    }

    try {
      const parsed: unknown = JSON.parse(serialized);
      this._state = restoreWorldSave(decodeWorldSave(parsed));
      this._saveStatus = 'loaded';
      this.notifyListeners();
    } catch {
      // Keep the fresh deterministic state and leave the corrupt data intact so
      // a later recovery tool can inspect it. Gameplay remains usable.
      this._saveStatus = 'error';
    }
  }

  public setInputMode(mode: SessionInputMode): void {
    this._inputMode = mode;
  }

  public subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this._state, this.lastEvents);
    return () => this.listeners.delete(listener);
  }

  public dispatch(command: Command): void {
    const result = devFrameMonitor.measure('simulation', () => applyCommand(this._state, command));
    this._state = result.state;
    this.lastEvents = result.events;
    if (result.accepted) this.persistAtActionBoundary();
    this.notifyListeners();
  }

  public move(direction: Direction): void {
    this.dispatch({ type: 'move', direction });
  }

  public wait(): void {
    this.dispatch({ type: 'wait' });
  }

  public gather(): void {
    const target = findAdjacentResource(this._state);
    if (!target) {
      this.dispatch({ type: 'interact', target: this._state.hero.position });
      return;
    }
    this.dispatch({ type: 'interact', target });
  }

  public performAction(action: ActionRequest): void {
    this.dispatch({ type: 'action', action });
  }

  public equipAbility(slot: AbilitySlotId, abilityId: string): void {
    this.dispatch({ type: 'equip-ability', slot, abilityId });
  }

  public craft(recipeId: string, quantity = 1): void {
    this.dispatch({ type: 'craft', recipeId, quantity });
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this._state, this.lastEvents));
  }

  private persistAtActionBoundary(): void {
    const provider = this.saveProvider;
    if (!provider) return;

    const revision = ++this.saveRevision;
    let serialized: string;
    try {
      serialized = encodeWorldSave(createWorldSave(this._state));
    } catch {
      this._saveStatus = 'error';
      return;
    }

    try {
      const pending = provider.save(this.saveSlot, serialized, revision);
      void Promise.resolve(pending)
        .then(() => {
          if (revision === this.saveRevision) this._saveStatus = 'saved';
        })
        .catch(() => {
          if (revision === this.saveRevision) this._saveStatus = 'error';
        });
    } catch {
      this._saveStatus = 'error';
    }
  }
}

export const gameSession = new GameSession();
