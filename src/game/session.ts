import {
  applyCommand,
  createInitialGameState,
  findAdjacentResource,
  latestMessage,
} from '../sim';
import type { AbilitySlotId, ActionRequest, Command, Direction, GameState, SimEvent } from '../sim';
import { devFrameMonitor } from '../dev/frame-monitor';

export type SessionListener = (state: GameState, events: SimEvent[]) => void;
export type SessionInputMode = 'world' | 'ui';

export class GameSession {
  private listeners = new Set<SessionListener>();
  private lastEvents: SimEvent[] = [];
  private _state: GameState;
  private _inputMode: SessionInputMode = 'world';

  public constructor(seed = 20260730) {
    this._state = createInitialGameState(seed);
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

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this._state, this.lastEvents));
  }
}

export const gameSession = new GameSession();
