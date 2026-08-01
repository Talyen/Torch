import type { WaypointTarget } from '../sim/types';

export type JournalTrigger =
  | { type: 'hero-moved' }
  | { type: 'tiles-revealed' }
  | { type: 'resource-gathered'; resource: 'wood' | 'ore' }
  | { type: 'enemy-defeated' }
  | { type: 'ability-used'; slot?: 'basic' | 'skill' | 'ultimate' }
  | { type: 'ability-equipped' }
  | { type: 'craft-completed' }
  | { type: 'position-reached'; position: { x: number; y: number } }
  | { type: 'observation'; observation: 'open-inventory' | 'open-journal' };

export type JournalReward =
  { kind: 'item'; itemId: string; quantity: number } | { kind: 'profile-unlock'; unlockId: string };

export interface JournalObjectiveDefinition {
  id: string;
  label: string;
  kind: 'counter' | 'boolean';
  target: number;
  trigger: JournalTrigger;
  requires?: readonly string[];
  hiddenUntil?: string;
}

export interface JournalClueDefinition {
  id: string;
  title: string;
  body: string;
  objectiveId?: string;
}

export interface JournalEntryDefinition {
  id: string;
  kind: 'quest' | 'mystery' | 'milestone';
  scope: 'profile' | 'world';
  title: string;
  summary: string;
  description: string;
  category: string;
  priority: number;
  prerequisites?: readonly string[];
  objectives: readonly JournalObjectiveDefinition[];
  rewards: readonly JournalReward[];
  location?: WaypointTarget;
  initiallyDiscovered?: boolean;
  clues?: readonly JournalClueDefinition[];
}

export const journalEntries: readonly JournalEntryDefinition[] = [
  {
    id: 'guide.first-move',
    kind: 'milestone',
    scope: 'profile',
    title: 'Take the First Step',
    summary: 'Move one tile and begin the expedition.',
    description: 'The Torch reveals more of the world each time you move. Start with one deliberate step.',
    category: 'Exploration',
    priority: 10,
    objectives: [{ id: 'move', label: 'Move one tile', kind: 'counter', target: 1, trigger: { type: 'hero-moved' } }],
    rewards: [{ kind: 'profile-unlock', unlockId: 'guide.movement' }],
  },
  {
    id: 'guide.reveal-terrain',
    kind: 'milestone',
    scope: 'profile',
    title: 'Read the Torchlight',
    summary: 'Reveal new terrain as you explore.',
    description: 'Unexplored ground is only a suggestion. Let the Torch show you what lies beyond the next tile.',
    category: 'Exploration',
    priority: 20,
    prerequisites: ['guide.first-move'],
    objectives: [
      { id: 'tiles', label: 'Reveal 5 new tiles', kind: 'counter', target: 5, trigger: { type: 'tiles-revealed' } },
    ],
    rewards: [{ kind: 'profile-unlock', unlockId: 'guide.visibility' }],
  },
  {
    id: 'guide.open-inventory',
    kind: 'milestone',
    scope: 'profile',
    title: 'Know What You Carry',
    summary: 'Open the Inventory once.',
    description: 'The Inventory keeps your gathered materials and crafted supplies close at hand.',
    category: 'Preparation',
    priority: 30,
    prerequisites: ['guide.first-move'],
    objectives: [
      {
        id: 'open',
        label: 'Open the Inventory',
        kind: 'boolean',
        target: 1,
        trigger: { type: 'observation', observation: 'open-inventory' },
      },
    ],
    rewards: [{ kind: 'profile-unlock', unlockId: 'guide.inventory' }],
  },
  {
    id: 'guide.equip-ability',
    kind: 'milestone',
    scope: 'profile',
    title: 'Prepare an Ability',
    summary: 'Equip an ability into a combat slot.',
    description: 'Every Hero carries a small set of equipped abilities. Choose the one that fits the next danger.',
    category: 'Combat',
    priority: 40,
    prerequisites: ['guide.open-inventory'],
    objectives: [
      {
        id: 'equip',
        label: 'Equip an ability',
        kind: 'boolean',
        target: 1,
        trigger: { type: 'ability-equipped' },
      },
    ],
    rewards: [{ kind: 'profile-unlock', unlockId: 'guide.ability-loadout' }],
  },
  {
    id: 'guide.chop-tree',
    kind: 'milestone',
    scope: 'profile',
    title: 'Chop a Tree',
    summary: 'Gather your first wood from a tree.',
    description: 'Trees are one action away from becoming useful timber. Stand beside one and choose Chop.',
    category: 'Gathering',
    priority: 50,
    prerequisites: ['guide.reveal-terrain'],
    objectives: [
      {
        id: 'guide-wood',
        label: 'Chop Tree',
        kind: 'counter',
        target: 1,
        trigger: { type: 'resource-gathered', resource: 'wood' },
      },
    ],
    rewards: [{ kind: 'profile-unlock', unlockId: 'guide.chopping' }],
  },
  {
    id: 'guide.mine-ore',
    kind: 'milestone',
    scope: 'profile',
    title: 'Mine Ore',
    summary: 'Extract your first ore from the mountain edge.',
    description: 'Ore appears where walkable ground meets the mountains. Stand beside a vein and choose Mine.',
    category: 'Gathering',
    priority: 60,
    prerequisites: ['guide.chop-tree'],
    objectives: [
      {
        id: 'guide-ore',
        label: 'Mine Ore',
        kind: 'counter',
        target: 1,
        trigger: { type: 'resource-gathered', resource: 'ore' },
      },
    ],
    rewards: [{ kind: 'profile-unlock', unlockId: 'guide.mining' }],
  },
  {
    id: 'guide.defeat-enemy',
    kind: 'milestone',
    scope: 'profile',
    title: 'Stand Your Ground',
    summary: 'Defeat an enemy.',
    description:
      'Enemies answer action with action. Use your equipped abilities deliberately and survive the response.',
    category: 'Combat',
    priority: 70,
    prerequisites: ['guide.equip-ability'],
    objectives: [
      {
        id: 'enemy',
        label: 'Defeat an Enemy',
        kind: 'counter',
        target: 1,
        trigger: { type: 'enemy-defeated' },
      },
    ],
    rewards: [{ kind: 'profile-unlock', unlockId: 'guide.combat' }],
  },
  {
    id: 'guide.use-ability',
    kind: 'milestone',
    scope: 'profile',
    title: 'Put Power to Work',
    summary: 'Use an ability in combat.',
    description: 'Skills and Ultimates change the shape of a fight. Spend one and watch its cooldown.',
    category: 'Combat',
    priority: 80,
    prerequisites: ['guide.defeat-enemy'],
    objectives: [
      {
        id: 'ability',
        label: 'Use an Ability',
        kind: 'counter',
        target: 1,
        trigger: { type: 'ability-used' },
      },
    ],
    rewards: [{ kind: 'profile-unlock', unlockId: 'guide.ability-use' }],
  },
  {
    id: 'guide.craft-item',
    kind: 'milestone',
    scope: 'profile',
    title: 'Make Something Useful',
    summary: 'Craft an item at an available station.',
    description: 'Gathered materials become more valuable when shaped into tools, torches, and supplies.',
    category: 'Crafting',
    priority: 90,
    prerequisites: ['guide.mine-ore'],
    objectives: [
      { id: 'craft', label: 'Craft an Item', kind: 'counter', target: 1, trigger: { type: 'craft-completed' } },
    ],
    rewards: [{ kind: 'profile-unlock', unlockId: 'guide.crafting' }],
  },
  {
    id: 'quest.gathering-trail',
    kind: 'quest',
    scope: 'world',
    title: 'A Practical Trail',
    summary: 'Gather the materials needed to light the next stretch of road.',
    description:
      'The old path fades where the forest meets the mountain. Gather wood and ore, then return to the homestead to prepare the next expedition.',
    category: 'Main',
    priority: 10,
    objectives: [
      {
        id: 'quest-wood',
        label: 'Chop a tree',
        kind: 'counter',
        target: 1,
        trigger: { type: 'resource-gathered', resource: 'wood' },
        requires: [],
      },
      {
        id: 'quest-ore',
        label: 'Mine ore',
        kind: 'counter',
        target: 1,
        trigger: { type: 'resource-gathered', resource: 'ore' },
        requires: ['quest-wood'],
      },
      {
        id: 'quest-return',
        label: 'Return to the homestead',
        kind: 'boolean',
        target: 1,
        trigger: { type: 'position-reached', position: { x: 0, y: 0 } },
        requires: ['quest-ore'],
      },
    ],
    rewards: [{ kind: 'item', itemId: 'field-torch', quantity: 1 }],
    location: { kind: 'location', locationId: 'homestead' },
  },
  {
    id: 'mystery.old-light',
    kind: 'mystery',
    scope: 'world',
    title: 'The Old Light',
    summary: 'Something beneath the homestead still remembers the way.',
    description:
      'A pale reflection moves across the stones near the homestead. The Torch shows no flame, yet the light returns whenever you come close.',
    category: 'Mysteries',
    priority: 20,
    initiallyDiscovered: true,
    objectives: [
      {
        id: 'clue-stones',
        label: 'Inspect the homestead stones',
        kind: 'boolean',
        target: 1,
        trigger: { type: 'position-reached', position: { x: 0, y: 0 } },
      },
    ],
    clues: [
      {
        id: 'stone-reflection',
        title: 'A reflection without a flame',
        body: 'The stones catch a pale gleam whenever you return home. It fades before you can touch it.',
        objectiveId: 'clue-stones',
      },
    ],
    rewards: [{ kind: 'item', itemId: 'field-torch', quantity: 1 }],
    location: { kind: 'location', locationId: 'homestead' },
  },
];

export function journalEntryDefinition(entryId: string): JournalEntryDefinition | undefined {
  return journalEntries.find((entry) => entry.id === entryId);
}

export function journalDefinitionsForScope(scope: 'profile' | 'world'): JournalEntryDefinition[] {
  return journalEntries
    .filter((entry) => entry.scope === scope)
    .sort((left, right) => {
      return (
        left.priority - right.priority || left.category.localeCompare(right.category) || left.id.localeCompare(right.id)
      );
    });
}
