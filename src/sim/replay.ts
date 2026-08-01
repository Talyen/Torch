import { applyCommand } from './simulation';
import { cloneSerializable } from './state';
import { commandAt, exactKeys, fail, integerAt, positiveIntegerAt, recordAt } from './save-validation';
import type { Command, GameState, SimEvent } from './types';
import { createInitialGameState, GENERATION_VERSION } from './world';

export interface ReplayTranscript {
  seed: number;
  generationVersion: number;
  commands: Command[];
}

export interface ReplayCheckpoint {
  command: Command;
  accepted: boolean;
  state: GameState;
  events: SimEvent[];
}

export interface ReplayResult {
  initialState: GameState;
  checkpoints: ReplayCheckpoint[];
  finalState: GameState;
}

export function decodeReplayTranscript(value: unknown): ReplayTranscript {
  const record = recordAt(value, 'replay');
  exactKeys(record, ['seed', 'generationVersion', 'commands'], [], 'replay');
  if (!Array.isArray(record.commands)) fail('replay.commands', 'expected an array');

  return {
    seed: integerAt(record.seed, 'replay.seed'),
    generationVersion: positiveIntegerAt(record.generationVersion, 'replay.generationVersion'),
    commands: record.commands.map((command, index) => commandAt(command, `replay.commands[${index}]`)),
  };
}

export function runReplay(value: unknown): ReplayResult {
  const transcript = decodeReplayTranscript(value);
  if (transcript.generationVersion !== GENERATION_VERSION) {
    throw new Error(
      `Cannot replay generation version ${transcript.generationVersion}; expected ${GENERATION_VERSION}.`,
    );
  }

  const initialState = createInitialGameState(transcript.seed);
  let state = initialState;
  const checkpoints: ReplayCheckpoint[] = [];

  for (const command of transcript.commands) {
    const result = applyCommand(state, command);
    state = result.state;
    checkpoints.push({
      command: cloneSerializable(command),
      accepted: result.accepted,
      state: cloneSerializable(result.state),
      events: cloneSerializable(result.events),
    });
  }

  return {
    initialState: cloneSerializable(initialState),
    checkpoints,
    finalState: cloneSerializable(state),
  };
}
