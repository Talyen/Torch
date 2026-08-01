import { addPosition, directionDelta, isCardinallyAdjacent, manhattanDistance, samePosition } from './coords';
import { defaultActionForEnemy, defaultActionForEntity, resolveAction, type CombatEventContext } from './actions';
import { blockingEntityAt, entityAt } from './entities';
import { abilityActionDefinition, canEquipAbility } from './ability-rules';
import { craftingContextForState, resolveCraft } from './crafting';
import { applyLoadoutCommand } from './loadout';
import { isTerrainWalkable, materializeGeneratedTrees, revealAround, tileAt } from './world';
import { advanceWorldJournal, claimWorldJournalReward, resolveWaypointPosition } from './journal';
import { cloneGameStateForCommand } from './state';
import { invalidateEntitySpatialIndex } from './spatial-index';
import type { Command, CommandResult, Direction, GameState, Position, SimEvent, WaypointTarget } from './types';

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
  revealAroundWithEvent(state, state.hero.position, events);
  materializeGeneratedTrees(state, state.hero.position);
  events.push({ type: 'hero-respawned', position: { ...state.hero.position } });
  events.push({ type: 'message', text: 'The Torch gutters out. You awaken at your bound homestead.' });
}

function revealAroundWithEvent(state: GameState, center: Position, events: SimEvent[]): void {
  state.revealedTiles = { ...state.revealedTiles };
  const count = revealAround(state, center);
  if (count > 0) events.push({ type: 'tiles-revealed', count });
}

function waypointStatusFor(state: GameState, target: WaypointTarget) {
  if (resolveWaypointPosition(state, target)) return 'active';
  return target.kind === 'entity' ? 'removed' : 'unresolved';
}

function refreshWaypointStatus(state: GameState, events: SimEvent[]): void {
  const waypoint = state.journal.waypoint;
  if (!waypoint) return;
  const nextStatus = waypointStatusFor(state, waypoint.target);
  if (nextStatus === waypoint.status) return;
  waypoint.status = nextStatus;
  events.push({ type: 'waypoint-changed', entryId: waypoint.entryId, status: nextStatus });
}

function advanceEnemies(state: GameState, events: SimEvent[], combatContext: CombatEventContext): void {
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
      events.push({
        type: 'attack-resolved',
        attackId: `${state.turn}:attack:${combatContext.attackOrdinal++}:${enemy.id}:${state.hero.heroId}`,
        action: 'attack',
        attacker: {
          id: enemy.id,
          kind: 'enemy',
          name: enemy.name,
          position: { ...enemy.position },
        },
        target: {
          id: state.hero.heroId,
          kind: 'hero',
          name: 'Hero',
          position: { ...state.hero.position },
        },
        amount,
        targetDefeated: false,
      });
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
    invalidateEntitySpatialIndex(state);
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

function advanceTurn(
  state: GameState,
  events: SimEvent[],
  consumedAbilityIds: Set<string>,
  combatContext: CombatEventContext,
): void {
  state.turn += 1;
  advanceAbilityCooldowns(state, consumedAbilityIds);
  advanceEnemies(state, events, combatContext);
  advanceAbilityEffects(state, consumedAbilityIds);
  events.push({ type: 'turn-advanced', turn: state.turn });
}

export function applyCommand(state: GameState, command: Command): CommandResult {
  const next = cloneGameStateForCommand(state);
  const events: SimEvent[] = [];
  const consumedAbilityIds = new Set<string>();
  const combatContext: CombatEventContext = { attackOrdinal: 0 };
  let accepted = false;

  // Equipment and loadout changes are state commands but not turn-consuming actions.
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
  } else if (command.type === 'equip-item' || command.type === 'unequip-item') {
    accepted = applyLoadoutCommand(next, command, events);
  } else if (command.type === 'craft') {
    // Crafting is an out-of-turn state command. The menu can remain open while
    // the cloned resolver updates inventory, without moving enemies or
    // advancing cooldowns.
    accepted = resolveCraft(next, command, events, craftingContextForState(next));
  } else if (command.type === 'set-journal-focus') {
    if (command.entryId && next.journal.entries[command.entryId]?.status === 'locked') {
      events.push({ type: 'blocked', reason: 'That Journal entry is not available yet.' });
      events.push({ type: 'message', text: 'That Journal entry is not available yet.' });
    } else {
      next.journal.focusedEntryId = command.entryId;
      accepted = true;
    }
  } else if (command.type === 'set-waypoint') {
    const runtime = next.journal.entries[command.entryId];
    if (!runtime || runtime.status === 'locked') {
      events.push({ type: 'blocked', reason: 'That Journal entry is not available yet.' });
      events.push({ type: 'message', text: 'That Journal entry is not available yet.' });
    } else {
      const status = waypointStatusFor(next, command.target);
      next.journal.waypoint = { entryId: command.entryId, target: command.target, status };
      events.push({ type: 'waypoint-changed', entryId: command.entryId, status });
      accepted = true;
    }
  } else if (command.type === 'clear-waypoint') {
    delete next.journal.waypoint;
    events.push({ type: 'waypoint-changed', status: 'removed' });
    accepted = true;
  } else if (command.type === 'claim-journal-reward') {
    accepted = claimWorldJournalReward(next, command.entryId, events);
  } else {
    switch (command.type) {
      case 'move': {
        const destination = addPosition(next.hero.position, directionDelta(command.direction));
        const destinationTerrain = tileAt(next.seed, destination);

        if (!isTerrainWalkable(destinationTerrain)) {
          const terrainName = 'A mountain';
          events.push({ type: 'blocked', reason: `${terrainName} blocks the way.` });
          events.push({ type: 'message', text: `${terrainName} blocks the way.` });
        } else {
          // Generated trees are part of movement validation because a tree in
          // the destination tile resolves its default chop action. Delay the
          // materialization until after terrain validation so a rejected move
          // cannot expose or remove unrelated generated entities.
          materializeGeneratedTrees(next, next.hero.position);
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
                combatContext,
              );
            } else {
              events.push({ type: 'blocked', reason: `${blocker.name} blocks the way.` });
              events.push({ type: 'message', text: `${blocker.name} blocks the way.` });
            }
          } else {
            const from = { ...next.hero.position };
            next.hero.position = destination;
            revealAroundWithEvent(next, destination, events);
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
              combatContext,
            );
          }
        }
        break;
      }
      case 'action':
        accepted = resolveAction(next, command.action, events, consumedAbilityIds, combatContext);
        break;
      case 'wait':
        events.push({ type: 'message', text: 'You wait and listen to the dark.' });
        accepted = true;
        break;
    }
  }

  if (accepted && !isStateOnlyCommand(command)) {
    // Keep the active generated ring current only after the command has been
    // accepted. Rejected interactions and actions must return the untouched
    // cloned state, including its sparse generated-entity mutations.
    materializeGeneratedTrees(next, next.hero.position);
    advanceTurn(next, events, consumedAbilityIds, combatContext);
    refreshWaypointStatus(next, events);
  }

  if (
    accepted &&
    !isStateOnlyCommand(command) &&
    command.type !== 'set-journal-focus' &&
    command.type !== 'set-waypoint' &&
    command.type !== 'clear-waypoint' &&
    command.type !== 'claim-journal-reward'
  ) {
    advanceWorldJournal(next, events);
  }

  return { state: next, events, accepted };
}

function isStateOnlyCommand(command: Command): boolean {
  return (
    command.type === 'equip-ability' ||
    command.type === 'equip-item' ||
    command.type === 'unequip-item' ||
    command.type === 'craft' ||
    command.type === 'set-journal-focus' ||
    command.type === 'set-waypoint' ||
    command.type === 'clear-waypoint' ||
    command.type === 'claim-journal-reward'
  );
}

export function latestMessage(events: SimEvent[]): string | undefined {
  return [...events].reverse().find((event) => event.type === 'message')?.text;
}
