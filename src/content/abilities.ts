import { abilityAssets } from './ability-assets';

export const abilitySlots = [
  { id: 'basic', label: 'Basic' },
  { id: 'skill', label: 'Skill' },
  { id: 'ultimate', label: 'Ultimate' },
] as const;

export type AbilitySlotId = (typeof abilitySlots)[number]['id'];

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
    description: 'A dependable strike that staggers a nearby foe.',
    assetPath: abilityAssets.bash.full,
    assetAlt: abilityAssets.bash.fullAlt,
  },
  {
    id: 'ability.sunder',
    name: 'Sunder',
    slot: 'skill',
    description: 'Break through a target’s defenses with a crushing blow.',
    assetPath: abilityAssets.sunder.full,
    assetAlt: abilityAssets.sunder.fullAlt,
  },
  {
    id: 'ability.avatar',
    name: 'Avatar',
    slot: 'ultimate',
    description: 'Become an unstoppable champion for a short time.',
    assetPath: abilityAssets.avatar.full,
    assetAlt: abilityAssets.avatar.fullAlt,
  },
];
