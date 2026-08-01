import type Phaser from 'phaser';
import {
  backingSizeForViewport,
  cameraScrollForLogicalViewport,
  renderScaleForDevicePixelRatio,
} from './render-resolution';

export interface LogicalViewportSize {
  width: number;
  height: number;
}

/**
 * Owns the canvas/DPR bridge. Scene rendering continues to use logical CSS
 * pixels; only the Phaser backing surface and camera zoom receive DPR.
 */
export class SceneViewportCoordinator {
  public size: LogicalViewportSize = { width: 960, height: 640 };

  private renderScale = 1;
  private resizeObserver?: ResizeObserver;
  private resizeFrame?: number;
  private dprMediaQuery?: MediaQueryList;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly onLogicalViewportChange: () => void,
  ) {}

  public connect(): void {
    this.bindDevicePixelRatioListener();
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(this.schedule);
    this.resizeObserver?.observe(this.scene.game.canvas.parentElement ?? this.scene.game.canvas);
    window.addEventListener('resize', this.schedule);
    window.visualViewport?.addEventListener('resize', this.schedule);
  }

  public disconnect(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    window.removeEventListener('resize', this.schedule);
    window.visualViewport?.removeEventListener('resize', this.schedule);
    this.unbindDevicePixelRatioListener();
    if (this.resizeFrame !== undefined) window.cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = undefined;
  }

  public readonly schedule = (): void => {
    if (this.resizeFrame !== undefined) return;
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      this.sync();
      return;
    }
    this.resizeFrame = window.requestAnimationFrame(() => {
      this.resizeFrame = undefined;
      this.sync();
    });
  };

  public sync(): void {
    const container = this.scene.game.canvas.parentElement;
    if (!container) return;

    const bounds = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width || this.scene.scale.width));
    const height = Math.max(1, Math.round(bounds.height || this.scene.scale.height));
    const nextRenderScale = renderScaleForDevicePixelRatio(typeof window === 'undefined' ? 1 : window.devicePixelRatio);
    const backingSize = backingSizeForViewport(width, height, nextRenderScale);
    if (
      this.size.width === width &&
      this.size.height === height &&
      this.renderScale === nextRenderScale &&
      this.scene.scale.width === backingSize.width &&
      this.scene.scale.height === backingSize.height
    ) {
      return;
    }

    this.size = { width, height };
    this.renderScale = nextRenderScale;
    this.scene.scale.resize(backingSize.width, backingSize.height);
    this.scene.cameras.main.setZoom(nextRenderScale);
    const scroll = cameraScrollForLogicalViewport(width, height, backingSize.width, backingSize.height);
    this.scene.cameras.main.setScroll(scroll.x, scroll.y);
    this.onLogicalViewportChange();
  }

  private readonly handleDevicePixelRatioChange = (): void => {
    this.bindDevicePixelRatioListener();
    this.schedule();
  };

  private bindDevicePixelRatioListener(): void {
    this.unbindDevicePixelRatioListener();
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    this.dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    if (typeof this.dprMediaQuery.addEventListener === 'function') {
      this.dprMediaQuery.addEventListener('change', this.handleDevicePixelRatioChange);
    } else {
      this.dprMediaQuery.addListener(this.handleDevicePixelRatioChange);
    }
  }

  private unbindDevicePixelRatioListener(): void {
    if (!this.dprMediaQuery) return;
    if (typeof this.dprMediaQuery.removeEventListener === 'function') {
      this.dprMediaQuery.removeEventListener('change', this.handleDevicePixelRatioChange);
    } else {
      this.dprMediaQuery.removeListener(this.handleDevicePixelRatioChange);
    }
    this.dprMediaQuery = undefined;
  }
}
