/**
 * Canonical item content. Simulation state stores these stable IDs and the
 * React inventory/crafting surfaces project display data from this registry.
 */
export type ItemCategory = 'resource' | 'material' | 'consumable' | 'equipment' | 'misc';

export type ItemIconId = 'tree' | 'gem' | 'flask' | 'sparkles' | 'package' | 'sword' | 'coins' | 'ellipsis';

export interface ItemDefinition {
  id: string;
  category: ItemCategory;
  name: string;
  description: string;
  icon: ItemIconId;
  stackable: boolean;
  equipmentSlot?: string;
  toolSlot?: string;
}

export const itemDefinitions: readonly ItemDefinition[] = [
  {
    id: 'wood',
    category: 'resource',
    name: 'Wood',
    description: 'Useful timber gathered from nearby trees.',
    icon: 'tree',
    stackable: true,
  },
  {
    id: 'ore',
    category: 'resource',
    name: 'Copper Ore',
    description: 'Raw ore ready to be refined into useful metal.',
    icon: 'gem',
    stackable: true,
  },
  {
    id: 'wood-plank',
    category: 'material',
    name: 'Wood Plank',
    description: 'Straight-grained timber prepared for field work.',
    icon: 'tree',
    stackable: true,
  },
  {
    id: 'copper-ingot',
    category: 'material',
    name: 'Copper Ingot',
    description: 'A small bar of copper cast from gathered ore.',
    icon: 'gem',
    stackable: true,
  },
  {
    id: 'field-torch',
    category: 'consumable',
    name: 'Field Torch',
    description: 'A hand-built light for the next stretch of dark ground.',
    icon: 'sparkles',
    stackable: true,
  },
  {
    id: 'healing-potion',
    category: 'consumable',
    name: 'Healing Potion',
    description: 'Restores a small amount of health when consumed.',
    icon: 'flask',
    stackable: true,
  },
  {
    id: 'iron-sword',
    category: 'equipment',
    name: 'Iron Sword',
    description: 'A dependable blade with a balanced grip.',
    icon: 'sword',
    stackable: false,
    equipmentSlot: 'main-hand',
  },
  {
    id: 'steel-dagger',
    category: 'equipment',
    name: 'Steel Dagger',
    description: 'A light sidearm kept sharp for close work.',
    icon: 'sword',
    stackable: false,
    equipmentSlot: 'main-hand',
  },
  {
    id: 'iron-axe',
    category: 'equipment',
    name: 'Iron Axe',
    description: 'A sturdy axe for working nearby tree groves.',
    icon: 'sword',
    stackable: false,
    toolSlot: 'axe',
  },
  {
    id: 'stone-pickaxe',
    category: 'equipment',
    name: 'Stone Pickaxe',
    description: 'A practical pick for breaking exposed copper ore.',
    icon: 'gem',
    stackable: false,
    toolSlot: 'pickaxe',
  },
  {
    id: 'iron-hammer',
    category: 'equipment',
    name: 'Iron Hammer',
    description: 'A compact hammer for future homestead work.',
    icon: 'sword',
    stackable: false,
    toolSlot: 'hammer',
  },
  {
    id: 'field-shovel',
    category: 'equipment',
    name: 'Field Shovel',
    description: 'A light shovel for future ground work.',
    icon: 'package',
    stackable: false,
    toolSlot: 'shovel',
  },
  {
    id: 'bark',
    category: 'resource',
    name: 'Bark',
    description: 'A rough material useful for simple bindings.',
    icon: 'tree',
    stackable: true,
  },
  {
    id: 'silver-ore',
    category: 'resource',
    name: 'Silver Ore',
    description: 'A pale vein of ore with a cool metallic sheen.',
    icon: 'gem',
    stackable: true,
  },
  {
    id: 'antidote',
    category: 'consumable',
    name: 'Antidote',
    description: 'A bitter draught prepared for poisonous wounds.',
    icon: 'flask',
    stackable: true,
  },
  {
    id: 'trail-ration',
    category: 'consumable',
    name: 'Trail Ration',
    description: 'A dry meal packed for a long day beyond the homestead.',
    icon: 'package',
    stackable: true,
  },
  {
    id: 'torch-oil',
    category: 'consumable',
    name: 'Torch Oil',
    description: 'Keeps the Torch burning through a long night.',
    icon: 'sparkles',
    stackable: true,
  },
  {
    id: 'ancient-coin',
    category: 'misc',
    name: 'Ancient Coin',
    description: 'A weathered coin bearing an unfamiliar crest.',
    icon: 'coins',
    stackable: true,
  },
  {
    id: 'old-key',
    category: 'misc',
    name: 'Old Key',
    description: 'A small key whose lock has not yet been found.',
    icon: 'package',
    stackable: false,
  },
  {
    id: 'unidentified-relic',
    category: 'misc',
    name: 'Unidentified Relic',
    description: 'Its purpose may become clear somewhere beneath the Torch.',
    icon: 'ellipsis',
    stackable: false,
  },
];

export function itemDefinition(itemId: string): ItemDefinition | undefined {
  return itemDefinitions.find((item) => item.id === itemId);
}
