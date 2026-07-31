import { expect, test } from '@playwright/test';

test('loads the first-light vertical slice with a minimal menu overlay', async ({ page }) => {
  await page.goto('/');

  const assetManifest = await page.evaluate(async () => {
    const response = await fetch('/assets/manifest.json');
    return response.json() as Promise<{ assets: Array<{ id: string; variants: Record<string, unknown> }> }>;
  });
  const slimeAsset = assetManifest.assets.find((asset) => asset.id === 'enemy.slime');
  expect(slimeAsset?.variants.full).toBeTruthy();
  expect(slimeAsset?.variants.marker).toBeTruthy();
  for (const abilityId of ['ability.bash', 'ability.sunder', 'ability.avatar']) {
    const abilityAsset = assetManifest.assets.find((asset) => asset.id === abilityId);
    expect(abilityAsset?.variants.full).toMatchObject({ width: 896, height: 1200 });
  }

  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.getByTestId('dev-performance')).toBeVisible();
  await expect(page.getByTestId('dev-performance')).toHaveText(/^\d+ FPS$/);
  await expect(page.getByTestId('hud-hero-button')).toBeVisible();
  await expect(page.getByTestId('hud-hero-button').locator('img')).toBeVisible();
  await expect(page.getByTestId('hud-hero-button').locator('img')).toHaveAttribute('src', /knight-hud\.png/);
  await expect(page.getByTestId('hud-hero-button').locator('svg')).toHaveCount(0);
  await expect(page.getByTestId('hero-hp')).toHaveAttribute('aria-label', 'Hero HP 10 of 10');
  await expect(page.getByTestId('hud-inventory-button')).toBeVisible();
  await expect(page.getByTestId('hud-inventory-button').locator('svg.lucide-backpack')).toBeVisible();
  await expect(page.getByTestId('hud-equipment-button')).toBeVisible();
  await expect(page.getByTestId('hud-equipment-button').locator('svg.lucide-sword')).toBeVisible();
  await expect(page.getByTestId('hud-abilities-button')).toBeVisible();
  await expect(page.getByTestId('hud-abilities-button').locator('svg.lucide-sparkles')).toBeVisible();
  await expect(page.getByTestId('menu-button')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Torch' })).toHaveCount(0);
  await expect(page.getByTestId('seed')).toHaveCount(0);
  await expect(page.getByText('Latest', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('move-east')).toHaveCount(0);

  await page.getByTestId('menu-button').click();

  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hero' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inventory' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Equipment' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Journal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();

  await page.getByTestId('menu-settings').click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(page.getByTestId('settings-screen')).toBeVisible();
  await expect(page.getByTestId('settings-master-volume')).toBeVisible();
  await page.getByTestId('settings-ui-scale').click();
  await expect(page.getByRole('option', { name: 'Large' })).toBeVisible();
  await page.getByRole('option', { name: 'Large' }).click();
  await expect(page.getByTestId('settings-ui-scale')).toContainText('Large');
  await page.getByTestId('close-menu').click();

  await page.getByTestId('hud-inventory-button').click();
  await expect(page.getByRole('dialog', { name: 'Inventory' })).toBeVisible();
  await expect(page.getByTestId('inventory-grid')).toBeVisible();
  await expect(page.getByTestId('inventory-grid')).toHaveAttribute('aria-label', 'all items');
  await expect(page.getByTestId('inventory-tab-equipment')).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByTestId('inventory-tab-resources')).toBeVisible();
  await page.getByTestId('inventory-tab-equipment').click();
  await expect(page.getByTestId('inventory-tab-equipment')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('inventory-tab-equipment').click();
  await expect(page.getByTestId('inventory-tab-equipment')).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByTestId('inventory-grid')).toHaveAttribute('aria-label', 'all items');
  await expect(page.getByTestId('inventory-sort')).toBeVisible();
  await page.getByTestId('inventory-sort').click();
  await expect(page.getByRole('menuitemradio', { name: 'Name' })).toBeVisible();
  await page.getByRole('menuitemradio', { name: 'Name' }).click();
  await expect(page.getByTestId('inventory-item-iron-sword')).toBeVisible();
  await expect(page.getByText('Iron Sword', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Select an item to inspect it.', { exact: true })).toHaveCount(0);
  const quantityLayout = await page.evaluate(() => {
    const item = document.querySelector<HTMLElement>('[data-testid="inventory-item-iron-sword"]');
    const quantity = item?.parentElement?.querySelector<HTMLElement>('.inventory-item-quantity');
    const itemRect = item?.getBoundingClientRect();
    const quantityRect = quantity?.getBoundingClientRect();
    return {
      itemBottom: itemRect?.bottom ?? 0,
      itemCenter: itemRect ? itemRect.left + itemRect.width / 2 : 0,
      quantityTop: quantityRect?.top ?? 0,
      quantityCenter: quantityRect ? quantityRect.left + quantityRect.width / 2 : 0,
    };
  });
  expect(quantityLayout.quantityTop).toBeGreaterThanOrEqual(quantityLayout.itemBottom);
  expect(Math.abs(quantityLayout.quantityCenter - quantityLayout.itemCenter)).toBeLessThanOrEqual(1);
  await page.getByTestId('inventory-item-iron-sword').click();
  await expect(page.getByTestId('inventory-detail')).toContainText('Iron Sword');
  await page.getByTestId('inventory-tab-resources').click();
  await expect(page.getByTestId('inventory-item-wood')).toBeVisible();
  await expect(page.getByTestId('inventory-detail')).toHaveCount(0);
  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-hero-button').click();
  await expect(page.getByTestId('hero-art-full')).toBeVisible();
  await expect(page.locator('.hero-art-panel')).toHaveCount(0);
  await expect(page.getByTestId('hero-art-square')).toHaveCount(0);
  await expect(page.getByTestId('hero-back')).toHaveCount(0);
  const heroArtRatio = await page.getByTestId('hero-art-full').evaluate((image: HTMLImageElement) => ({
    rendered: image.clientWidth / image.clientHeight,
    native: image.naturalWidth / image.naturalHeight,
  }));
  expect(heroArtRatio.rendered).toBeCloseTo(heroArtRatio.native, 2);
  for (const stat of ['Strength', 'Agility', 'Toughness', 'Wisdom', 'Intellect']) {
    await expect(page.getByText(stat, { exact: true })).toBeVisible();
  }
  await expect(page.getByTestId('equipment-slot-main-hand')).toHaveCount(0);
  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-equipment-button').click();
  await expect(page.getByRole('dialog', { name: 'Equipment' })).toBeVisible();
  await expect(page.getByTestId('equipment-screen')).toBeVisible();
  await expect(page.getByTestId('equipment-slot-main-hand')).toBeVisible();
  await page.getByTestId('equipment-slot-main-hand').click();
  await expect(page.getByTestId('equipment-picker')).toBeVisible();
  await page.getByRole('button', { name: 'Iron Sword', exact: true }).click();
  await page.getByRole('button', { name: 'Equip', exact: true }).click();
  await expect(page.getByTestId('equipment-slot-main-hand')).toHaveAttribute('aria-label', 'Main Hand: Iron Sword');
  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-abilities-button').click();
  await expect(page.getByRole('dialog', { name: 'Abilities' })).toBeVisible();
  await expect(page.getByTestId('abilities-screen')).toBeVisible();
  await expect(page.getByTestId('ability-slot-basic')).toBeVisible();
  await page.getByTestId('ability-slot-basic').click();
  await expect(page.getByTestId('ability-picker')).toBeVisible();
  await expect(page.getByTestId('ability-choice-bash')).toBeVisible();
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>('[data-testid="ability-choice-bash"] img');
    return Boolean(image?.naturalWidth && image?.naturalHeight);
  });
  const abilityRatio = await page.getByTestId('ability-choice-bash').locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth / image.naturalHeight);
  expect(abilityRatio).toBeCloseTo(3 / 4, 2);

  await page.getByTestId('close-menu').click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
});

test('fits the Hero detail content within landscape and portrait viewports', async ({ page }) => {
  for (const viewport of [
    { width: 1170, height: 624 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByTestId('hud-hero-button').click();
    await page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>('[data-testid="hero-art-full"]');
      return Boolean(image?.naturalWidth);
    });

    const layout = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('#torch-menu');
      const details = document.querySelector<HTMLElement>('.hero-details');
      const image = document.querySelector<HTMLImageElement>('[data-testid="hero-art-full"]');
      const stats = document.querySelector<HTMLElement>('.stats-panel');
      const panelRect = panel?.getBoundingClientRect();
      const detailsRect = details?.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      const statsRect = stats?.getBoundingClientRect();
      return {
        panelBottom: panelRect?.bottom ?? 0,
        imageBottom: imageRect?.bottom ?? 0,
        panelScrollHeight: panel?.scrollHeight ?? 0,
        panelClientHeight: panel?.clientHeight ?? 0,
        artLeftInset: detailsRect && imageRect ? imageRect.left - detailsRect.left : 0,
        statsRightInset: detailsRect && statsRect ? detailsRect.right - statsRect.right : 0,
        artRight: imageRect?.right ?? 0,
        statsLeft: statsRect?.left ?? 0,
        artWidth: imageRect?.width ?? 0,
        statsWidth: statsRect?.width ?? 0,
        renderedRatio: imageRect ? imageRect.width / imageRect.height : 0,
        nativeRatio: image && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 0,
      };
    });
    expect(layout.panelBottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(layout.imageBottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(layout.panelScrollHeight).toBe(layout.panelClientHeight);
    expect(layout.renderedRatio).toBeCloseTo(layout.nativeRatio, 2);
    expect(layout.artLeftInset).toBeLessThanOrEqual(1);
    expect(layout.statsRightInset).toBeLessThanOrEqual(1);
    expect(layout.artWidth).toBeGreaterThan(0);
    expect(layout.statsWidth).toBeGreaterThan(0);
    expect(layout.artRight).toBeLessThanOrEqual(layout.statsLeft + 1);
  }
});
