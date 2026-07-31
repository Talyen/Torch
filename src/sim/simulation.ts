import {
  addPosition,
  directionDelta,
  isCardinallyAdjacent,
  manhattanDistance,
  positionKey,
  samePosition,
} from './coords';
import { defaultActionForEntity, resolveAction } from './actions';
import { entityOccupiesPosition } from './footprint';
import { revealAround } from './world';
import type { Command, CommandResult, Direction, EntityState, GameState, Position, SimEvent } from './types';

function cloneState(state: GameState): GameState {
  return structuredClone(state) as GameState;
}

function entityAt(state: GameState, position: Position): EntityState | undefined {
  return Object.values(state.entities).find(
    (entity) => entity.health !== 0 && entityOccupiesPosition(entity, position),
  );
}

function blockingEntityAt(state: GameState, position: Position): EntityState | undefined {
  const entity = entityAt(state, position);
  return entity?.blocksMovement ? entity : undefined;
}

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
  events.push({ type: 'hero-respawned', position: { ...state.hero.position } });
  events.push({ type: 'message', text: 'The Torch gutters out. You awaken at your bound homestead.' });
}

function advanceEnemies(state: GameState, events: SimEvent[]): void {
  const enemies = Object.values(state.entities).filter(
    (entity) => entity.kind === 'enemy' && (entity.health ?? 0) > 0,
  );

  for (const enemy of enemies) {
    if (enemy.disposition === 'neutral' && !enemy.alerted) continue;

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
    const blocker = blockingEntityAt(state, destination);
    if (blocker && blocker.id !== enemy.id) continue;
    if (samePosition(destination, state.hero.position)) continue;

    const from = { ...enemy.position };
    enemy.position = destination;
    events.push({ type: 'enemy-moved', entityId: enemy.id, from, to: { ...destination } });
  }
}

function advanceTurn(state: GameState, events: SimEvent[]): void {
  state.turn += 1;
  advanceEnemies(state, events);
  events.push({ type: 'turn-advanced', turn: state.turn });
}

export function findAdjacentResource(state: GameState): Position | undefined {
  const adjacent = Object.values(state.entities).find(
    (entity) =>
      (entity.kind === 'tree' || entity.kind === 'ore') &&
      isCardinallyAdjacent(entity.position, state.hero.position),
  );
  return adjacent ? { ...adjacent.position } : undefined;
}

export function applyCommand(state: GameState, command: Command): CommandResult {
  const next = cloneState(state);
  const events: SimEvent[] = [];
  let accepted = false;

  if (command.type === 'move') {
    const destination = addPosition(next.hero.position, directionDelta(command.direction));
    const blocker = blockingEntityAt(next, destination);

    if (blocker) {
      const action = defaultActionForEntity(blocker);
      if (action) {
        accepted = resolveAction(next, {
          kind: action,
          entityId: blocker.id,
          target: { ...destination },
        }, events);
      } else {
        events.push({ type: 'blocked', reason: `${blocker.name} blocks the way.` });
        events.push({ type: 'message', text: `${blocker.name} blocks the way.` });
      }
    } else {
      const from = { ...next.hero.position };
      next.hero.position = destination;
      revealAround(next, destination);
      events.push({ type: 'hero-moved', from, to: { ...destination } });
      events.push({ type: 'message', text: `Moved to ${destination.x}, ${destination.y}.` });
      accepted = true;
    }
  }

  if (command.type === 'interact') {
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
        accepted = resolveAction(next, {
          kind: action,
          entityId: target.id,
          target: { ...command.target },
        }, events);
      }
    }
  }

  if (command.type === 'action') {
    accepted = resolveAction(next, command.action, events);
  }

  if (command.type === 'wait') {
    events.push({ type: 'message', text: 'You wait and listen to the dark.' });
    accepted = true;
  }

  if (accepted) advanceTurn(next, events);

  return { state: next, events, accepted };
}

export function latestMessage(events: SimEvent[]): string | undefined {
  return [...events].reverse().find((event) => event.type === 'message')?.text;
}

export function isTileRevealed(state: GameState, position: Position): boolean {
  return state.revealedTiles[positionKey(position)] === true;
}
