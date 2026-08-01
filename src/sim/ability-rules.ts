import type { AbilityEffectKind, AbilitySlotId } from './types';

/**
 * Simulation-facing ability rules deliberately contain no artwork or UI
 * concerns. Content definitions use the same stable ids to attach art and
 * descriptions in the React layer.
 */
interface AbilityActionDefinition {
  id: string;
  name: string;
  slot: AbilitySlotId;
  damage: number;
  cooldown: number;
  effect: AbilityEffectKind;
  effectAmount: number;
  effectDuration: number;
}

const abilityActionDefinitions: readonly AbilityActionDefinition[] = [
  {
    id: 'ability.bash',
    name: 'Bash',
    slot: 'basic',
    damage: 2,
    cooldown: 0,
    effect: 'stun',
    effectAmount: 1,
    effectDuration: 1,
  },
  {
    id: 'ability.sunder',
    name: 'Sunder',
    slot: 'skill',
    damage: 3,
    cooldown: 3,
    effect: 'halve-block',
    effectAmount: 0,
    effectDuration: 0,
  },
  {
    id: 'ability.avatar',
    name: 'Avatar',
    slot: 'ultimate',
    damage: 0,
    cooldown: 6,
    effect: 'holy-damage-from-block',
    effectAmount: 0,
    effectDuration: 2,
  },
];

export const DEFAULT_ABILITY_PRIORITY: readonly AbilitySlotId[] = ['ultimate', 'skill', 'basic'];

export function abilityActionDefinition(abilityId: string | undefined): AbilityActionDefinition | undefined {
  return abilityActionDefinitions.find((ability) => ability.id === abilityId);
}

export function canEquipAbility(slot: AbilitySlotId, abilityId: string): boolean {
  return abilityActionDefinition(abilityId)?.slot === slot;
}
