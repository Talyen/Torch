import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  availableRecipes,
  createInitialGameState,
  createWorldSave,
  recipeAvailability,
  restoreWorldSave,
  runReplay,
  validateCraftingContent,
} from '../src/sim';
import { inventoryItemsForState } from '../src/content/inventory';

describe('crafting simulation', () => {
  it('validates the authored recipe catalog and orders it deterministically', () => {
    validateCraftingContent();
    const state = createInitialGameState(1234);
    expect(availableRecipes(state).map((entry) => entry.recipe.id)).toEqual([
      'recipe.wood-plank',
      'recipe.copper-ingot',
      'recipe.field-torch',
      'recipe.healing-potion',
    ]);
  });

  it('crafts an atomic batch without advancing the turn or enemy response', () => {
    const state = createInitialGameState(1234);
    state.hero.inventory.wood = 3;
    state.entities.slime.alerted = true;
    const result = applyCommand(state, { type: 'craft', recipeId: 'recipe.wood-plank', quantity: 2 });

    expect(result.accepted).toBe(true);
    expect(result.state.turn).toBe(state.turn);
    expect(result.state.hero.inventory.wood).toBe(1);
    expect(result.state.hero.inventory['wood-plank']).toBe(8);
    expect(result.state.entities.slime.position).toEqual(state.entities.slime.position);
    expect(result.events).toContainEqual({
      type: 'craft-completed',
      recipeId: 'recipe.wood-plank',
      batchCount: 2,
      outputItemId: 'wood-plank',
      outputQuantity: 8,
    });
    expect(result.events.some((event) => event.type === 'turn-advanced')).toBe(false);
  });

  it('rejects missing materials without mutating the cloned state', () => {
    const state = createInitialGameState(1234);
    const result = applyCommand(state, { type: 'craft', recipeId: 'recipe.copper-ingot', quantity: 1 });

    expect(result.accepted).toBe(false);
    expect(result.state).toEqual(state);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'craft-blocked',
        recipeId: 'recipe.copper-ingot',
        reason: 'missing-ingredients',
      }),
    );
  });

  it('clamps batches to the available ingredient count', () => {
    const state = createInitialGameState(1234);
    state.hero.inventory.wood = 2;
    const availability = recipeAvailability(state, 'recipe.wood-plank');
    expect(availability.maxCraftableQuantity).toBe(2);

    const result = applyCommand(state, { type: 'craft', recipeId: 'recipe.wood-plank', quantity: 3 });
    expect(result.accepted).toBe(false);
    expect(result.state).toEqual(state);
  });

  it('blocks invalid batch quantities without mutating inventory', () => {
    const state = createInitialGameState(1234);
    state.hero.inventory.wood = 2;

    for (const quantity of [0, Number.MAX_SAFE_INTEGER + 1]) {
      const result = applyCommand(state, { type: 'craft', recipeId: 'recipe.wood-plank', quantity });
      expect(result.accepted).toBe(false);
      expect(result.state).toEqual(state);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'craft-blocked', reason: 'invalid-quantity' }),
      );
    }
  });

  it('replays accepted and rejected crafting commands deterministically', () => {
    const transcript = {
      seed: 1234,
      generationVersion: createInitialGameState(1234).generationVersion,
      commands: [
        { type: 'craft' as const, recipeId: 'recipe.wood-plank', quantity: 1 },
        { type: 'move' as const, direction: 'east' as const },
        { type: 'craft' as const, recipeId: 'recipe.wood-plank', quantity: 1 },
      ],
    };
    const first = runReplay(transcript);
    const second = runReplay(JSON.parse(JSON.stringify(transcript)));

    expect(second).toEqual(first);
    expect(first.checkpoints.map((checkpoint) => checkpoint.accepted)).toEqual([false, true, false]);
    expect(first.finalState.turn).toBe(1);
  });

  it('keeps crafted inventory in the save contract and display projection', () => {
    const state = createInitialGameState(1234);
    state.hero.inventory.wood = 1;
    const crafted = applyCommand(state, { type: 'craft', recipeId: 'recipe.wood-plank', quantity: 1 });
    expect(crafted.accepted).toBe(true);

    const restored = restoreWorldSave(JSON.parse(JSON.stringify(createWorldSave(crafted.state))));
    expect(restored.hero.inventory).toEqual({ 'wood-plank': 4 });
    expect(inventoryItemsForState(restored).find((item) => item.id === 'wood-plank')).toMatchObject({
      quantity: 4,
      category: 'resources',
    });
  });
});
