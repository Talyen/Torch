import { isCardinallyAdjacent } from './coords';
import { entityOccupiesPosition } from './footprint';
import type {
  ActionKind,
  ActionRequest,
  EntityState,
  GameState,
  Position,
  SimEvent,
} from './types';

export interface ActionOption extends ActionRequest {
  label: string;
}

const ACTION_LABELS: Record<ActionKind, string> = {
  attack: 'Attack',
  chop: 'Chop',
  mine: 'Mine',
};

/**
 * Returns the actions currently authored for an entity. Keeping this list
 * separate from command resolution lets future tiles expose multiple choices
 * without changing the movement or replay contract.
 */
export function actionOptionsForEntity(entity: EntityState): ActionKind[] {
  if (entity.actions) return [...entity.actions];

  switch (entity.kind) {
    case 'enemy':
      return ['attack'];
    case 'tree':
      return ['chop'];
    case 'ore':
      return ['mine'];
    default:
      return [];
  }
}

export function defaultActionForEntity(entity: EntityState): ActionKind | undefined {
  return actionOptionsForEntity(entity)[0];
}

export function availableActionsAt(state: GameState, target: Position): ActionOption[] {
  if (!isCardinallyAdjacent(state.hero.position, target)) return [];

  const entity = entityAt(state, target);
  if (!entity) return [];

  return actionOptionsForEntity(entity).map((kind) => ({
    kind,
    entityId: entity.id,
    target: { ...target },
    label: ACTION_LABELS[kind],
  }));
}

export function resolveAction(state: GameState, action: ActionRequest, events: SimEvent[]): boolean {
  const entity = state.entities[action.entityId];
  const actionKinds = entity ? actionOptionsForEntity(entity) : [];

  if (
    !entity ||
    entity.health === 0 ||
    !isCardinallyAdjacent(state.hero.position, action.target) ||
    !entityOccupiesPosition(entity, action.target) ||
    !actionKinds.includes(action.kind)
  ) {
    events.push({ type: 'blocked', reason: 'That action is not available.' });
    events.push({ type: 'message', text: 'That action is not available.' });
    return false;
  }

  events.push({ type: 'action-resolved', action: action.kind, entityId: entity.id });

  if (action.kind === 'attack') {
    const amount = 1;
    entity.alerted = true;
    entity.health = Math.max(0, (entity.health ?? 1) - amount);
    events.push({ type: 'enemy-damaged', entityId: entity.id, amount });
    if (entity.health === 0) {
      delete state.entities[entity.id];
      events.push({ type: 'enemy-defeated', entityId: entity.id });
      events.push({ type: 'message', text: `${entity.name} is defeated.` });
    } else {
      events.push({ type: 'message', text: `You attack ${entity.name} for ${amount}.` });
    }
    return true;
  }

  const resource = entity.resourceType ?? (action.kind === 'chop' ? 'wood' : 'ore');
  state.hero.inventory[resource] = (state.hero.inventory[resource] ?? 0) + 1;
  if (entity.id.startsWith('generated-tree:')) {
    state.removedGeneratedEntities[entity.id] = true;
  }
  delete state.entities[entity.id];
  events.push({ type: 'resource-gathered', resource, amount: 1 });
  events.push({ type: 'message', text: `${action.kind === 'chop' ? 'Chopped' : 'Mined'} 1 ${resource}.` });
  return true;
}

function entityAt(state: GameState, position: Position): EntityState | undefined {
  return Object.values(state.entities).find(
    (entity) => entity.health !== 0 && entityOccupiesPosition(entity, position),
  );
}
