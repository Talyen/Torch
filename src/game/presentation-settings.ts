/**
 * Small client-side bridge for presentation preferences. The simulation never
 * reads these values; Phaser and the React overlay simply share the same
 * browser preference and event contract.
 */
export const SHOW_GRID_EVENT = 'torch:show-grid-changed';
const SHOW_GRID_STORAGE_KEY = 'torch.show-grid';

export function readShowGridPreference(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(SHOW_GRID_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setShowGridPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(SHOW_GRID_STORAGE_KEY, String(enabled));
  } catch {
    // Local storage can be unavailable in private or embedded browser modes.
  }

  window.dispatchEvent(new CustomEvent(SHOW_GRID_EVENT, { detail: { enabled } }));
}
