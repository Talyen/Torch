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
