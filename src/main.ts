import Phaser from 'phaser';
import { Fragment, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { TorchScene } from './game/scene';
import { createGameRuntime } from './game/session';
import { MenuOverlay } from './ui/menu-overlay';
import { LocalStorageSaveProvider } from './platform/local-save-provider';
import { devFrameMonitor } from './dev/frame-monitor';
import { CardPlayLab } from './dev/card-play-lab';
import { applyReduceMotionPreference, applyUiScalePreference } from './game/presentation-settings';
import { BOARD_PRESENTATION_FALLBACKS } from './game/presentation-colors';
import { RuntimeProvider } from './ui/runtime-context';
import './index.css';
import './styles.css';

const uiRoot = document.querySelector<HTMLDivElement>('#ui-root');
if (!uiRoot) throw new Error('Torch UI root is missing.');

const enabledDevTools = new Set(new URLSearchParams(window.location.search).getAll('dev'));
const isDevToolEnabled = (tool: string): boolean => import.meta.env.DEV && enabledDevTools.has(tool);

applyUiScalePreference();
applyReduceMotionPreference();

const runtime = await createGameRuntime(20260730, { saveProvider: new LocalStorageSaveProvider() });

createRoot(uiRoot).render(
  createElement(
    RuntimeProvider,
    { runtime },
    createElement(
      Fragment,
      null,
      createElement(MenuOverlay),
      isDevToolEnabled('card-play-lab') ? createElement(CardPlayLab) : null,
    ),
  ),
);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 640,
  // Matches --ui-color-background; TorchScene reads the live token after CSS
  // has loaded so the board and overlay share one charcoal foundation.
  backgroundColor: BOARD_PRESENTATION_FALLBACKS.background,
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
  scene: [new TorchScene(runtime)],
});

window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void runtime.flushPersistence();
});
window.addEventListener('pagehide', () => void runtime.flushPersistence());

if (isDevToolEnabled('frame-monitor')) {
  devFrameMonitor.start(game);
  game.events.once(Phaser.Core.Events.DESTROY, () => devFrameMonitor.stop());
}
game.events.once(Phaser.Core.Events.DESTROY, () => void runtime.shutdown());
