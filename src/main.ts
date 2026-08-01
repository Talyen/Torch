import Phaser from 'phaser';
import { Fragment, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { TorchScene } from './game/scene';
import { gameSession } from './game/session';
import { MenuOverlay } from './ui/menu-overlay';
import { LocalStorageSaveProvider } from './platform/local-save-provider';
import { devFrameMonitor } from './dev/frame-monitor';
import { CardPlayLab } from './dev/card-play-lab';
import { applyReduceMotionPreference, applyUiScalePreference } from './game/presentation-settings';
import './index.css';
import './styles.css';

const uiRoot = document.querySelector<HTMLDivElement>('#ui-root');
if (!uiRoot) throw new Error('Torch UI root is missing.');

applyUiScalePreference();
applyReduceMotionPreference();
gameSession.attachSaveProvider(new LocalStorageSaveProvider());

createRoot(uiRoot).render(
  createElement(Fragment, null, createElement(MenuOverlay), import.meta.env.DEV ? createElement(CardPlayLab) : null),
);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 640,
  // Matches --ui-color-background; TorchScene reads the live token after CSS
  // has loaded so the board and overlay share one charcoal foundation.
  backgroundColor: '#0c0b09',
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
  },
  scale: {
    // TorchScene owns the CSS-to-backing-size bridge so high-DPI displays get
    // a dense renderer without leaking device pixels into world coordinates.
    mode: Phaser.Scale.NONE,
  },
  scene: [TorchScene],
});

if (import.meta.env.DEV) {
  devFrameMonitor.start(game);
  game.events.once(Phaser.Core.Events.DESTROY, () => devFrameMonitor.stop());
}
