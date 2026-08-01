import {
  applyCommand,
  decodeWorldSave,
  createInitialGameState,
  createWorldSave,
  encodeWorldSave,
  findAdjacentResource,
  latestMessage,
  restoreWorldSave,
  advanceProfileJournal,
  claimProfileJournalReward,
  createInitialProfileJournalState,
  decodeProfileSave,
  createProfileSave,
  encodeProfileSave,
  markJournalEntrySeen,
  recordProfileObservation,
} from '../sim';
import type {
  AbilitySlotId,
  ActionRequest,
  Command,
  CommandResult,
  Direction,
  GameState,
  LoadoutSlotId,
  ProfileJournalState,
  SimEvent,
  WaypointTarget,
} from '../sim';
import { devFrameMonitor } from '../dev/frame-monitor';
import type { SaveProvider } from './save-provider';
import { PRIMARY_PROFILE_SAVE_SLOT, PRIMARY_WORLD_SAVE_SLOT } from './save-provider';

export type SessionListener = (state: GameState, events: SimEvent[], profileJournal: ProfileJournalState) => void;
export interface ActionBatch {
  /** Monotonic client-side identity; not part of replay or save data. */
  batchId: number;
  previousState: GameState;
  nextState: GameState;
  events: SimEvent[];
  accepted: boolean;
}
export type ActionBatchListener = (batch: ActionBatch) => void;
export type SessionInputMode = 'world' | 'ui';
export type SaveStatus = 'unconfigured' | 'loaded' | 'saved' | 'error';

export interface GameSessionOptions {
  saveProvider?: SaveProvider;
  saveSlot?: string;
}

export class GameSession {
  private listeners = new Set<SessionListener>();
  private actionBatchListeners = new Set<ActionBatchListener>();
  private lastEvents: SimEvent[] = [];
  private nextBatchId = 1;
  private _state: GameState;
  private _profileJournal: ProfileJournalState = createInitialProfileJournalState();
  private _inputMode: SessionInputMode = 'world';
  private saveProvider?: SaveProvider;
  private saveSlot = PRIMARY_WORLD_SAVE_SLOT;
  private profileSaveSlot = PRIMARY_PROFILE_SAVE_SLOT;
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

  public get profileJournal(): ProfileJournalState {
    return this._profileJournal;
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
    if (serialized) {
      try {
        const parsed: unknown = JSON.parse(serialized);
        this._state = restoreWorldSave(decodeWorldSave(parsed));
        this._saveStatus = 'loaded';
      } catch {
        // Keep the fresh deterministic state and leave the corrupt data intact so
        // a later recovery tool can inspect it. Gameplay remains usable.
        this._saveStatus = 'error';
      }
    } else {
      this._saveStatus = 'unconfigured';
    }
    if (provider.supportsIndependentSlots) {
      try {
        const profileSerialized = provider.load(this.profileSaveSlot);
        if (profileSerialized) this._profileJournal = decodeProfileSave(JSON.parse(profileSerialized)).journal;
      } catch {
        this._saveStatus = 'error';
      }
    }
    this.notifyListeners();
  }

  public setInputMode(mode: SessionInputMode): void {
    this._inputMode = mode;
  }

  public subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this._state, this.lastEvents, this._profileJournal);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to each dispatch exactly once. Unlike `subscribe`, this stream
   * never replays the previous event array to a newly mounted consumer, which
   * keeps one-shot Phaser effects from duplicating after React rerenders.
   */
  public subscribeActionBatches(listener: ActionBatchListener): () => void {
    this.actionBatchListeners.add(listener);
    return () => this.actionBatchListeners.delete(listener);
  }

  public dispatch(command: Command): CommandResult {
    const previousState = this._state;
    const result = devFrameMonitor.measure('simulation', () => applyCommand(previousState, command));
    this._state = result.state;
    this.lastEvents = result.events;
    if (result.accepted) {
      this._profileJournal = advanceProfileJournal(this._profileJournal, result.events);
      this.persistAtActionBoundary();
    }
    this.notifyListeners();
    const batch: ActionBatch = {
      batchId: this.nextBatchId++,
      previousState,
      nextState: this._state,
      events: result.events,
      accepted: result.accepted,
    };
    this.actionBatchListeners.forEach((listener) => listener(batch));
    return result;
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

  public performAction(action: ActionRequest): CommandResult {
    return this.dispatch({ type: 'action', action });
  }

  public equipAbility(slot: AbilitySlotId, abilityId: string): void {
    this.dispatch({ type: 'equip-ability', slot, abilityId });
  }

  public equipItem(slot: LoadoutSlotId, itemId: string): void {
    this.dispatch({ type: 'equip-item', slot, itemId });
  }

  public unequipItem(slot: LoadoutSlotId): void {
    this.dispatch({ type: 'unequip-item', slot });
  }

  public craft(recipeId: string, quantity = 1): void {
    this.dispatch({ type: 'craft', recipeId, quantity });
  }

  public setJournalFocus(entryId?: string): void {
    this.dispatch({ type: 'set-journal-focus', entryId });
  }

  public setWaypoint(entryId: string, target: WaypointTarget): void {
    this.dispatch({ type: 'set-waypoint', entryId, target });
  }

  public clearWaypoint(): void {
    this.dispatch({ type: 'clear-waypoint' });
  }

  public claimJournalReward(entryId: string): void {
    this.dispatch({ type: 'claim-journal-reward', entryId });
  }

  public claimProfileJournalReward(entryId: string): boolean {
    const result = claimProfileJournalReward(this._profileJournal, entryId);
    if (!result.accepted) return false;
    this._profileJournal = result.state;
    this.persistAtActionBoundary();
    this.notifyListeners();
    return true;
  }

  public recordProfileObservation(observation: 'open-inventory' | 'open-journal'): void {
    this._profileJournal = recordProfileObservation(this._profileJournal, observation);
    this.persistAtActionBoundary();
    this.notifyListeners();
  }

  public markJournalEntrySeen(scope: 'profile' | 'world', entryId: string): void {
    if (scope === 'profile') this._profileJournal = markJournalEntrySeen(this._profileJournal, entryId);
    else this._state = { ...this._state, journal: markJournalEntrySeen(this._state.journal, entryId) };
    this.persistAtActionBoundary();
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this._state, this.lastEvents, this._profileJournal));
  }

  private persistAtActionBoundary(): void {
    const provider = this.saveProvider;
    if (!provider) return;

    const revision = ++this.saveRevision;
    let serialized: string;
    let profileSerialized: string;
    try {
      serialized = encodeWorldSave(createWorldSave(this._state));
      profileSerialized = encodeProfileSave(createProfileSave(this._profileJournal));
    } catch {
      this._saveStatus = 'error';
      return;
    }

    try {
      const pending = provider.save(this.saveSlot, serialized, revision);
      if (provider.supportsIndependentSlots) {
        const profilePending = provider.save(this.profileSaveSlot, profileSerialized, revision);
        void Promise.resolve(profilePending).catch(() => {
          if (revision === this.saveRevision) this._saveStatus = 'error';
        });
      }
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
