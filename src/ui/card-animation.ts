import type { ContextActionOption } from '../sim';
import type { Position } from '../sim';

export interface CardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type CardAnimationPresetId = 'trinket' | 'alchemy';

export type CardAnimationPhase = 'idle' | 'draw' | 'hover' | 'reflow' | 'discard' | 'play';

export interface CardAnimationSnapshot {
  /** Narrow presentation identity, independent of the current entity target. */
  cardKey: string;
  /** Immutable action/card projection captured before the simulation mutates. */
  action: ContextActionOption;
  sourceRect?: CardRect;
  cameraPosition: Position;
  target: Position;
  presetId: CardAnimationPresetId;
}

export interface CardAnimationPreset {
  id: CardAnimationPresetId;
  label: string;
  shortLabel: string;
  description: string;
  layout: {
    /** Resting fan angle per card. */
    angleStep: number;
    /** Resting vertical fan rise per card. */
    verticalStep: number;
    overlap: number;
    hoverLift: number;
    hoverRotationStep: number;
    hoverScale: number;
    heldScale: number;
  };
  timing: {
    entryMs: number;
    entryStaggerMs: number;
    reflowMs: number;
    drawMs: number;
    discardMs: number;
    playMs: number;
    reducedPlayMs: number;
  };
  transfer: {
    drawFlip: readonly number[];
    discardFlip: readonly number[];
    playMode: 'dissolve' | 'travel';
    playTravelMs: number;
  };
}

/**
 * Source-faithful presentation bundles. These values are presentation-only;
 * the simulation still owns action legality, state, and event ordering.
 */
export const CARD_ANIMATION_PRESETS: readonly CardAnimationPreset[] = [
  {
    id: 'trinket',
    label: 'Trinket',
    shortLabel: 'Spring cast',
    description: 'A tactile fan with held-card tilt, spring reflow, staggered draw, and a quiet dissolve cast.',
    layout: {
      angleStep: 9,
      verticalStep: 10,
      overlap: 0.45,
      hoverLift: -16,
      hoverRotationStep: 0,
      hoverScale: 1.035,
      heldScale: 1.035,
    },
    timing: {
      entryMs: 300,
      entryStaggerMs: 45,
      reflowMs: 340,
      drawMs: 320,
      discardMs: 1_000,
      playMs: 1_000,
      reducedPlayMs: 560,
    },
    transfer: {
      drawFlip: [0],
      discardFlip: [0],
      playMode: 'dissolve',
      playTravelMs: 1_000,
    },
  },
  {
    id: 'alchemy',
    label: 'Alchemy',
    shortLabel: 'Pile travel',
    description: 'A precise fan with hover lift, 3D draw/discard flips, and a ghost card travelling to the target.',
    layout: {
      angleStep: 4.2,
      verticalStep: 10,
      overlap: 0.46,
      hoverLift: -34,
      hoverRotationStep: 2.6,
      hoverScale: 1.03,
      heldScale: 1.03,
    },
    timing: {
      entryMs: 230,
      entryStaggerMs: 36,
      reflowMs: 340,
      drawMs: 500,
      discardMs: 500,
      playMs: 672,
      reducedPlayMs: 560,
    },
    transfer: {
      drawFlip: [180, 90, 0],
      discardFlip: [0, 90, 180],
      playMode: 'travel',
      playTravelMs: 528,
    },
  },
] as const;

export const DEFAULT_CARD_ANIMATION_PRESET: CardAnimationPresetId = 'trinket';

export function cardAnimationPresetForId(id: CardAnimationPresetId): CardAnimationPreset {
  return CARD_ANIMATION_PRESETS.find((preset) => preset.id === id) ?? CARD_ANIMATION_PRESETS[0];
}

export function snapshotForCardAnimation(
  action: ContextActionOption,
  cardKey: string,
  cameraPosition: Position,
  sourceRect?: CardRect,
  presetId: CardAnimationPresetId = DEFAULT_CARD_ANIMATION_PRESET,
): CardAnimationSnapshot {
  return {
    cardKey,
    action: {
      ...action,
      action: { ...action.action, target: { ...action.action.target } },
    },
    sourceRect: sourceRect ? { ...sourceRect } : undefined,
    cameraPosition: { ...cameraPosition },
    target: { ...action.action.target },
    presetId,
  };
}

export function animationDurationForPhase(
  preset: CardAnimationPreset,
  phase: CardAnimationPhase,
  reducedMotion = false,
): number {
  if (phase === 'draw') return reducedMotion ? 1 : preset.timing.drawMs;
  if (phase === 'discard') return reducedMotion ? 1 : preset.timing.discardMs;
  if (phase === 'play') return reducedMotion ? preset.timing.reducedPlayMs : preset.timing.playMs;
  if (phase === 'reflow') return reducedMotion ? 1 : preset.timing.reflowMs;
  return reducedMotion ? 1 : preset.timing.entryMs;
}
