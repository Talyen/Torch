import Phaser from 'phaser';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { TorchScene } from './game/scene';
import { MenuOverlay } from './ui/menu-overlay';
import { devFrameMonitor } from './dev/frame-monitor';
import { applyReduceMotionPreference, applyUiScalePreference } from './game/presentation-settings';
import './index.css';
import './styles.css';

const uiRoot = document.querySelector<HTMLDivElement>('#ui-root');
if (!uiRoot) throw new Error('Torch UI root is missing.');

applyUiScalePreference();
applyReduceMotionPreference();

createRoot(uiRoot).render(createElement(MenuOverlay));

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
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TorchScene],
});

if (import.meta.env.DEV) {
  devFrameMonitor.start(game);
}
