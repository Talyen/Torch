import {
  addPosition,
  directionDelta,
  isCardinallyAdjacent,
  manhattanDistance,
  positionKey,
  samePosition,
} from './coords';
import { defaultActionForEnemy, defaultActionForEntity, resolveAction } from './actions';
import { blockingEntityAt, entityAt } from './entities';
import { abilityActionDefinition, canEquipAbility } from './ability-rules';
import { isTerrainWalkable, materializeGeneratedTrees, revealAround, tileAt } from './world';
import { cloneGameState } from './state';
import type { Command, CommandResult, Direction, GameState, Position, SimEvent } from './types';

function directionToward(from: Position, to: Position): Direction | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? 'east' : 'west';
  if (dy !== 0) return dy > 0 ? 'south' : 'north';
  return undefined;
}

function respawnHero(state: GameState, events: SimEvent[]): void {
  state.hero.deaths += 1;
  state.hero.position = { ...state.hero.boundPosition };
  state.hero.health = state.hero.maxHealth;
  revealAround(state, state.hero.position);
  materializeGeneratedTrees(state, state.hero.position);
  events.push({ type: 'hero-respawned', position: { ...state.hero.position } });
  events.push({ type: 'message', text: 'The Torch gutters out. You awaken at your bound homestead.' });
}

function advanceEnemies(state: GameState, events: SimEvent[]): void {
  const enemies = Object.values(state.entities).filter((entity) => entity.kind === 'enemy' && (entity.health ?? 0) > 0);

  for (const enemy of enemies) {
    if (enemy.disposition === 'neutral' && !enemy.alerted) continue;

    if ((enemy.stunnedActions ?? 0) > 0) {
      enemy.stunnedActions = Math.max(0, (enemy.stunnedActions ?? 0) - 1);
      continue;
    }

    const distance = manhattanDistance(enemy.position, state.hero.position);
    if (distance > 7) continue;

    if (distance === 1) {
      const amount = enemy.attack ?? 1;
      state.hero.health -= amount;
      events.push({ type: 'hero-damaged', amount, source: enemy.name });
      events.push({ type: 'message', text: `${enemy.name} strikes for ${amount}.` });
      if (state.hero.health <= 0) respawnHero(state, events);
      continue;
    }

    const direction = directionToward(enemy.position, state.hero.position);
    if (!direction) continue;

    const destination = addPosition(enemy.position, directionDelta(direction));
    if (!isTerrainWalkable(tileAt(state.seed, destination))) continue;
    const blocker = blockingEntityAt(state, destination);
    if (blocker && blocker.id !== enemy.id) continue;
    if (samePosition(destination, state.hero.position)) continue;

    const from = { ...enemy.position };
    enemy.position = destination;
    events.push({ type: 'enemy-moved', entityId: enemy.id, from, to: { ...destination } });
  }
}

function advanceAbilityCooldowns(state: GameState, consumedAbilityIds: Set<string>): void {
  for (const [abilityId, remaining] of Object.entries(state.hero.abilityCooldowns)) {
    if (consumedAbilityIds.has(abilityId)) continue;
    if (remaining <= 0) continue;
    state.hero.abilityCooldowns[abilityId] = remaining - 1;
  }
}

function advanceAbilityEffects(state: GameState, consumedAbilityIds: Set<string>): void {
  state.hero.activeAbilityEffects = state.hero.activeAbilityEffects.flatMap((effect) => {
    if (consumedAbilityIds.has(effect.abilityId)) return [effect];
    const remainingActions = effect.remainingActions - 1;
    return remainingActions > 0 ? [{ ...effect, remainingActions }] : [];
  });
}

function advanceTurn(state: GameState, events: SimEvent[], consumedAbilityIds: Set<string>): void {
  state.turn += 1;
  advanceAbilityCooldowns(state, consumedAbilityIds);
  advanceEnemies(state, events);
  advanceAbilityEffects(state, consumedAbilityIds);
  events.push({ type: 'turn-advanced', turn: state.turn });
}

export function applyCommand(state: GameState, command: Command): CommandResult {
  const next = cloneGameState(state);
  const events: SimEvent[] = [];
  const consumedAbilityIds = new Set<string>();
  let accepted = false;

  // Equipment changes are state commands but not turn-consuming actions.
  // They still go through this resolver so replays and UI callbacks share one
  // validation path.
  if (command.type === 'equip-ability') {
    const ability = abilityActionDefinition(command.abilityId);
    if (!ability || !canEquipAbility(command.slot, command.abilityId)) {
      events.push({ type: 'blocked', reason: 'That ability cannot be equipped in this slot.' });
      events.push({ type: 'message', text: 'That ability cannot be equipped in this slot.' });
    } else {
      next.hero.equippedAbilities[command.slot] = command.abilityId;
      next.hero.abilityCooldowns[command.abilityId] = 0;
      events.push({ type: 'ability-equipped', slot: command.slot, abilityId: command.abilityId });
      accepted = true;
    }
  } else {
    materializeGeneratedTrees(next, next.hero.position);

    switch (command.type) {
      case 'move': {
        const destination = addPosition(next.hero.position, directionDelta(command.direction));
        const destinationTerrain = tileAt(next.seed, destination);

        if (!isTerrainWalkable(destinationTerrain)) {
          const terrainName = 'A mountain';
          events.push({ type: 'blocked', reason: `${terrainName} blocks the way.` });
          events.push({ type: 'message', text: `${terrainName} blocks the way.` });
        } else {
          const blocker = blockingEntityAt(next, destination);

          if (blocker) {
            const action =
              blocker.kind === 'enemy'
                ? defaultActionForEnemy(next, blocker, destination)
                : defaultActionForEntity(blocker);
            if (action) {
              accepted = resolveAction(
                next,
                typeof action === 'string'
                  ? {
                      kind: action,
                      entityId: blocker.id,
                      target: { ...destination },
                    }
                  : action,
                events,
                consumedAbilityIds,
              );
            } else {
              events.push({ type: 'blocked', reason: `${blocker.name} blocks the way.` });
              events.push({ type: 'message', text: `${blocker.name} blocks the way.` });
            }
          } else {
            const from = { ...next.hero.position };
            next.hero.position = destination;
            revealAround(next, destination);
            materializeGeneratedTrees(next, destination);
            events.push({ type: 'hero-moved', from, to: { ...destination } });
            events.push({ type: 'message', text: `Moved to ${destination.x}, ${destination.y}.` });
            accepted = true;
          }
        }
        break;
      }
      case 'interact': {
        if (!isCardinallyAdjacent(next.hero.position, command.target)) {
          events.push({ type: 'blocked', reason: 'That is too far away.' });
          events.push({ type: 'message', text: 'You need to stand beside that resource.' });
        } else {
          const target = entityAt(next, command.target);
          const action = target ? defaultActionForEntity(target) : undefined;
          if (!target || !action) {
            events.push({ type: 'blocked', reason: 'There is nothing useful there.' });
            events.push({ type: 'message', text: 'There is no action available there.' });
          } else {
            accepted = resolveAction(
              next,
              {
                kind: action,
                entityId: target.id,
                target: { ...command.target },
              },
              events,
              consumedAbilityIds,
            );
          }
        }
        break;
      }
      case 'action':
        accepted = resolveAction(next, command.action, events, consumedAbilityIds);
        break;
      case 'wait':
        events.push({ type: 'message', text: 'You wait and listen to the dark.' });
        accepted = true;
        break;
    }
  }

  if (accepted && command.type !== 'equip-ability') advanceTurn(next, events, consumedAbilityIds);

  return { state: next, events, accepted };
}

export function latestMessage(events: SimEvent[]): string | undefined {
  return [...events].reverse().find((event) => event.type === 'message')?.text;
}

export function isTileRevealed(state: GameState, position: Position): boolean {
  return state.revealedTiles[positionKey(position)] === true;
}
