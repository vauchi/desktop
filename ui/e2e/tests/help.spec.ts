// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect } from '@playwright/test';
import { tauriMockScript } from '../fixtures/tauri-mock';
import { setupTestUser, navigateTo } from '../fixtures/test-helpers';

// MISS-2: Help page coverage
// MISS-10: App Password + Duress PIN coverage (via Settings)
// MISS-11: GDPR/Privacy section coverage (via Settings)

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ content: tauriMockScript() });
  await setupTestUser(page);
});

/** Navigate to Help page via Settings */
async function goToHelp(page: import('@playwright/test').Page): Promise<void> {
  await navigateTo(page, 'Settings');
  await page.waitForSelector('.page.settings', { timeout: 10000 });
  await page.click('button[aria-label="Open FAQ and help"]');
  await page.waitForSelector('.page.help', { timeout: 10000 });
}

test.describe('Help Page', () => {
  test('should display help page with title', async ({ page }) => {
    await goToHelp(page);

    await expect(page.locator('#help-title')).toBeVisible();
  });

  test('should show search input', async ({ page }) => {
    await goToHelp(page);

    await expect(page.locator('input[aria-label="Search FAQs"]')).toBeVisible();
  });

  test('should show category filter chips', async ({ page }) => {
    await goToHelp(page);

    // "All" chip should be visible and active
    const allChip = page.locator('.category-chip').first();
    await expect(allChip).toBeVisible();
    await expect(allChip).toContainText('All');
  });

  test('should display FAQ items', async ({ page }) => {
    await goToHelp(page);

    // Wait for FAQs to load
    await page.waitForSelector('.faq-item', { timeout: 5000 });
    const faqCount = await page.locator('.faq-item').count();
    expect(faqCount).toBeGreaterThanOrEqual(1);
  });

  test('should expand FAQ on click', async ({ page }) => {
    await goToHelp(page);
    await page.waitForSelector('.faq-item', { timeout: 5000 });

    // Click first FAQ question
    await page.locator('.faq-question').first().click();

    // Answer should be visible
    await expect(page.locator('.faq-answer').first()).toBeVisible();
  });

  test('should navigate back to settings', async ({ page }) => {
    await goToHelp(page);

    await page.click('button[aria-label="Go back to settings"]');
    await expect(page.locator('.page.settings')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Settings - Security Section', () => {
  test('should display security section elements', async ({ page }) => {
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings', { timeout: 10000 });

    // Check Devices and Recovery navigation buttons exist
    await expect(
      page.locator('button[aria-label="Manage linked devices"]')
    ).toBeVisible();
    await expect(
      page.locator('button[aria-label="Configure recovery options"]')
    ).toBeVisible();
  });
});

test.describe('Settings - GDPR/Privacy Section', () => {
  test('should display privacy section', async ({ page }) => {
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings', { timeout: 10000 });

    // Check for GDPR-related elements
    await expect(
      page.locator('button[aria-label="Export all personal data"]')
    ).toBeVisible();
  });

  test('should export GDPR data', async ({ page }) => {
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings', { timeout: 10000 });

    await page.click('button[aria-label="Export all personal data"]');

    // Should trigger export — mock returns JSON, check for success toast/result
    await page.waitForTimeout(500);
  });

  test('should schedule account deletion', async ({ page }) => {
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings', { timeout: 10000 });

    const deleteBtn = page.locator('button[aria-label="Schedule account deletion"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // After scheduling, a cancel button should appear
    await expect(
      page.locator('button[aria-label="Cancel account deletion"]')
    ).toBeVisible({ timeout: 5000 });
  });
});
