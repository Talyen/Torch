import { expect, test } from './fixtures';

test('gathers a resource, crafts a batch, and reflects the result in Inventory', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.waitForTimeout(400);

  // The authored tree begins three tiles east of the hero. Walking into it
  // resolves the one-action chop interaction without adding a setup screen.
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(350);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(350);
  const chopCard = page.getByTestId('context-action-card-context-entity-resource-tree-chop');
  await expect(chopCard).toBeVisible();
  await page.keyboard.press('g');
  await expect(chopCard).toHaveAttribute('data-card-play-state', 'playing');

  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-crafting').click();
  await expect(page.getByRole('dialog', { name: 'Crafting' })).toBeVisible();
  await expect(page.getByTestId('crafting-screen')).toBeVisible();
  await expect(page.getByTestId('crafting-station-status')).toContainText('Expedition crafting');
  await page.getByTestId('crafting-recipe-recipe.iron-axe').click();
  await expect(page.getByTestId('crafting-inspector')).toContainText('Requires Workbench');
  await expect(page.getByTestId('crafting-craft')).toBeDisabled();

  await page.getByTestId('crafting-recipe-recipe.wood-plank').click();
  await expect(page.getByTestId('crafting-craft')).toBeEnabled();
  await page.getByTestId('crafting-craft').click();
  await expect(page.getByTestId('crafting-screen')).toContainText('Crafted 4 Wood Planks.');

  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-inventory-button').click();
  await page.getByTestId('inventory-filter').click();
  await page.getByTestId('inventory-tab-resources').click();
  await expect(page.getByTestId('inventory-item-wood-plank')).toHaveAttribute('aria-label', 'Wood Plank, quantity 4');
});
