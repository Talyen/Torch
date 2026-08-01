import type { Direction } from '../sim';

/**
 * Client-side keyboard binding preferences. Simulation commands remain typed
 * and deterministic; this module only translates physical keyboard input into
 * those commands at the platform boundary.
 */
export const KEY_BINDINGS_EVENT = 'torch:key-bindings-changed';
export const OPEN_MAP_EVENT = 'torch:open-map';
export const OPEN_JOURNAL_EVENT = 'torch:open-journal';
const KEY_BINDINGS_STORAGE_KEY = 'torch.key-bindings';

export type KeyBindingAction =
  'move-north' | 'move-south' | 'move-west' | 'move-east' | 'wait' | 'gather' | 'map' | 'journal';

/** Shared client intent emitted by keyboard and controller adapters. */
export type InputAction = KeyBindingAction;

const DIRECTION_BINDINGS: readonly (readonly [Direction, KeyBindingAction])[] = [
  ['north', 'move-north'],
  ['south', 'move-south'],
  ['west', 'move-west'],
  ['east', 'move-east'],
];

export interface KeyBindingDefinition {
  id: KeyBindingAction;
  label: string;
  description: string;
  defaultKeys: readonly string[];
}

export const keyBindingDefinitions: readonly KeyBindingDefinition[] = [
  { id: 'move-north', label: 'Move North', description: 'Move up one tile.', defaultKeys: ['w', 'ArrowUp'] },
  { id: 'move-south', label: 'Move South', description: 'Move down one tile.', defaultKeys: ['s', 'ArrowDown'] },
  { id: 'move-west', label: 'Move West', description: 'Move left one tile.', defaultKeys: ['a', 'ArrowLeft'] },
  { id: 'move-east', label: 'Move East', description: 'Move right one tile.', defaultKeys: ['d', 'ArrowRight'] },
  { id: 'wait', label: 'Wait', description: 'Spend an action listening to the dark.', defaultKeys: ['Space'] },
  { id: 'gather', label: 'Gather', description: 'Gather the nearest adjacent resource.', defaultKeys: ['g'] },
  { id: 'map', label: 'Open Map', description: 'Open the world map.', defaultKeys: ['m'] },
  {
    id: 'journal',
    label: 'Open Journal',
    description: 'Review quests, mysteries, and milestones.',
    defaultKeys: ['j'],
  },
];

export type KeyBindings = Record<KeyBindingAction, string[]>;

export const defaultKeyBindings = (): KeyBindings =>
  Object.fromEntries(
    keyBindingDefinitions.map((definition) => [definition.id, [...definition.defaultKeys]]),
  ) as KeyBindings;

export function normalizeBindingKey(key: string): string {
  if (key === ' ' || key === 'Spacebar' || key === 'Space') return 'Space';
  if (key.length === 1) return key.toLowerCase();
  return key;
}

export function formatBindingKey(key: string): string {
  if (key === 'Space') return 'Space';
  const arrows: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
  };
  return arrows[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

export function readKeyBindings(): KeyBindings {
  const fallback = defaultKeyBindings();
  if (typeof window === 'undefined') return fallback;

  try {
    const stored = window.localStorage.getItem(KEY_BINDINGS_STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<Record<KeyBindingAction, unknown>>;
    for (const definition of keyBindingDefinitions) {
      const keys = parsed[definition.id];
      if (Array.isArray(keys)) {
        const normalized = keys
          .filter((key): key is string => typeof key === 'string' && key.length > 0)
          .map(normalizeBindingKey);
        if (normalized.length > 0) fallback[definition.id] = normalized;
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function setKeyBindings(bindings: KeyBindings): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Embedded/private browser contexts may not expose local storage.
  }
  window.dispatchEvent(new CustomEvent(KEY_BINDINGS_EVENT, { detail: bindings }));
}

export function updateKeyBinding(
  bindings: KeyBindings,
  action: KeyBindingAction,
  slot: number,
  key: string,
): KeyBindings {
  const next = Object.fromEntries(Object.entries(bindings).map(([id, keys]) => [id, [...keys]])) as KeyBindings;
  const normalized = normalizeBindingKey(key);
  const current = next[action] ?? [];
  const replacementIndex = Math.max(0, Math.min(slot, current.length - 1));
  const displacedKey = current[replacementIndex];
  next[action] =
    current.length === 0
      ? [normalized]
      : current.map((candidate, index) => (index === replacementIndex ? normalized : candidate));
  for (const [id, keys] of Object.entries(next) as Array<[KeyBindingAction, string[]]>) {
    if (id === action) {
      next[id] = keys.filter((candidate, index) => candidate !== normalized || index === replacementIndex);
    } else {
      next[id] = displacedKey
        ? keys.map((candidate) => (candidate === normalized ? displacedKey : candidate))
        : keys.filter((candidate) => candidate !== normalized);
    }
  }
  return next;
}

export function keyMatchesBinding(bindings: KeyBindings, action: KeyBindingAction, key: string): boolean {
  return (bindings[action] ?? []).includes(normalizeBindingKey(key));
}

/** Converts a physical key into a movement command using the active bindings. */
export function directionForKey(bindings: KeyBindings, key: string): Direction | undefined {
  return DIRECTION_BINDINGS.find(([, action]) => keyMatchesBinding(bindings, action, key))?.[0];
}

export function directionForInputAction(action: InputAction): Direction | undefined {
  return DIRECTION_BINDINGS.find(([, bindingAction]) => bindingAction === action)?.[0];
}
