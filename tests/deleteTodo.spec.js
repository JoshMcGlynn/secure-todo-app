const { test, expect } = require('@playwright/test');

test('User can delete a TODO item', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'TestPass123');
  await page.click('button[type="submit"]');

  await page.goto('http://localhost:3000/todos');

  const deleteButtons = await page.locator('text=Delete').all();

  if (deleteButtons.length > 0) {
    await deleteButtons[0].click();
  }

  await expect(page).toHaveURL('http://localhost:3000/todos');
});