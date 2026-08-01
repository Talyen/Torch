import type { PrimaryStats } from './stats';

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
  entities: Record<string, EntityState>;
  removedGeneratedEntities: Record<string, true>;
  /** Partial work on generated gatherables survives active-ring pruning. */
  gatheringProgress: Record<string, number>;
  /** World-local discovery flags; profile/meta progression is intentionally separate. */
  discoveries: Record<string, true>;
  revealedTiles: Record<string, true>;
}

export type Command =
  | { type: 'move'; direction: Direction }
  | { type: 'interact'; target: Position }
  | { type: 'action'; action: ActionRequest }
  | { type: 'equip-ability'; slot: AbilitySlotId; abilityId: string }
  | { type: 'wait' };

export type SimEvent =
  | { type: 'message'; text: string }
  | { type: 'hero-moved'; from: Position; to: Position }
  | { type: 'enemy-moved'; entityId: string; from: Position; to: Position }
  | { type: 'action-resolved'; action: ActionKind; entityId: string; target: Position; abilityId?: string }
  | { type: 'ability-used'; abilityId: string; entityId: string; target: Position; amount: number }
  | { type: 'ability-equipped'; slot: AbilitySlotId; abilityId: string }
  | { type: 'enemy-damaged'; entityId: string; amount: number }
  | { type: 'enemy-defeated'; entityId: string }
  | { type: 'resource-gathered'; resource: 'wood' | 'ore'; amount: number }
  | { type: 'hero-damaged'; amount: number; source: string }
  | { type: 'hero-respawned'; position: Position }
  | { type: 'blocked'; reason: string }
  | { type: 'turn-advanced'; turn: number };

export interface CommandResult {
  state: GameState;
  events: SimEvent[];
  accepted: boolean;
}
