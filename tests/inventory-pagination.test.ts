import { describe, expect, it } from 'vitest';
import { inventoryItems } from '../src/content/inventory';
import {
  clampInventoryPage,
  filterAndSortInventoryItems,
  inventoryLayoutForViewport,
  inventoryPageCount,
  inventoryPageItems,
  inventoryPageRange,
} from '../src/ui/inventory-pagination';

describe('inventory pagination', () => {
  it('uses a finite page capacity for each supported layout profile', () => {
    expect(inventoryLayoutForViewport(1280, 720)).toMatchObject({ profile: 'wide', columns: 4, rows: 2, pageSize: 8 });
    expect(inventoryLayoutForViewport(1170, 624)).toMatchObject({ profile: 'short', columns: 4, rows: 2, pageSize: 8 });
    expect(inventoryLayoutForViewport(390, 844)).toMatchObject({ profile: 'compact', columns: 3, rows: 2, pageSize: 6 });
    expect(inventoryLayoutForViewport(320, 568)).toMatchObject({ profile: 'tiny', columns: 3, rows: 1, pageSize: 3 });
  });

  it('slices exact and overflowing pages without mutating source order', () => {
    const items = inventoryItems.map((item) => ({ ...item }));
    const firstPage = inventoryPageItems(items, 0, 3);
    const secondPage = inventoryPageItems(items, 1, 3);

    expect(firstPage).toHaveLength(3);
    expect(secondPage).toHaveLength(3);
    expect(inventoryPageItems(items, 2, 3)).toHaveLength(3);
    expect(items[0]?.id).toBe(inventoryItems[0]?.id);
    expect(inventoryPageCount(items.length, 3)).toBe(5);
  });

  it('clamps page indexes and formats user-facing ranges', () => {
    expect(clampInventoryPage(-1, 3)).toBe(0);
    expect(clampInventoryPage(99, 3)).toBe(2);
    expect(inventoryPageRange(13, 0, 6)).toBe('Items 1–6 of 13');
    expect(inventoryPageRange(13, 2, 6)).toBe('Items 13–13 of 13');
    expect(inventoryPageRange(0, 0, 6)).toBe('No items');
  });

  it('keeps category and sort results deterministic', () => {
    expect(filterAndSortInventoryItems(inventoryItems, 'resources', 'category').map((item) => item.id))
      .toEqual(['bark', 'copper-ore', 'silver-ore', 'wood']);
    expect(filterAndSortInventoryItems(inventoryItems, undefined, 'quantity')[0]?.id).toBe('wood');
    expect(filterAndSortInventoryItems(inventoryItems, undefined, 'name')[0]?.name).toBe('Ancient Coin');
  });
});
