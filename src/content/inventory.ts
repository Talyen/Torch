import { itemDefinitions } from './items';
import type { GameState } from '../sim';

export const inventoryCategories = [
  { id: 'equipment', label: 'Equipment', icon: 'sword' },
  { id: 'resources', label: 'Resources', icon: 'tree' },
  { id: 'consumables', label: 'Consumables', icon: 'flask' },
  { id: 'misc', label: 'Miscellaneous', icon: 'package' },
] as const;

export type InventoryCategory = (typeof inventoryCategories)[number]['id'];
export type InventoryIconId = 'sword' | 'tree' | 'flask' | 'gem' | 'sparkles' | 'coins' | 'package' | 'ellipsis';

export interface InventoryItemDefinition {
  id: string;
  category: InventoryCategory;
  name: string;
  quantity: number;
  description: string;
  icon: InventoryIconId;
}

// Catalog-only display fixtures remain available for pagination tests and
// content previews. They are never treated as owned inventory.
export const inventoryItems: InventoryItemDefinition[] = [
  {
    id: 'iron-sword',
    category: 'equipment',
    name: 'Iron Sword',
    quantity: 1,
    description: 'A dependable blade with a balanced grip.',
    icon: 'sword',
  },
  {
    id: 'steel-dagger',
    category: 'equipment',
    name: 'Steel Dagger',
    quantity: 1,
    description: 'A light sidearm kept sharp for close work.',
    icon: 'sword',
  },
  {
    id: 'wood',
    category: 'resources',
    name: 'Wood',
    quantity: 12,
    description: 'Useful timber gathered from nearby trees.',
    icon: 'tree',
  },
  {
    id: 'copper-ore',
    category: 'resources',
    name: 'Copper Ore',
    quantity: 6,
    description: 'Raw ore ready to be smelted or traded.',
    icon: 'gem',
  },
  {
    id: 'silver-ore',
    category: 'resources',
    name: 'Silver Ore',
    quantity: 2,
    description: 'A pale vein of ore with a cool metallic sheen.',
    icon: 'gem',
  },
  {
    id: 'bark',
    category: 'resources',
    name: 'Bark',
    quantity: 8,
    description: 'A rough material useful for simple bindings.',
    icon: 'tree',
  },
  {
    id: 'healing-potion',
    category: 'consumables',
    name: 'Healing Potion',
    quantity: 3,
    description: 'Restores a small amount of health when consumed.',
    icon: 'flask',
  },
  {
    id: 'antidote',
    category: 'consumables',
    name: 'Antidote',
    quantity: 2,
    description: 'A bitter draught prepared for poisonous wounds.',
    icon: 'flask',
  },
  {
    id: 'trail-ration',
    category: 'consumables',
    name: 'Trail Ration',
    quantity: 5,
    description: 'A dry meal packed for a long day beyond the homestead.',
    icon: 'package',
  },
  {
    id: 'torch-oil',
    category: 'consumables',
    name: 'Torch Oil',
    quantity: 4,
    description: 'Keeps the Torch burning through a long night.',
    icon: 'sparkles',
  },
  {
    id: 'ancient-coin',
    category: 'misc',
    name: 'Ancient Coin',
    quantity: 2,
    description: 'A weathered coin bearing an unfamiliar crest.',
    icon: 'coins',
  },
  {
    id: 'old-key',
    category: 'misc',
    name: 'Old Key',
    quantity: 1,
    description: 'A small key whose lock has not yet been found.',
    icon: 'package',
  },
  {
    id: 'unidentified-relic',
    category: 'misc',
    name: 'Unidentified Relic',
    quantity: 1,
    description: 'Its purpose may become clear somewhere beneath the Torch.',
    icon: 'ellipsis',
  },
];

const categoryForItem = (category: (typeof itemDefinitions)[number]['category']): InventoryCategory => {
  if (category === 'consumable') return 'consumables';
  if (category === 'equipment') return 'equipment';
  if (category === 'misc') return 'misc';
  return 'resources';
};

/** Projects only simulation-owned item IDs into the display model. */
export function inventoryItemsForState(state: Pick<GameState, 'hero'>): InventoryItemDefinition[] {
  return itemDefinitions
    .filter((item) => (state.hero.inventory[item.id] ?? 0) > 0)
    .map((item) => ({
      id: item.id,
      category: categoryForItem(item.category),
      name: item.name,
      quantity: state.hero.inventory[item.id] ?? 0,
      description: item.description,
      icon: item.icon,
    }));
}
