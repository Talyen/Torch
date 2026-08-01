export type ToolAction = 'chop' | 'mine' | 'hammer' | 'shovel';

export interface ToolDefinition {
  id: string;
  name: string;
  action: ToolAction;
  icon: 'axe' | 'pickaxe' | 'hammer' | 'shovel';
}

export const toolSlots = [
  { id: 'axe', label: 'Axe', action: 'chop' },
  { id: 'pickaxe', label: 'Pickaxe', action: 'mine' },
  { id: 'hammer', label: 'Hammer', action: 'hammer' },
  { id: 'shovel', label: 'Shovel', action: 'shovel' },
] as const satisfies ReadonlyArray<{ id: string; label: string; action: ToolAction }>;

export type ToolSlotId = (typeof toolSlots)[number]['id'];

// Tool definitions provide the presentation metadata for canonical equipment
// IDs. Durability and tool-specific gathering modifiers remain future work.
export const tools: ToolDefinition[] = [
  { id: 'iron-axe', name: 'Iron Axe', action: 'chop', icon: 'axe' },
  { id: 'stone-pickaxe', name: 'Stone Pickaxe', action: 'mine', icon: 'pickaxe' },
  { id: 'iron-hammer', name: 'Iron Hammer', action: 'hammer', icon: 'hammer' },
  { id: 'field-shovel', name: 'Field Shovel', action: 'shovel', icon: 'shovel' },
];
