import { expect, test, type Page } from './fixtures';

async function expectActiveTabVisible(page: Page, selector: string) {
  const readMetrics = () =>
    page.locator(selector).evaluate((list: HTMLElement) => {
      const active = list.querySelector<HTMLElement>('[aria-selected="true"]');
      const listRect = list.getBoundingClientRect();
      const activeRect = active?.getBoundingClientRect();
      return {
        active: active?.textContent?.trim(),
        visible:
          Boolean(activeRect) && activeRect!.left >= listRect.left - 1 && activeRect!.right <= listRect.right + 1,
      };
    });
  await expect.poll(async () => (await readMetrics()).visible).toBe(true);
  const metrics = await readMetrics();
  expect(metrics.active).toBeTruthy();
}

async function expectSurfaceTitle(page: Page, title: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  const heading = dialog.locator('.menu-header').getByRole('heading', { name: title, exact: true });
  await expect(heading).toHaveCount(1);
  await expect(heading).toBeVisible();
}

async function expectNoBodyOverflow(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
}

test('keeps compact tabs discoverable and active tabs visible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');

  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-journal').click();
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible();
  await expectActiveTabVisible(page, '.journal-tabs');
  await page.getByRole('tab', { name: 'Guide', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Guide', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectActiveTabVisible(page, '.journal-tabs');
  await page.getByTestId('close-menu').click();

  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-crafting').click();
  await expect(page.getByRole('dialog', { name: 'Crafting' })).toBeVisible();
  await expectActiveTabVisible(page, '.crafting-category-tabs');
  await page.getByTestId('crafting-category-structures').click();
  await expect(page.getByTestId('crafting-category-structures')).toHaveAttribute('aria-selected', 'true');
  await expectActiveTabVisible(page, '.crafting-category-tabs');
  await page.getByTestId('close-menu').click();

  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-settings').click();
  await expect(page.getByRole('dialog', { name: 'Options' })).toBeVisible();
  await expectActiveTabVisible(page, '.options-nav');
  await page.getByTestId('settings-tab-accessibility').click();
  await expect(page.getByTestId('settings-tab-accessibility')).toHaveAttribute('aria-selected', 'true');
  await expectActiveTabVisible(page, '.options-nav');
  await page.getByTestId('close-menu').click();
});

test('uses surface-specific close names and Torch focus styling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const hudSurfaces = [
    ['hud-hero-button', 'Hero'],
    ['hud-inventory-button', 'Inventory'],
    ['hud-gear-button', 'Equipment'],
    ['hud-abilities-button', 'Abilities'],
  ] as const;
  for (const [testId, title] of hudSurfaces) {
    await page.getByTestId(testId).click();
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    await expect(page.getByRole('button', { name: `Close ${title}`, exact: true })).toBeVisible();
    await page.getByTestId('close-menu').click();
  }

  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-journal').click();
  await page.getByTestId('journal-entry-quest.gathering-trail').click();
  await expect(page.getByTestId('journal-detail-back')).toBeVisible();
  const headingFocus = await page.getByTestId('journal-detail-back').evaluate(() => {
    const heading = document.querySelector<HTMLElement>('#journal-detail-title');
    if (!heading) return undefined;
    heading.focus();
    const style = getComputedStyle(heading);
    return { outline: style.outline, outlineColor: style.outlineColor };
  });
  expect(headingFocus?.outlineColor).toBe('rgb(242, 196, 99)');
  await page.getByTestId('close-menu').click();

  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-settings').click();
  await page.getByTestId('settings-tab-audio').click();
  const slider = page.getByRole('slider', { name: 'Master Volume', exact: true });
  await slider.click();
  const sliderFocus = await slider.evaluate((element) => {
    const style = getComputedStyle(element);
    return { boxShadow: style.boxShadow, active: document.activeElement === element };
  });
  expect(sliderFocus.active).toBe(true);
  expect(sliderFocus.boxShadow).toContain('rgba(242, 196, 99');
});

test('keeps the menu and key surfaces titled once at the compact width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');

  await expectNoBodyOverflow(page);
  await page.getByTestId('menu-button').click();
  await expectSurfaceTitle(page, 'Menu');
  await expectNoBodyOverflow(page);

  const hudSurfaces = [
    ['hud-hero-button', 'Hero'],
    ['hud-inventory-button', 'Inventory'],
    ['hud-gear-button', 'Equipment'],
    ['hud-abilities-button', 'Abilities'],
  ] as const;
  await page.getByTestId('close-menu').click();
  for (const [testId, title] of hudSurfaces) {
    await page.getByTestId(testId).click();
    await expectSurfaceTitle(page, title);
    await expectNoBodyOverflow(page);
    await page.getByTestId('close-menu').click();
  }

  const menuSurfaces = [
    ['menu-map', 'Map'],
    ['menu-crafting', 'Crafting'],
    ['menu-journal', 'Journal'],
    ['menu-settings', 'Options'],
  ] as const;
  for (const [testId, title] of menuSurfaces) {
    await page.getByTestId('menu-button').click();
    await page.getByTestId(testId).click();
    await expectSurfaceTitle(page, title);
    await expectNoBodyOverflow(page);
    await page.getByTestId('close-menu').click();
  }
});

test('keeps development diagnostics hidden unless explicitly enabled', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('card-play-lab')).toHaveCount(0);
  await expect(page.getByTestId('dev-performance')).toHaveCount(0);

  test.skip(process.env.TORCH_E2E_PROD === '1', 'Development diagnostics are not available in production previews.');

  await page.goto('/?dev=card-play-lab');
  const cardPlayLab = page.getByTestId('card-play-lab');
  await expect(cardPlayLab).toBeVisible();
  await expect(page.getByTestId('dev-performance')).toHaveCount(0);
  await expect(page.getByTestId('card-play-preset-trinket')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('card-play-preset-alchemy').click();
  await expect(page.getByTestId('card-play-preset-alchemy')).toHaveAttribute('aria-checked', 'true');

  await page.goto('/?dev=frame-monitor');
  await expect(page.getByTestId('card-play-lab')).toHaveCount(0);
  const performancePanel = page.getByTestId('dev-performance');
  await expect(performancePanel).toBeVisible();
  await expect.poll(async () => performancePanel.textContent()).toMatch(/^\d+ FPS$/);

  await page.goto('/?dev=card-play-lab&dev=frame-monitor');
  await expect(page.getByTestId('card-play-lab')).toBeVisible();
  await expect(page.getByTestId('dev-performance')).toBeVisible();
});
