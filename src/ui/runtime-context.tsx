import { createContext, useContext } from 'react';
import type { GameRuntimePort } from '../game/session';

const RuntimeContext = createContext<GameRuntimePort | null>(null);

export function RuntimeProvider({ runtime, children }: { runtime: GameRuntimePort; children?: React.ReactNode }) {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

export function useGameRuntime(): GameRuntimePort {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error('Torch runtime is not available.');
  return runtime;
}
