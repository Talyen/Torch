const MAX_RENDER_SCALE = 2;

interface BackingSize {
  width: number;
  height: number;
}

interface CameraScroll {
  x: number;
  y: number;
}

/**
 * Keeps the renderer sharp on high-DPI displays without allowing the backing
 * surface to grow without bound on very dense screens.
 */
export function renderScaleForDevicePixelRatio(
  devicePixelRatio: number | undefined,
  maximum = MAX_RENDER_SCALE,
): number {
  const safeRatio =
    typeof devicePixelRatio === 'number' && Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  const safeMaximum = Number.isFinite(maximum) && maximum >= 1 ? maximum : MAX_RENDER_SCALE;
  return Math.min(safeMaximum, Math.max(1, safeRatio));
}

export function backingSizeForViewport(width: number, height: number, renderScale: number): BackingSize {
  return {
    width: Math.max(1, Math.round(Math.max(1, width) * renderScale)),
    height: Math.max(1, Math.round(Math.max(1, height) * renderScale)),
  };
}

/** Centers a logical CSS-pixel viewport inside the denser backing surface. */
export function cameraScrollForLogicalViewport(
  logicalWidth: number,
  logicalHeight: number,
  backingWidth: number,
  backingHeight: number,
): CameraScroll {
  return {
    x: (logicalWidth - backingWidth) / 2,
    y: (logicalHeight - backingHeight) / 2,
  };
}

/**
 * Phaser's pointer coordinates are expressed in its backing-canvas space.
 * Convert them once into the logical CSS-pixel space used by TorchScene.
 */
export function logicalPointerCoordinate(value: number, displayScale: number): number {
  const safeScale = Number.isFinite(displayScale) && displayScale > 0 ? displayScale : 1;
  return value / safeScale;
}
