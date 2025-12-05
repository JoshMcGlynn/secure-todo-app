const { test, expect } = require('@playwright/test');

test('User can log in', async ({ page }) => {
  await page.goto('http://localhost:3000/login');

  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'TestPass123');
  
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('http://localhost:3000/');
});