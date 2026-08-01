import type { ReactElement } from 'react';
import { CARD_ANIMATION_PRESETS } from '../ui/card-animation';
import { selectCardPlayPreset, useCardPlayLabState } from './card-play-lab-store';

/** Development-only selector for comparing the real, full hand animation paths. */
export function CardPlayLab(): ReactElement {
  const state = useCardPlayLabState();

  return (
    <aside className="card-play-lab" data-testid="card-play-lab" aria-label="Card Play animation lab">
      <div className="card-play-lab__header">
        <span className="card-play-lab__eyebrow">Dev lab</span>
        <strong>Card Animations</strong>
      </div>
      <p className="card-play-lab__copy">Every choice controls hand, hover, reflow, draw, discard, and play.</p>
      <div className="card-play-lab__presets" role="radiogroup" aria-label="Card animation sources">
        {CARD_ANIMATION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="card-play-lab__preset"
            data-testid={`card-play-preset-${preset.id}`}
            role="radio"
            aria-checked={state.activePreset === preset.id}
            disabled={state.isPlaying}
            title={preset.description}
            onClick={() => selectCardPlayPreset(preset.id)}
          >
            <span className="card-play-lab__dot" aria-hidden="true" />
            <span>
              <strong>{preset.label}</strong>
              <small>{preset.shortLabel}</small>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
