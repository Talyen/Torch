import { itemDefinition } from '../content/items';
import { journalDefinitionsForScope, journalEntryDefinition } from '../content/journal';
import type {
  JournalEntryDefinition,
  JournalObjectiveDefinition,
  JournalReward,
  JournalTrigger,
} from '../content/journal';
import { abilityActionDefinition } from './ability-rules';
import { findGeneratedResourcePosition } from './world';
import { cloneSerializable } from './state';
import type {
  GameState,
  JournalEntryRuntime,
  JournalEntryStatus,
  ProfileJournalState,
  SimEvent,
  WaypointTarget,
  WorldJournalState,
} from './types';

export const JOURNAL_STATE_SCHEMA_VERSION = 1 as const;

function emptyRuntime(status: JournalEntryStatus, seen = false): JournalEntryRuntime {
  return {
    status,
    progress: {},
    discoveredClueIds: {},
    seen,
  };
}

export function createInitialProfileJournalState(): ProfileJournalState {
  const entries: ProfileJournalState['entries'] = {};
  for (const definition of journalDefinitionsForScope('profile')) {
    entries[definition.id] = emptyRuntime(definition.prerequisites?.length ? 'locked' : 'active');
  }
  return {
    schemaVersion: JOURNAL_STATE_SCHEMA_VERSION,
    entries,
    rewardClaims: {},
    unlocks: {},
    observations: {},
  };
}

export function createInitialWorldJournalState(): WorldJournalState {
  const entries: WorldJournalState['entries'] = {};
  for (const definition of journalDefinitionsForScope('world')) {
    const visible = definition.kind === 'quest' || definition.initiallyDiscovered === true;
    entries[definition.id] = emptyRuntime(visible ? 'active' : 'locked', false);
  }
  return {
    schemaVersion: JOURNAL_STATE_SCHEMA_VERSION,
    entries,
    rewardClaims: {},
  };
}

function objectiveReady(
  definition: JournalEntryDefinition,
  objective: JournalObjectiveDefinition,
  runtime: JournalEntryRuntime,
): boolean {
  return (objective.requires ?? []).every(
    (requiredId) => (runtime.progress[requiredId] ?? 0) >= objectiveTarget(definition, requiredId),
  );
}

function objectiveTarget(definition: JournalEntryDefinition, objectiveId: string): number {
  return definition.objectives.find((objective) => objective.id === objectiveId)?.target ?? 1;
}

function matchesTrigger(event: SimEvent, trigger: JournalTrigger): number {
  switch (trigger.type) {
    case 'hero-moved':
      return event.type === 'hero-moved' ? 1 : 0;
    case 'tiles-revealed':
      return event.type === 'tiles-revealed' ? event.count : 0;
    case 'resource-gathered':
      return event.type === 'resource-gathered' && event.resource === trigger.resource ? event.amount : 0;
    case 'enemy-defeated':
      return event.type === 'enemy-defeated' ? 1 : 0;
    case 'ability-used':
      if (event.type !== 'ability-used') return 0;
      return !trigger.slot || abilityActionDefinition(event.abilityId)?.slot === trigger.slot ? 1 : 0;
    case 'ability-equipped':
      return event.type === 'ability-equipped' ? 1 : 0;
    case 'craft-completed':
      return event.type === 'craft-completed' ? event.batchCount : 0;
    case 'position-reached':
      if (event.type !== 'hero-moved') return 0;
      return event.to.x === trigger.position.x && event.to.y === trigger.position.y ? 1 : 0;
    case 'observation':
      return 0;
  }
}

function allObjectivesComplete(definition: JournalEntryDefinition, runtime: JournalEntryRuntime): boolean {
  return definition.objectives.every((objective) => (runtime.progress[objective.id] ?? 0) >= objective.target);
}

function prerequisitesComplete(
  definition: JournalEntryDefinition,
  entries: Record<string, JournalEntryRuntime>,
): boolean {
  return (definition.prerequisites ?? []).every((entryId) => {
    const status = entries[entryId]?.status;
    return status === 'complete' || status === 'reward-ready' || status === 'claimed';
  });
}

function refreshAvailability(
  entries: Record<string, JournalEntryRuntime>,
  definitions: readonly JournalEntryDefinition[],
): void {
  for (const definition of definitions) {
    const runtime = entries[definition.id];
    if (!runtime || runtime.status !== 'locked') continue;
    if (prerequisitesComplete(definition, entries)) runtime.status = 'active';
  }
}

function advanceEntries(
  entries: Record<string, JournalEntryRuntime>,
  definitions: readonly JournalEntryDefinition[],
  events: readonly SimEvent[],
  emit: (event: SimEvent) => void,
  turn?: number,
): void {
  refreshAvailability(entries, definitions);

  for (const definition of definitions) {
    const runtime = entries[definition.id];
    if (!runtime || runtime.status !== 'active') continue;

    for (const objective of definition.objectives) {
      if (!objectiveReady(definition, objective, runtime)) continue;
      const current = runtime.progress[objective.id] ?? 0;
      if (current >= objective.target) continue;

      const increment = events.reduce((total, event) => total + matchesTrigger(event, objective.trigger), 0);
      if (increment <= 0) continue;
      const next = Math.min(objective.target, current + increment);
      runtime.progress[objective.id] = next;
      runtime.lastUpdatedTurn = turn;
      emit({
        type: 'journal-progressed',
        entryId: definition.id,
        objectiveId: objective.id,
        current: next,
        target: objective.target,
      });

      if (definition.kind === 'mystery' && next >= objective.target) {
        const clue = definition.clues?.find((candidate) => candidate.objectiveId === objective.id);
        if (clue && !runtime.discoveredClueIds[clue.id]) {
          runtime.discoveredClueIds[clue.id] = true;
          runtime.seen = false;
          emit({ type: 'journal-entry-discovered', entryId: definition.id });
        }
      }
    }

    if (allObjectivesComplete(definition, runtime)) {
      runtime.status = 'reward-ready';
      emit({ type: 'journal-entry-completed', entryId: definition.id });
      emit({ type: 'journal-reward-ready', entryId: definition.id });
    }
  }
}

export function advanceWorldJournal(state: GameState, events: SimEvent[]): void {
  const journalEvents: SimEvent[] = [];
  advanceEntries(
    state.journal.entries,
    journalDefinitionsForScope('world'),
    events,
    (event) => journalEvents.push(event),
    state.turn,
  );
  events.push(...journalEvents);
}

export function advanceProfileJournal(state: ProfileJournalState, events: readonly SimEvent[]): ProfileJournalState {
  const next = cloneSerializable(state);
  const definitions = journalDefinitionsForScope('profile');
  advanceEntries(next.entries, definitions, events, () => undefined);
  return next;
}

export function recordProfileObservation(
  state: ProfileJournalState,
  observation: 'open-inventory' | 'open-journal',
): ProfileJournalState {
  const next = cloneSerializable(state);
  next.observations[observation] = true;
  for (const definition of journalDefinitionsForScope('profile')) {
    const runtime = next.entries[definition.id];
    if (!runtime || runtime.status !== 'active') continue;
    for (const objective of definition.objectives) {
      if (objective.trigger.type !== 'observation' || objective.trigger.observation !== observation) continue;
      if (!objectiveReady(definition, objective, runtime)) continue;
      runtime.progress[objective.id] = objective.target;
      runtime.lastUpdatedTurn = undefined;
    }
    if (allObjectivesComplete(definition, runtime)) runtime.status = 'reward-ready';
  }
  return next;
}

export function markJournalEntrySeen(
  state: WorldJournalState | ProfileJournalState,
  entryId: string,
): WorldJournalState | ProfileJournalState {
  const next = cloneSerializable(state);
  const runtime = next.entries[entryId];
  if (runtime) runtime.seen = true;
  return next;
}

function rewardClaimKey(entryId: string): string {
  return `${entryId}:all`;
}

function applyItemReward(state: GameState, reward: JournalReward): boolean {
  if (reward.kind !== 'item') return true;
  if (!itemDefinition(reward.itemId) || !Number.isSafeInteger(reward.quantity) || reward.quantity < 1) return false;
  state.hero.inventory[reward.itemId] = (state.hero.inventory[reward.itemId] ?? 0) + reward.quantity;
  return true;
}

export function claimWorldJournalReward(state: GameState, entryId: string, events: SimEvent[]): boolean {
  const definition = journalEntryDefinition(entryId);
  const runtime = state.journal.entries[entryId];
  if (!definition || definition.scope !== 'world' || !runtime || runtime.status !== 'reward-ready') {
    events.push({ type: 'blocked', reason: 'That Journal reward is not ready.' });
    events.push({ type: 'message', text: 'That Journal reward is not ready.' });
    return false;
  }
  const claimKey = rewardClaimKey(entryId);
  if (state.journal.rewardClaims[claimKey]) {
    events.push({ type: 'blocked', reason: 'That Journal reward was already claimed.' });
    events.push({ type: 'message', text: 'That Journal reward was already claimed.' });
    return false;
  }
  const validRewards = definition.rewards.every(
    (reward) =>
      reward.kind === 'item' &&
      itemDefinition(reward.itemId) &&
      Number.isSafeInteger(reward.quantity) &&
      reward.quantity > 0,
  );
  if (!validRewards) {
    events.push({ type: 'blocked', reason: 'That Journal reward is not available yet.' });
    events.push({ type: 'message', text: 'That Journal reward is not available yet.' });
    return false;
  }

  for (const reward of definition.rewards) applyItemReward(state, reward);

  state.journal.rewardClaims[claimKey] = true;
  runtime.status = 'claimed';
  events.push({ type: 'journal-reward-claimed', entryId });
  events.push({ type: 'message', text: `Reward claimed: ${definition.title}.` });
  return true;
}

export function claimProfileJournalReward(
  state: ProfileJournalState,
  entryId: string,
):
  | { state: ProfileJournalState; accepted: true; unlockIds: string[] }
  | { state: ProfileJournalState; accepted: false; unlockIds: [] } {
  const definition = journalEntryDefinition(entryId);
  const runtime = state.entries[entryId];
  if (!definition || definition.scope !== 'profile' || !runtime || runtime.status !== 'reward-ready') {
    return { state, accepted: false, unlockIds: [] };
  }
  const claimKey = rewardClaimKey(entryId);
  if (state.rewardClaims[claimKey]) return { state, accepted: false, unlockIds: [] };
  const next = cloneSerializable(state);
  next.rewardClaims[claimKey] = true;
  next.entries[entryId].status = 'claimed';
  const unlockIds = definition.rewards.flatMap((reward) => (reward.kind === 'profile-unlock' ? [reward.unlockId] : []));
  for (const unlockId of unlockIds) next.unlocks[unlockId] = true;
  return { state: next, accepted: true, unlockIds };
}

export function waypointTargetForEntry(entryId: string): WaypointTarget | undefined {
  return journalEntryDefinition(entryId)?.location;
}

export function resolveWaypointPosition(
  state: GameState,
  target: WaypointTarget,
): { x: number; y: number } | undefined {
  switch (target.kind) {
    case 'coordinate':
      return { ...target.position };
    case 'location':
      return target.locationId === 'homestead' ? { ...state.homestead } : undefined;
    case 'entity':
      return state.entities[target.entityId]?.position ? { ...state.entities[target.entityId].position } : undefined;
    case 'derived':
      if (target.resolverId === 'first-ore') {
        return findGeneratedResourcePosition(state.seed, state.hero.position, 'ore');
      }
      return undefined;
  }
}

export function resolvedWaypointPosition(state: GameState): { x: number; y: number } | undefined {
  if (!state.journal.waypoint) return undefined;
  return resolveWaypointPosition(state, state.journal.waypoint.target);
}

export function journalEntryDefinitionsForState(
  scope: 'profile' | 'world',
  state: GameState | ProfileJournalState,
): JournalEntryDefinition[] {
  const entries = 'journal' in state ? state.journal.entries : state.entries;
  return journalDefinitionsForScope(scope).filter((definition) => {
    const runtime = entries[definition.id];
    return runtime?.status !== 'locked';
  });
}
