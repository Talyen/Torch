/**
 * Application-facing persistence contract. The simulation owns the DTO and
 * codec; providers only store opaque serialized data and never resolve rules.
 */
export interface SaveProvider {
  load(slot: string): string | undefined;
  /** Implementations must ignore a revision older than their latest accepted write. */
  save(slot: string, serialized: string, revision: number): void | Promise<void>;
}

export const PRIMARY_WORLD_SAVE_SLOT = 'world:primary';
