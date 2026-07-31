import { expect, test } from '@playwright/test';

test('loads the Torch vertical slice with a minimal menu overlay', async ({ page }) => {
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
  await expect(page.getByTestId('hud-equipment-button')).toHaveCount(0);
  await expect(page.getByTestId('hud-abilities-button')).toBeVisible();
  await expect(page.getByTestId('hud-abilities-button').locator('svg.lucide-sparkles')).toBeVisible();
  await expect(page.getByTestId('hud-map-button')).toBeVisible();
  await expect(page.getByTestId('hud-map-button').locator('svg.lucide-map')).toBeVisible();
  await expect(page.getByTestId('menu-button')).toBeVisible();
  const hudOrder = await page.locator('.hud-rail > button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')));
  expect(hudOrder).toEqual([
    'Open hero',
    'Open inventory',
    'Open abilities',
    'Open map',
    'Open menu',
  ]);
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
  await expect(page.getByTestId('settings-show-grid')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('settings-show-grid').click();
  await expect(page.getByTestId('settings-show-grid')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('settings-ui-scale').click();
  await expect(page.getByRole('option', { name: 'Large' })).toBeVisible();
  await page.getByRole('option', { name: 'Large' }).click();
  await expect(page.getByTestId('settings-ui-scale')).toContainText('Large');
  const menuSurfaceStyles = await page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>('.menu-panel');
    const content = document.querySelector<HTMLElement>('.settings-group');
    const menuStyle = menu ? getComputedStyle(menu) : undefined;
    const contentStyle = content ? getComputedStyle(content) : undefined;
    return {
      menuBackground: menuStyle?.backgroundColor ?? '',
      contentBackground: contentStyle?.backgroundColor ?? '',
      contentBackdropFilter: contentStyle?.backdropFilter ?? '',
    };
  });
  expect(menuSurfaceStyles.menuBackground).toMatch(/rgba\(/);
  expect(menuSurfaceStyles.contentBackground).not.toMatch(/rgba\(/);
  expect(menuSurfaceStyles.contentBackdropFilter).toBe('none');
  await page.getByTestId('close-menu').click();

  await page.getByTestId('hud-inventory-button').click();
  await expect(page.getByRole('dialog', { name: 'Inventory' })).toBeVisible();
  await expect(page.getByTestId('inventory-section-tabs')).toBeVisible();
  await expect(page.getByTestId('inventory-section-tab-inventory')).toHaveAttribute('aria-selected', 'true');
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
  await page.getByTestId('hud-inventory-button').click();
  await expect(page.getByRole('dialog', { name: 'Inventory' })).toBeVisible();
  await page.getByTestId('inventory-section-tab-gear').click();
  await expect(page.getByTestId('inventory-section-tab-gear')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('equipment-screen')).toBeVisible();
  await expect(page.getByTestId('equipment-slot-main-hand')).toBeVisible();
  await expect(page.getByTestId('equipment-slot-body')).toBeVisible();
  const equipmentFit = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#torch-menu');
    const slot = (id: string): DOMRect | undefined => document.querySelector<HTMLElement>(`[data-testid="equipment-slot-${id}"]`)?.getBoundingClientRect();
    const helm = slot('helm');
    const amulet = slot('amulet');
    const ringLeft = slot('ring-1');
    const belt = slot('belt');
    const ringRight = slot('ring-2');
    const body = slot('body');
    const slots = [...document.querySelectorAll<HTMLElement>('.equipment-slot')].map((item) => item.getBoundingClientRect());
    return {
      panelFits: panel ? panel.scrollHeight === panel.clientHeight : false,
      slotsAreSquare: slots.every((item) => Math.abs(item.width - item.height) <= 1),
      amuletRightOfHelm: helm && amulet ? amulet.left > helm.left : false,
      bodyBetweenHands: body && helm && belt ? body.left >= helm.left && body.left <= belt.right : false,
      ringsAroundBelt: ringLeft && belt && ringRight ? ringLeft.left < belt.left && ringRight.left > belt.left : false,
    };
  });
  expect(equipmentFit.panelFits).toBe(true);
  expect(equipmentFit.slotsAreSquare).toBe(true);
  expect(equipmentFit.amuletRightOfHelm).toBe(true);
  expect(equipmentFit.bodyBetweenHands).toBe(true);
  expect(equipmentFit.ringsAroundBelt).toBe(true);
  await page.getByTestId('equipment-slot-main-hand').click();
  await expect(page.getByTestId('equipment-picker')).toBeVisible();
  await expect(page.getByTestId('equipment-picker-back')).toBeVisible();
  await page.getByTestId('equipment-choice-iron-sword').click();
  await expect(page.getByTestId('equipment-picker')).toHaveCount(0);
  await expect(page.getByTestId('equipment-slot-main-hand')).toHaveAttribute('aria-label', 'Main Hand: Iron Sword');
  await page.getByTestId('inventory-section-tab-tools').click();
  await expect(page.getByTestId('tools-screen')).toBeVisible();
  await expect(page.getByTestId('tool-slot-axe')).toBeVisible();
  await expect(page.getByTestId('tool-slot-pickaxe')).toBeVisible();
  await page.getByTestId('tool-slot-axe').click();
  await expect(page.getByTestId('tool-picker')).toBeVisible();
  await expect(page.getByTestId('tool-choice-iron-axe')).toBeVisible();
  await page.getByTestId('tool-choice-iron-axe').click();
  await expect(page.getByTestId('tool-picker')).toHaveCount(0);
  await expect(page.getByTestId('tool-slot-axe')).toHaveAttribute('aria-label', 'Axe: Iron Axe');
  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-abilities-button').click();
  await expect(page.getByRole('dialog', { name: 'Abilities' })).toBeVisible();
  await expect(page.getByTestId('abilities-screen')).toBeVisible();
  await expect(page.getByTestId('ability-slot-basic')).toBeVisible();
  const abilitiesFit = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#torch-menu');
    const cards = [...document.querySelectorAll<HTMLElement>('.ability-loadout-card')].map((card) => card.getBoundingClientRect());
    const images = [...document.querySelectorAll<HTMLImageElement>('.ability-loadout-card img')].map((image) => image.getBoundingClientRect());
    return {
      panelFits: panel ? panel.scrollHeight === panel.clientHeight : false,
      cardsAreSideBySide: cards.length === 3 && cards[0].right <= cards[1].left + 1 && cards[1].right <= cards[2].left + 1,
      artKeepsRatio: images.every((image) => Math.abs(image.width / image.height - 3 / 4) <= 0.02),
    };
  });
  expect(abilitiesFit.panelFits).toBe(true);
  expect(abilitiesFit.cardsAreSideBySide).toBe(true);
  expect(abilitiesFit.artKeepsRatio).toBe(true);
  await page.getByTestId('ability-slot-basic').locator('.ability-art-button').dispatchEvent('pointerdown');
  await expect(page.getByTestId('ability-detail')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Bash details' })).toContainText('Deal 2 Stun damage.');
  await expect(page.getByTestId('ability-detail')).toContainText('No cooldown');
  await page.getByTestId('ability-detail-close').click();
  await page.getByTestId('ability-slot-basic').locator('.ability-art-button').click();
  await expect(page.getByTestId('ability-picker')).toBeVisible();
  await expect(page.getByTestId('ability-choice-bash')).toBeVisible();
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>('[data-testid="ability-choice-bash"] img');
    return Boolean(image?.naturalWidth && image?.naturalHeight);
  });
  const abilityRatio = await page.getByTestId('ability-choice-bash').locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth / image.naturalHeight);
  expect(abilityRatio).toBeCloseTo(3 / 4, 2);
  await page.getByTestId('ability-choice-bash').click();
  await expect(page.getByTestId('ability-picker')).toHaveCount(0);

  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-map-button').click();
  await expect(page.getByRole('dialog', { name: 'Map' })).toBeVisible();
  await expect(page.getByTestId('map-screen')).toBeVisible();
  await expect(page.getByTestId('map-grid')).toHaveAttribute('aria-label', /Explored terrain map with Hero/);
  await expect(page.getByTestId('map-grid').locator('.map-tile.is-grass')).not.toHaveCount(0);
  await expect(page.getByTestId('map-grid').locator('.map-tile.is-unexplored')).not.toHaveCount(0);
  await expect(page.getByTestId('map-screen').locator('.map-toolbar')).toHaveCount(0);
  await expect(page.getByTestId('map-screen').locator('.map-legend')).toHaveCount(0);
  await expect(page.getByTestId('map-grid').locator('.map-hero-token')).toHaveCount(1);
  await expect(page.getByTestId('map-grid').locator('.map-hero-token img')).toHaveAttribute('src', /knight-marker\.png/);
  const mapGeometry = await page.getByTestId('map-grid').evaluate((grid) => {
    const tile = grid.querySelector<HTMLElement>('.map-tile');
    const heroToken = grid.querySelector<HTMLElement>('.map-hero-token');
    const tileRect = tile?.getBoundingClientRect();
    const heroRect = heroToken?.getBoundingClientRect();
    const viewportRect = grid.parentElement?.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    return {
      tileWidth: tileRect?.width ?? 0,
      tileHeight: tileRect?.height ?? 0,
      heroWidth: heroRect?.width ?? 0,
      heroHeight: heroRect?.height ?? 0,
      gridWidth: gridRect.width,
      viewportWidth: viewportRect?.width ?? 0,
    };
  });
  expect(mapGeometry.tileWidth).toBeGreaterThan(0);
  expect(mapGeometry.tileHeight).toBeGreaterThan(0);
  expect(Math.abs(mapGeometry.tileWidth - mapGeometry.tileHeight)).toBeLessThanOrEqual(1);
  expect(mapGeometry.heroWidth).toBeGreaterThanOrEqual(18);
  expect(mapGeometry.heroHeight).toBeGreaterThanOrEqual(18);
  expect(mapGeometry.gridWidth).toBeGreaterThanOrEqual(mapGeometry.viewportWidth - 2);
  const mapStyles = await page.getByTestId('map-grid').evaluate((grid) => {
    const tile = grid.querySelector<HTMLElement>('.map-tile');
    const heroToken = grid.querySelector<HTMLElement>('.map-hero-token');
    return {
      mapBorder: getComputedStyle(grid).borderWidth,
      tileBorder: tile ? getComputedStyle(tile).borderRightWidth : '',
      heroRadius: heroToken ? getComputedStyle(heroToken).borderRadius : '',
      gridVisible: grid.classList.contains('is-grid-visible'),
    };
  });
  expect(mapStyles.mapBorder).toBe('0px');
  expect(mapStyles.tileBorder).toBe('1px');
  expect(mapStyles.heroRadius).not.toBe('50%');
  expect(mapStyles.gridVisible).toBe(true);
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
        statColumns: [...document.querySelectorAll<HTMLElement>('.stat-row')].map((row) => Math.round(row.getBoundingClientRect().left)),
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
    expect(new Set(layout.statColumns).size).toBe(1);
    expect(layout.artRight).toBeLessThanOrEqual(layout.statsLeft + 1);
  }
});

test('shows contextual action cards for gathering and combat', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hud-hero-button')).toBeVisible();
  await page.waitForTimeout(400);

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('context-action-card-context-entity-resource-tree-chop')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chop at Old Pine' })).toBeVisible();

  const chopCard = page.getByTestId('context-action-card-context-entity-resource-tree-chop');
  await chopCard.click();
  await expect(chopCard).toHaveClass(/is-playing/);
  await page.waitForTimeout(500);
  await expect(page.getByTestId('context-action-hand')).toHaveCount(0);

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Bash against Forest Slime' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sunder against Forest Slime' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avatar against Forest Slime' })).toBeVisible();

  await page.getByRole('button', { name: 'Sunder against Forest Slime' }).click();
  await expect(page.getByRole('button', { name: 'Sunder, Ready in 3 actions.' })).toBeDisabled();
});
