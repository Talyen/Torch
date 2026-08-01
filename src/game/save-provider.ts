/**
 * Application-facing persistence contract. The simulation owns the DTO and
 * codec; providers only store opaque serialized data and never resolve rules.
 */
export interface SaveProvider {
  /** Providers that can address multiple slots independently may persist the profile projection too. */
  readonly supportsIndependentSlots?: boolean;
  load(slot: string): string | undefined;
  /** Implementations must ignore a revision older than their latest accepted write. */
  save(slot: string, serialized: string, revision: number): void | Promise<void>;
}

export const PRIMARY_WORLD_SAVE_SLOT = 'world:primary';
export const PRIMARY_PROFILE_SAVE_SLOT = 'profile:primary';
