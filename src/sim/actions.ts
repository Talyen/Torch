import { isCardinallyAdjacent } from './coords';
import { entityAt } from './entities';
import { entityOccupiesPosition } from './footprint';
import { abilityActionDefinition, DEFAULT_ABILITY_PRIORITY } from './ability-rules';
import { GATHERING_ACTION_COSTS } from './gathering';
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
  ability: 'Ability',
};

export function actionLabel(kind: ActionKind): string {
  return ACTION_LABELS[kind];
}

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

/**
 * The blocked-move shortcut is deliberately more opinionated than the
 * contextual hand: when an enemy is directly in the destination tile, use the
 * strongest ready equipped ability first, then fall back to a plain attack.
 */
export function defaultActionForEnemy(state: GameState, entity: EntityState, target: Position): ActionRequest {
  for (const slot of DEFAULT_ABILITY_PRIORITY) {
    const abilityId = state.hero.equippedAbilities[slot];
    const ability = abilityActionDefinition(abilityId);
    const cooldown = abilityId ? (state.hero.abilityCooldowns[abilityId] ?? 0) : 0;
    if (!ability || cooldown > 0) continue;
    return {
      kind: 'ability',
      entityId: entity.id,
      target: { ...target },
      abilityId,
    };
  }

  return {
    kind: 'attack',
    entityId: entity.id,
    target: { ...target },
  };
}

export function availableActionsAt(state: GameState, target: Position): ActionOption[] {
  if (!isCardinallyAdjacent(state.hero.position, target)) return [];

  const entity = entityAt(state, target);
  if (!entity) return [];

  return actionOptionsForEntity(entity).map((kind) => ({
    kind,
    entityId: entity.id,
    target: { ...target },
    label: actionLabel(kind),
  }));
}

export function resolveAction(
  state: GameState,
  action: ActionRequest,
  events: SimEvent[],
  consumedAbilityIds: Set<string> = new Set(),
): boolean {
  const entity = state.entities[action.entityId];
  const actionKinds = entity ? actionOptionsForEntity(entity) : [];
  const isAbilityAction = action.kind === 'ability';

  if (
    !entity ||
    (entity.health ?? 1) <= 0 ||
    !isCardinallyAdjacent(state.hero.position, action.target) ||
    !entityOccupiesPosition(entity, action.target) ||
    (!isAbilityAction && !actionKinds.includes(action.kind))
  ) {
    events.push({ type: 'blocked', reason: 'That action is not available.' });
    events.push({ type: 'message', text: 'That action is not available.' });
    return false;
  }

  if (action.kind === 'ability') {
    return resolveAbilityAction(state, entity, action, events, consumedAbilityIds);
  }

  events.push({
    type: 'action-resolved',
    action: action.kind,
    entityId: entity.id,
    target: { ...action.target },
  });

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
  const requiredActions = Math.max(1, entity.gatheringActionCost ?? GATHERING_ACTION_COSTS[action.kind]);
  const remainingActions = Math.max(0, (entity.remainingGatheringActions ?? requiredActions) - 1);
  entity.gatheringActionCost = requiredActions;
  entity.remainingGatheringActions = remainingActions;

  if (remainingActions > 0) {
    state.gatheringProgress ??= {};
    state.gatheringProgress[entity.id] = remainingActions;
    events.push({
      type: 'message',
      text: `${action.kind === 'chop' ? 'Chop' : 'Mine'} ${requiredActions - remainingActions}/${requiredActions}.`,
    });
    return true;
  }

  state.gatheringProgress ??= {};
  delete state.gatheringProgress[entity.id];
  state.hero.inventory[resource] = (state.hero.inventory[resource] ?? 0) + 1;
  if (entity.id.startsWith('generated-tree:')) {
    state.removedGeneratedEntities[entity.id] = true;
  }
  delete state.entities[entity.id];
  events.push({ type: 'resource-gathered', resource, amount: 1 });
  events.push({ type: 'message', text: `${action.kind === 'chop' ? 'Chopped' : 'Mined'} 1 ${resource}.` });
  return true;
}

function resolveAbilityAction(
  state: GameState,
  entity: EntityState,
  action: ActionRequest,
  events: SimEvent[],
  consumedAbilityIds: Set<string>,
): boolean {
  const ability = abilityActionDefinition(action.abilityId);
  const equipped = action.abilityId
    ? Object.values(state.hero.equippedAbilities).includes(action.abilityId)
    : false;
  const cooldown = action.abilityId ? (state.hero.abilityCooldowns[action.abilityId] ?? 0) : 0;

  if (
    !ability
    || !action.abilityId
    || !equipped
    || entity.kind !== 'enemy'
    || cooldown > 0
  ) {
    events.push({ type: 'blocked', reason: 'That ability is not available.' });
    events.push({ type: 'message', text: 'That ability is not available.' });
    return false;
  }

  const amount = ability.damage;
  entity.alerted = true;
  state.hero.abilityCooldowns[action.abilityId] = ability.cooldown;
  consumedAbilityIds.add(action.abilityId);
  events.push({
    type: 'action-resolved',
    action: 'ability',
    entityId: entity.id,
    target: { ...action.target },
    abilityId: action.abilityId,
  });
  events.push({
    type: 'ability-used',
    abilityId: action.abilityId,
    entityId: entity.id,
    target: { ...action.target },
    amount,
  });

  if (amount > 0) {
    entity.health = Math.max(0, (entity.health ?? 1) - amount);
    events.push({ type: 'enemy-damaged', entityId: entity.id, amount });
  }

  applyAbilityEffect(state, entity, ability.id, ability.effect, ability.effectAmount, ability.effectDuration);

  if (entity.health === 0) {
    delete state.entities[entity.id];
    events.push({ type: 'enemy-defeated', entityId: entity.id });
    events.push({ type: 'message', text: `${ability.name} defeats ${entity.name}.` });
  } else {
    events.push({
      type: 'message',
      text: amount > 0
        ? `You use ${ability.name} on ${entity.name} for ${amount}.`
        : `You use ${ability.name}.`,
    });
  }
  return true;
}

function applyAbilityEffect(
  state: GameState,
  entity: EntityState,
  abilityId: string,
  effect: 'stun' | 'halve-block' | 'holy-damage-from-block',
  effectAmount: number,
  effectDuration: number,
): void {
  switch (effect) {
    case 'stun':
      entity.stunnedActions = Math.max(entity.stunnedActions ?? 0, effectAmount);
      return;
    case 'halve-block':
      entity.block = Math.floor((entity.block ?? 0) / 2);
      return;
    case 'holy-damage-from-block':
      state.hero.activeAbilityEffects = [
        ...state.hero.activeAbilityEffects.filter((active) => active.kind !== effect),
        {
          id: `${abilityId}:${state.turn}`,
          abilityId,
          kind: effect,
          amount: state.hero.block ?? 0,
          remainingActions: effectDuration,
        },
      ];
      return;
  }
}
