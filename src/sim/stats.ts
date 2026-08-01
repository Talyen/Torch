export const PRIMARY_STAT_NAMES = ['strength', 'agility', 'toughness', 'wisdom', 'intellect'] as const;

export type PrimaryStatName = (typeof PRIMARY_STAT_NAMES)[number];
export type PrimaryStats = Record<PrimaryStatName, number>;

export const PRIMARY_STAT_BUDGET = 60;

export function primaryStatTotal(stats: PrimaryStats): number {
  return PRIMARY_STAT_NAMES.reduce((total, stat) => total + stats[stat], 0);
}
