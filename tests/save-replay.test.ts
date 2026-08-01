import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createInitialGameState,
  createWorldSave,
  decodeWorldSaveJson,
  decodeReplayTranscript,
  decodeWorldSave,
  generatedTreeAt,
  generatedTreeId,
  materializeGeneratedTrees,
  restoreWorldSave,
  runReplay,
  SimulationDataValidationError,
} from '../src/sim';
import type { Command } from '../src/sim';

function nearbyGeneratedTree(seed: number): { x: number; y: number } {
  for (let y = -16; y <= 16; y += 1) {
    for (let x = -16; x <= 16; x += 1) {
      if (generatedTreeAt(seed, { x, y })) return { x, y };
    }
  }
  throw new Error(`Expected a generated tree for seed ${seed}.`);
}

describe('WorldSave v1', () => {
  it('round-trips state while regenerating baseline entities from sparse mutations', () => {
    const state = createInitialGameState(1234);
    const generatedPosition = nearbyGeneratedTree(state.seed);
    const generatedId = generatedTreeId(generatedPosition);
    state.hero.position = { x: generatedPosition.x - 1, y: generatedPosition.y };
    materializeGeneratedTrees(state, state.hero.position);
    state.turn = 9;
    state.hero.inventory.wood = 4;
    state.entities.slime.health = 2;
    delete state.entities['resource-tree'];

    state.discoveries['discovery:old-pine'] = true;
    const save = createWorldSave(state);
    expect(save.worldId).toBe('world:1234');
    expect(save.discoveries).toEqual({ 'discovery:old-pine': true });
    const encoded = JSON.stringify(save);
    const decoded = decodeWorldSave(JSON.parse(encoded));
    const restored = restoreWorldSave(decoded);

    expect(save.entityMutations.updated[generatedId]).toBeUndefined();
    expect(save.entityMutations.updated.slime?.health).toBe(2);
    expect(save.entityMutations.removed).toContain('resource-tree');
    expect(restored).toEqual(state);
    expect(restored.entities[generatedId]).toEqual(state.entities[generatedId]);
  });

  it('retains generated removals without serializing materialized generated entities', () => {
    const state = createInitialGameState(1234);
    const target = nearbyGeneratedTree(state.seed);
    const targetId = generatedTreeId(target);
    state.hero.position = { x: target.x - 1, y: target.y };
    materializeGeneratedTrees(state, state.hero.position);

    const gathered = applyCommand(state, { type: 'interact', target });
    const save = createWorldSave(gathered.state);
    const restored = restoreWorldSave(JSON.parse(JSON.stringify(save)));

    expect(save.removedGeneratedEntities[targetId]).toBe(true);
    expect(save.entityMutations.updated[targetId]).toBeUndefined();
    expect(restored.entities[targetId]).toBeUndefined();
    expect(restored.removedGeneratedEntities[targetId]).toBe(true);
  });

  it('rejects corrupt, unknown, and unsupported save data', () => {
    const valid = createWorldSave(createInitialGameState(1234));

    expect(() => decodeWorldSave({ ...valid, unexpected: true })).toThrow(SimulationDataValidationError);
    expect(() => decodeWorldSave({ ...valid, schemaVersion: 2 })).toThrow(/unsupported schema version 2/);
    expect(() =>
      decodeWorldSave({
        ...valid,
        hero: { ...valid.hero, position: { x: 'east', y: 2 } },
      }),
    ).toThrow(/worldSave\.hero\.position\.x/);
    expect(() => restoreWorldSave({ ...valid, generationVersion: valid.generationVersion + 1 })).toThrow(
      /Cannot load generation version/,
    );
    expect(() => restoreWorldSave({ ...valid, worldId: 'world:other' })).toThrow(/Cannot load world world:other/);
  });

  it('decodes the portable JSON representation and preserves discoveries', () => {
    const state = createInitialGameState(1234);
    state.discoveries['discovery:homestead'] = true;
    const encoded = JSON.stringify(createWorldSave(state));

    expect(decodeWorldSaveJson(encoded).discoveries).toEqual({ 'discovery:homestead': true });
  });

  it('round-trips the deterministic bound respawn state after death', () => {
    const state = createInitialGameState(1234);
    state.hero.position = { x: 4, y: 2 };
    state.hero.health = 1;
    state.entities.slime.disposition = 'hostile';

    const result = applyCommand(state, { type: 'wait' });
    expect(result.events.some((event) => event.type === 'hero-respawned')).toBe(true);
    expect(restoreWorldSave(createWorldSave(result.state))).toEqual(result.state);
  });
});

describe('deterministic replay', () => {
  it('reproduces fixed-seed checkpoints, events, and final state', () => {
    const commands: Command[] = [
      { type: 'move', direction: 'east' },
      { type: 'wait' },
      { type: 'move', direction: 'east' },
      { type: 'equip-ability', slot: 'basic', abilityId: 'ability.bash' },
    ];
    const transcript = {
      seed: 1234,
      generationVersion: createInitialGameState(1234).generationVersion,
      commands,
    };

    const first = runReplay(transcript);
    const second = runReplay(JSON.parse(JSON.stringify(transcript)));

    expect(second).toEqual(first);
    expect(first.checkpoints).toHaveLength(commands.length);
    expect(first.checkpoints.map((checkpoint) => checkpoint.accepted)).toEqual([true, true, true, true]);
    expect(first.finalState.turn).toBe(3);
    expect(restoreWorldSave(createWorldSave(first.finalState))).toEqual(first.finalState);
  });

  it('strictly validates transcript commands and generation version', () => {
    const generationVersion = createInitialGameState(1234).generationVersion;

    expect(() =>
      decodeReplayTranscript({
        seed: 1234,
        generationVersion,
        commands: [{ type: 'move', direction: 'diagonal' }],
      }),
    ).toThrow(/replay\.commands\[0\]\.direction/);
    expect(() => runReplay({ seed: 1234, generationVersion: generationVersion + 1, commands: [] })).toThrow(
      /Cannot replay generation version/,
    );
  });
});
