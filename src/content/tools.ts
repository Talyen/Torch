export type ToolAction = 'chop' | 'mine';

export interface ToolDefinition {
  id: string;
  name: string;
  action: ToolAction;
  icon: 'axe' | 'pickaxe';
}

export const toolSlots = [
  { id: 'axe', label: 'Axe', action: 'chop' },
  { id: 'pickaxe', label: 'Pickaxe', action: 'mine' },
] as const satisfies ReadonlyArray<{ id: string; label: string; action: ToolAction }>;

export type ToolSlotId = (typeof toolSlots)[number]['id'];

// These fixtures establish the loadout contract before tool durability and
// tool-specific gathering modifiers become simulation-backed inventory data.
export const tools: ToolDefinition[] = [
  { id: 'iron-axe', name: 'Iron Axe', action: 'chop', icon: 'axe' },
  { id: 'stone-pickaxe', name: 'Stone Pickaxe', action: 'mine', icon: 'pickaxe' },
];
