import type {
  AbilityEffectKind,
  AbilitySlotId,
  ActionKind,
  ActionRequest,
  Command,
  Direction,
  EnemyDisposition,
  EntityState,
  HeroState,
  Position,
  WaypointTarget,
} from './types';
import type { PrimaryStats } from './stats';
import { equipmentSlots } from '../content/equipment';
import { toolSlots } from '../content/tools';

export class SimulationDataValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SimulationDataValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

const RESERVED_RECORD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ABILITY_SLOTS = new Set<AbilitySlotId>(['basic', 'skill', 'ultimate']);
const LOADOUT_SLOTS = new Set([...equipmentSlots.map((slot) => slot.id), ...toolSlots.map((slot) => slot.id)]);
const ACTION_KINDS = new Set<ActionKind>(['attack', 'chop', 'mine', 'ability']);
const DIRECTIONS = new Set<Direction>(['north', 'south', 'west', 'east']);
const EFFECT_KINDS = new Set<AbilityEffectKind>(['stun', 'halve-block', 'holy-damage-from-block']);
const DISPOSITIONS = new Set<EnemyDisposition>(['neutral', 'hostile']);
const ENTITY_KINDS = new Set<EntityState['kind']>(['homestead', 'tree', 'ore', 'enemy']);

export function fail(path: string, message: string): never {
  throw new SimulationDataValidationError(`${path}: ${message}`);
}

export function recordAt(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(path, 'expected an object');
  }

  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, 'expected a plain object');
  }

  return value as UnknownRecord;
}

export function exactKeys(
  value: UnknownRecord,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'missing required field');
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, 'unknown field');
  }
}

export function safeRecordKey(key: string, path: string): void {
  if (RESERVED_RECORD_KEYS.has(key)) fail(path, 'reserved record key');
}

export function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) return fail(path, 'expected a non-empty string');
  return value;
}

export function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return fail(path, 'expected a boolean');
  return value;
}

function finiteNumberAt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(path, 'expected a finite number');
  return value;
}

export function integerAt(value: unknown, path: string): number {
  const number = finiteNumberAt(value, path);
  if (!Number.isSafeInteger(number)) return fail(path, 'expected a safe integer');
  return number;
}

export function nonNegativeIntegerAt(value: unknown, path: string): number {
  const number = integerAt(value, path);
  if (number < 0) return fail(path, 'expected a non-negative integer');
  return number;
}

export function positiveIntegerAt(value: unknown, path: string): number {
  const number = integerAt(value, path);
  if (number <= 0) return fail(path, 'expected a positive integer');
  return number;
}

function enumAt<T extends string>(value: unknown, options: ReadonlySet<T>, path: string): T {
  if (typeof value !== 'string' || !options.has(value as T)) return fail(path, 'unexpected value');
  return value as T;
}

function positionAt(value: unknown, path: string): Position {
  const record = recordAt(value, path);
  exactKeys(record, ['x', 'y'], [], path);
  return {
    x: integerAt(record.x, `${path}.x`),
    y: integerAt(record.y, `${path}.y`),
  };
}

function primaryStatsAt(value: unknown, path: string): PrimaryStats {
  const record = recordAt(value, path);
  const keys = ['strength', 'agility', 'toughness', 'wisdom', 'intellect'] as const;
  exactKeys(record, keys, [], path);
  return {
    strength: nonNegativeIntegerAt(record.strength, `${path}.strength`),
    agility: nonNegativeIntegerAt(record.agility, `${path}.agility`),
    toughness: nonNegativeIntegerAt(record.toughness, `${path}.toughness`),
    wisdom: nonNegativeIntegerAt(record.wisdom, `${path}.wisdom`),
    intellect: nonNegativeIntegerAt(record.intellect, `${path}.intellect`),
  };
}

function numberRecordAt(value: unknown, path: string): Record<string, number> {
  const record = recordAt(value, path);
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(record)) {
    safeRecordKey(key, `${path}.${key}`);
    result[key] = nonNegativeIntegerAt(entry, `${path}.${key}`);
  }
  return result;
}

function loadoutAt(value: unknown, path: string, allowedSlots: readonly string[]): Record<string, string> {
  const record = recordAt(value, path);
  const allowed = new Set(allowedSlots);
  const result: Record<string, string> = {};
  for (const [slot, itemId] of Object.entries(record)) {
    safeRecordKey(slot, `${path}.${slot}`);
    if (!allowed.has(slot)) fail(`${path}.${slot}`, 'unexpected loadout slot');
    result[slot] = stringAt(itemId, `${path}.${slot}`);
  }
  return result;
}

function abilityEffectAt(value: unknown, path: string): HeroState['activeAbilityEffects'][number] {
  const record = recordAt(value, path);
  exactKeys(record, ['id', 'abilityId', 'kind', 'amount', 'remainingActions'], [], path);
  return {
    id: stringAt(record.id, `${path}.id`),
    abilityId: stringAt(record.abilityId, `${path}.abilityId`),
    kind: enumAt(record.kind, EFFECT_KINDS, `${path}.kind`),
    amount: finiteNumberAt(record.amount, `${path}.amount`),
    remainingActions: nonNegativeIntegerAt(record.remainingActions, `${path}.remainingActions`),
  };
}

export function heroStateAt(value: unknown, path: string): HeroState {
  const record = recordAt(value, path);
  exactKeys(
    record,
    [
      'heroId',
      'position',
      'boundPosition',
      'health',
      'maxHealth',
      'deaths',
      'inventory',
      'primaryStats',
      'equippedAbilities',
      'equippedItems',
      'equippedTools',
      'abilityCooldowns',
      'activeAbilityEffects',
    ],
    ['block'],
    path,
  );

  const equipped = recordAt(record.equippedAbilities, `${path}.equippedAbilities`);
  exactKeys(equipped, ['basic', 'skill', 'ultimate'], [], `${path}.equippedAbilities`);
  const equippedItems = loadoutAt(
    record.equippedItems,
    `${path}.equippedItems`,
    equipmentSlots.map((slot) => slot.id),
  );
  const equippedTools = loadoutAt(
    record.equippedTools,
    `${path}.equippedTools`,
    toolSlots.map((slot) => slot.id),
  );
  const effects = record.activeAbilityEffects;
  if (!Array.isArray(effects)) fail(`${path}.activeAbilityEffects`, 'expected an array');
  const health = finiteNumberAt(record.health, `${path}.health`);
  const maxHealth = finiteNumberAt(record.maxHealth, `${path}.maxHealth`);
  if (maxHealth <= 0) fail(`${path}.maxHealth`, 'expected a positive number');
  if (health < 0) fail(`${path}.health`, 'expected a non-negative number');
  if (health > maxHealth) fail(`${path}.health`, 'must not exceed maxHealth');

  return {
    heroId: stringAt(record.heroId, `${path}.heroId`),
    position: positionAt(record.position, `${path}.position`),
    boundPosition: positionAt(record.boundPosition, `${path}.boundPosition`),
    health,
    maxHealth,
    deaths: nonNegativeIntegerAt(record.deaths, `${path}.deaths`),
    inventory: numberRecordAt(record.inventory, `${path}.inventory`),
    ...(Object.hasOwn(record, 'block') ? { block: finiteNumberAt(record.block, `${path}.block`) } : {}),
    primaryStats: primaryStatsAt(record.primaryStats, `${path}.primaryStats`),
    equippedAbilities: {
      basic: stringAt(equipped.basic, `${path}.equippedAbilities.basic`),
      skill: stringAt(equipped.skill, `${path}.equippedAbilities.skill`),
      ultimate: stringAt(equipped.ultimate, `${path}.equippedAbilities.ultimate`),
    },
    equippedItems,
    equippedTools,
    abilityCooldowns: numberRecordAt(record.abilityCooldowns, `${path}.abilityCooldowns`),
    activeAbilityEffects: effects.map((effect, index) =>
      abilityEffectAt(effect, `${path}.activeAbilityEffects[${index}]`),
    ),
  };
}

export function entityStateAt(value: unknown, path: string): EntityState {
  const record = recordAt(value, path);
  exactKeys(
    record,
    ['id', 'kind', 'name', 'position', 'blocksMovement'],
    [
      'health',
      'maxHealth',
      'resourceType',
      'block',
      'stunnedActions',
      'gatheringActionCost',
      'remainingGatheringActions',
      'attack',
      'assetId',
      'disposition',
      'alerted',
      'actions',
      'primaryStats',
      'footprint',
    ],
    path,
  );

  const entity: EntityState = {
    id: stringAt(record.id, `${path}.id`),
    kind: enumAt(record.kind, ENTITY_KINDS, `${path}.kind`),
    name: stringAt(record.name, `${path}.name`),
    position: positionAt(record.position, `${path}.position`),
    blocksMovement: booleanAt(record.blocksMovement, `${path}.blocksMovement`),
  };

  const optionalNumbers = [
    'health',
    'maxHealth',
    'block',
    'stunnedActions',
    'gatheringActionCost',
    'remainingGatheringActions',
    'attack',
  ] as const;
  for (const key of optionalNumbers) {
    if (Object.hasOwn(record, key)) entity[key] = finiteNumberAt(record[key], `${path}.${key}`);
  }
  if (Object.hasOwn(record, 'resourceType')) {
    entity.resourceType = enumAt(record.resourceType, new Set<'wood' | 'ore'>(['wood', 'ore']), `${path}.resourceType`);
  }
  if (Object.hasOwn(record, 'assetId')) entity.assetId = stringAt(record.assetId, `${path}.assetId`);
  if (Object.hasOwn(record, 'disposition')) {
    entity.disposition = enumAt(record.disposition, DISPOSITIONS, `${path}.disposition`);
  }
  if (Object.hasOwn(record, 'alerted')) entity.alerted = booleanAt(record.alerted, `${path}.alerted`);
  if (Object.hasOwn(record, 'actions')) {
    if (!Array.isArray(record.actions)) fail(`${path}.actions`, 'expected an array');
    entity.actions = record.actions.map((action, index) => enumAt(action, ACTION_KINDS, `${path}.actions[${index}]`));
  }
  if (Object.hasOwn(record, 'primaryStats')) {
    entity.primaryStats = primaryStatsAt(record.primaryStats, `${path}.primaryStats`);
  }
  if (Object.hasOwn(record, 'footprint')) {
    const footprint = recordAt(record.footprint, `${path}.footprint`);
    exactKeys(footprint, ['width', 'height'], [], `${path}.footprint`);
    entity.footprint = {
      width: positiveIntegerAt(footprint.width, `${path}.footprint.width`),
      height: positiveIntegerAt(footprint.height, `${path}.footprint.height`),
    };
  }

  return entity;
}

export function commandAt(value: unknown, path: string): Command {
  const record = recordAt(value, path);
  const type = stringAt(record.type, `${path}.type`);

  switch (type) {
    case 'move':
      exactKeys(record, ['type', 'direction'], [], path);
      return { type, direction: enumAt(record.direction, DIRECTIONS, `${path}.direction`) };
    case 'interact':
      exactKeys(record, ['type', 'target'], [], path);
      return { type, target: positionAt(record.target, `${path}.target`) };
    case 'action': {
      exactKeys(record, ['type', 'action'], [], path);
      const actionRecord = recordAt(record.action, `${path}.action`);
      exactKeys(actionRecord, ['kind', 'entityId', 'target'], ['abilityId'], `${path}.action`);
      const action: ActionRequest = {
        kind: enumAt(actionRecord.kind, ACTION_KINDS, `${path}.action.kind`),
        entityId: stringAt(actionRecord.entityId, `${path}.action.entityId`),
        target: positionAt(actionRecord.target, `${path}.action.target`),
      };
      if (Object.hasOwn(actionRecord, 'abilityId')) {
        action.abilityId = stringAt(actionRecord.abilityId, `${path}.action.abilityId`);
      }
      return { type, action };
    }
    case 'equip-ability':
      exactKeys(record, ['type', 'slot', 'abilityId'], [], path);
      return {
        type,
        slot: enumAt(record.slot, ABILITY_SLOTS, `${path}.slot`),
        abilityId: stringAt(record.abilityId, `${path}.abilityId`),
      };
    case 'equip-item':
      exactKeys(record, ['type', 'slot', 'itemId'], [], path);
      return {
        type,
        slot: enumAt(record.slot, LOADOUT_SLOTS, `${path}.slot`),
        itemId: stringAt(record.itemId, `${path}.itemId`),
      };
    case 'unequip-item':
      exactKeys(record, ['type', 'slot'], [], path);
      return {
        type,
        slot: enumAt(record.slot, LOADOUT_SLOTS, `${path}.slot`),
      };
    case 'craft':
      exactKeys(record, ['type', 'recipeId', 'quantity'], [], path);
      return {
        type,
        recipeId: stringAt(record.recipeId, `${path}.recipeId`),
        quantity: positiveIntegerAt(record.quantity, `${path}.quantity`),
      };
    case 'set-journal-focus':
      exactKeys(record, ['type'], ['entryId'], path);
      return Object.hasOwn(record, 'entryId')
        ? { type, entryId: stringAt(record.entryId, `${path}.entryId`) }
        : { type };
    case 'set-waypoint':
      exactKeys(record, ['type', 'entryId', 'target'], [], path);
      return {
        type,
        entryId: stringAt(record.entryId, `${path}.entryId`),
        target: waypointTargetAt(record.target, `${path}.target`),
      };
    case 'clear-waypoint':
      exactKeys(record, ['type'], [], path);
      return { type };
    case 'claim-journal-reward':
      exactKeys(record, ['type', 'entryId'], [], path);
      return { type, entryId: stringAt(record.entryId, `${path}.entryId`) };
    case 'wait':
      exactKeys(record, ['type'], [], path);
      return { type };
    default:
      return fail(`${path}.type`, 'unsupported command');
  }
}

function waypointTargetAt(value: unknown, path: string): WaypointTarget {
  const record = recordAt(value, path);
  const kind = stringAt(record.kind, `${path}.kind`);
  if (kind === 'coordinate') {
    exactKeys(record, ['kind', 'position'], [], path);
    return { kind, position: positionAt(record.position, `${path}.position`) };
  }
  if (kind === 'location') {
    exactKeys(record, ['kind', 'locationId'], [], path);
    return { kind, locationId: stringAt(record.locationId, `${path}.locationId`) };
  }
  if (kind === 'entity') {
    exactKeys(record, ['kind', 'entityId'], [], path);
    return { kind, entityId: stringAt(record.entityId, `${path}.entityId`) };
  }
  if (kind === 'derived') {
    exactKeys(record, ['kind', 'resolverId', 'parameters'], [], path);
    const parameters = recordAt(record.parameters, `${path}.parameters`);
    const parsed: Record<string, string> = {};
    for (const [key, entry] of Object.entries(parameters)) {
      safeRecordKey(key, `${path}.parameters.${key}`);
      parsed[key] = stringAt(entry, `${path}.parameters.${key}`);
    }
    return { kind, resolverId: stringAt(record.resolverId, `${path}.resolverId`), parameters: parsed };
  }
  return fail(`${path}.kind`, 'unexpected value');
}
