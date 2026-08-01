import type { EntityState, GameState } from './types';

/** Default one-action gathering costs used when content does not override them. */
export const GATHERING_ACTION_COSTS = {
  chop: 1,
  mine: 1,
} as const;

export function isGeneratedGatherable(entity: EntityState): boolean {
  return entity.id.startsWith('generated-tree:');
}

/** Generated gatherables keep partial work in the sparse mutation map. */
export function remainingGatheringActionsFor(state: GameState, entity: EntityState, requiredActions: number): number {
  return isGeneratedGatherable(entity)
    ? (state.gatheringProgress[entity.id] ?? requiredActions)
    : (entity.remainingGatheringActions ?? requiredActions);
}
