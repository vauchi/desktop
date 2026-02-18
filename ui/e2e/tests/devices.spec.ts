// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect } from '@playwright/test';
import { tauriMockScript } from '../fixtures/tauri-mock';
import { setupTestUser, navigateTo } from '../fixtures/test-helpers';

// CRIT-10a: Devices page coverage

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ content: tauriMockScript() });
  await setupTestUser(page);
});

/** Navigate to Devices page via Settings */
async function goToDevices(page: import('@playwright/test').Page): Promise<void> {
  await navigateTo(page, 'Settings');
  await page.waitForSelector('.page.settings', { timeout: 10000 });
  await page.click('button[aria-label="Manage linked devices"]');
  await page.waitForSelector('.page.devices', { timeout: 10000 });
}

test.describe('Devices Page', () => {
  test('should display devices page with title and device list', async ({ page }) => {
    await goToDevices(page);

    await expect(page.locator('#devices-title')).toBeVisible();
    await expect(page.locator('.devices-list')).toBeVisible();
  });

  test('should show current device in list', async ({ page }) => {
    await goToDevices(page);

    const deviceItem = page.locator('.device-item').first();
    await expect(deviceItem).toBeVisible();
    await expect(deviceItem).toContainText('This device');
  });

  test('should generate device link', async ({ page }) => {
    await goToDevices(page);

    await page.click('button[aria-label="Generate link to add a new device"]');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Dialog should show link data
    await expect(page.locator('[aria-label="Link data preview"]')).toBeVisible();
    // Expiration warning should be visible
    await expect(page.locator('.warning')).toContainText('expires');
  });

  test('should open join device dialog', async ({ page }) => {
    await goToDevices(page);

    await page.click('button[aria-label="Join this device to another account"]');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Dialog should have textarea for link data
    await expect(page.locator('[aria-label="Device link data"]')).toBeVisible();
    // Join button should be disabled when empty
    const joinBtn = page.locator('button[aria-label="Join this device to the account"]');
    await expect(joinBtn).toBeDisabled();
  });

  test('should not show revoke button on current device', async ({ page }) => {
    await goToDevices(page);

    // The current device should not have a revoke button
    const currentDevice = page.locator('.device-item.current');
    await expect(currentDevice).toBeVisible();
    await expect(currentDevice.locator('button.danger')).not.toBeVisible();
  });

  test('should navigate back to home via back button', async ({ page }) => {
    await goToDevices(page);

    await page.click('button[aria-label="Go back to home"]');
    await expect(page.locator('.page.home')).toBeVisible({ timeout: 10000 });
  });

  test('should have bottom navigation', async ({ page }) => {
    await goToDevices(page);

    await expect(page.locator('nav.bottom-nav')).toBeVisible();
    await expect(page.locator('button[aria-label="Go to Home"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Go to Contacts"]')).toBeVisible();
  });
});
