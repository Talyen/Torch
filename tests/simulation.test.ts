import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  availableActionsAt,
  availableContextActionsAt,
  contextActionCardKey,
  createInitialGameState,
  generateChunk,
  generatedResourceAt,
  generatedTreeAt,
  generatedTreeId,
  isTerrainWalkable,
  materializeGeneratedTrees,
  positionKey,
  PRIMARY_STAT_BUDGET,
  primaryStatTotal,
  tileAt,
} from '../src/sim';

const SEED_1234_TERRAIN = {
  seed: 1234,
  positions: Array.from({ length: 129 }, (_, index) => index - 64).flatMap((x) =>
    Array.from({ length: 129 }, (_, index) => ({ x, y: index - 64 })),
  ),
} as const;

describe('Torch simulation', () => {
  it('generates the same chunk for the same seed and coordinates', () => {
    const first = generateChunk(1234, -2, 4);
    const second = generateChunk(1234, -2, 4);

    expect(second).toEqual(first);
  });

  it('generates grassland and mountain terrain with deterministic tree groves and ore candidates', () => {
    const { seed, positions } = SEED_1234_TERRAIN;
    const mountain = positions.find((position) => tileAt(seed, position) === 'mountain');
    const ore = positions.find((position) => generatedResourceAt(seed, position) === 'ore');
    const treeCount = positions.filter((position) => generatedTreeAt(seed, position)).length;
    const kinds = new Set(positions.map((position) => tileAt(seed, position)));

    expect(mountain).toBeDefined();
    expect(ore).toBeDefined();
    expect(treeCount).toBeGreaterThan(positions.length * 0.15);
    expect(kinds).toEqual(new Set(['grass', 'mountain']));
    expect(isTerrainWalkable('mountain')).toBe(false);
    expect(isTerrainWalkable('grass')).toBe(true);
  });

  it('places ore on every walkable tile adjacent to a mountain', () => {
    const { seed, positions } = SEED_1234_TERRAIN;
    const mountain = positions.find((position) => tileAt(seed, position) === 'mountain');
    const adjacent = [
      { x: mountain!.x, y: mountain!.y - 1 },
      { x: mountain!.x + 1, y: mountain!.y },
      { x: mountain!.x, y: mountain!.y + 1 },
      { x: mountain!.x - 1, y: mountain!.y },
    ].filter((position) => isTerrainWalkable(tileAt(seed, position)));

    expect(mountain).toBeDefined();
    expect(adjacent.length).toBeGreaterThan(0);
    expect(adjacent.every((position) => generatedResourceAt(seed, position) === 'ore')).toBe(true);
  });

  it('materializes generated trees as chop actions and remembers removed groves', () => {
    const state = createInitialGameState(SEED_1234_TERRAIN.seed);
    const position = SEED_1234_TERRAIN.positions.find((candidate) => generatedTreeAt(state.seed, candidate));

    expect(position).toBeDefined();
    materializeGeneratedTrees(state, position!);
    const treeId = generatedTreeId(position!);
    expect(state.entities[treeId]?.actions).toEqual(['chop']);
    expect(state.entities[treeId]?.gatheringActionCost).toBe(1);

    state.hero.position = { x: position!.x - 1, y: position!.y };
    const result = applyCommand(state, { type: 'interact', target: position! });

    expect(result.accepted).toBe(true);
    expect(result.state.entities[treeId]).toBeUndefined();
    expect(result.state.removedGeneratedEntities[treeId]).toBe(true);
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
    const state = createInitialGameState(SEED_1234_TERRAIN.seed);
    const offsets = [
      { x: -1, y: 0, direction: 'east' as const },
      { x: 1, y: 0, direction: 'west' as const },
      { x: 0, y: -1, direction: 'south' as const },
      { x: 0, y: 1, direction: 'north' as const },
    ];
    const mountainAndStart = SEED_1234_TERRAIN.positions.flatMap((position) =>
      offsets
        .filter(
          (offset) =>
            tileAt(state.seed, position) === 'mountain' &&
            isTerrainWalkable(tileAt(state.seed, { x: position.x + offset.x, y: position.y + offset.y })),
        )
        .map((offset) => ({
          mountain: position,
          start: { x: position.x + offset.x, y: position.y + offset.y },
          direction: offset.direction,
        })),
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
    expect(result.state.hero.inventory.wood).toBe(state.hero.inventory.wood + 1);
    expect(result.state.entities['resource-tree']).toBeUndefined();
  });

  it('does not expose entities with depleted health to action resolution', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };
    state.entities.slime.health = -1;

    const result = applyCommand(state, {
      type: 'action',
      action: {
        kind: 'attack',
        entityId: 'slime',
        target: { x: 5, y: 2 },
      },
    });

    expect(result.accepted).toBe(false);
    expect(result.state.turn).toBe(0);
    expect(result.events.some((event) => event.type === 'blocked')).toBe(true);
  });

  it('defaults a blocked move into a tree to the chop action', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 2, y: 2 };

    const result = applyCommand(state, { type: 'move', direction: 'east' });

    expect(result.accepted).toBe(true);
    expect(result.state.hero.position).toEqual({ x: 2, y: 2 });
    expect(result.state.hero.inventory.wood).toBe(state.hero.inventory.wood + 1);
    expect(result.state.entities['resource-tree']).toBeUndefined();
    expect(result.events.some((event) => event.type === 'action-resolved' && event.action === 'chop')).toBe(true);
  });

  it('retains the target name in action events after a gatherable is removed', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 2, y: 2 };

    const result = applyCommand(state, { type: 'move', direction: 'east' });
    const resolved = result.events.find(
      (event): event is Extract<typeof event, { type: 'action-resolved' }> => event.type === 'action-resolved',
    );

    expect(result.state.entities['resource-tree']).toBeUndefined();
    expect(resolved).toMatchObject({ action: 'chop', entityId: 'resource-tree', entityName: 'Old Pine' });
  });

  it('defaults a blocked move into an enemy to the strongest ready ability', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };

    expect(availableActionsAt(state, { x: 5, y: 2 })).toEqual([
      { kind: 'attack', entityId: 'slime', target: { x: 5, y: 2 }, label: 'Attack' },
    ]);

    const result = applyCommand(state, { type: 'move', direction: 'east' });

    expect(result.accepted).toBe(true);
    expect(result.state.hero.position).toEqual({ x: 4, y: 2 });
    expect(result.state.entities.slime.health).toBe(4);
    expect(result.state.entities.slime.alerted).toBe(true);
    expect(result.state.hero.health).toBe(9);
    expect(result.events.some((event) => event.type === 'ability-used' && event.abilityId === 'ability.avatar')).toBe(
      true,
    );
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
    expect(result.state.hero.inventory.ore).toBe(state.hero.inventory.ore + 1);
    expect(result.state.entities['resource-ore']).toBeUndefined();
  });

  it('projects gathering context into a single-action card', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 2, y: 2 };

    const cards = availableContextActionsAt(state, { x: 3, y: 2 });

    expect(cards).toEqual([
      expect.objectContaining({
        id: 'context:entity:resource-tree:chop',
        label: 'Chop',
        source: 'entity',
        action: { kind: 'chop', entityId: 'resource-tree', target: { x: 3, y: 2 } },
      }),
    ]);
  });

  it('projects only ready equipped abilities into combat cards', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };
    state.hero.abilityCooldowns['ability.sunder'] = 2;

    const cards = availableContextActionsAt(state, { x: 5, y: 2 });

    expect(cards.map((card) => card.abilityId)).toEqual(['ability.bash', 'ability.avatar']);
    expect(cards).toEqual([
      expect.objectContaining({
        abilityId: 'ability.bash',
        cooldownRemaining: 0,
        disabledReason: undefined,
      }),
      expect.objectContaining({
        abilityId: 'ability.avatar',
        cooldownRemaining: 0,
        disabledReason: undefined,
      }),
    ]);
    expect(cards[0]?.action).toEqual({
      kind: 'ability',
      abilityId: 'ability.bash',
      entityId: 'slime',
      target: { x: 5, y: 2 },
    });
    expect(cards).not.toContainEqual(expect.objectContaining({ abilityId: 'ability.sunder' }));
  });

  it('falls back deterministically to entity actions when all abilities are cooling down', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };
    state.hero.abilityCooldowns = {
      'ability.bash': 1,
      'ability.sunder': 2,
      'ability.avatar': 3,
    };

    const cards = availableContextActionsAt(state, { x: 5, y: 2 });

    expect(cards).toEqual([
      {
        id: 'context:entity:slime:attack',
        label: 'Attack',
        source: 'entity',
        entityName: 'Forest Slime',
        action: { kind: 'attack', entityId: 'slime', target: { x: 5, y: 2 } },
      },
    ]);

    const blockedCooldownAction = applyCommand(state, {
      type: 'action',
      action: {
        kind: 'ability',
        abilityId: 'ability.sunder',
        entityId: 'slime',
        target: { x: 5, y: 2 },
      },
    });
    expect(blockedCooldownAction.accepted).toBe(false);
    expect(blockedCooldownAction.state.turn).toBe(0);
    expect(blockedCooldownAction.state.entities.slime.health).toBe(state.entities.slime.health);
    expect(blockedCooldownAction.events.some((event) => event.type === 'blocked')).toBe(true);

    const fallback = applyCommand(state, { type: 'action', action: cards[0]!.action });
    expect(fallback.accepted).toBe(true);
    expect(fallback.state.turn).toBe(1);
    expect(fallback.state.entities.slime.health).toBe(3);
    expect(fallback.events.some((event) => event.type === 'action-resolved' && event.action === 'attack')).toBe(true);
  });

  it('keeps ability card identity stable when the adjacent enemy target changes', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };
    state.entities['second-slime'] = {
      ...state.entities.slime,
      id: 'second-slime',
      name: 'Second Slime',
      position: { x: 4, y: 3 },
    };

    const firstTargetCards = availableContextActionsAt(state, { x: 5, y: 2 });
    const secondTargetCards = availableContextActionsAt(state, { x: 4, y: 3 });

    expect(firstTargetCards.map(contextActionCardKey)).toEqual(secondTargetCards.map(contextActionCardKey));
    expect(firstTargetCards[0]?.action.target).not.toEqual(secondTargetCards[0]?.action.target);
  });

  it('resolves an equipped ability and advances its cooldown deterministically', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };
    const result = applyCommand(state, {
      type: 'action',
      action: {
        kind: 'ability',
        abilityId: 'ability.sunder',
        entityId: 'slime',
        target: { x: 5, y: 2 },
      },
    });

    expect(result.accepted).toBe(true);
    expect(result.state.entities.slime.health).toBe(1);
    expect(result.state.hero.abilityCooldowns['ability.sunder']).toBe(3);
    expect(result.events.some((event) => event.type === 'ability-used' && event.abilityId === 'ability.sunder')).toBe(
      true,
    );

    const afterOneTurn = applyCommand(result.state, { type: 'wait' });
    expect(afterOneTurn.state.hero.abilityCooldowns['ability.sunder']).toBe(2);
    const afterTwoTurns = applyCommand(afterOneTurn.state, { type: 'wait' });
    expect(afterTwoTurns.state.hero.abilityCooldowns['ability.sunder']).toBe(1);
    const afterThreeTurns = applyCommand(afterTwoTurns.state, { type: 'wait' });
    expect(afterThreeTurns.state.hero.abilityCooldowns['ability.sunder']).toBe(0);
  });

  it('applies the Knight ability effects from the Trinket rules', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };
    state.entities.slime.health = 8;
    state.entities.slime.block = 5;

    const bash = applyCommand(state, {
      type: 'action',
      action: { kind: 'ability', abilityId: 'ability.bash', entityId: 'slime', target: { x: 5, y: 2 } },
    });
    expect(bash.state.entities.slime.health).toBe(6);
    expect(bash.state.entities.slime.stunnedActions).toBe(0);
    expect(bash.state.hero.health).toBe(10);

    const sunder = applyCommand(bash.state, {
      type: 'action',
      action: { kind: 'ability', abilityId: 'ability.sunder', entityId: 'slime', target: { x: 5, y: 2 } },
    });
    expect(sunder.state.entities.slime.health).toBe(3);
    expect(sunder.state.entities.slime.block).toBe(2);

    const avatarState = createInitialGameState(1234);
    avatarState.hero.position = { x: 4, y: 2 };
    avatarState.hero.block = 3;
    const avatar = applyCommand(avatarState, {
      type: 'action',
      action: { kind: 'ability', abilityId: 'ability.avatar', entityId: 'slime', target: { x: 5, y: 2 } },
    });
    expect(avatar.state.hero.activeAbilityEffects).toEqual([
      expect.objectContaining({
        abilityId: 'ability.avatar',
        kind: 'holy-damage-from-block',
        amount: 3,
        remainingActions: 2,
      }),
    ]);
  });

  it('routes ability loadout changes through a non-turn simulation command', () => {
    const state = createInitialGameState(1234);
    const result = applyCommand(state, {
      type: 'equip-ability',
      slot: 'basic',
      abilityId: 'ability.bash',
    });

    expect(result.accepted).toBe(true);
    expect(result.state.turn).toBe(state.turn);
    expect(result.state.hero.equippedAbilities.basic).toBe('ability.bash');
    expect(result.state.hero.abilityCooldowns['ability.bash']).toBe(0);
    expect(result.events).toContainEqual({
      type: 'ability-equipped',
      slot: 'basic',
      abilityId: 'ability.bash',
    });

    const invalid = applyCommand(result.state, {
      type: 'equip-ability',
      slot: 'basic',
      abilityId: 'ability.avatar',
    });
    expect(invalid.accepted).toBe(false);
    expect(invalid.state.hero.equippedAbilities.basic).toBe('ability.bash');
    expect(invalid.state.turn).toBe(result.state.turn);
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
