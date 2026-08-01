import { describe, expect, it } from 'vitest';
import { applyCommand, createInitialGameState, createWorldSave, restoreWorldSave } from '../src/sim';

describe('canonical equipment and tool loadouts', () => {
  it('equips and replaces inventory-owned equipment without advancing time', () => {
    const state = createInitialGameState(1234);
    const result = applyCommand(state, { type: 'equip-item', slot: 'main-hand', itemId: 'iron-sword' });

    expect(result.accepted).toBe(true);
    expect(result.state.turn).toBe(state.turn);
    expect(result.state.hero.equippedItems['main-hand']).toBe('iron-sword');
    expect(result.state.hero.inventory['iron-sword']).toBeUndefined();
    expect(result.events).toContainEqual({ type: 'item-equipped', slot: 'main-hand', itemId: 'iron-sword' });

    const replaced = applyCommand(result.state, { type: 'equip-item', slot: 'main-hand', itemId: 'steel-dagger' });
    expect(replaced.accepted).toBe(true);
    expect(replaced.state.hero.equippedItems['main-hand']).toBe('steel-dagger');
    expect(replaced.state.hero.inventory['iron-sword']).toBe(1);
    expect(replaced.state.hero.inventory['steel-dagger']).toBeUndefined();
  });

  it('rejects incompatible or unowned loadout choices without mutation', () => {
    const state = createInitialGameState(1234);
    const incompatible = applyCommand(state, { type: 'equip-item', slot: 'main-hand', itemId: 'iron-axe' });
    expect(incompatible.accepted).toBe(false);
    expect(incompatible.state).toEqual(state);

    const missing = applyCommand(state, { type: 'equip-item', slot: 'main-hand', itemId: 'unknown-item' });
    expect(missing.accepted).toBe(false);
    expect(missing.state).toEqual(state);
  });

  it('uses tool slots through the same canonical command path', () => {
    const state = createInitialGameState(1234);
    const equipped = applyCommand(state, { type: 'equip-item', slot: 'axe', itemId: 'iron-axe' });
    expect(equipped.accepted).toBe(true);
    expect(equipped.state.hero.equippedTools.axe).toBe('iron-axe');

    const unequipped = applyCommand(equipped.state, { type: 'unequip-item', slot: 'axe' });
    expect(unequipped.accepted).toBe(true);
    expect(unequipped.state.hero.equippedTools.axe).toBeUndefined();
    expect(unequipped.state.hero.inventory['iron-axe']).toBe(1);
  });

  it('gates equipment crafting to the unlocked homestead workbench', () => {
    const state = createInitialGameState(1234);
    state.hero.inventory = { 'wood-plank': 2, 'copper-ingot': 1 };

    const away = applyCommand(state, { type: 'craft', recipeId: 'recipe.iron-axe', quantity: 1 });
    expect(away.accepted).toBe(false);
    expect(away.events).toContainEqual(expect.objectContaining({ type: 'craft-blocked', reason: 'requires-station' }));

    const atHome = { ...state, hero: { ...state.hero, position: { ...state.homestead } } };
    const crafted = applyCommand(atHome, { type: 'craft', recipeId: 'recipe.iron-axe', quantity: 1 });
    expect(crafted.accepted).toBe(true);
    expect(crafted.state.hero.inventory['iron-axe']).toBe(1);
    expect(crafted.state.turn).toBe(atHome.turn);
  });

  it('round-trips loadouts and station state through the clean v2 save shape', () => {
    const state = createInitialGameState(1234);
    const equipped = applyCommand(state, { type: 'equip-item', slot: 'main-hand', itemId: 'iron-sword' });
    const restored = restoreWorldSave(createWorldSave(equipped.state));

    expect(restored.hero.equippedItems).toEqual({ 'main-hand': 'iron-sword' });
    expect(restored.hero.equippedTools).toEqual({});
    expect(restored.unlockedStations).toEqual({ workbench: true });
  });
});
