import type { InventoryCategory, InventoryItemDefinition } from '../content/inventory';
import { layoutProfileForSize } from './responsive-layout';
import type { LayoutProfile } from './responsive-layout';

export type InventorySort = 'category' | 'name' | 'quantity';

export interface InventoryLayout {
  profile: LayoutProfile;
  columns: number;
  rows: number;
  pageSize: number;
}

/** The detail surface is mounted only for a valid selection. */
export function inventoryDetailVisible(hasSelection: boolean, isCompactLayout: boolean, detailOpen: boolean): boolean {
  return hasSelection && (!isCompactLayout || detailOpen);
}

/**
 * Inventory deliberately uses a finite layout instead of an inner scroll
 * region. Keep the breakpoints and page sizes together so the paginator and
 * CSS grid cannot disagree about how many cards fit on screen.
 */
export function inventoryLayoutForViewport(width: number, height: number): InventoryLayout {
  const profile = layoutProfileForSize(width, height);
  return profile === 'tiny'
    ? { profile, columns: 3, rows: 1, pageSize: 3 }
    : profile === 'compact'
      ? { profile, columns: 3, rows: 2, pageSize: 6 }
      : { profile, columns: 4, rows: 2, pageSize: 8 };
}

export function filterAndSortInventoryItems(
  items: readonly InventoryItemDefinition[],
  category: InventoryCategory | undefined,
  sort: InventorySort,
): InventoryItemDefinition[] {
  return items
    .filter((item) => !category || item.category === category)
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      if (sort === 'quantity')
        return b.quantity - a.quantity || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      return a.id.localeCompare(b.id);
    });
}

export function inventoryPageCount(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampInventoryPage(pageIndex: number, pageCount: number): number {
  return Math.min(Math.max(0, pageIndex), Math.max(0, pageCount - 1));
}

export function inventoryPageItems<T>(items: readonly T[], pageIndex: number, pageSize: number): T[] {
  if (pageSize <= 0) return [];
  const start = Math.max(0, pageIndex) * pageSize;
  return items.slice(start, start + pageSize);
}

export function inventoryPageRange(totalItems: number, pageIndex: number, pageSize: number): string {
  if (totalItems <= 0 || pageSize <= 0) return 'No items';
  const start = Math.max(0, pageIndex) * pageSize + 1;
  const end = Math.min(totalItems, start + pageSize - 1);
  return `Items ${start}–${end} of ${totalItems}`;
}
