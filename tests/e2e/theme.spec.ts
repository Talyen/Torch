import { expect, test, type Page } from './fixtures';

const legacyBlueValues = [
  '203039',
  '142027',
  '3a443e',
  '222f32',
  '1b292f',
  '152027',
  '1b292e',
  '142026',
  '18252b',
  '18272d',
  '101a20',
  '18262c',
  '121d23',
  '121c21',
  '0b1217',
  '151d22',
  '1b2022',
  '111c22',
];

async function surfaceStyle(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((element: Element) => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.backgroundImage, style.borderColor, style.color].join(' ');
    });
}

test('uses the canonical Gold/Charcoal palette across overlay surfaces', async ({ page }) => {
  await page.goto('/');

  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      background: root.getPropertyValue('--ui-color-background').trim(),
      surface: root.getPropertyValue('--ui-color-surface').trim(),
      panel: root.getPropertyValue('--ui-color-surface-panel').trim(),
      raised: root.getPropertyValue('--ui-color-surface-content-raised').trim(),
      accent: root.getPropertyValue('--ui-color-accent').trim(),
      muted: root.getPropertyValue('--ui-color-muted').trim(),
    };
  });

  expect(tokens).toEqual({
    background: '#0c0b09',
    surface: '#15130f',
    panel: '#171511',
    raised: '#2b2720',
    accent: '#f2c463',
    muted: '#b8ae9f',
  });

  await page.getByTestId('menu-button').click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  const menuPanel = await surfaceStyle(page, '.menu-panel');
  const menuTile = await surfaceStyle(page, '.menu-item-icon');
  expect(menuPanel).toContain('rgb(23, 21, 17)');
  expect(menuTile).not.toContain('rgb(27, 41, 47)');

  await page.getByTestId('menu-settings').click();
  await expect(page.getByRole('dialog', { name: 'Options' })).toBeVisible();
  const settingsGroup = await surfaceStyle(page, '.settings-group');
  expect(settingsGroup).not.toContain('rgb(24, 38, 44)');

  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-inventory-button').click();
  const inventoryItem = await surfaceStyle(page, '.inventory-item');
  expect(inventoryItem).not.toContain('rgb(27, 41, 47)');

  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-gear-button').click();
  const equipmentSlot = await surfaceStyle(page, '.gear-screen .equipment-slot');
  expect(equipmentSlot).not.toContain('rgb(27, 41, 47)');

  const allSurfaceStyles = [menuPanel, menuTile, settingsGroup, inventoryItem, equipmentSlot].join(' ').toLowerCase();
  for (const value of legacyBlueValues) expect(allSurfaceStyles).not.toContain(value);
});

test('uses Torch geometry for dialog close and pagination controls', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('hud-inventory-button').click();
  await expect(page.getByRole('dialog', { name: 'Inventory' })).toBeVisible();

  const metrics = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      const icon = element?.querySelector<SVGElement>('svg');
      if (!element || !icon) return undefined;
      const elementRect = element.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        height: elementRect.height,
        width: elementRect.width,
        centerDeltaX: iconRect.left + iconRect.width / 2 - (elementRect.left + elementRect.width / 2),
        centerDeltaY: iconRect.top + iconRect.height / 2 - (elementRect.top + elementRect.height / 2),
        borderRadius: style.borderRadius,
        background: style.backgroundColor,
        dataSlot: element.dataset.slot,
      };
    };

    return {
      close: read("button[aria-label='Close menu']"),
      previous: read("button[aria-label='Previous inventory page']"),
      next: read("button[aria-label='Next inventory page']"),
    };
  });

  expect(metrics.close).toBeDefined();
  expect(metrics.close?.dataSlot).toBe('button');
  expect(metrics.close?.borderRadius).toBe('50%');
  expect(Math.abs(metrics.close?.centerDeltaX ?? 99)).toBeLessThan(0.5);
  expect(Math.abs(metrics.close?.centerDeltaY ?? 99)).toBeLessThan(0.5);

  for (const pagination of [metrics.previous, metrics.next]) {
    expect(pagination).toBeDefined();
    expect(pagination?.dataSlot).toBe('button');
    expect(pagination?.height).toBeGreaterThanOrEqual(42);
    expect(pagination?.background).not.toBe('rgb(12, 11, 9)');
  }
});
