import { expect, test } from './fixtures';

test('keeps canonical Gear readable across supported viewports', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1170, height: 624 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByTestId('hud-gear-button').click();
    await expect(page.getByTestId('equipment-screen')).toBeVisible();
    await expect(page.getByTestId('equipment-tab')).toHaveAttribute('aria-selected', 'true');

    const gearTabHitAreas = await page.locator('.gear-tabs [role="tab"]').evaluateAll((tabs) =>
      tabs.map((tab) => {
        const rect = tab.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    );
    expect(gearTabHitAreas).toHaveLength(2);
    expect(gearTabHitAreas.every(({ width, height }) => width >= 42 && height >= 42)).toBe(true);

    const containment = await page.locator('#torch-menu').evaluate((panel) => {
      const screen = panel.querySelector<HTMLElement>('.gear-screen')?.getBoundingClientRect();
      const paneElement = panel.querySelector<HTMLElement>('.gear-loadout-pane');
      const pane = paneElement?.getBoundingClientRect();
      const slots = [...panel.querySelectorAll<HTMLElement>('.equipment-slot')]
        .filter((slot) => !slot.hidden && slot.getBoundingClientRect().width > 0)
        .map((slot) => {
          const rect = slot.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });
      return {
        scrollWidth: panel.scrollWidth,
        clientWidth: panel.clientWidth,
        slots,
        screen,
        pane,
        paneScrollHeight: paneElement?.scrollHeight ?? 0,
        paneClientHeight: paneElement?.clientHeight ?? 0,
      };
    });

    expect(containment.scrollWidth).toBeLessThanOrEqual(containment.clientWidth + 1);
    expect(containment.slots).toHaveLength(10);
    expect(containment.screen).toBeTruthy();
    expect(containment.pane).toBeTruthy();
    const contentBottom =
      (containment.pane?.top ?? 0) + Math.max(containment.paneScrollHeight, containment.paneClientHeight);
    expect(
      containment.slots.every(
        (slot) =>
          slot.left >= (containment.screen?.left ?? 0) - 1 &&
          slot.right <= (containment.screen?.right ?? 0) + 1 &&
          slot.top >= (containment.pane?.top ?? 0) - 1 &&
          slot.bottom <= contentBottom + 1,
      ),
    ).toBe(true);

    await page.getByTestId('tools-tab').click();
    await expect(page.getByTestId('tool-slot-axe')).toBeVisible();
    const toolContainment = await page.locator('#torch-menu').evaluate((panel) => {
      const screen = panel.querySelector<HTMLElement>('.gear-screen')?.getBoundingClientRect();
      const pane = panel
        .querySelector<HTMLElement>('.gear-tab-panel:not([inert]) .gear-loadout-pane')
        ?.getBoundingClientRect();
      const slots = [...panel.querySelectorAll<HTMLElement>('.tool-slot')]
        .filter((slot) => !slot.hidden && slot.getBoundingClientRect().width > 0)
        .map((slot) => {
          const rect = slot.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });
      return { slots, screen, pane };
    });
    expect(toolContainment.slots).toHaveLength(4);
    expect(
      toolContainment.slots.every(
        (slot) =>
          slot.left >= (toolContainment.screen?.left ?? 0) - 1 &&
          slot.right <= (toolContainment.screen?.right ?? 0) + 1 &&
          slot.top >= (toolContainment.pane?.top ?? 0) - 1 &&
          slot.bottom <= (toolContainment.pane?.bottom ?? 0) + 1,
      ),
    ).toBe(true);

    await page.getByTestId('close-menu').click();
  }
});

test('keeps selector and Unequip controls at least 42px across supported viewports', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1170, height: 624 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByTestId('hud-gear-button').click();
    await expect(page.getByTestId('equipment-screen')).toBeVisible();

    await page.getByTestId('equipment-slot-main-hand').click();
    await expect(page.getByTestId('equipment-picker')).toBeVisible();
    const equipmentSelectorHitAreas = await page
      .getByTestId('equipment-picker')
      .locator('button')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
    expect(equipmentSelectorHitAreas.length).toBeGreaterThan(0);
    expect(equipmentSelectorHitAreas.every(({ width, height }) => width >= 42 && height >= 42)).toBe(true);

    await page.getByTestId('equipment-choice-iron-sword').click();
    await page.getByTestId('equipment-slot-main-hand').click();
    await expect(page.getByTestId('equipment-unequip')).toBeVisible();
    const equipmentUnequipHitArea = await page.getByTestId('equipment-unequip').evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(equipmentUnequipHitArea.width).toBeGreaterThanOrEqual(42);
    expect(equipmentUnequipHitArea.height).toBeGreaterThanOrEqual(42);
    await page.getByTestId('equipment-unequip').click();
    await expect(page.getByTestId('equipment-picker')).toHaveCount(0);

    await page.getByTestId('tools-tab').click();
    await page.getByTestId('tool-slot-axe').click();
    await expect(page.getByTestId('tool-picker')).toBeVisible();
    const toolSelectorHitAreas = await page
      .getByTestId('tool-picker')
      .locator('button')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
    expect(toolSelectorHitAreas.length).toBeGreaterThan(0);
    expect(toolSelectorHitAreas.every(({ width, height }) => width >= 42 && height >= 42)).toBe(true);

    await page.getByTestId('tool-choice-iron-axe').click();
    await page.getByTestId('tool-slot-axe').click();
    await expect(page.getByTestId('tool-unequip')).toBeVisible();
    const toolUnequipHitArea = await page.getByTestId('tool-unequip').evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(toolUnequipHitArea.width).toBeGreaterThanOrEqual(42);
    expect(toolUnequipHitArea.height).toBeGreaterThanOrEqual(42);
    await page.getByTestId('tool-unequip').click();
    await expect(page.getByTestId('tool-picker')).toHaveCount(0);
    await page.getByTestId('close-menu').click();
  }
});
