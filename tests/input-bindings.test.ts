import { describe, expect, it } from 'vitest';
import {
  defaultKeyBindings,
  directionForKey,
  keyMatchesBinding,
  normalizeBindingKey,
  updateKeyBinding,
} from '../src/game/input-bindings';

describe('keyboard bindings', () => {
  it('normalizes browser key names while preserving arrow bindings', () => {
    expect(normalizeBindingKey('W')).toBe('w');
    expect(normalizeBindingKey(' ')).toBe('Space');
    expect(normalizeBindingKey('ArrowUp')).toBe('ArrowUp');
  });

  it('matches both WASD and arrow defaults', () => {
    const bindings = defaultKeyBindings();
    expect(keyMatchesBinding(bindings, 'move-north', 'w')).toBe(true);
    expect(keyMatchesBinding(bindings, 'move-north', 'ArrowUp')).toBe(true);
    expect(keyMatchesBinding(bindings, 'map', 'm')).toBe(true);
  });

  it('resolves movement from the active bindings', () => {
    const bindings = defaultKeyBindings();
    bindings['move-north'] = ['i'];

    expect(directionForKey(bindings, 'i')).toBe('north');
    expect(directionForKey(bindings, 'w')).toBeUndefined();
    expect(directionForKey(bindings, 'ArrowDown')).toBe('south');
  });

  it('updates one key slot without leaving duplicate assignments', () => {
    const bindings = defaultKeyBindings();
    const next = updateKeyBinding(bindings, 'map', 0, 'x');
    expect(next.map).toEqual(['x']);
    expect(next['move-north']).toEqual(['w', 'ArrowUp']);
    expect(keyMatchesBinding(next, 'map', 'x')).toBe(true);
  });

  it('swaps a conflicting key so both actions remain usable', () => {
    const bindings = defaultKeyBindings();
    const next = updateKeyBinding(bindings, 'move-north', 0, 'm');
    expect(next['move-north']).toEqual(['m', 'ArrowUp']);
    expect(next.map).toEqual(['w']);
  });
});
