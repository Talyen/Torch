import { abilityAssets } from './ability-assets';
import type { AbilitySlotId } from '../sim/types';

export const abilitySlots = [
  { id: 'basic', label: 'Basic' },
  { id: 'skill', label: 'Skill' },
  { id: 'ultimate', label: 'Ultimate' },
] as const;

export type { AbilitySlotId } from '../sim/types';

export interface AbilityDefinition {
  id: string;
  name: string;
  slot: AbilitySlotId;
  description: string;
  assetPath: string;
  assetAlt: string;
}

export const abilities: AbilityDefinition[] = [
  {
    id: 'ability.bash',
    name: 'Bash',
    slot: 'basic',
    description: 'Deal 2 Stun damage.',
    assetPath: abilityAssets.bash.full,
    assetAlt: abilityAssets.bash.fullAlt,
  },
  {
    id: 'ability.sunder',
    name: 'Sunder',
    slot: 'skill',
    description: 'Deal 3 Physical damage and Halve the enemy’s Block.',
    assetPath: abilityAssets.sunder.full,
    assetAlt: abilityAssets.sunder.fullAlt,
  },
  {
    id: 'ability.avatar',
    name: 'Avatar',
    slot: 'ultimate',
    description: 'Gain Holy damage equal to your Block for 2 turns.',
    assetPath: abilityAssets.avatar.full,
    assetAlt: abilityAssets.avatar.fullAlt,
  },
];
