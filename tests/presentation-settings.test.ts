import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESENTATION_SETTINGS,
  readPresentationSettings,
  resetPresentationSettings,
  setPresentationSetting,
} from '../src/game/presentation-settings';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('presentation settings', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    const eventTarget = new EventTarget();
    globalThis.window = Object.assign(eventTarget, {
      localStorage: storage,
      matchMedia: () => ({ matches: false }),
    }) as unknown as Window & typeof globalThis;
    globalThis.document = {
      documentElement: { dataset: {} },
    } as unknown as Document;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  it('reads the canonical defaults when no preference has been saved', () => {
    expect(readPresentationSettings()).toEqual(DEFAULT_PRESENTATION_SETTINGS);
  });

  it('merges partial stored settings without turning missing values into undefined', () => {
    storage.setItem('torch.presentation-settings', JSON.stringify({ screenShake: false }));

    expect(readPresentationSettings()).toMatchObject({
      screenShake: false,
      interactionHints: DEFAULT_PRESENTATION_SETTINGS.interactionHints,
      confirmActions: DEFAULT_PRESENTATION_SETTINGS.confirmActions,
    });
  });

  it('honors canonical settings when legacy preference keys are absent', () => {
    storage.setItem(
      'torch.presentation-settings',
      JSON.stringify({ showGrid: false, uiScale: 'large', reduceMotion: true }),
    );

    expect(readPresentationSettings()).toMatchObject({ showGrid: false, uiScale: 'large', reduceMotion: true });
  });

  it('falls back to the declared defaults for unknown stored preference values', () => {
    storage.setItem('torch.show-grid', 'sometimes');
    storage.setItem('torch.reduce-motion', 'sometimes');

    expect(readPresentationSettings().showGrid).toBe(DEFAULT_PRESENTATION_SETTINGS.showGrid);
    expect(readPresentationSettings().reduceMotion).toBe(DEFAULT_PRESENTATION_SETTINGS.reduceMotion);
  });

  it('uses the platform motion preference when the stored value is unknown', () => {
    globalThis.window = Object.assign(window, {
      matchMedia: () => ({ matches: true }),
    }) as unknown as Window & typeof globalThis;
    storage.setItem('torch.reduce-motion', 'sometimes');

    expect(readPresentationSettings().reduceMotion).toBe(true);
  });

  it('persists a changed setting and keeps legacy preference consumers in sync', () => {
    const next = setPresentationSetting('showGrid', false);

    expect(next.showGrid).toBe(false);
    expect(readPresentationSettings().showGrid).toBe(false);
    expect(storage.getItem('torch.show-grid')).toBe('false');
    expect(JSON.parse(storage.getItem('torch.presentation-settings') ?? '{}')).toMatchObject({ showGrid: false });
  });

  it('restores all presentation settings to defaults', () => {
    setPresentationSetting('uiScale', 'large');
    setPresentationSetting('reduceMotion', true);
    setPresentationSetting('masterVolume', 12);

    expect(resetPresentationSettings()).toEqual(DEFAULT_PRESENTATION_SETTINGS);
    expect(readPresentationSettings()).toEqual(DEFAULT_PRESENTATION_SETTINGS);
    expect(document.documentElement.dataset.uiScale).toBe('auto');
    expect(document.documentElement.dataset.reduceMotion).toBe('false');
  });
});
