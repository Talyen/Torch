import type { PrimaryStats } from './stats';
import type { EquipmentSlotId } from '../content/equipment';
import type { ToolSlotId } from '../content/tools';

export type Direction = 'north' | 'south' | 'west' | 'east';

export interface Position {
  x: number;
  y: number;
}

export type TileKind = 'grass' | 'mountain';

export type EntityKind = 'homestead' | 'tree' | 'ore' | 'enemy';
export type EnemyDisposition = 'neutral' | 'hostile';

export type AbilitySlotId = 'basic' | 'skill' | 'ultimate';
export type ActionKind = 'attack' | 'chop' | 'mine' | 'ability';
export type CraftBlockedReason =
  'unknown-recipe' | 'locked' | 'requires-station' | 'missing-ingredients' | 'invalid-quantity';

export type LoadoutSlotId = EquipmentSlotId | ToolSlotId;

export type JournalEntryKind = 'quest' | 'mystery' | 'milestone';
export type JournalScope = 'profile' | 'world';
export type JournalEntryStatus =
  'locked' | 'active' | 'complete' | 'reward-ready' | 'claimed' | 'failed' | 'expired' | 'abandoned';

export type WaypointTarget =
  | { kind: 'coordinate'; position: Position }
  | { kind: 'location'; locationId: string }
  | { kind: 'entity'; entityId: string }
  | { kind: 'derived'; resolverId: string; parameters: Record<string, string> };

export type WaypointStatus = 'active' | 'unresolved' | 'removed';

export interface JournalWaypoint {
  entryId: string;
  target: WaypointTarget;
  status: WaypointStatus;
}

export interface JournalEntryRuntime {
  status: JournalEntryStatus;
  progress: Record<string, number>;
  discoveredClueIds: Record<string, true>;
  seen: boolean;
  lastUpdatedTurn?: number;
}

export interface WorldJournalState {
  schemaVersion: 1;
  entries: Record<string, JournalEntryRuntime>;
  rewardClaims: Record<string, true>;
  focusedEntryId?: string;
  waypoint?: JournalWaypoint;
}

export interface ProfileJournalState {
  schemaVersion: 1;
  entries: Record<string, JournalEntryRuntime>;
  rewardClaims: Record<string, true>;
  unlocks: Record<string, true>;
  observations: Record<string, true>;
}

export type AbilityEffectKind = 'stun' | 'halve-block' | 'holy-damage-from-block';

export interface ActiveAbilityEffect {
  id: string;
  abilityId: string;
  kind: AbilityEffectKind;
  amount: number;
  remainingActions: number;
}

export interface ActionRequest {
  kind: ActionKind;
  entityId: string;
  target: Position;
  abilityId?: string;
}

export interface CraftingCommand {
  type: 'craft';
  recipeId: string;
  quantity: number;
}

export type LoadoutCommand =
  { type: 'equip-item'; slot: LoadoutSlotId; itemId: string } | { type: 'unequip-item'; slot: LoadoutSlotId };

export interface EntityState {
  id: string;
  kind: EntityKind;
  name: string;
  position: Position;
  blocksMovement: boolean;
  health?: number;
  maxHealth?: number;
  resourceType?: 'wood' | 'ore';
  /** Current Block pool used by defensive ability effects. */
  block?: number;
  /** A stunned enemy skips its next response action. */
  stunnedActions?: number;
  /** Number of one-action gathering steps this entity requires. */
  gatheringActionCost?: number;
  /** Remaining gathering steps for this world-local entity. */
  remainingGatheringActions?: number;
  attack?: number;
  assetId?: string;
  disposition?: EnemyDisposition;
  alerted?: boolean;
  actions?: ActionKind[];
  primaryStats?: PrimaryStats;
  footprint?: Footprint;
}

export interface Footprint {
  width: number;
  height: number;
}

export interface HeroState {
  heroId: string;
  position: Position;
  boundPosition: Position;
  health: number;
  maxHealth: number;
  deaths: number;
  inventory: Record<string, number>;
  /** Current Block pool used by Avatar's Knight effect. */
  block?: number;
  primaryStats: PrimaryStats;
  equippedAbilities: Record<AbilitySlotId, string>;
  /** Canonical stable-ID equipment loadout; inventory remains the ownership source. */
  equippedItems: Partial<Record<EquipmentSlotId, string>>;
  /** Canonical stable-ID tool loadout; tool items are also inventory entries. */
  equippedTools: Partial<Record<ToolSlotId, string>>;
  abilityCooldowns: Record<string, number>;
  activeAbilityEffects: ActiveAbilityEffect[];
}

export interface GameState {
  /** Stable world-slot identity used by the versioned WorldSave projection. */
  worldId: string;
  seed: number;
  generationVersion: number;
  turn: number;
  hero: HeroState;
  homestead: Position;
  /** Stations unlocked by the current world. The starter homestead has a workbench. */
  unlockedStations: Record<string, true>;
  entities: Record<string, EntityState>;
  removedGeneratedEntities: Record<string, true>;
  /** Partial work on generated gatherables survives active-ring pruning. */
  gatheringProgress: Record<string, number>;
  /** World-local discovery flags; profile/meta progression is intentionally separate. */
  discoveries: Record<string, true>;
  revealedTiles: Record<string, true>;
  journal: WorldJournalState;
}

export type CombatantKind = 'hero' | 'enemy';

/** Stable, presentation-neutral facts about one side of an attack. */
export interface CombatantSnapshot {
  id: string;
  kind: CombatantKind;
  name: string;
  position: Position;
}

/** One resolved attack. The simulation commits this synchronously; clients
 * decide when to show its visual impact. */
export interface AttackResolvedEvent {
  type: 'attack-resolved';
  attackId: string;
  action: ActionKind;
  abilityId?: string;
  attacker: CombatantSnapshot;
  target: CombatantSnapshot;
  amount: number;
  targetDefeated: boolean;
}

export type Command =
  | { type: 'move'; direction: Direction }
  | { type: 'interact'; target: Position }
  | { type: 'action'; action: ActionRequest }
  | { type: 'equip-ability'; slot: AbilitySlotId; abilityId: string }
  | LoadoutCommand
  | CraftingCommand
  | { type: 'set-journal-focus'; entryId?: string }
  | { type: 'set-waypoint'; entryId: string; target: WaypointTarget }
  | { type: 'clear-waypoint' }
  | { type: 'claim-journal-reward'; entryId: string }
  | { type: 'wait' };

export type SimEvent =
  | { type: 'message'; text: string }
  | { type: 'hero-moved'; from: Position; to: Position }
  | { type: 'enemy-moved'; entityId: string; from: Position; to: Position }
  | {
      type: 'action-resolved';
      action: ActionKind;
      entityId: string;
      entityName: string;
      target: Position;
      abilityId?: string;
    }
  | {
      type: 'ability-used';
      abilityId: string;
      entityId: string;
      entityName: string;
      target: Position;
      amount: number;
    }
  | AttackResolvedEvent
  | { type: 'ability-equipped'; slot: AbilitySlotId; abilityId: string }
  | { type: 'item-equipped'; slot: LoadoutSlotId; itemId: string }
  | { type: 'item-unequipped'; slot: LoadoutSlotId; itemId: string }
  | {
      type: 'craft-completed';
      recipeId: string;
      batchCount: number;
      outputItemId: string;
      outputQuantity: number;
    }
  | {
      type: 'craft-blocked';
      recipeId: string;
      reason: CraftBlockedReason;
      missingItems?: Array<{ itemId: string; quantity: number }>;
    }
  | { type: 'tiles-revealed'; count: number }
  | { type: 'enemy-damaged'; entityId: string; amount: number }
  | { type: 'enemy-defeated'; entityId: string }
  | {
      type: 'resource-gathered';
      resource: 'wood' | 'ore';
      amount: number;
      /** Snapshot used by presentation layers to anchor feedback. */
      collectorPosition?: Position;
    }
  | { type: 'hero-damaged'; amount: number; source: string }
  | { type: 'hero-respawned'; position: Position }
  | { type: 'journal-progressed'; entryId: string; objectiveId: string; current: number; target: number }
  | { type: 'journal-entry-discovered'; entryId: string }
  | { type: 'journal-entry-completed'; entryId: string }
  | { type: 'journal-reward-ready'; entryId: string }
  | { type: 'journal-reward-claimed'; entryId: string }
  | { type: 'waypoint-changed'; entryId?: string; status: WaypointStatus }
  | { type: 'blocked'; reason: string }
  | { type: 'turn-advanced'; turn: number };

export interface CommandResult {
  state: GameState;
  events: SimEvent[];
  accepted: boolean;
}
