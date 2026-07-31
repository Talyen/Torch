import type { PrimaryStats } from '../sim/stats';

export interface HeroDefinition {
  id: string;
  name: string;
  assetId: string;
  primaryStats: PrimaryStats;
}

export const heroDefinitions = {
  knight: {
    id: 'hero.knight',
    name: 'Knight',
    assetId: 'hero.knight',
    primaryStats: {
      strength: 14,
      agility: 10,
      toughness: 14,
      wisdom: 12,
      intellect: 10,
    },
  },
} satisfies Record<string, HeroDefinition>;
