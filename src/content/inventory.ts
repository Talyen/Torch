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

// Temporary authored fixtures keep the menu useful while inventory simulation state is still on the roadmap.
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
    id: 'healing-potion',
    category: 'consumables',
    name: 'Healing Potion',
    quantity: 3,
    description: 'Restores a small amount of health when consumed.',
    icon: 'flask',
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
    id: 'unidentified-relic',
    category: 'misc',
    name: 'Unidentified Relic',
    quantity: 1,
    description: 'Its purpose may become clear somewhere beneath the Torch.',
    icon: 'ellipsis',
  },
];
