import { describe, expect, it } from 'vitest';
import { GameRuntime } from '../src/game/session';
import type { ActionBatch } from '../src/game/session';

describe('GameRuntime action batches', () => {
  it('does not replay a prior event array and emits one batch per dispatch', () => {
    const session = new GameRuntime(1234);
    const batches: Array<Pick<ActionBatch, 'batchId' | 'events'>> = [];
    const unsubscribe = session.subscribeActionBatches((batch) => batches.push(batch));

    session.wait();
    session.wait();
    unsubscribe();

    expect(batches.map((batch) => batch.batchId)).toEqual([1, 2]);
    expect(
      batches.map((batch) =>
        batch.events
          .filter((event): event is Extract<typeof event, { type: 'turn-advanced' }> => event.type === 'turn-advanced')
          .map((event) => event.turn),
      ),
    ).toEqual([[1], [2]]);
  });

  it('keeps the previous state separate from the resolved next state', () => {
    const session = new GameRuntime(1234);
    let previousTurn = -1;
    let nextTurn = -1;
    session.subscribeActionBatches((batch) => {
      previousTurn = batch.previousState.turn;
      nextTurn = batch.nextState.turn;
    });

    session.wait();

    expect(previousTurn).toBe(0);
    expect(nextTurn).toBe(1);
  });
});
