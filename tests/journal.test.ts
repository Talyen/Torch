import { describe, expect, it } from 'vitest';
import {
  advanceProfileJournal,
  advanceWorldJournal,
  applyCommand,
  claimWorldJournalReward,
  createInitialGameState,
  createInitialProfileJournalState,
  createProfileSave,
  decodeProfileSave,
  encodeProfileSave,
  createWorldSave,
  markJournalEntrySeen,
  restoreWorldSave,
} from '../src/sim';

describe('Journal progression', () => {
  it('records onboarding milestones at the command boundary', () => {
    const state = createInitialGameState(1234);
    const profile = createInitialProfileJournalState();
    const result = applyCommand(state, { type: 'move', direction: 'east' });
    const nextProfile = advanceProfileJournal(profile, result.events);

    expect(result.events).toContainEqual({ type: 'hero-moved', from: { x: 0, y: 2 }, to: { x: 1, y: 2 } });
    expect(nextProfile.entries['guide.first-move'].status).toBe('reward-ready');
    expect(nextProfile.entries['guide.first-move'].progress.move).toBe(1);
  });

  it('gates multi-step quests, then claims an item reward exactly once', () => {
    const state = createInitialGameState(1234);
    const quest = state.journal.entries['quest.gathering-trail'];

    advanceWorldJournal(state, [{ type: 'resource-gathered', resource: 'wood', amount: 1 }]);
    expect(quest.progress['quest-wood']).toBe(1);
    expect(quest.progress['quest-ore']).toBeUndefined();

    advanceWorldJournal(state, [{ type: 'resource-gathered', resource: 'ore', amount: 1 }]);
    advanceWorldJournal(state, [{ type: 'hero-moved', from: { x: 0, y: 1 }, to: { x: 0, y: 0 } }]);
    expect(quest.status).toBe('reward-ready');

    const events: Parameters<typeof claimWorldJournalReward>[2] = [];
    expect(claimWorldJournalReward(state, 'quest.gathering-trail', events)).toBe(true);
    expect(state.hero.inventory['field-torch']).toBe(1);
    expect(state.journal.entries['quest.gathering-trail'].status).toBe('claimed');
    expect(claimWorldJournalReward(state, 'quest.gathering-trail', events)).toBe(false);
    expect(state.hero.inventory['field-torch']).toBe(1);
  });

  it('persists Journal state and waypoint fields through the world save projection', () => {
    const state = createInitialGameState(1234);
    const waypointResult = applyCommand(state, {
      type: 'set-waypoint',
      entryId: 'quest.gathering-trail',
      target: { kind: 'location', locationId: 'homestead' },
    });
    expect(waypointResult.accepted).toBe(true);
    expect(waypointResult.state.journal.waypoint?.status).toBe('active');

    const restored = restoreWorldSave(createWorldSave(waypointResult.state));
    expect(restored.journal).toEqual(waypointResult.state.journal);
  });

  it('round-trips the profile Journal projection independently', () => {
    const profile = createInitialProfileJournalState();
    const progressed = advanceProfileJournal(profile, [
      { type: 'hero-moved', from: { x: 0, y: 2 }, to: { x: 1, y: 2 } },
    ]);
    const decoded = decodeProfileSave(JSON.parse(encodeProfileSave(createProfileSave(progressed))));
    expect(decoded.journal).toEqual(progressed);
    expect(decoded.profileId).toBe('profile:primary');
  });

  it('preserves the journal state type when marking a profile entry seen', () => {
    const profile = createInitialProfileJournalState();
    const next = markJournalEntrySeen(profile, 'guide.first-move');

    expect(next.entries['guide.first-move'].seen).toBe(true);
    expect(next.unlocks).toEqual(profile.unlocks);
  });
});
