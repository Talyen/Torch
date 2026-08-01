import { expect, test } from './fixtures';

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
  const canvasResolution = await page.locator('#game canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    return {
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      cssWidth: canvas.clientWidth,
      cssHeight: canvas.clientHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  });
  const expectedRenderScale = Math.min(2, Math.max(1, canvasResolution.devicePixelRatio));
  expect(canvasResolution.backingWidth / canvasResolution.cssWidth).toBeCloseTo(expectedRenderScale, 1);
  expect(canvasResolution.backingHeight / canvasResolution.cssHeight).toBeCloseTo(expectedRenderScale, 1);
  // The performance panel is intentionally development-only; production
  // preview smoke proves the playable surface without relying on diagnostics.
  const performancePanel = page.getByTestId('dev-performance');
  if (await performancePanel.count()) {
    await expect(performancePanel).toBeVisible();
    await expect(performancePanel).toHaveText(/^\d+ FPS$/);
  }
  const cardPlayLab = page.getByTestId('card-play-lab');
  if (process.env.TORCH_E2E_PROD === '1') {
    await expect(performancePanel).toHaveCount(0);
    await expect(cardPlayLab).toHaveCount(0);
  } else {
    await expect(cardPlayLab).toBeVisible();
  }
  await expect(page.getByTestId('hud-hero-button')).toBeVisible();
  await expect(page.getByTestId('hud-hero-button').locator('img')).toBeVisible();
  await expect(page.getByTestId('hud-hero-button').locator('img')).toHaveAttribute('src', /knight-hud\.png/);
  await expect(page.getByTestId('hud-hero-button').locator('svg')).toHaveCount(0);
  await expect(page.getByTestId('hero-hp')).toHaveAttribute('aria-label', 'Hero HP 10 of 10');
  await expect(page.getByTestId('hud-inventory-button')).toBeVisible();
  await expect(page.getByTestId('hud-inventory-button').locator('svg.lucide-backpack')).toBeVisible();
  await expect(page.getByTestId('hud-gear-button')).toBeVisible();
  await expect(page.getByTestId('hud-gear-button').locator('svg.lucide-swords')).toBeVisible();
  await expect(page.getByTestId('hud-abilities-button')).toBeVisible();
  await expect(page.getByTestId('hud-abilities-button').locator('svg.lucide-sparkles')).toBeVisible();
  await expect(page.getByTestId('hud-map-button')).toHaveCount(0);
  await expect(page.getByTestId('menu-button')).toBeVisible();
  const hudOrder = await page
    .locator('.hud-rail > button')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')));
  expect(hudOrder).toEqual(['Open hero', 'Open inventory', 'Open gear', 'Open abilities', 'Open menu']);
  await expect(page.getByRole('heading', { name: 'Torch' })).toHaveCount(0);
  await expect(page.getByTestId('seed')).toHaveCount(0);
  await expect(page.getByText('Latest', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('move-east')).toHaveCount(0);

  await page.getByTestId('menu-button').click();

  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  await expect(page.locator('.menu-kicker')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hero' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inventory' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Equipment' })).toHaveCount(0);
  await expect(page.getByTestId('menu-map')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Journal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Options' })).toBeVisible();
  await expect(page.getByTestId('menu-talents')).toBeDisabled();
  await expect(page.getByTestId('menu-talents')).toContainText('Coming in a later phase');

  await page.getByTestId('menu-journal').click();
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible();
  await expect(page.getByTestId('journal-screen')).toBeVisible();
  await expect(page.getByTestId('journal-tab-overview')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('journal-entry-quest.gathering-trail')).toBeVisible();
  await page.getByTestId('journal-entry-quest.gathering-trail').click();
  await expect(page.getByRole('heading', { name: 'A Practical Trail' })).toBeVisible();
  await page.getByTestId('close-menu').click();
  await expect(page.getByRole('dialog', { name: 'Journal' })).toHaveCount(0);
  await expect(page.getByTestId('menu-button')).toBeFocused();
  await page.getByTestId('menu-button').click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();

  await page.getByTestId('menu-map').click();
  await expect(page.getByRole('dialog', { name: 'Map' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Explored terrain map/ })).toBeVisible();
  await expect(page.getByText('Waypoint', { exact: true })).toBeVisible();
  await page.getByTestId('close-menu').click();
  await expect(page.getByRole('dialog', { name: 'Map' })).toHaveCount(0);
  await expect(page.getByTestId('menu-button')).toBeFocused();
  await page.getByTestId('menu-button').click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();

  await page.getByTestId('menu-settings').click();
  await expect(page.getByRole('dialog', { name: 'Options' })).toBeVisible();
  await expect(page.getByTestId('settings-screen')).toBeVisible();
  await expect(page.getByTestId('settings-show-grid')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('settings-show-grid').click();
  await expect(page.getByTestId('settings-show-grid')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('settings-show-grid').click();
  await expect(page.getByTestId('settings-show-grid')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('settings-tab-accessibility').click();
  await expect(page.getByRole('switch', { name: 'Reduce Motion' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('switch', { name: 'Reduce Motion' }).click();
  await expect(page.getByRole('switch', { name: 'Reduce Motion' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
  await page.getByRole('switch', { name: 'Reduce Motion' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'false');
  await page.getByTestId('settings-tab-display').click();
  await page.getByTestId('settings-ui-scale').click();
  await page.getByRole('option', { name: 'Large' }).click();
  await expect(page.getByTestId('settings-ui-scale')).toContainText('Large');
  const largeUiFontSize = Number.parseFloat(
    await page.locator('#ui-root').evaluate((element) => getComputedStyle(element).fontSize),
  );
  expect(largeUiFontSize).toBeGreaterThanOrEqual(18);
  expect(largeUiFontSize).toBeLessThanOrEqual(20);
  await page.getByTestId('settings-ui-scale').click();
  await page.getByRole('option', { name: 'Auto' }).click();
  const autoUiFontSize = Number.parseFloat(
    await page.locator('#ui-root').evaluate((element) => getComputedStyle(element).fontSize),
  );
  expect(autoUiFontSize).toBeGreaterThanOrEqual(16);
  expect(autoUiFontSize).toBeLessThanOrEqual(18);
  expect(largeUiFontSize).toBeGreaterThan(autoUiFontSize);
  await page.getByTestId('settings-tab-bindings').click();
  await expect(page.getByTestId('key-binding-move-north-0')).toBeVisible();
  await page.getByTestId('key-binding-move-north-0').click();
  await page.keyboard.press('i');
  await expect(page.getByTestId('key-binding-move-north-0')).toHaveText('I');
  await page.getByTestId('reset-key-bindings').click();
  await page.getByTestId('settings-tab-audio').click();
  await expect(page.getByTestId('settings-master-volume')).toBeVisible();
  await expect(page.getByText('Changes apply immediately and are saved locally.')).toHaveCount(0);
  await expect(page.getByTestId('options-reset')).toBeVisible();
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
  expect(menuSurfaceStyles.menuBackground).not.toMatch(/rgba\(/);
  expect(menuSurfaceStyles.contentBackground).not.toMatch(/rgba\(/);
  expect(menuSurfaceStyles.contentBackdropFilter).toBe('none');
  await page.getByTestId('close-menu').click();

  await page.getByTestId('hud-inventory-button').click();
  await expect(page.getByRole('dialog', { name: 'Inventory' })).toBeVisible();
  await expect(page.getByTestId('inventory-section-tabs')).toHaveCount(0);
  await expect(page.getByTestId('inventory-grid')).toBeVisible();
  await expect(page.getByTestId('inventory-grid')).toHaveAttribute('aria-label', 'all items');
  await expect(page.getByTestId('inventory-filter')).toBeVisible();
  await expect(page.getByTestId('inventory-tab-equipment')).toHaveCount(0);
  await expect(page.getByTestId('inventory-page-previous')).toBeDisabled();
  await expect(page.getByTestId('inventory-page-next')).toBeEnabled();
  await page.getByTestId('inventory-page-next').click();
  await expect(page.locator('.inventory-pagination-label')).toHaveText('Page 2 of 3');
  await expect(page.getByTestId('inventory-page-previous')).toBeEnabled();
  await page.getByTestId('inventory-page-previous').click();
  await expect(page.locator('.inventory-pagination-label')).toHaveText('Page 1 of 3');
  await page.getByTestId('inventory-filter').click();
  await expect(page.getByTestId('inventory-tab-equipment')).toBeVisible();
  await page.getByTestId('inventory-tab-equipment').click();
  await expect(page.getByTestId('inventory-grid')).toHaveAttribute('aria-label', 'equipment items');
  await page.getByTestId('inventory-filter').click();
  await page.getByTestId('inventory-tab-all').click();
  await expect(page.getByTestId('inventory-grid')).toHaveAttribute('aria-label', 'all items');
  await expect(page.getByTestId('inventory-sort')).toBeVisible();
  await page.getByTestId('inventory-sort').click();
  await expect(page.getByRole('menuitemradio', { name: 'Name' })).toBeVisible();
  await page.getByRole('menuitemradio', { name: 'Name' }).click();
  await page.getByTestId('inventory-page-next').click();
  await expect(page.getByTestId('inventory-item-iron-sword')).toBeVisible();
  await expect(page.getByText('Iron Sword', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Select an item to inspect it.', { exact: true })).toHaveCount(0);
  const quantityLayout = await page.evaluate(() => {
    const item = document.querySelector<HTMLElement>('[data-testid="inventory-item-iron-sword"]');
    const quantity = item?.querySelector<HTMLElement>('.inventory-item-quantity');
    const itemRect = item?.getBoundingClientRect();
    const quantityRect = quantity?.getBoundingClientRect();
    return {
      itemBottom: itemRect?.bottom ?? 0,
      itemCenter: itemRect ? itemRect.left + itemRect.width / 2 : 0,
      quantityTop: quantityRect?.top ?? 0,
      quantityCenter: quantityRect ? quantityRect.left + quantityRect.width / 2 : 0,
    };
  });
  expect(quantityLayout.quantityTop).toBeLessThan(quantityLayout.itemBottom);
  expect(quantityLayout.quantityCenter).toBeGreaterThan(quantityLayout.itemCenter);
  await page.getByTestId('inventory-item-iron-sword').click();
  await expect(page.getByTestId('inventory-detail')).toContainText('Iron Sword');
  await page.getByTestId('inventory-filter').click();
  await page.getByTestId('inventory-tab-resources').click();
  await expect(page.getByTestId('inventory-item-wood')).toBeVisible();
  await expect(page.getByTestId('inventory-detail')).toHaveCount(0);
  await page.getByTestId('close-menu').click();
  await expect(page.getByTestId('hud-inventory-button')).toBeFocused();
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
  await page.getByTestId('hud-gear-button').click();
  await expect(page.getByRole('dialog', { name: 'Equipment' })).toBeVisible();
  await expect(page.getByTestId('equipment-screen')).toBeVisible();
  await expect(page.getByTestId('equipment-tab')).toBeVisible();
  await expect(page.getByTestId('tools-tab')).toBeVisible();
  await expect(page.getByTestId('equipment-slot-main-hand')).toBeVisible();
  await expect(page.getByTestId('equipment-slot-body')).toBeVisible();
  const equipmentFit = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#torch-menu');
    const screen = document.querySelector<HTMLElement>('.gear-screen')?.getBoundingClientRect();
    const slot = (id: string): DOMRect | undefined =>
      document.querySelector<HTMLElement>(`[data-testid="equipment-slot-${id}"]`)?.getBoundingClientRect();
    const helm = slot('helm');
    const mainHand = slot('main-hand');
    const body = slot('body');
    const offHand = slot('off-hand');
    const gloves = slot('gloves');
    const boots = slot('boots');
    const amulet = slot('amulet');
    const trinket = slot('trinket');
    const ring = slot('ring-1');
    const belt = slot('belt');
    const slots = [...document.querySelectorAll<HTMLElement>('.equipment-slot')].map((item) =>
      item.getBoundingClientRect(),
    );
    const paperGrid = document.querySelector<HTMLElement>('.paper-doll-grid')?.getBoundingClientRect();
    const sameRow = (left?: DOMRect, right?: DOMRect): boolean =>
      Boolean(left && right && Math.abs(left.top - right.top) <= 1);
    const centerX = (rect?: DOMRect): number => (rect ? rect.left + rect.width / 2 : 0);
    return {
      panelFits: panel ? panel.scrollHeight === panel.clientHeight : false,
      noHeroArt: !document.querySelector('.gear-hero-art'),
      ringTwoRemoved: !document.querySelector('[data-testid="equipment-slot-ring-2"]'),
      slotsAreSquare: slots.every((item) => Math.abs(item.width - item.height) <= 1),
      slotsFitScreen: screen
        ? slots.every(
            (item) =>
              item.left >= screen.left &&
              item.right <= screen.right &&
              item.top >= screen.top &&
              item.bottom <= screen.bottom,
          )
        : false,
      helmAboveHands: helm && mainHand ? helm.bottom <= mainHand.top + 1 : false,
      helmCenteredOverBody: helm && body ? Math.abs(centerX(helm) - centerX(body)) <= 1 : false,
      amuletRightOfHelm: amulet && helm ? amulet.left >= helm.right - 1 : false,
      handsAreAligned: sameRow(mainHand, body) && sameRow(body, offHand),
      glovesBelowMainHand: gloves && mainHand ? gloves.top >= mainHand.bottom - 1 : false,
      beltBelowBody: belt && body ? belt.top >= body.bottom - 1 : false,
      bootsBelowBelt: boots && belt ? boots.top >= belt.bottom - 1 : false,
      bootsCenteredOverBelt: boots && belt ? Math.abs(centerX(boots) - centerX(belt)) <= 1 : false,
      accessoryRowIsAligned: sameRow(ring, trinket),
      ringLeftOfTrinket: ring && trinket ? ring.left <= trinket.left : false,
      paperGridContainsSlots: paperGrid
        ? slots.every(
            (item) =>
              item.left >= paperGrid.left &&
              item.right <= paperGrid.right &&
              item.top >= paperGrid.top &&
              item.bottom <= paperGrid.bottom,
          )
        : false,
      artworkIsSquare: [...document.querySelectorAll<HTMLElement>('.equipment-slot-art')].every((item) => {
        const rect = item.getBoundingClientRect();
        return Math.abs(rect.width - rect.height) <= 1 && rect.width >= 40;
      }),
      labelsReadable: [
        ...document.querySelectorAll<HTMLElement>(
          '.gear-screen .loadout-slot-label, .gear-screen .loadout-slot-value, .gear-screen .loadout-slot-empty',
        ),
      ].every((item) => getComputedStyle(item).textOverflow !== 'ellipsis' && item.getBoundingClientRect().height > 0),
      paperGroupSemantics: document.querySelector('.paper-doll-grid')?.getAttribute('role') === 'group',
    };
  });
  expect(equipmentFit.panelFits).toBe(true);
  expect(equipmentFit.noHeroArt).toBe(true);
  expect(equipmentFit.ringTwoRemoved).toBe(true);
  expect(equipmentFit.slotsAreSquare).toBe(true);
  expect(equipmentFit.slotsFitScreen).toBe(true);
  expect(equipmentFit.helmAboveHands).toBe(true);
  expect(equipmentFit.helmCenteredOverBody).toBe(true);
  expect(equipmentFit.amuletRightOfHelm).toBe(true);
  expect(equipmentFit.handsAreAligned).toBe(true);
  expect(equipmentFit.glovesBelowMainHand).toBe(true);
  expect(equipmentFit.beltBelowBody).toBe(true);
  expect(equipmentFit.bootsBelowBelt).toBe(true);
  expect(equipmentFit.bootsCenteredOverBelt).toBe(true);
  expect(equipmentFit.accessoryRowIsAligned).toBe(true);
  expect(equipmentFit.ringLeftOfTrinket).toBe(true);
  expect(equipmentFit.paperGridContainsSlots).toBe(true);
  expect(equipmentFit.artworkIsSquare).toBe(true);
  expect(equipmentFit.labelsReadable).toBe(true);
  expect(equipmentFit.paperGroupSemantics).toBe(true);
  await page.getByTestId('equipment-slot-main-hand').click();
  await expect(page.getByTestId('equipment-picker')).toBeVisible();
  await expect(page.getByTestId('equipment-picker-back')).toBeVisible();
  await expect(page.getByTestId('equipment-picker-back')).toBeFocused();
  await page.getByTestId('equipment-choice-iron-sword').click();
  await expect(page.getByTestId('equipment-picker')).toHaveCount(0);
  await expect(page.getByTestId('equipment-slot-main-hand')).toBeFocused();
  await expect(page.getByTestId('equipment-slot-main-hand')).toHaveAttribute('aria-label', 'Main Hand: Iron Sword');
  await page.getByTestId('tools-tab').click();
  await expect(page.getByTestId('tool-slot-axe')).toBeVisible();
  await expect(page.getByTestId('tool-slot-pickaxe')).toBeVisible();
  await expect(page.getByTestId('tool-slot-hammer')).toBeVisible();
  await expect(page.getByTestId('tool-slot-shovel')).toBeVisible();
  await page.getByTestId('tool-slot-axe').click({ force: true });
  await expect(page.getByTestId('tool-picker')).toBeVisible();
  await expect(page.getByTestId('tool-choice-iron-axe')).toBeVisible();
  await page.getByTestId('tool-choice-iron-axe').click();
  await expect(page.getByTestId('tool-picker')).toHaveCount(0);
  await expect(page.getByTestId('tool-slot-axe')).toHaveAttribute('aria-label', 'Axe: Iron Axe');
  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-gear-button').click();
  await expect(page.getByTestId('equipment-slot-main-hand')).toHaveAttribute('aria-label', 'Main Hand: Iron Sword');
  await page.getByTestId('tools-tab').click();
  await expect(page.getByTestId('tool-slot-axe')).toHaveAttribute('aria-label', 'Axe: Iron Axe');
  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-abilities-button').click();
  await expect(page.getByRole('dialog', { name: 'Abilities' })).toBeVisible();
  await expect(page.getByTestId('abilities-screen')).toBeVisible();
  await expect(page.getByTestId('ability-slot-basic')).toBeVisible();
  const abilitiesFit = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#torch-menu');
    const cards = [...document.querySelectorAll<HTMLElement>('.ability-loadout-card')].map((card) =>
      card.getBoundingClientRect(),
    );
    const images = [...document.querySelectorAll<HTMLImageElement>('.ability-loadout-card img')].map((image) =>
      image.getBoundingClientRect(),
    );
    return {
      panelFits: panel ? panel.scrollHeight === panel.clientHeight : false,
      cardsAreSideBySide:
        cards.length === 3 && cards[0].right <= cards[1].left + 1 && cards[1].right <= cards[2].left + 1,
      artKeepsRatio: images.every((image) => Math.abs(image.width / image.height - 3 / 4) <= 0.02),
    };
  });
  expect(abilitiesFit.panelFits).toBe(true);
  expect(abilitiesFit.cardsAreSideBySide).toBe(true);
  expect(abilitiesFit.artKeepsRatio).toBe(true);
  await expect(page.getByTestId('ability-inspector')).toHaveCount(0);
  await page.getByTestId('ability-card-basic').click();
  await expect(page.getByTestId('ability-picker')).toBeVisible();
  await expect(page.getByTestId('ability-picker-back')).toBeFocused();
  await page.getByTestId('ability-choice-bash').click();
  await expect(page.getByTestId('ability-detail')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Bash' })).toContainText('Deal 2 Stun damage.');
  await expect(page.getByTestId('ability-detail')).toContainText('No cooldown');
  await page.getByTestId('ability-detail-select').click();
  await expect(page.getByTestId('ability-picker')).toHaveCount(0);
  await expect(page.getByTestId('ability-detail')).toHaveCount(0);

  await page.getByTestId('close-menu').click();
  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-map').click();
  await expect(page.getByRole('dialog', { name: 'Map' })).toBeVisible();
  await expect(page.getByTestId('map-screen')).toBeVisible();
  await expect(page.getByTestId('map-grid')).toHaveAttribute('aria-label', /Explored terrain map with Hero/);
  await expect(page.getByTestId('map-grid').locator('.map-tile.is-grass')).not.toHaveCount(0);
  await expect(page.getByTestId('map-grid').locator('.map-tile.is-unexplored')).not.toHaveCount(0);
  await expect(page.getByTestId('map-screen').locator('.map-toolbar')).toHaveCount(0);
  await expect(page.getByTestId('map-screen').locator('.map-legend')).toBeVisible();
  await expect(page.getByTestId('map-grid').locator('.map-hero-token')).toHaveCount(1);
  await expect(page.getByTestId('map-grid').locator('.map-hero-token img')).toHaveAttribute(
    'src',
    /knight-marker\.png/,
  );
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
  expect(mapGeometry.gridWidth).toBeGreaterThanOrEqual(mapGeometry.viewportWidth - 28);
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
  expect(mapStyles.mapBorder).toBe('2px');
  expect(mapStyles.tileBorder).toBe('0px');
  expect(mapStyles.heroRadius).not.toBe('50%');
  expect(mapStyles.gridVisible).toBe(false);
  await page.getByTestId('close-menu').click();
  await page.keyboard.press('m');
  await expect(page.getByRole('dialog', { name: 'Map' })).toBeVisible();
  await page.getByTestId('close-menu').click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
});

test('keeps Inventory contained without scroll regions across supported viewports', async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 600 },
    { width: 674, height: 582 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByTestId('hud-inventory-button').click();
    await expect(page.getByRole('dialog', { name: 'Inventory' })).toBeVisible();

    const geometry = await page.evaluate(() => {
      const rect = (selector: string): DOMRect | undefined =>
        document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
      const noScroll = (selector: string): boolean => {
        const element = document.querySelector<HTMLElement>(selector);
        return element
          ? element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1
          : false;
      };
      const filter = rect('[data-testid="inventory-filter"]');
      const toolbar = rect('.inventory-toolbar');
      const panel = rect('#torch-menu');
      const screen = rect('.inventory-screen');
      return {
        panel,
        screen,
        noScreenScroll: noScroll('.inventory-screen'),
        noContentScroll: noScroll('.inventory-content'),
        noGridScroll: noScroll('.inventory-grid'),
        noDetailScroll: !document.querySelector('.inventory-detail') || noScroll('.inventory-detail'),
        noPaginationScroll: noScroll('.inventory-pagination'),
        filterInsideToolbar: Boolean(
          filter && toolbar && filter.left >= toolbar.left - 1 && filter.right <= toolbar.right + 1,
        ),
      };
    });
    expect(geometry.noScreenScroll).toBe(true);
    // A short/landscape surface may need the finite grid/detail row to scroll
    // as one explicit owner; it must remain reachable rather than be clipped.
    expect(geometry.noContentScroll).toBe(viewport.height >= 500);
    expect(geometry.noGridScroll).toBe(true);
    expect(geometry.noDetailScroll).toBe(true);
    expect(geometry.noPaginationScroll).toBe(true);
    expect(geometry.filterInsideToolbar).toBe(true);
    expect(geometry.panel?.bottom ?? Infinity).toBeLessThanOrEqual(viewport.height + 1);
    expect(geometry.screen?.bottom ?? Infinity).toBeLessThanOrEqual((geometry.panel?.bottom ?? 0) + 1);

    if (viewport.width <= 720) {
      await page.locator('[data-testid^="inventory-item-"]').first().click();
      await expect(page.locator('.inventory-screen')).toHaveClass(/is-detail-open/);
      await expect(page.getByTestId('inventory-detail-back')).toBeVisible();
      const detailGeometry = await page.evaluate(() => {
        const noScroll = (selector: string): boolean => {
          const element = document.querySelector<HTMLElement>(selector);
          return element
            ? element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1
            : false;
        };
        const panel = document.querySelector<HTMLElement>('#torch-menu')?.getBoundingClientRect();
        const screen = document.querySelector<HTMLElement>('.inventory-screen')?.getBoundingClientRect();
        return {
          noScreenScroll: noScroll('.inventory-screen'),
          noContentScroll: noScroll('.inventory-content'),
          noDetailScroll: noScroll('.inventory-detail'),
          panelBottom: panel?.bottom ?? Infinity,
          screenBottom: screen?.bottom ?? Infinity,
        };
      });
      expect(detailGeometry.noScreenScroll).toBe(true);
      expect(detailGeometry.noContentScroll).toBe(true);
      expect(detailGeometry.noDetailScroll).toBe(true);
      expect(detailGeometry.screenBottom).toBeLessThanOrEqual(detailGeometry.panelBottom + 1);
      expect(detailGeometry.panelBottom).toBeLessThanOrEqual(viewport.height + 1);
      await page.getByTestId('inventory-detail-back').click();
      await expect(page.locator('.inventory-screen')).not.toHaveClass(/is-detail-open/);
      await expect(page.locator('[data-testid^="inventory-item-"]').first()).toBeFocused();
    }

    await page.getByTestId('close-menu').click();
  }
});

test('keeps Options navigable across supported viewports', async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 600 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-settings').click();
    await expect(page.getByRole('dialog', { name: 'Options' })).toBeVisible();

    const layout = await page.evaluate(() => {
      const rect = (selector: string): DOMRect | undefined =>
        document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
      const panel = rect('#torch-menu');
      const screen = rect('.options-screen');
      const footer = rect('.options-footer');
      const tabs = [...document.querySelectorAll<HTMLElement>('.options-nav [role="tab"]')].map((tab) =>
        tab.getBoundingClientRect(),
      );
      const options = document.querySelector<HTMLElement>('.options-screen');
      const tabsRoot = document.querySelector<HTMLElement>('.options-screen');
      const optionsBody = document.querySelector<HTMLElement>('.options-body');
      return {
        panel,
        screen,
        footer,
        noHorizontalOverflow: options ? options.scrollWidth <= options.clientWidth + 1 : false,
        tabsHaveHitArea: tabs.length === 5 && tabs.every((tab) => tab.width >= 42 && tab.height >= 42),
        tabsOrientation: tabsRoot?.getAttribute('data-orientation') ?? '',
        optionsBodyWidth: optionsBody?.clientWidth ?? 0,
      };
    });

    expect(layout.noHorizontalOverflow).toBe(true);
    expect(layout.tabsHaveHitArea).toBe(true);
    expect(layout.tabsOrientation).toBe(layout.optionsBodyWidth <= 720 ? 'horizontal' : 'vertical');
    expect(layout.screen?.left ?? -Infinity).toBeGreaterThanOrEqual((layout.panel?.left ?? 0) - 1);
    expect(layout.screen?.right ?? Infinity).toBeLessThanOrEqual((layout.panel?.right ?? 0) + 1);
    expect(layout.footer?.bottom ?? Infinity).toBeLessThanOrEqual((layout.panel?.bottom ?? 0) + 1);
    await page.getByTestId('close-menu').click();
  }
});

test('reflows an open surface after a live viewport resize', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1024 });
  await page.goto('/');
  await page.getByTestId('hud-inventory-button').click();
  await expect(page.locator('.inventory-screen')).toHaveClass(/inventory-layout-wide/);

  await page.setViewportSize({ width: 520, height: 844 });
  await expect(page.locator('.inventory-screen')).toHaveClass(/inventory-layout-compact/, { timeout: 5_000 });
  const compactBounds = await page.locator('#torch-menu').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  });
  expect(compactBounds.left).toBeGreaterThanOrEqual(0);
  expect(compactBounds.top).toBeGreaterThanOrEqual(0);
  expect(compactBounds.right).toBeLessThanOrEqual(521);
  expect(compactBounds.bottom).toBeLessThanOrEqual(845);

  await page.setViewportSize({ width: 1024, height: 600 });
  await expect(page.locator('.inventory-screen')).toHaveClass(/inventory-layout-short/, { timeout: 5_000 });
  await expect(page.getByTestId('inventory-page-next')).toBeVisible();
});

test('keeps the Ability workspace readable across supported viewports', async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 600 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByTestId('hud-abilities-button').click();
    await expect(page.getByTestId('abilities-screen')).toBeVisible({ timeout: 15_000 });
    await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLImageElement>('.ability-loadout-card img')].every(
        (image) => image.naturalWidth > 0 && image.naturalHeight > 0,
      ),
    );

    const layout = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('#torch-menu');
      const screen = document.querySelector<HTMLElement>('[data-testid="abilities-screen"]');
      const inspector = document.querySelector<HTMLElement>('[data-testid="ability-inspector"]');
      const cards = [...document.querySelectorAll<HTMLElement>('.ability-loadout-card')];
      const images = [...document.querySelectorAll<HTMLImageElement>('.ability-loadout-card img')];
      const controls = [...document.querySelectorAll<HTMLElement>('[data-testid="abilities-screen"] button')];
      const panelRect = panel?.getBoundingClientRect();
      const screenRect = screen?.getBoundingClientRect();
      const inspectorRect = inspector?.getBoundingClientRect();
      return {
        panelInsideViewport: Boolean(
          panelRect &&
          panelRect.left >= 0 &&
          panelRect.top >= 0 &&
          panelRect.right <= window.innerWidth + 1 &&
          panelRect.bottom <= window.innerHeight + 1,
        ),
        screenInsidePanel: Boolean(
          panelRect &&
          screenRect &&
          screenRect.left >= panelRect.left &&
          screenRect.right <= panelRect.right + 1 &&
          screenRect.bottom <= panelRect.bottom + 1,
        ),
        inspectorAbsent: !inspectorRect,
        cardsHaveReadableWidth: cards.length === 3 && cards.every((card) => card.getBoundingClientRect().width >= 42),
        artKeepsRatio:
          images.length === 3 &&
          images.every(
            (image) =>
              Math.abs(image.getBoundingClientRect().width / image.getBoundingClientRect().height - 3 / 4) <= 0.02,
          ),
        controlsHaveHitArea: controls.every(
          (control) => control.getBoundingClientRect().width >= 42 && control.getBoundingClientRect().height >= 42,
        ),
      };
    });

    expect(layout.panelInsideViewport).toBe(true);
    expect(layout.screenInsidePanel).toBe(true);
    expect(layout.inspectorAbsent).toBe(true);
    expect(layout.cardsHaveReadableWidth).toBe(true);
    expect(layout.artKeepsRatio).toBe(true);
    expect(layout.controlsHaveHitArea).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByTestId('hud-abilities-button').click();
  await page.getByTestId('ability-slot-skill').locator('.ability-art-button').click();
  await expect(page.getByTestId('ability-picker')).toBeVisible();
  await expect(page.getByTestId('ability-picker-back')).toBeFocused();
  await page.getByTestId('ability-picker-back').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('ability-picker')).toHaveCount(0);
});

test('keeps pointer-to-tile mapping aligned with the high-DPI backing surface', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.goto('/');
  const canvas = page.locator('#game canvas');
  await expect(canvas).toBeVisible();

  const metrics = await canvas.evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }));
  const tileSize = Math.min(metrics.width, metrics.height) / 7;
  await canvas.click({ position: { x: metrics.width / 2 + tileSize, y: metrics.height / 2 } });

  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-map').click();
  await expect(page.getByRole('img', { name: /Explored terrain map/ })).toBeVisible();
  await expect(page.getByTestId('map-grid')).toHaveAttribute('aria-label', 'Explored terrain map with Hero at 1, 2');
});

test('keeps the fixed Hero shell contained across landscape and portrait viewports', async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 600 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 320, height: 568 },
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
        artBottom: imageRect?.bottom ?? 0,
        statsLeft: statsRect?.left ?? 0,
        statsTop: statsRect?.top ?? 0,
        artWidth: imageRect?.width ?? 0,
        statsWidth: statsRect?.width ?? 0,
        gridColumns: getComputedStyle(details as HTMLElement).gridTemplateColumns,
        statColumns: [...document.querySelectorAll<HTMLElement>('.stat-row')].map((row) =>
          Math.round(row.getBoundingClientRect().left),
        ),
        renderedRatio: imageRect ? imageRect.width / imageRect.height : 0,
        nativeRatio: image && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 0,
      };
    });
    expect(layout.panelBottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(layout.imageBottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(layout.panelScrollHeight).toBe(layout.panelClientHeight);
    expect(layout.renderedRatio).toBeCloseTo(layout.nativeRatio, 2);
    // The fixed shell centers native-ratio art inside its equal-width column;
    // it no longer stretches the art to the column edge.
    expect(layout.artLeftInset).toBeGreaterThanOrEqual(0);
    expect(layout.statsRightInset).toBeGreaterThanOrEqual(0);
    expect(layout.artWidth).toBeGreaterThan(0);
    expect(layout.statsWidth).toBeGreaterThan(0);
    expect(new Set(layout.statColumns).size).toBe(1);
    if (layout.gridColumns.split(' ').length > 1) {
      expect(layout.artRight).toBeLessThanOrEqual(layout.statsLeft + 1);
    } else {
      expect(layout.artBottom).toBeLessThanOrEqual(layout.statsTop + 1);
    }
  }
});

test('shows contextual action cards for gathering and combat', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.getByTestId('hud-hero-button')).toBeVisible();
  await page.waitForTimeout(400);
  const cardPlayLab = page.getByTestId('card-play-lab');
  const hasCardPlayLab = (await cardPlayLab.count()) > 0;
  if (hasCardPlayLab) {
    await expect(cardPlayLab).toBeVisible();
    await expect(page.getByTestId('card-play-preset-trinket')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('card-play-replay')).toHaveCount(0);
    await expect(page.getByTestId('card-play-compare')).toHaveCount(0);
    await expect(page.getByTestId('card-play-slow-motion')).toHaveCount(0);
    for (const presetId of ['alchemy']) {
      const preset = page.getByTestId(`card-play-preset-${presetId}`);
      await preset.click();
      await expect(preset).toHaveAttribute('aria-checked', 'true');
    }
    await page.getByTestId('card-play-preset-trinket').click();
    const labPlacement = await page.evaluate(() => {
      const lab = document.querySelector<HTMLElement>('[data-testid="card-play-lab"]')?.getBoundingClientRect();
      const perf = document.querySelector<HTMLElement>('[data-testid="dev-performance"]')?.getBoundingClientRect();
      return {
        labLeft: lab?.left ?? 0,
        labTop: lab?.top ?? 0,
        labRight: lab?.right ?? 0,
        labBottom: lab?.bottom ?? 0,
        perfBottom: perf?.bottom ?? 0,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(labPlacement.labLeft).toBeGreaterThanOrEqual(0);
    expect(labPlacement.labTop).toBeGreaterThanOrEqual(labPlacement.perfBottom);
    expect(labPlacement.labRight).toBeLessThanOrEqual(labPlacement.viewportWidth);
    expect(labPlacement.labBottom).toBeLessThanOrEqual(labPlacement.viewportHeight);
  }
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight');
  const chopCard = page.getByTestId('context-action-card-context-entity-resource-tree-chop');
  await expect(chopCard).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chop at Old Pine' })).toBeVisible();

  const handLayout = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.context-action-card');
    const hand = document.querySelector<HTMLElement>('.context-action-hand');
    const rail = document.querySelector<HTMLElement>('.hud-rail');
    return {
      cardBottom: card?.getBoundingClientRect().bottom ?? 0,
      railTop: rail?.getBoundingClientRect().top ?? 0,
      railBottom: rail?.getBoundingClientRect().bottom ?? 0,
      handBottom: hand?.getBoundingClientRect().bottom ?? 0,
      handZ: hand ? Number.parseInt(getComputedStyle(hand).zIndex, 10) : 0,
      railZ: rail ? Number.parseInt(getComputedStyle(rail).zIndex, 10) : 0,
    };
  });
  expect(handLayout.cardBottom).toBeGreaterThan(handLayout.railTop);
  expect(handLayout.cardBottom).toBeLessThanOrEqual(handLayout.railBottom);
  expect(handLayout.handBottom).toBeGreaterThan(handLayout.railTop);
  expect(handLayout.railZ).toBeGreaterThan(handLayout.handZ);

  // Let the card enter its ready state before activating it directly. This
  // keeps the assertion focused on the action-hand feedback contract rather
  // than keyboard repeat timing.
  await expect(chopCard).toHaveAttribute('data-card-animation-phase', 'idle');
  await chopCard.evaluate((element) => {
    (window as Window & { __torchCardNode?: HTMLElement }).__torchCardNode = element as HTMLElement;
  });
  await chopCard.click();
  await expect(chopCard).toHaveClass(/is-playing/);
  const playingCardAnimation = await chopCard.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      name: style.animationName,
      duration: style.animationDuration,
    };
  });
  expect(playingCardAnimation.name).toBe('torch-card-play-trinket');
  expect(playingCardAnimation.duration).not.toBe('0s');
  const playingCardGeometry = await chopCard.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const hand = document.querySelector<HTMLElement>('.context-action-hand')?.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      radius: Number.parseFloat(style.borderTopLeftRadius),
      handBottom: hand?.bottom ?? 0,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      sameNode: (window as Window & { __torchCardNode?: HTMLElement }).__torchCardNode === element,
    };
  });
  expect(playingCardGeometry.sameNode).toBe(true);
  expect(playingCardGeometry.radius).toBeGreaterThanOrEqual(12);
  expect(playingCardGeometry.left).toBeGreaterThanOrEqual(-1);
  expect(playingCardGeometry.right).toBeLessThanOrEqual(playingCardGeometry.viewportWidth + 1);
  expect(playingCardGeometry.top).toBeGreaterThanOrEqual(-1);
  expect(playingCardGeometry.bottom).toBeLessThanOrEqual(playingCardGeometry.viewportHeight + 1);
  expect(playingCardGeometry.handBottom).toBeGreaterThanOrEqual(playingCardGeometry.bottom - 2);
  await expect(chopCard).toHaveAttribute('data-card-play-state', 'playing');
  await expect(chopCard).toHaveAttribute('data-card-animation-preset', 'trinket');
  await expect(chopCard).toHaveAttribute('data-card-animation-phase', 'play');
  await expect(chopCard).toHaveAttribute('data-card-play-key', 'entity:chop');
  await expect(chopCard.getByRole('status')).toHaveText('Resolving…');
  await expect(page.getByTestId('card-animation-transfer')).toHaveCount(0);
  await expect(chopCard).toContainText('Old Pine');
  await expect(chopCard).not.toContainText('Target');

  await page.evaluate(() => {
    document.documentElement.dataset.reduceMotion = 'true';
  });

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Bash against Forest Slime' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sunder against Forest Slime' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avatar against Forest Slime' })).toBeVisible();

  const sunderCard = page.getByRole('button', { name: 'Sunder against Forest Slime' });
  await sunderCard.click();
  await expect(sunderCard).toHaveAttribute('data-card-animation-preset', 'trinket');
  await expect(sunderCard).toHaveAttribute('data-card-animation-phase', 'play');
  await expect(sunderCard).toHaveCount(0, { timeout: 2500 });
  const defaultAbilityCard = page.getByTestId('context-action-card-context-ability-ability.avatar');
  await expect(defaultAbilityCard).toBeVisible();
  await defaultAbilityCard.click();
  await expect(defaultAbilityCard).toHaveAttribute('data-card-animation-phase', 'play');
  await expect(defaultAbilityCard).toHaveAttribute('data-card-animation-preset', 'trinket');
  await expect(defaultAbilityCard).toHaveCount(0, { timeout: 2500 });
});

test('persists an action-boundary world and restores it after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hud-hero-button')).toBeVisible();

  await page.waitForTimeout(350);
  await page.keyboard.press('d');
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.getByTestId('hud-hero-button')).toBeVisible();

  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-map').click();
  await expect(page.getByTestId('map-grid')).toHaveAttribute('aria-label', 'Explored terrain map with Hero at 1, 2');
});

test('keeps the Journal usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-journal').click();
  await expect(page.getByTestId('journal-screen')).toBeVisible();
  await expect(page.getByTestId('journal-tab-guide')).toBeVisible();
  await expect(page.getByTestId('journal-entry-quest.gathering-trail')).toBeVisible();
  await expect(page.getByTestId('journal-entry-quest.gathering-trail')).toHaveAttribute(
    'aria-controls',
    'journal-entry-panel-quest-gathering-trail',
  );
  await page.getByTestId('journal-entry-quest.gathering-trail').click();
  await expect(page.getByRole('heading', { name: 'A Practical Trail' })).toBeFocused();
  await expect(page.getByTestId('journal-detail-back')).toBeVisible();
  await page.getByTestId('journal-detail-back').click();
  await expect(page.getByTestId('journal-entry-quest.gathering-trail')).toBeFocused();
  const containment = await page.locator('.menu-panel').evaluate((panel) => ({
    scrollWidth: panel.scrollWidth,
    clientWidth: panel.clientWidth,
    journal: document.querySelector<HTMLElement>('.journal-screen')?.getBoundingClientRect(),
  }));
  expect(containment.scrollWidth).toBeLessThanOrEqual(containment.clientWidth + 1);
  expect(containment.journal?.width ?? 0).toBeGreaterThan(0);
});
