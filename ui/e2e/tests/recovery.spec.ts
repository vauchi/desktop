// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect } from '@playwright/test';
import { tauriMockScript } from '../fixtures/tauri-mock';
import { setupTestUser, navigateTo } from '../fixtures/test-helpers';

// CRIT-10b: Recovery page coverage

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ content: tauriMockScript() });
  await setupTestUser(page);
});

/** Navigate to Recovery page via Settings */
async function goToRecovery(page: import('@playwright/test').Page): Promise<void> {
  await navigateTo(page, 'Settings');
  await page.waitForSelector('.page.settings', { timeout: 10000 });
  await page.click('button[aria-label="Configure recovery options"]');
  await page.waitForSelector('.page.recovery', { timeout: 10000 });
}

test.describe('Recovery Page - Menu', () => {
  test('should display recovery page with title', async ({ page }) => {
    await goToRecovery(page);

    await expect(page.locator('#recovery-title')).toBeVisible();
  });

  test('should show Create Claim and Vouch options', async ({ page }) => {
    await goToRecovery(page);

    await expect(
      page.locator('[aria-label*="Create Recovery Claim"]')
    ).toBeVisible();
    await expect(
      page.locator('[aria-label*="Vouch for Contact"]')
    ).toBeVisible();
  });

  test('should show How it Works section with steps', async ({ page }) => {
    await goToRecovery(page);

    await expect(page.locator('#how-recovery-works-title')).toBeVisible();
    // Should have 5 recovery steps
    const steps = page.locator('ol[aria-label="Recovery process steps"] li');
    await expect(steps).toHaveCount(5);
  });

  test('should navigate back to home from menu', async ({ page }) => {
    await goToRecovery(page);

    await page.click('button[aria-label="Go back to home"]');
    await expect(page.locator('.page.home')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Recovery Page - Create Claim', () => {
  test('should enter claim mode and show form', async ({ page }) => {
    await goToRecovery(page);

    await page.click('[aria-label*="Create Recovery Claim"]');

    await expect(page.locator('#create-claim-title')).toBeVisible();
    await expect(page.locator('#old-pk-input')).toBeVisible();
    await expect(
      page.locator('button[aria-label="Generate recovery claim"]')
    ).toBeVisible();
  });

  test('should show error when submitting empty key', async ({ page }) => {
    await goToRecovery(page);

    await page.click('[aria-label*="Create Recovery Claim"]');
    await page.click('button[aria-label="Generate recovery claim"]');

    await expect(page.locator('.error')).toContainText('public key');
  });

  test('should generate claim with valid key', async ({ page }) => {
    await goToRecovery(page);

    await page.click('[aria-label*="Create Recovery Claim"]');
    await page.fill('#old-pk-input', 'ab'.repeat(32));
    await page.click('button[aria-label="Generate recovery claim"]');

    // Should show claim data result
    await expect(page.locator('.claim-data')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.success')).toContainText('created');
  });

  test('should go back to menu from claim mode', async ({ page }) => {
    await goToRecovery(page);

    await page.click('[aria-label*="Create Recovery Claim"]');
    await expect(page.locator('#create-claim-title')).toBeVisible();

    // Back button should return to menu
    await page.click('button[aria-label="Go back to recovery menu"]');
    await expect(
      page.locator('[aria-label*="Create Recovery Claim"]')
    ).toBeVisible();
  });
});

test.describe('Recovery Page - Vouch', () => {
  test('should enter vouch mode and show form', async ({ page }) => {
    await goToRecovery(page);

    await page.click('[aria-label*="Vouch for Contact"]');

    await expect(page.locator('#vouch-title')).toBeVisible();
    await expect(page.locator('#vouch-input')).toBeVisible();
    await expect(
      page.locator('button[aria-label="Verify the recovery claim"]')
    ).toBeVisible();
  });

  test('should show error when verifying empty claim', async ({ page }) => {
    await goToRecovery(page);

    await page.click('[aria-label*="Vouch for Contact"]');
    await page.click('button[aria-label="Verify the recovery claim"]');

    await expect(page.locator('.error')).toContainText('claim');
  });

  test('should parse and display claim details', async ({ page }) => {
    await goToRecovery(page);

    await page.click('[aria-label*="Vouch for Contact"]');
    await page.fill('#vouch-input', 'mock-claim-b64-data');
    await page.click('button[aria-label="Verify the recovery claim"]');

    // Should show claim details
    await expect(page.locator('#claim-details-title')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('text=Old Identity')).toBeVisible();
    await expect(page.locator('text=New Identity')).toBeVisible();
  });
});
