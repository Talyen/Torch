import { expect, test } from '@playwright/test';

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
  await page.keyboard.press('g');
  await page.waitForTimeout(350);

  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-crafting').click();
  await expect(page.getByRole('dialog', { name: 'Crafting' })).toBeVisible();
  await expect(page.getByTestId('crafting-screen')).toBeVisible();

  await page.getByTestId('crafting-recipe-recipe.wood-plank').click();
  await expect(page.getByTestId('crafting-craft')).toBeEnabled();
  await page.getByTestId('crafting-craft').click();
  await expect(page.getByTestId('crafting-screen')).toContainText('Crafted 4 Wood Planks.');

  await page.getByTestId('close-menu').click();
  await page.getByTestId('hud-inventory-button').click();
  await page.getByTestId('inventory-tab-resources').click();
  await expect(page.getByTestId('inventory-item-wood-plank')).toHaveAttribute('aria-label', 'Wood Plank, quantity 4');
});
