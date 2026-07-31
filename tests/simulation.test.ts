import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  availableActionsAt,
  createInitialGameState,
  generateChunk,
  generatedResourceAt,
  isTerrainWalkable,
  positionKey,
  PRIMARY_STAT_BUDGET,
  primaryStatTotal,
  tileAt,
} from '../src/sim';

describe('Torch simulation', () => {
  it('generates the same chunk for the same seed and coordinates', () => {
    const first = generateChunk(1234, -2, 4);
    const second = generateChunk(1234, -2, 4);

    expect(second).toEqual(first);
  });

  it('generates seeded grassland, forest, and mountain regions with mountain-side ore candidates', () => {
    const seed = 1234;
    const positions = Array.from({ length: 129 }, (_, index) => index - 64)
      .flatMap((x) => Array.from({ length: 129 }, (_, index) => ({ x, y: index - 64 })));
    const forest = positions.find((position) => tileAt(seed, position) === 'forest');
    const mountain = positions.find((position) => tileAt(seed, position) === 'mountain');
    const ore = positions.find((position) => generatedResourceAt(seed, position) === 'ore');
    const kinds = new Set(positions.map((position) => tileAt(seed, position)));

    expect(forest).toBeDefined();
    expect(mountain).toBeDefined();
    expect(ore).toBeDefined();
    expect(kinds).toEqual(new Set(['grass', 'forest', 'mountain']));
    expect(isTerrainWalkable('mountain')).toBe(false);
    expect(isTerrainWalkable('grass')).toBe(true);
  });

  it('reveals the Torch radius around the Hero', () => {
    const state = createInitialGameState(1234);

    expect(state.revealedTiles[positionKey({ x: 0, y: 2 })]).toBe(true);
    expect(state.revealedTiles[positionKey({ x: 3, y: 2 })]).toBe(true);
    expect(state.revealedTiles[positionKey({ x: 4, y: 2 })]).toBeUndefined();
  });

  it('starts the Knight with the shared 60-point primary stat budget', () => {
    const state = createInitialGameState(1234);

    expect(state.hero.heroId).toBe('hero.knight');
    expect(state.hero.primaryStats).toEqual({
      strength: 14,
      agility: 10,
      toughness: 14,
      wisdom: 12,
      intellect: 10,
    });
    expect(primaryStatTotal(state.hero.primaryStats)).toBe(PRIMARY_STAT_BUDGET);
    expect(primaryStatTotal(state.entities.slime.primaryStats!)).toBe(PRIMARY_STAT_BUDGET);
  });

  it('places the starter ore beside a generated mountain for the default seed', () => {
    const state = createInitialGameState();
    const orePosition = state.entities['resource-ore'].position;

    expect(generatedResourceAt(state.seed, orePosition)).toBe('ore');
  });

  it('treats generated mountains as impassable terrain', () => {
    const state = createInitialGameState(1234);
    const offsets = [
      { x: -1, y: 0, direction: 'east' as const },
      { x: 1, y: 0, direction: 'west' as const },
      { x: 0, y: -1, direction: 'south' as const },
      { x: 0, y: 1, direction: 'north' as const },
    ];
    const mountainAndStart = Array.from({ length: 129 }, (_, index) => index - 64)
      .flatMap((x) => Array.from({ length: 129 }, (_, index) => ({ x, y: index - 64 })))
      .flatMap((position) => offsets
        .filter((offset) => (
          tileAt(state.seed, position) === 'mountain'
          && isTerrainWalkable(tileAt(state.seed, { x: position.x + offset.x, y: position.y + offset.y }))
        ))
        .map((offset) => ({ mountain: position, start: { x: position.x + offset.x, y: position.y + offset.y }, direction: offset.direction }))
      )[0];

    expect(mountainAndStart).toBeDefined();
    const { start, direction } = mountainAndStart!;
    state.hero.position = start;
    const result = applyCommand(state, { type: 'move', direction });

    expect(result.accepted).toBe(false);
    expect(result.state.hero.position).toEqual(start);
    expect(result.events.some((event) => event.type === 'blocked' && event.reason.includes('mountain'))).toBe(true);
  });

  it('resolves cardinal movement as one action and lets a hostile enemy respond', () => {
    const state = createInitialGameState(1234);
    state.entities.slime.disposition = 'hostile';
    const result = applyCommand(state, { type: 'move', direction: 'east' });

    expect(result.accepted).toBe(true);
    expect(result.state.turn).toBe(1);
    expect(result.state.hero.position).toEqual({ x: 1, y: 2 });
    expect(result.state.entities.slime.position).toEqual({ x: 4, y: 2 });
    expect(result.events.some((event) => event.type === 'enemy-moved')).toBe(true);
  });

  it('keeps a neutral enemy passive until it is alerted', () => {
    const state = createInitialGameState(1234);
    const result = applyCommand(state, { type: 'move', direction: 'east' });

    expect(result.state.entities.slime.position).toEqual({ x: 5, y: 2 });
    expect(result.state.hero.health).toBe(result.state.hero.maxHealth);
    expect(result.events.some((event) => event.type === 'enemy-moved')).toBe(false);
  });

  it('allows an alerted neutral enemy to use hostile movement rules', () => {
    const state = createInitialGameState(1234);
    state.entities.slime.alerted = true;
    const result = applyCommand(state, { type: 'wait' });

    expect(result.state.entities.slime.position).toEqual({ x: 4, y: 2 });
    expect(result.events.some((event) => event.type === 'enemy-moved')).toBe(true);
  });

  it('gathers an adjacent resource and advances the turn', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 2, y: 2 };

    const result = applyCommand(state, {
      type: 'interact',
      target: { x: 3, y: 2 },
    });

    expect(result.accepted).toBe(true);
    expect(result.state.turn).toBe(1);
    expect(result.state.hero.inventory.wood).toBe(1);
    expect(result.state.entities['resource-tree']).toBeUndefined();
  });

  it('defaults a blocked move into a tree to the chop action', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 2, y: 2 };

    const result = applyCommand(state, { type: 'move', direction: 'east' });

    expect(result.accepted).toBe(true);
    expect(result.state.hero.position).toEqual({ x: 2, y: 2 });
    expect(result.state.hero.inventory.wood).toBe(1);
    expect(result.state.entities['resource-tree']).toBeUndefined();
    expect(result.events.some((event) => event.type === 'action-resolved' && event.action === 'chop')).toBe(true);
  });

  it('defaults a blocked move into an enemy to attack and exposes the action option', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };

    expect(availableActionsAt(state, { x: 5, y: 2 })).toEqual([
      { kind: 'attack', entityId: 'slime', target: { x: 5, y: 2 }, label: 'Attack' },
    ]);

    const result = applyCommand(state, { type: 'move', direction: 'east' });

    expect(result.accepted).toBe(true);
    expect(result.state.hero.position).toEqual({ x: 4, y: 2 });
    expect(result.state.entities.slime.health).toBe(3);
    expect(result.state.entities.slime.alerted).toBe(true);
    expect(result.state.hero.health).toBe(9);
    expect(result.events.some((event) => event.type === 'enemy-damaged')).toBe(true);
  });

  it('resolves an explicit typed action through the same validation path', () => {
    const state = createInitialGameState(1234);
    const orePosition = state.entities['resource-ore'].position;
    state.hero.position = { x: orePosition.x + 1, y: orePosition.y };

    const result = applyCommand(state, {
      type: 'action',
      action: { kind: 'mine', entityId: 'resource-ore', target: { ...orePosition } },
    });

    expect(result.accepted).toBe(true);
    expect(result.state.hero.inventory.ore).toBe(1);
    expect(result.state.entities['resource-ore']).toBeUndefined();
  });

  it('returns the Hero to the bound location after death without clearing inventory', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };
    state.hero.health = 1;
    state.hero.inventory.wood = 3;
    state.entities.slime.disposition = 'hostile';

    const result = applyCommand(state, { type: 'wait' });

    expect(result.state.hero.position).toEqual(state.hero.boundPosition);
    expect(result.state.hero.health).toBe(result.state.hero.maxHealth);
    expect(result.state.hero.deaths).toBe(1);
    expect(result.state.hero.inventory.wood).toBe(3);
    expect(result.events.some((event) => event.type === 'hero-respawned')).toBe(true);
  });
});
