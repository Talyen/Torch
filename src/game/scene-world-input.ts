import type { Position } from '../sim';
import type { GameRuntimePort } from './session';
import {
  directionForInputAction,
  directionForKey,
  keyMatchesBinding,
  OPEN_JOURNAL_EVENT,
  OPEN_MAP_EVENT,
} from './input-bindings';
import type { InputAction, KeyBindings } from './input-bindings';
import { presentationGate } from './presentation-gate';

export function canAcceptWorldInput(runtime: GameRuntimePort, heroAnimating: boolean): boolean {
  return (
    runtime.inputMode === 'world' && runtime.runtimeStatus !== 'loading' && !heroAnimating && !presentationGate.busy
  );
}

/** Route physical input through the existing session boundary. */
export function dispatchWorldInput(runtime: GameRuntimePort, action: InputAction): void {
  const direction = directionForInputAction(action);
  if (direction) {
    runtime.move(direction);
  } else if (action === 'wait') {
    runtime.wait();
  } else if (action === 'gather') {
    runtime.gather();
  } else if (action === 'map') {
    window.dispatchEvent(new Event(OPEN_MAP_EVENT));
  } else if (action === 'journal') {
    window.dispatchEvent(new Event(OPEN_JOURNAL_EVENT));
  }
}

export function dispatchBoundKeyboardInput(
  runtime: GameRuntimePort,
  event: KeyboardEvent,
  bindings: KeyBindings,
): boolean {
  const direction = directionForKey(bindings, event.key);
  if (direction) {
    event.preventDefault();
    runtime.move(direction);
    return true;
  }

  const action: InputAction | undefined = keyMatchesBinding(bindings, 'wait', event.key)
    ? 'wait'
    : keyMatchesBinding(bindings, 'gather', event.key)
      ? 'gather'
      : keyMatchesBinding(bindings, 'map', event.key)
        ? 'map'
        : keyMatchesBinding(bindings, 'journal', event.key)
          ? 'journal'
          : undefined;
  if (!action) return false;
  event.preventDefault();
  dispatchWorldInput(runtime, action);
  return true;
}

export function moveHeroForAdjacentTile(runtime: GameRuntimePort, target: Position): void {
  const hero = runtime.state.hero.position;
  const deltaX = target.x - hero.x;
  const deltaY = target.y - hero.y;
  if (Math.abs(deltaX) + Math.abs(deltaY) !== 1) return;
  if (deltaX === 1) runtime.move('east');
  else if (deltaX === -1) runtime.move('west');
  else if (deltaY === 1) runtime.move('south');
  else if (deltaY === -1) runtime.move('north');
}
