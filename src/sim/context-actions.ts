import { CARDINAL_OFFSETS, isCardinallyAdjacent } from './coords';
import { abilityActionDefinition } from './ability-rules';
import { actionLabel, actionOptionsForEntity } from './actions';
import { entityAt } from './entities';
import { remainingGatheringActionsFor } from './gathering';
import type { AbilitySlotId, ActionKind, ActionRequest, EntityState, GameState, Position } from './types';

const ABILITY_SLOT_ORDER: readonly AbilitySlotId[] = ['basic', 'skill', 'ultimate'];

export interface ContextActionOption {
  id: string;
  label: string;
  action: ActionRequest;
  source: 'ability' | 'entity';
  entityName: string;
  abilityId?: string;
  slot?: AbilitySlotId;
  cooldownRemaining?: number;
  disabledReason?: string;
  progress?: { current: number; required: number };
}

/**
 * Presentation identity is intentionally narrower than action identity. A
 * card represents an equipped ability (or an action type), not the adjacent
 * entity it is currently aimed at, so retargeting does not remount or replay
 * the card animation.
 */
export function contextActionCardKey(action: ContextActionOption): string {
  return action.source === 'ability' ? `ability:${action.abilityId ?? action.id}` : `entity:${action.action.kind}`;
}

/** Returns adjacent occupied targets in a stable compass order for focus selection. */
export function contextualActionTargets(state: GameState): Position[] {
  const targets: Position[] = [];
  for (const offset of CARDINAL_OFFSETS) {
    const position = {
      x: state.hero.position.x + offset.x,
      y: state.hero.position.y + offset.y,
    };
    if (entityAt(state, position)) targets.push(position);
  }
  return targets;
}

/**
 * Projects one focused adjacent target into cards. This is intentionally a
 * pure simulation helper: React can attach artwork and presentation without
 * becoming an authority on action legality.
 */
export function availableContextActionsAt(state: GameState, target?: Position): ContextActionOption[] {
  const focusedTarget = target ?? contextualActionTargets(state)[0];
  if (!focusedTarget || !isCardinallyAdjacent(state.hero.position, focusedTarget)) return [];

  const entity = entityAt(state, focusedTarget);
  if (!entity) return [];

  if (entity.kind === 'enemy') {
    const abilityCards = equippedAbilityCards(state, entity, focusedTarget);
    if (abilityCards.length > 0) return abilityCards;
  }

  return actionOptionsForEntity(entity).map((kind) => entityActionCard(state, entity, focusedTarget, kind));
}

function equippedAbilityCards(state: GameState, entity: EntityState, target: Position): ContextActionOption[] {
  const equipped = state.hero.equippedAbilities ?? {};
  return ABILITY_SLOT_ORDER.flatMap((slot) => {
    const abilityId = equipped[slot];
    const ability = abilityActionDefinition(abilityId);
    if (!ability) return [];

    const cooldownRemaining = state.hero.abilityCooldowns?.[ability.id] ?? 0;
    if (cooldownRemaining > 0) return [];

    return [
      {
        id: `context:ability:${ability.id}`,
        label: ability.name,
        source: 'ability' as const,
        entityName: entity.name,
        abilityId: ability.id,
        slot,
        cooldownRemaining,
        disabledReason:
          cooldownRemaining > 0
            ? `Ready in ${cooldownRemaining} action${cooldownRemaining === 1 ? '' : 's'}.`
            : undefined,
        action: {
          kind: 'ability' as const,
          entityId: entity.id,
          target: { ...target },
          abilityId: ability.id,
        },
      } satisfies ContextActionOption,
    ];
  });
}

function entityActionCard(
  state: GameState,
  entity: EntityState,
  target: Position,
  kind: ActionKind,
): ContextActionOption {
  const required = Math.max(1, entity.gatheringActionCost ?? 1);
  const remaining = Math.max(0, remainingGatheringActionsFor(state, entity, required));
  const isGathering = kind === 'chop' || kind === 'mine';
  return {
    id: `context:entity:${entity.id}:${kind}`,
    label: actionLabel(kind),
    action: { kind, entityId: entity.id, target: { ...target } },
    source: 'entity',
    entityName: entity.name,
    ...(isGathering && required > 1 ? { progress: { current: required - remaining, required } } : {}),
  };
}
