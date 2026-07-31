import type { ActionKind, EnemyDisposition } from '../sim/types';
import type { Footprint } from '../sim/types';
import type { PrimaryStats } from '../sim/stats';

export interface EnemyDefinition {
  id: string;
  name: string;
  assetId: string;
  disposition: EnemyDisposition;
  health: number;
  attack: number;
  actions: ActionKind[];
  primaryStats: PrimaryStats;
  footprint: Footprint;
}

export const enemyDefinitions = {
  slime: {
    id: 'slime',
    name: 'Forest Slime',
    assetId: 'enemy.slime',
    disposition: 'neutral',
    health: 4,
    attack: 1,
    actions: ['attack'],
    primaryStats: {
      strength: 12,
      agility: 12,
      toughness: 20,
      wisdom: 6,
      intellect: 10,
    },
    footprint: { width: 1, height: 1 },
  },
} satisfies Record<string, EnemyDefinition>;
