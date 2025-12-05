const { test, expect } = require('@playwright/test');

test('User can create a TODO item', async ({ page }) => {
  // Login first
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'TestPass123');
  await page.click('button[type="submit"]');

  await page.goto('http://localhost:3000/todo');

  await page.fill('input[name="title"]', 'Playwright TODO');
  await page.fill('textarea[name="description"]', 'This is a Playwright test item.');

  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('http://localhost:3000/todos');
  await expect(page.getByText('Playwright TODO')).toBeVisible();
});