/**
 * Canonical item content. Simulation state stores these stable IDs and the
 * React inventory/crafting surfaces project display data from this registry.
 */
export type ItemCategory = 'resource' | 'material' | 'consumable' | 'equipment' | 'misc';

export type ItemIconId = 'tree' | 'gem' | 'flask' | 'sparkles' | 'package' | 'sword';

export interface ItemDefinition {
  id: string;
  category: ItemCategory;
  name: string;
  description: string;
  icon: ItemIconId;
  stackable: boolean;
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
];

export function itemDefinition(itemId: string): ItemDefinition | undefined {
  return itemDefinitions.find((item) => item.id === itemId);
}
