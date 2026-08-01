import { describe, expect, it } from 'vitest';
import {
  backingSizeForViewport,
  cameraScrollForLogicalViewport,
  logicalPointerCoordinate,
  renderScaleForDevicePixelRatio,
} from '../src/game/render-resolution';

describe('render resolution', () => {
  it('clamps device pixel ratios to a bounded renderer scale', () => {
    expect(renderScaleForDevicePixelRatio(0.75)).toBe(1);
    expect(renderScaleForDevicePixelRatio(1)).toBe(1);
    expect(renderScaleForDevicePixelRatio(1.5)).toBe(1.5);
    expect(renderScaleForDevicePixelRatio(3)).toBe(2);
    expect(renderScaleForDevicePixelRatio(Number.NaN)).toBe(1);
  });

  it('rounds backing dimensions while preserving the logical viewport', () => {
    expect(backingSizeForViewport(552, 742, 2)).toEqual({ width: 1104, height: 1484 });
    expect(backingSizeForViewport(390, 844, 1.25)).toEqual({ width: 488, height: 1055 });
    expect(backingSizeForViewport(0, 0, 2)).toEqual({ width: 2, height: 2 });
  });

  it('converts backing-space pointer coordinates exactly once', () => {
    expect(logicalPointerCoordinate(110, 2)).toBe(55);
    expect(logicalPointerCoordinate(137.5, 1.25)).toBe(110);
    expect(logicalPointerCoordinate(110, 0)).toBe(110);
  });

  it('centers the logical viewport within the backing surface', () => {
    expect(cameraScrollForLogicalViewport(552, 742, 1104, 1484)).toEqual({ x: -276, y: -371 });
    expect(cameraScrollForLogicalViewport(640, 480, 640, 480)).toEqual({ x: 0, y: 0 });
  });
});
