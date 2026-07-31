import type { PrimaryStats } from './stats';

export type Direction = 'north' | 'south' | 'west' | 'east';

export interface Position {
  x: number;
  y: number;
}

export type TileKind = 'grass' | 'forest-floor' | 'stone-floor' | 'water';

export type EntityKind = 'homestead' | 'tree' | 'ore' | 'enemy';
export type EnemyDisposition = 'neutral' | 'hostile';

export type ActionKind = 'attack' | 'chop' | 'mine';

export interface ActionRequest {
  kind: ActionKind;
  entityId: string;
  target: Position;
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
  primaryStats: PrimaryStats;
}

export interface GameState {
  seed: number;
  generationVersion: number;
  turn: number;
  hero: HeroState;
  homestead: Position;
  entities: Record<string, EntityState>;
  revealedTiles: Record<string, true>;
}

export type Command =
  | { type: 'move'; direction: Direction }
  | { type: 'interact'; target: Position }
  | { type: 'action'; action: ActionRequest }
  | { type: 'wait' };

export type SimEvent =
  | { type: 'message'; text: string }
  | { type: 'hero-moved'; from: Position; to: Position }
  | { type: 'enemy-moved'; entityId: string; from: Position; to: Position }
  | { type: 'action-resolved'; action: ActionKind; entityId: string }
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
