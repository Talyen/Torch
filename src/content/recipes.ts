import type { ItemCategory } from './items';

export type CraftingCategory = 'materials' | 'consumables' | 'equipment' | 'structures';

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface RecipeDefinition {
  id: string;
  category: CraftingCategory;
  name: string;
  description: string;
  output: RecipeIngredient;
  ingredients: readonly RecipeIngredient[];
  maxBatch: number;
  displayOrder: number;
  /** Optional world discovery key. Recipes without one are known by default. */
  discoveryKey?: string;
  /** Station requirements are data-only until station entities exist. */
  stationId?: string;
  outputCategory?: ItemCategory;
}

export const recipes: readonly RecipeDefinition[] = [
  {
    id: 'recipe.wood-plank',
    category: 'materials',
    name: 'Wood Plank',
    description: 'Prepare gathered timber into sturdy building material.',
    output: { itemId: 'wood-plank', quantity: 4 },
    ingredients: [{ itemId: 'wood', quantity: 1 }],
    maxBatch: 20,
    displayOrder: 10,
    outputCategory: 'material',
  },
  {
    id: 'recipe.copper-ingot',
    category: 'materials',
    name: 'Copper Ingot',
    description: 'Refine copper ore into a compact metal bar.',
    output: { itemId: 'copper-ingot', quantity: 1 },
    ingredients: [{ itemId: 'ore', quantity: 2 }],
    maxBatch: 20,
    displayOrder: 20,
    outputCategory: 'material',
  },
  {
    id: 'recipe.field-torch',
    category: 'consumables',
    name: 'Field Torch',
    description: 'Bind wood and copper into a reliable expedition light.',
    output: { itemId: 'field-torch', quantity: 1 },
    ingredients: [
      { itemId: 'wood', quantity: 1 },
      { itemId: 'ore', quantity: 1 },
    ],
    maxBatch: 20,
    displayOrder: 30,
    outputCategory: 'consumable',
  },
  {
    id: 'recipe.healing-potion',
    category: 'consumables',
    name: 'Healing Potion',
    description: 'Mix prepared timber resin with copper salts for a restorative draught.',
    output: { itemId: 'healing-potion', quantity: 1 },
    ingredients: [
      { itemId: 'wood-plank', quantity: 1 },
      { itemId: 'ore', quantity: 1 },
    ],
    maxBatch: 10,
    displayOrder: 40,
    outputCategory: 'consumable',
  },
  {
    id: 'recipe.iron-axe',
    category: 'equipment',
    name: 'Iron Axe',
    description: 'Shape a reliable axe at the homestead workbench.',
    output: { itemId: 'iron-axe', quantity: 1 },
    ingredients: [
      { itemId: 'wood-plank', quantity: 2 },
      { itemId: 'copper-ingot', quantity: 1 },
    ],
    maxBatch: 1,
    displayOrder: 50,
    stationId: 'workbench',
    outputCategory: 'equipment',
  },
];

export function recipeDefinition(recipeId: string): RecipeDefinition | undefined {
  return recipes.find((recipe) => recipe.id === recipeId);
}
