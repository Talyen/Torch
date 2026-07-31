import type { GameState } from './types';

/** Clone at the command boundary so resolver helpers can mutate an isolated state. */
export function cloneGameState(state: GameState): GameState {
  return structuredClone(state);
}
