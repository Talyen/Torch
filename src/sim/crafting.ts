import { itemDefinition } from '../content/items';
import { recipeDefinition, recipes } from '../content/recipes';
import { stationDefinition } from '../content/stations';
import { samePosition } from './coords';
import type { RecipeDefinition } from '../content/recipes';
import type { CraftBlockedReason, CraftingCommand, GameState, SimEvent } from './types';

export const MAX_CRAFT_BATCH = 99;

export interface CraftingContext {
  /** Station IDs are derived from simulation state, never authored by React. */
  stationIds?: readonly string[];
}

export function craftingContextForState(state: GameState): CraftingContext {
  return {
    stationIds: samePosition(state.hero.position, state.homestead) ? Object.keys(state.unlockedStations) : [],
  };
}

export interface MissingIngredient {
  itemId: string;
  quantity: number;
}

export interface RecipeAvailability {
  recipe: RecipeDefinition;
  known: boolean;
  craftable: boolean;
  maxCraftableQuantity: number;
  missingIngredients: MissingIngredient[];
  reason?: CraftBlockedReason;
}

export function orderedRecipes(source: readonly RecipeDefinition[] = recipes): RecipeDefinition[] {
  return [...source].sort((left, right) => left.displayOrder - right.displayOrder || compareIds(left.id, right.id));
}

export function maxCraftableQuantity(
  state: GameState,
  recipe: RecipeDefinition,
  context: CraftingContext = {},
): number {
  if (!recipeKnown(state, recipe) || !stationAvailable(recipe, context)) return 0;
  if (recipe.ingredients.length === 0) return Math.min(recipe.maxBatch, MAX_CRAFT_BATCH);

  return Math.max(
    0,
    Math.min(
      recipe.maxBatch,
      MAX_CRAFT_BATCH,
      ...recipe.ingredients.map((ingredient) =>
        Math.floor((state.hero.inventory[ingredient.itemId] ?? 0) / ingredient.quantity),
      ),
    ),
  );
}

export function recipeAvailability(
  state: GameState,
  recipeId: string,
  context: CraftingContext = {},
  source: readonly RecipeDefinition[] = recipes,
): RecipeAvailability {
  const recipe = source.find((candidate) => candidate.id === recipeId) ?? recipeDefinition(recipeId);
  if (!recipe) {
    return {
      recipe: {
        id: recipeId,
        category: 'materials',
        name: 'Unknown recipe',
        description: 'This recipe is not part of the current content version.',
        output: { itemId: 'unknown', quantity: 0 },
        ingredients: [],
        maxBatch: 0,
        displayOrder: Number.MAX_SAFE_INTEGER,
      },
      known: false,
      craftable: false,
      maxCraftableQuantity: 0,
      missingIngredients: [],
      reason: 'unknown-recipe',
    };
  }

  const known = recipeKnown(state, recipe);
  const stationReady = stationAvailable(recipe, context);
  const missingIngredients = recipe.ingredients.flatMap((ingredient) => {
    const available = state.hero.inventory[ingredient.itemId] ?? 0;
    return available < ingredient.quantity
      ? [{ itemId: ingredient.itemId, quantity: ingredient.quantity - available }]
      : [];
  });
  const maxQuantity = maxCraftableQuantity(state, recipe, context);
  const reason = !known
    ? 'locked'
    : !stationReady
      ? 'requires-station'
      : missingIngredients.length > 0
        ? 'missing-ingredients'
        : undefined;

  return {
    recipe,
    known,
    craftable: reason === undefined && maxQuantity > 0,
    maxCraftableQuantity: maxQuantity,
    missingIngredients,
    ...(reason ? { reason } : {}),
  };
}

export function availableRecipes(
  state: GameState,
  context: CraftingContext = {},
  source: readonly RecipeDefinition[] = recipes,
): RecipeAvailability[] {
  return orderedRecipes(source).map((recipe) => recipeAvailability(state, recipe.id, context, source));
}

export function validateCraftingContent(source: readonly RecipeDefinition[] = recipes): void {
  const recipeIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const recipe of source) {
    if (recipeIds.has(recipe.id)) throw new Error(`Duplicate recipe ID: ${recipe.id}`);
    recipeIds.add(recipe.id);
    if (!Number.isSafeInteger(recipe.displayOrder) || recipe.displayOrder < 0) {
      throw new Error(`Invalid display order for recipe: ${recipe.id}`);
    }
    if (!Number.isSafeInteger(recipe.maxBatch) || recipe.maxBatch < 1 || recipe.maxBatch > MAX_CRAFT_BATCH) {
      throw new Error(`Invalid max batch for recipe: ${recipe.id}`);
    }
    validateIngredient(recipe.id, recipe.output, 'output');
    if (!itemDefinition(recipe.output.itemId)) throw new Error(`Unknown output item: ${recipe.output.itemId}`);
    if (recipe.stationId && !stationDefinition(recipe.stationId)) {
      throw new Error(`Unknown station requirement: ${recipe.stationId}`);
    }
    const ingredients = new Set<string>();
    for (const ingredient of recipe.ingredients) {
      validateIngredient(recipe.id, ingredient, 'ingredient');
      if (ingredients.has(ingredient.itemId)) throw new Error(`Duplicate ingredient in recipe: ${recipe.id}`);
      ingredients.add(ingredient.itemId);
      if (!itemDefinition(ingredient.itemId)) throw new Error(`Unknown ingredient item: ${ingredient.itemId}`);
    }
    itemIds.add(recipe.output.itemId);
  }
  if (itemIds.size === 0) throw new Error('Crafting content must define at least one output item.');
}

export function resolveCraft(
  state: GameState,
  command: CraftingCommand,
  events: SimEvent[],
  context: CraftingContext = {},
): boolean {
  const availability = recipeAvailability(state, command.recipeId, context);
  if (!Number.isSafeInteger(command.quantity) || command.quantity < 1 || command.quantity > MAX_CRAFT_BATCH) {
    return blockCraft(events, command.recipeId, 'invalid-quantity');
  }
  if (availability.reason) {
    return blockCraft(events, command.recipeId, availability.reason, availability.missingIngredients);
  }
  if (command.quantity > availability.maxCraftableQuantity) {
    return blockCraft(events, command.recipeId, 'missing-ingredients', availability.missingIngredients);
  }

  const deltas = new Map<string, number>();
  for (const ingredient of availability.recipe.ingredients) {
    deltas.set(ingredient.itemId, (deltas.get(ingredient.itemId) ?? 0) - ingredient.quantity * command.quantity);
  }
  deltas.set(
    availability.recipe.output.itemId,
    (deltas.get(availability.recipe.output.itemId) ?? 0) + availability.recipe.output.quantity * command.quantity,
  );

  for (const [itemId, delta] of deltas) {
    const nextQuantity = (state.hero.inventory[itemId] ?? 0) + delta;
    if (!Number.isSafeInteger(nextQuantity) || nextQuantity < 0) {
      return blockCraft(events, command.recipeId, 'missing-ingredients', availability.missingIngredients);
    }
  }
  for (const [itemId, delta] of deltas) {
    const nextQuantity = (state.hero.inventory[itemId] ?? 0) + delta;
    if (nextQuantity === 0) delete state.hero.inventory[itemId];
    else state.hero.inventory[itemId] = nextQuantity;
  }

  const outputQuantity = availability.recipe.output.quantity * command.quantity;
  events.push({
    type: 'craft-completed',
    recipeId: command.recipeId,
    batchCount: command.quantity,
    outputItemId: availability.recipe.output.itemId,
    outputQuantity,
  });
  events.push({
    type: 'message',
    text: `Crafted ${outputQuantity} ${availability.recipe.name}${outputQuantity === 1 ? '' : 's'}.`,
  });
  return true;
}

function recipeKnown(state: GameState, recipe: RecipeDefinition): boolean {
  return recipe.discoveryKey === undefined || state.discoveries[recipe.discoveryKey] === true;
}

function stationAvailable(recipe: RecipeDefinition, context: CraftingContext): boolean {
  return recipe.stationId === undefined || context.stationIds?.includes(recipe.stationId) === true;
}

function validateIngredient(recipeId: string, ingredient: { itemId: string; quantity: number }, role: string): void {
  if (!ingredient.itemId || !Number.isSafeInteger(ingredient.quantity) || ingredient.quantity < 1) {
    throw new Error(`Invalid ${role} in recipe: ${recipeId}`);
  }
}

function blockCraft(
  events: SimEvent[],
  recipeId: string,
  reason: CraftBlockedReason,
  missingIngredients: MissingIngredient[] = [],
): false {
  events.push({
    type: 'craft-blocked',
    recipeId,
    reason,
    ...(missingIngredients.length > 0 ? { missingItems: missingIngredients } : {}),
  });
  const messages: Record<CraftBlockedReason, string> = {
    'unknown-recipe': 'That recipe is not available.',
    locked: 'Discover that recipe before crafting it.',
    'requires-station': 'You need the right crafting station.',
    'missing-ingredients': 'You do not have all of the required materials.',
    'invalid-quantity': 'Choose a valid craft quantity.',
  };
  events.push({ type: 'message', text: messages[reason] });
  return false;
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
