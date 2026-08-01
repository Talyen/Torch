import { useSyncExternalStore } from 'react';
import { DEFAULT_CARD_ANIMATION_PRESET, type CardAnimationPresetId } from '../ui/card-animation';

/** The lab is intentionally a selector, not a second playback system. */
interface CardPlayLabState {
  activePreset: CardAnimationPresetId;
  isPlaying: boolean;
}

const listeners = new Set<() => void>();
let state: CardPlayLabState = {
  activePreset: DEFAULT_CARD_ANIMATION_PRESET,
  isPlaying: false,
};

function notify(): void {
  listeners.forEach((listener) => listener());
}

function update(next: CardPlayLabState): void {
  state = next;
  notify();
}

function getCardPlayLabState(): CardPlayLabState {
  return state;
}

function subscribeToCardPlayLab(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCardPlayLabState(): CardPlayLabState {
  return useSyncExternalStore(subscribeToCardPlayLab, getCardPlayLabState, getCardPlayLabState);
}

export function selectCardPlayPreset(presetId: CardAnimationPresetId): void {
  if (state.isPlaying || state.activePreset === presetId) return;
  update({ ...state, activePreset: presetId });
}

export function setCardPlayPlaybackActive(isPlaying: boolean): void {
  update({ ...state, isPlaying });
}
