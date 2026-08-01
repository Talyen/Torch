import { describe, expect, it } from 'vitest';
import {
  activeControllerActions,
  CONTROLLER_AXIS_DEADZONE,
  ControllerInputTracker,
  readConnectedGamepad,
} from '../src/game/controller-input';
import type { ControllerGamepadState } from '../src/game/controller-input';
import { directionForInputAction } from '../src/game/input-bindings';

function gamepad(overrides: Partial<ControllerGamepadState> = {}): ControllerGamepadState {
  return {
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    ...overrides,
  };
}

function withButtons(...indices: number[]): ControllerGamepadState {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  for (const index of indices) buttons[index] = { pressed: true, value: 1 };
  return gamepad({ buttons });
}

describe('controller input', () => {
  it('maps standard D-pad and dominant left-stick input to cardinal intents', () => {
    expect(activeControllerActions(withButtons(12))).toContain('move-north');
    expect(activeControllerActions(withButtons(13))).toContain('move-south');
    expect(activeControllerActions(withButtons(14))).toContain('move-west');
    expect(activeControllerActions(withButtons(15))).toContain('move-east');
    expect(activeControllerActions(gamepad({ axes: [0.8, 0.6] }))).toContain('move-east');
    expect(activeControllerActions(gamepad({ axes: [0.2, -0.9] }))).toContain('move-north');
    expect(directionForInputAction('move-west')).toBe('west');
  });

  it('ignores deadzone noise and ambiguous diagonals', () => {
    expect(
      activeControllerActions(
        gamepad({
          axes: [CONTROLLER_AXIS_DEADZONE - 0.01, -(CONTROLLER_AXIS_DEADZONE - 0.01)],
        }),
      ),
    ).toEqual([]);
    expect(activeControllerActions(gamepad({ axes: [0.8, -0.8] }))).toEqual([]);
    expect(activeControllerActions(withButtons(12, 15))).toEqual([]);
  });

  it('maps standard face and menu buttons to gather, wait, and map', () => {
    expect(activeControllerActions(withButtons(0))).toEqual(['gather']);
    expect(activeControllerActions(withButtons(2))).toEqual(['wait']);
    expect(activeControllerActions(withButtons(9))).toEqual(['map']);
  });

  it('emits one action per press and requires release before repeating movement', () => {
    const tracker = new ControllerInputTracker();
    const east = gamepad({ axes: [1, 0] });
    const neutral = gamepad();

    expect(tracker.poll(east)).toBe('move-east');
    expect(tracker.poll(east)).toBeUndefined();
    expect(tracker.poll(neutral)).toBeUndefined();
    expect(tracker.poll(east)).toBe('move-east');
  });

  it('resets safely for disconnects, controller changes, and unavailable browser APIs', () => {
    const tracker = new ControllerInputTracker();
    expect(tracker.poll(gamepad({ axes: [1, 0] }))).toBe('move-east');
    expect(tracker.poll(undefined)).toBeUndefined();
    expect(tracker.poll(gamepad({ axes: [1, 0] }))).toBe('move-east');
    expect(tracker.poll(gamepad({ index: 1, axes: [1, 0] }))).toBe('move-east');

    expect(readConnectedGamepad(undefined)).toBeUndefined();
    expect(readConnectedGamepad({ getGamepads: () => [gamepad({ mapping: '' })] })).toBeUndefined();
    expect(readConnectedGamepad({ getGamepads: () => [null, gamepad({ index: 2 })] })?.index).toBe(2);
    expect(
      readConnectedGamepad({
        getGamepads: () => {
          throw new Error('unavailable');
        },
      }),
    ).toBeUndefined();
  });
});
