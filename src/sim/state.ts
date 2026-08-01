import type { EntityState, GameState } from './types';

/** Clone the JSON-shaped simulation graph without depending on DOM globals. */
export function cloneSerializable<T>(value: T): T {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Simulation state must be JSON serializable.');
  return JSON.parse(serialized) as T;
}

function cloneEntity(entity: EntityState): EntityState {
  return {
    ...entity,
    position: { ...entity.position },
    ...(entity.actions ? { actions: [...entity.actions] } : {}),
    ...(entity.primaryStats ? { primaryStats: { ...entity.primaryStats } } : {}),
    ...(entity.footprint ? { footprint: { ...entity.footprint } } : {}),
  };
}

/**
 * Creates the bounded mutable working graph used by one command resolution.
 *
 * The active entity collection is copied because actors and gatherables can be
 * updated by any turn. Large sparse world-mutation records are shared until the
 * resolver that owns them performs an explicit copy-on-write. This keeps waits,
 * loadout changes, and other unrelated commands independent of exploration
 * history without exposing mutations back into the previous state.
 */
export function cloneGameStateForCommand(state: GameState): GameState {
  return {
    ...state,
    hero: {
      ...state.hero,
      position: { ...state.hero.position },
      boundPosition: { ...state.hero.boundPosition },
      inventory: { ...state.hero.inventory },
      primaryStats: { ...state.hero.primaryStats },
      equippedAbilities: { ...state.hero.equippedAbilities },
      equippedItems: { ...state.hero.equippedItems },
      equippedTools: { ...state.hero.equippedTools },
      abilityCooldowns: { ...state.hero.abilityCooldowns },
      activeAbilityEffects: state.hero.activeAbilityEffects.map((effect) => ({ ...effect })),
    },
    homestead: { ...state.homestead },
    entities: Object.fromEntries(Object.entries(state.entities).map(([id, entity]) => [id, cloneEntity(entity)])),
    journal: cloneSerializable(state.journal),
  };
}
