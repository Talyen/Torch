import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/session';

describe('GameSession action batches', () => {
  it('does not replay a prior event array and emits one batch per dispatch', () => {
    const session = new GameSession(1234);
    const batches: number[] = [];
    const unsubscribe = session.subscribeActionBatches((batch) => batches.push(batch.batchId));

    session.wait();
    session.wait();
    unsubscribe();

    expect(batches).toEqual([1, 2]);
  });

  it('keeps the previous state separate from the resolved next state', () => {
    const session = new GameSession(1234);
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
