/**
 * Shared responsive layout math.
 *
 * This module intentionally has no browser or React dependencies.  It is the
 * single source of truth for breakpoint decisions and for layouts that need
 * the measured size of their owning surface rather than the window size.
 */

export type LayoutProfile = 'wide' | 'short' | 'compact' | 'tiny';

export interface ResponsiveSize {
  width: number;
  height: number;
}

export interface MapFit {
  columns: number;
  rows: number;
  cellSize: number;
}

export function positiveSize(size: ResponsiveSize): ResponsiveSize {
  return {
    width: Math.max(0, Number.isFinite(size.width) ? size.width : 0),
    height: Math.max(0, Number.isFinite(size.height) ? size.height : 0),
  };
}

/**
 * Keep semantic layout profiles based on the available surface.  The values
 * match the inventory pagination contract and are deliberately independent of
 * device-pixel-ratio or browser chrome.
 */
export function layoutProfileForSize(width: number, height: number): LayoutProfile {
  if (width <= 360) return 'tiny';
  if (width <= 720) return 'compact';
  if (height < 660) return 'short';
  return 'wide';
}

/**
 * Fit an explored map into its measured viewport while preserving square
 * cells.  Extra cells are added around the explored region so the viewport is
 * filled without stretching or clipping the map.
 */
export function mapFitForViewport(
  width: number,
  height: number,
  exploredColumns: number,
  exploredRows: number,
): MapFit | undefined {
  const viewportWidth = Math.max(0, Number.isFinite(width) ? width : 0);
  const viewportHeight = Math.max(0, Number.isFinite(height) ? height : 0);
  const columnsInWorld = Math.max(1, Math.floor(exploredColumns));
  const rowsInWorld = Math.max(1, Math.floor(exploredRows));
  if (viewportWidth <= 0 || viewportHeight <= 0) return undefined;

  const baseCellSize = Math.max(1, Math.floor(Math.min(viewportWidth / columnsInWorld, viewportHeight / rowsInWorld)));
  const expandedColumns = Math.max(columnsInWorld, Math.ceil(viewportWidth / baseCellSize));
  const expandedRows = Math.max(rowsInWorld, Math.ceil(viewportHeight / baseCellSize));
  const candidates = [
    { columns: expandedColumns, rows: rowsInWorld },
    { columns: columnsInWorld, rows: expandedRows },
    { columns: expandedColumns, rows: expandedRows },
  ].map((candidate) => ({
    ...candidate,
    cellSize: Math.min(viewportWidth / candidate.columns, viewportHeight / candidate.rows),
  }));
  const best = candidates.reduce((currentBest, candidate) => {
    const bestArea = currentBest.cellSize * currentBest.columns * currentBest.cellSize * currentBest.rows;
    const candidateArea = candidate.cellSize * candidate.columns * candidate.cellSize * candidate.rows;
    return candidateArea > bestArea ? candidate : currentBest;
  });

  // Bias the final fit toward the full viewport width. When height is the
  // limiting dimension, this keeps a little vertical breathing room instead of
  // shrinking every cell and leaving a wide unused strip on the sides.
  const columns = Math.max(
    columnsInWorld,
    Math.ceil(viewportWidth / best.cellSize),
    Math.ceil((viewportWidth * rowsInWorld) / viewportHeight),
  );
  const cellSize = viewportWidth / columns;
  const rows = Math.max(rowsInWorld, Math.floor(viewportHeight / cellSize));
  return { columns, rows, cellSize };
}
