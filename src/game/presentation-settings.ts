/**
 * Small client-side bridge for presentation preferences. The simulation never
 * reads these values; Phaser and the React overlay simply share the same
 * browser preference and event contract.
 */
export const SHOW_GRID_EVENT = 'torch:show-grid-changed';
const SHOW_GRID_STORAGE_KEY = 'torch.show-grid';
const DEFAULT_SHOW_GRID = true;
export const UI_SCALE_EVENT = 'torch:ui-scale-changed';
const UI_SCALE_STORAGE_KEY = 'torch.ui-scale';
export type UiScale = 'auto' | 'compact' | 'large';
const DEFAULT_UI_SCALE: UiScale = 'auto';
export const REDUCE_MOTION_EVENT = 'torch:reduce-motion-changed';
const REDUCE_MOTION_STORAGE_KEY = 'torch.reduce-motion';
const DEFAULT_REDUCE_MOTION = false;
export const PRESENTATION_SETTINGS_EVENT = 'torch:presentation-settings-changed';

export type PresentationSettings = {
  uiScale: UiScale;
  showGrid: boolean;
  reduceMotion: boolean;
  screenShake: boolean;
  interactionHints: boolean;
  confirmActions: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
};

export type PresentationSettingKey = keyof PresentationSettings;

const PRESENTATION_SETTINGS_STORAGE_KEY = 'torch.presentation-settings';

export const DEFAULT_PRESENTATION_SETTINGS: PresentationSettings = {
  uiScale: DEFAULT_UI_SCALE,
  showGrid: DEFAULT_SHOW_GRID,
  reduceMotion: DEFAULT_REDUCE_MOTION,
  screenShake: true,
  interactionHints: true,
  confirmActions: false,
  masterVolume: 80,
  musicVolume: 70,
  sfxVolume: 85,
};

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readStoredPresentationSettings(): Partial<PresentationSettings> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = window.localStorage.getItem(PRESENTATION_SETTINGS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const settings: Partial<PresentationSettings> = {
      masterVolume: clampVolume(parsed.masterVolume, DEFAULT_PRESENTATION_SETTINGS.masterVolume),
      musicVolume: clampVolume(parsed.musicVolume, DEFAULT_PRESENTATION_SETTINGS.musicVolume),
      sfxVolume: clampVolume(parsed.sfxVolume, DEFAULT_PRESENTATION_SETTINGS.sfxVolume),
    };
    if (parsed.uiScale === 'compact' || parsed.uiScale === 'large') settings.uiScale = parsed.uiScale;
    if (typeof parsed.showGrid === 'boolean') settings.showGrid = parsed.showGrid;
    if (typeof parsed.reduceMotion === 'boolean') settings.reduceMotion = parsed.reduceMotion;
    if (typeof parsed.screenShake === 'boolean') settings.screenShake = parsed.screenShake;
    if (typeof parsed.interactionHints === 'boolean') settings.interactionHints = parsed.interactionHints;
    if (typeof parsed.confirmActions === 'boolean') settings.confirmActions = parsed.confirmActions;
    return settings;
  } catch {
    return {};
  }
}

export function readPresentationSettings(): PresentationSettings {
  const stored = readStoredPresentationSettings();
  return {
    ...DEFAULT_PRESENTATION_SETTINGS,
    ...stored,
    // Keep the legacy individual preference keys authoritative when present so
    // existing saves migrate without a visible preference reset.
    showGrid: readShowGridPreference(),
    uiScale: readUiScalePreference(),
    reduceMotion: readReduceMotionPreference(),
  };
}

function writePresentationSettings(settings: PresentationSettings): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PRESENTATION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Embedded/private browser contexts may not expose local storage.
  }

  window.dispatchEvent(new CustomEvent(PRESENTATION_SETTINGS_EVENT, { detail: settings }));
}

export function setPresentationSetting<K extends PresentationSettingKey>(
  key: K,
  value: PresentationSettings[K],
): PresentationSettings {
  const current = readPresentationSettings();
  const next = { ...current, [key]: value } as PresentationSettings;

  if (key === 'showGrid') setShowGridPreference(value as boolean);
  if (key === 'uiScale') setUiScalePreference(value as UiScale);
  if (key === 'reduceMotion') setReduceMotionPreference(value as boolean);
  writePresentationSettings(next);
  return next;
}

export function resetPresentationSettings(): PresentationSettings {
  const next = { ...DEFAULT_PRESENTATION_SETTINGS };
  setShowGridPreference(next.showGrid);
  setUiScalePreference(next.uiScale);
  setReduceMotionPreference(next.reduceMotion);
  writePresentationSettings(next);
  return next;
}

export function readShowGridPreference(): boolean {
  if (typeof window === 'undefined') return DEFAULT_SHOW_GRID;

  try {
    const storedValue = window.localStorage.getItem(SHOW_GRID_STORAGE_KEY);
    return storedValue === null ? DEFAULT_SHOW_GRID : storedValue === 'true';
  } catch {
    return DEFAULT_SHOW_GRID;
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

export function readUiScalePreference(): UiScale {
  if (typeof window === 'undefined') return DEFAULT_UI_SCALE;
  try {
    const value = window.localStorage.getItem(UI_SCALE_STORAGE_KEY);
    return value === 'compact' || value === 'large' ? value : DEFAULT_UI_SCALE;
  } catch {
    return DEFAULT_UI_SCALE;
  }
}

export function applyUiScalePreference(scale: UiScale = readUiScalePreference()): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.uiScale = scale;
}

export function setUiScalePreference(scale: UiScale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_SCALE_STORAGE_KEY, scale);
  } catch {
    // Local storage can be unavailable in private or embedded browser modes.
  }
  applyUiScalePreference(scale);
  window.dispatchEvent(new CustomEvent(UI_SCALE_EVENT, { detail: { scale } }));
}

export function readReduceMotionPreference(): boolean {
  if (typeof window === 'undefined') return DEFAULT_REDUCE_MOTION;

  try {
    const storedValue = window.localStorage.getItem(REDUCE_MOTION_STORAGE_KEY);
    if (storedValue !== null) return storedValue === 'true';
  } catch {
    // Fall through to the platform preference when storage is unavailable.
  }

  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : DEFAULT_REDUCE_MOTION;
}

export function applyReduceMotionPreference(enabled: boolean = readReduceMotionPreference()): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.reduceMotion = String(enabled);
}

export function setReduceMotionPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, String(enabled));
  } catch {
    // Local storage can be unavailable in private or embedded browser modes.
  }

  applyReduceMotionPreference(enabled);
  window.dispatchEvent(new CustomEvent(REDUCE_MOTION_EVENT, { detail: { enabled } }));
}
