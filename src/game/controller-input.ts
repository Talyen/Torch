import type { InputAction } from './input-bindings';

export const CONTROLLER_AXIS_DEADZONE = 0.55;

const STANDARD_BUTTON = {
  primary: 0,
  wait: 2,
  menu: 9,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

export interface ControllerButtonState {
  pressed: boolean;
  value: number;
}

export interface ControllerGamepadState {
  index: number;
  connected: boolean;
  mapping?: string;
  axes: readonly number[];
  buttons: readonly ControllerButtonState[];
}

export interface NavigatorGamepadSource {
  getGamepads(): ArrayLike<ControllerGamepadState | null>;
}

function supportedGamepad(gamepad: ControllerGamepadState): boolean {
  // Browser Gamepad button indices are portable only for the standard layout.
  // The optional case keeps small headless test doubles ergonomic.
  return gamepad.connected && (gamepad.mapping === undefined || gamepad.mapping === 'standard');
}

function buttonPressed(gamepad: ControllerGamepadState, index: number): boolean {
  const button = gamepad.buttons[index];
  return button?.pressed === true || (Number.isFinite(button?.value) && (button?.value ?? 0) >= 0.5);
}

function finiteAxis(gamepad: ControllerGamepadState, index: number): number {
  const value = gamepad.axes[index];
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

function dpadAction(gamepad: ControllerGamepadState): InputAction | undefined {
  const up = buttonPressed(gamepad, STANDARD_BUTTON.dpadUp);
  const down = buttonPressed(gamepad, STANDARD_BUTTON.dpadDown);
  const left = buttonPressed(gamepad, STANDARD_BUTTON.dpadLeft);
  const right = buttonPressed(gamepad, STANDARD_BUTTON.dpadRight);
  const vertical = up !== down ? (up ? 'move-north' : 'move-south') : undefined;
  const horizontal = left !== right ? (left ? 'move-west' : 'move-east') : undefined;

  // Torch consumes one cardinal action at a time. Ambiguous diagonals wait for
  // the player to choose one direction instead of resolving by frame order.
  if (vertical && horizontal) return undefined;
  return vertical ?? horizontal;
}

function stickAction(gamepad: ControllerGamepadState): InputAction | undefined {
  const horizontal = finiteAxis(gamepad, 0);
  const vertical = finiteAxis(gamepad, 1);
  const horizontalMagnitude = Math.abs(horizontal);
  const verticalMagnitude = Math.abs(vertical);

  if (horizontalMagnitude < CONTROLLER_AXIS_DEADZONE && verticalMagnitude < CONTROLLER_AXIS_DEADZONE) {
    return undefined;
  }
  if (horizontalMagnitude === verticalMagnitude) return undefined;
  if (horizontalMagnitude > verticalMagnitude) return horizontal < 0 ? 'move-west' : 'move-east';
  return vertical < 0 ? 'move-north' : 'move-south';
}

/** Translate a standard-layout browser gamepad snapshot into active client intents. */
export function activeControllerActions(gamepad: ControllerGamepadState): InputAction[] {
  if (!supportedGamepad(gamepad)) return [];

  const actions: InputAction[] = [];
  if (buttonPressed(gamepad, STANDARD_BUTTON.menu)) actions.push('map');
  if (buttonPressed(gamepad, STANDARD_BUTTON.primary)) actions.push('gather');
  if (buttonPressed(gamepad, STANDARD_BUTTON.wait)) actions.push('wait');
  const movement = dpadAction(gamepad) ?? stickAction(gamepad);
  if (movement) actions.push(movement);
  return actions;
}

/**
 * Emit one intent on each neutral-to-active edge.
 *
 * Holding a stick cannot advance the turn every render frame: the player must
 * return it to the deadzone before another one-tile movement is emitted.
 */
export class ControllerInputTracker {
  private gamepadIndex?: number;
  private activeActions = new Set<InputAction>();

  public poll(gamepad: ControllerGamepadState | undefined): InputAction | undefined {
    if (!gamepad?.connected) {
      this.reset();
      return undefined;
    }
    if (this.gamepadIndex !== gamepad.index) {
      this.gamepadIndex = gamepad.index;
      this.activeActions.clear();
    }

    const current = activeControllerActions(gamepad);
    const nextAction = current.find((action) => !this.activeActions.has(action));
    this.activeActions = new Set(current);
    return nextAction;
  }

  public reset(): void {
    this.gamepadIndex = undefined;
    this.activeActions.clear();
  }
}

/** Read the first connected browser gamepad without trusting API availability. */
export function readConnectedGamepad(
  source: NavigatorGamepadSource | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): ControllerGamepadState | undefined {
  if (!source || typeof source.getGamepads !== 'function') return undefined;
  try {
    return Array.from(source.getGamepads()).find(
      (gamepad): gamepad is ControllerGamepadState => gamepad !== null && supportedGamepad(gamepad),
    );
  } catch {
    return undefined;
  }
}
