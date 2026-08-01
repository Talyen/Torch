import {
  applyCommand,
  createInitialGameState,
  findAdjacentResource,
  latestMessage,
  advanceProfileJournal,
  claimProfileJournalReward,
  createInitialProfileJournalState,
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
import { PersistenceCoordinator } from './persistence-coordinator';
import type { PersistenceStatus } from './persistence-coordinator';
import type { SaveProvider } from './save-provider';
import { PRIMARY_SAVE_SLOT } from './save-provider';

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
export type RuntimeStatus = 'loading' | 'ready' | 'recovered' | 'error';
export type SaveStatus = 'unconfigured' | PersistenceStatus;

export interface RuntimeSnapshot {
  state: GameState;
  profileJournal: ProfileJournalState;
  events: readonly SimEvent[];
  message: string;
  inputMode: SessionInputMode;
  runtimeStatus: RuntimeStatus;
  persistenceStatus: SaveStatus;
}

export interface GameRuntimePort {
  readonly state: GameState;
  readonly profileJournal: ProfileJournalState;
  readonly inputMode: SessionInputMode;
  readonly runtimeStatus: RuntimeStatus;
  readonly saveStatus: SaveStatus;
  getSnapshot(): RuntimeSnapshot;
  dispatch(command: Command): CommandResult;
  subscribeSnapshot(listener: (snapshot: RuntimeSnapshot) => void): () => void;
  subscribeActionBatches(listener: ActionBatchListener): () => void;
  setInputMode(mode: SessionInputMode): void;
  move(direction: Direction): void;
  wait(): void;
  gather(): void;
  performAction(action: ActionRequest): CommandResult;
  equipAbility(slot: AbilitySlotId, abilityId: string): void;
  equipItem(slot: LoadoutSlotId, itemId: string): void;
  unequipItem(slot: LoadoutSlotId): void;
  craft(recipeId: string, quantity?: number): void;
  setJournalFocus(entryId?: string): void;
  setWaypoint(entryId: string, target: WaypointTarget): void;
  clearWaypoint(): void;
  claimJournalReward(entryId: string): void;
  claimProfileJournalReward(entryId: string): boolean;
  recordProfileObservation(observation: 'open-inventory' | 'open-journal'): void;
  markJournalEntrySeen(scope: 'profile' | 'world', entryId: string): void;
}

export interface GameRuntimeOptions {
  saveProvider?: SaveProvider;
  saveSlot?: string;
}

export class GameRuntime implements GameRuntimePort {
  private listeners = new Set<SessionListener>();
  private snapshotListeners = new Set<(snapshot: RuntimeSnapshot) => void>();
  private actionBatchListeners = new Set<ActionBatchListener>();
  private lastEvents: SimEvent[] = [];
  private nextBatchId = 1;
  private _state: GameState;
  private _profileJournal: ProfileJournalState = createInitialProfileJournalState();
  private _inputMode: SessionInputMode = 'world';
  private _runtimeStatus: RuntimeStatus;
  private persistence?: PersistenceCoordinator;
  private bootPromise?: Promise<void>;
  private unsubscribePersistence?: () => void;

  public constructor(seed = 20260730, options: GameRuntimeOptions = {}) {
    this._state = createInitialGameState(seed);
    this._runtimeStatus = options.saveProvider ? 'loading' : 'ready';
    if (options.saveProvider) this.configurePersistence(options.saveProvider, options.saveSlot ?? PRIMARY_SAVE_SLOT);
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

  public get runtimeStatus(): RuntimeStatus {
    return this._runtimeStatus;
  }

  public get saveStatus(): SaveStatus {
    return this.persistence?.status ?? 'unconfigured';
  }

  public getSnapshot(): RuntimeSnapshot {
    return {
      state: this._state,
      profileJournal: this._profileJournal,
      events: this.lastEvents,
      message: this.message,
      inputMode: this._inputMode,
      runtimeStatus: this._runtimeStatus,
      persistenceStatus: this.saveStatus,
    };
  }

  /** Hydrates persistence exactly once before production consumers are mounted. */
  public boot(): Promise<void> {
    if (this.bootPromise) return this.bootPromise;
    if (!this.persistence) {
      this._runtimeStatus = 'ready';
      return Promise.resolve();
    }
    this.bootPromise = this.hydrate();
    return this.bootPromise;
  }

  /** Compatibility hook for tests and platform hosts that attach storage after construction. */
  public async attachSaveProvider(provider: SaveProvider, slot = PRIMARY_SAVE_SLOT): Promise<void> {
    if (this.persistence) throw new Error('A save provider is already attached to this runtime.');
    this._runtimeStatus = 'loading';
    this.configurePersistence(provider, slot);
    this.notifySnapshotListeners();
    await this.boot();
  }

  public setInputMode(mode: SessionInputMode): void {
    this._inputMode = mode;
    this.notifySnapshotListeners();
  }

  /** Compatibility state subscription; new clients should use subscribeSnapshot. */
  public subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this._state, this.lastEvents, this._profileJournal);
    return () => this.listeners.delete(listener);
  }

  public subscribeSnapshot(listener: (snapshot: RuntimeSnapshot) => void): () => void {
    this.snapshotListeners.add(listener);
    listener(this.getSnapshot());
    return () => this.snapshotListeners.delete(listener);
  }

  /**
   * Subscribe to each dispatch exactly once. Unlike state subscriptions, this
   * stream never replays the previous event array to a newly mounted consumer.
   */
  public subscribeActionBatches(listener: ActionBatchListener): () => void {
    this.actionBatchListeners.add(listener);
    return () => this.actionBatchListeners.delete(listener);
  }

  public dispatch(command: Command): CommandResult {
    if (this._runtimeStatus === 'loading') return this.rejectWhileLoading();
    const previousState = this._state;
    const result = devFrameMonitor.measure('simulation', () => applyCommand(previousState, command));
    this._state = result.state;
    this.lastEvents = result.events;
    if (result.accepted) {
      this._profileJournal = advanceProfileJournal(this._profileJournal, result.events);
      this.persistAtActionBoundary();
    }
    this.notifyStateListeners();
    this.emitBatch(previousState, result);
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
    if (this._runtimeStatus === 'loading') return false;
    const result = claimProfileJournalReward(this._profileJournal, entryId);
    if (!result.accepted) return false;
    this._profileJournal = result.state;
    this.persistAtActionBoundary();
    this.notifyStateListeners();
    return true;
  }

  public recordProfileObservation(observation: 'open-inventory' | 'open-journal'): void {
    if (this._runtimeStatus === 'loading') return;
    this._profileJournal = recordProfileObservation(this._profileJournal, observation);
    this.persistAtActionBoundary();
    this.notifyStateListeners();
  }

  public markJournalEntrySeen(scope: 'profile' | 'world', entryId: string): void {
    if (this._runtimeStatus === 'loading') return;
    if (scope === 'profile') this._profileJournal = markJournalEntrySeen(this._profileJournal, entryId);
    else this._state = { ...this._state, journal: markJournalEntrySeen(this._state.journal, entryId) };
    this.persistAtActionBoundary();
    this.notifyStateListeners();
  }

  public async flushPersistence(): Promise<void> {
    await this.persistence?.flush();
  }

  public async shutdown(): Promise<void> {
    await this.flushPersistence();
    this.unsubscribePersistence?.();
    this.listeners.clear();
    this.snapshotListeners.clear();
    this.actionBatchListeners.clear();
  }

  private configurePersistence(provider: SaveProvider, slot: string): void {
    this.persistence = new PersistenceCoordinator(provider, slot);
    this.unsubscribePersistence = this.persistence.subscribe(() => this.notifySnapshotListeners());
  }

  private async hydrate(): Promise<void> {
    const persistence = this.persistence;
    if (!persistence) return;
    const hydration = await persistence.hydrate(this._state, this._profileJournal);
    this._state = hydration.state;
    this._profileJournal = hydration.profileJournal;
    this._runtimeStatus = persistence.status === 'error' ? 'error' : hydration.recovered ? 'recovered' : 'ready';
    this.notifyStateListeners();
  }

  private rejectWhileLoading(): CommandResult {
    const previousState = this._state;
    const events: SimEvent[] = [
      { type: 'blocked', reason: 'The game is still loading.' },
      { type: 'message', text: 'The game is still loading.' },
    ];
    const result = { state: previousState, events, accepted: false };
    this.lastEvents = events;
    this.notifyStateListeners();
    this.emitBatch(previousState, result);
    return result;
  }

  private emitBatch(previousState: GameState, result: CommandResult): void {
    const batch: ActionBatch = {
      batchId: this.nextBatchId++,
      previousState,
      nextState: this._state,
      events: result.events,
      accepted: result.accepted,
    };
    this.actionBatchListeners.forEach((listener) => listener(batch));
  }

  private notifyStateListeners(): void {
    this.listeners.forEach((listener) => listener(this._state, this.lastEvents, this._profileJournal));
    this.notifySnapshotListeners();
  }

  private notifySnapshotListeners(): void {
    const snapshot = this.getSnapshot();
    this.snapshotListeners.forEach((listener) => listener(snapshot));
  }

  private persistAtActionBoundary(): void {
    this.persistence?.requestSave(this._state, this._profileJournal);
  }
}

/** Preferred production construction: hydrate before mounting React or Phaser. */
export async function createGameRuntime(seed = 20260730, options: GameRuntimeOptions = {}): Promise<GameRuntime> {
  const runtime = new GameRuntime(seed, options);
  await runtime.boot();
  return runtime;
}

/** @deprecated Use GameRuntime. Retained temporarily for downstream test compatibility. */
export class GameSession extends GameRuntime {}
