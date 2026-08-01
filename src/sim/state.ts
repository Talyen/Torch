import type { GameState } from './types';

/** Clone the JSON-shaped simulation graph without depending on DOM globals. */
export function cloneSerializable<T>(value: T): T {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Simulation state must be JSON serializable.');
  return JSON.parse(serialized) as T;
}

/** Clone at the command boundary so resolver helpers can mutate an isolated state. */
export function cloneGameState(state: GameState): GameState {
  return cloneSerializable(state);
}
